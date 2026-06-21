/**
 * deductCredits — atomic Firestore credit deduction.
 *
 * This is the M9 core: a Firestore transaction that reads the user's credit
 * balance, rejects the request if insufficient, and writes the new balance —
 * all atomically. The LLM is only called AFTER this commits.
 *
 * Design guarantees:
 *  - Atomic: no partial deductions. Either the full cost is deducted or nothing.
 *  - Un-bypassable: runs server-side inside a Cloud Function; the client cannot skip it.
 *  - Concurrency-safe: Firestore transactions auto-retry on contention.
 *    A bounded retry cap prevents infinite loops under pathological load.
 *  - Single write target: users/{uid}.credits — one document per user,
 *    so per-user contention is low (M9's 100-concurrent target is across users).
 *
 * When Xiaoyi delivers the real schema:
 *  - Update USERS_COLLECTION and USER_FIELDS in schema.ts ONLY.
 *  - This file does not change.
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { ensurePlatformCaches } from "../config/env";
import {
  checkQuotasOrThrow,
  logCreditLedger,
  logUsageEvent,
  utcDayKey,
  writeUsageCounters,
} from "../admin/usageLog";
import { CREDIT_LEDGER_COLLECTION, USAGE_EVENTS_COLLECTION } from "../admin/schema";
import { USERS_COLLECTION, USER_FIELDS } from "./schema";

// Initialise the Admin SDK once (idempotent — safe to call multiple times).
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Maximum number of transaction retries before surfacing a hard error.
 * Firestore retries automatically on contention; this cap prevents
 * runaway retries under extreme load.
 */
const MAX_RETRIES = 3;

export interface DeductCreditsOptions {
  /**
   * Optional client-generated idempotency key. When present, the same uid +
   * requestId can create at most one deducted usage event and one balance change.
   */
  requestId?: string;
}

export interface DeductCreditsResult {
  charged: boolean;
  duplicate: boolean;
  balanceAfter: number;
  usageEventId?: string;
}

function normalizeRequestId(requestId: string | undefined): string | undefined {
  if (requestId === undefined || requestId === null || requestId === "") return undefined;
  if (
    typeof requestId !== "string" ||
    requestId.length < 8 ||
    requestId.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(requestId)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid requestId. It must be 8-128 URL-safe characters."
    );
  }
  return requestId;
}

function requestDocPart(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function usageEventRef(uid: string, requestId: string | undefined): admin.firestore.DocumentReference {
  if (!requestId) return db.collection(USAGE_EVENTS_COLLECTION).doc();
  return db.collection(USAGE_EVENTS_COLLECTION).doc(`req_${requestDocPart(uid)}_${requestDocPart(requestId)}`);
}

/**
 * Atomically deducts `cost` credits from `users/{uid}`.
 *
 * @param uid   - Firebase Auth user ID.
 * @param cost  - Number of credits to deduct (must be > 0).
 * @param tool  - Tool name for error messages (e.g. "resume-analysis").
 *
 * @throws HttpsError("failed-precondition") — insufficient credits.
 * @throws HttpsError("not-found")           — user document does not exist.
 * @throws HttpsError("resource-exhausted")  — too many concurrent requests; retry.
 * @throws HttpsError("internal")            — unexpected error.
 */
export async function deductCredits(
  uid: string,
  cost: number,
  tool: string,
  options: DeductCreditsOptions = {}
): Promise<DeductCreditsResult> {
  // Guard against an unknown/missing tool cost (e.g. TOOL_CREDIT_COSTS["typo"] === undefined).
  // Without this, `current - undefined` writes NaN to the balance and corrupts the account.
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid credit cost for ${tool}. This is a configuration error.`
    );
  }

  await ensurePlatformCaches();

  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const requestId = normalizeRequestId(options.requestId);
  const eventRef = usageEventRef(uid, requestId);

  if (requestId) {
    const existing = await eventRef.get();
    if (existing.exists) {
      const data = existing.data() ?? {};
      return {
        charged: false,
        duplicate: true,
        balanceAfter: Number(data.balance_after ?? 0),
        usageEventId: eventRef.id,
      };
    }
  }

  await checkQuotasOrThrow(uid, cost, tool);

  let attempt = 0;
  let balanceAfter = 0;
  let duplicate = false;

  while (attempt < MAX_RETRIES) {
    try {
      await db.runTransaction(async (tx) => {
        const existing = requestId ? await tx.get(eventRef) : null;
        if (existing?.exists) {
          const data = existing.data() ?? {};
          duplicate = true;
          balanceAfter = Number(data.balance_after ?? 0);
          return;
        }

        const snap = await tx.get(userRef);

        if (!snap.exists) {
          throw new HttpsError(
            "not-found",
            `User profile not found. Please sign out and sign back in.`
          );
        }

        const current: number = snap.get(USER_FIELDS.credits) ?? 0;

        if (current < cost) {
          throw new HttpsError(
            "failed-precondition",
            `Insufficient credits for ${tool}. ` +
              `Required: ${cost}, available: ${current}. ` +
              `Please purchase more credits.`
          );
        }

        balanceAfter = current - cost;
        const dayKey = utcDayKey();
        tx.update(userRef, { [USER_FIELDS.credits]: balanceAfter });
        tx.set(eventRef, {
          uid,
          tool,
          credit_cost: cost,
          status: "deducted",
          day_key: dayKey,
          request_id: requestId ?? null,
          balance_after: balanceAfter,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        writeUsageCounters(tx, uid, cost, dayKey);
        tx.set(db.collection(CREDIT_LEDGER_COLLECTION).doc(), {
          uid,
          amount: -cost,
          balance_after: balanceAfter,
          reason: "tool_deduction",
          tool,
          request_id: requestId ?? null,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      return {
        charged: !duplicate,
        duplicate,
        balanceAfter,
        usageEventId: eventRef.id,
      };
    } catch (err) {
      // Re-throw our own HttpsErrors immediately — no retry needed.
      if (err instanceof HttpsError) throw err;

      attempt++;

      if (attempt >= MAX_RETRIES) {
        console.error(`deductCredits: all ${MAX_RETRIES} attempts failed`, {
          uid,
          cost,
          tool,
          err,
        });
        throw new HttpsError(
          "resource-exhausted",
          "Too many concurrent requests. Please try again in a moment."
        );
      }

      // Brief back-off before retry (exponential: 50ms, 100ms, 200ms …)
      await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt - 1)));
    }
  }

  throw new HttpsError(
    "resource-exhausted",
    "Too many concurrent requests. Please try again in a moment."
  );
}

export interface RecordFreeRunResult {
  counted: boolean;
  duplicate: boolean;
}

/**
 * Meters a FREE AI tool run (credit_cost 0). Free helpers (creditKey:null in the tool
 * registry) don't deduct credits, but they must still (a) count toward the free-tier
 * daily run cap — otherwise they are an unbounded free-LLM faucet — and (b) leave a
 * usage event + counter so ALL AI usage is observable. Mirrors deductCredits'
 * idempotency (same uid+requestId records the run at most once) without touching the
 * credit balance or the ledger.
 *
 * @throws HttpsError("resource-exhausted") — free-tier daily run cap reached.
 */
export async function recordFreeToolRun(
  uid: string,
  tool: string,
  options: DeductCreditsOptions = {}
): Promise<RecordFreeRunResult> {
  await ensurePlatformCaches();

  const requestId = normalizeRequestId(options.requestId);
  const eventRef = usageEventRef(uid, requestId);

  if (requestId) {
    const existing = await eventRef.get();
    if (existing.exists) {
      return { counted: false, duplicate: true };
    }
  }

  // Enforce the daily run cap BEFORE running. cost 0 → the credit-spend guards are
  // inert, but the per-user run count (which free runs now increment) is what bites.
  await checkQuotasOrThrow(uid, 0, tool);

  let duplicate = false;
  await db.runTransaction(async (tx) => {
    if (requestId) {
      const existing = await tx.get(eventRef);
      if (existing.exists) {
        duplicate = true;
        return;
      }
    }
    const dayKey = utcDayKey();
    tx.set(eventRef, {
      uid,
      tool,
      credit_cost: 0,
      status: "free",
      day_key: dayKey,
      request_id: requestId ?? null,
      balance_after: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Increment runs (+1) and credits (+0): the run counter is what the free-tier
    // cap reads, so a free run consumes one of the day's allowance.
    writeUsageCounters(tx, uid, 0, dayKey);
  });

  return { counted: !duplicate, duplicate };
}

/**
 * Refunds `amount` credits to `users/{uid}` — used to reverse a deduction when the
 * downstream LLM call fails AFTER credits were already taken. Best-effort and
 * non-throwing: a failed refund is logged, never surfaced (the caller is already
 * handling the original error).
 */
export async function refundCredits(uid: string, amount: number): Promise<void> {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return;

  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  try {
    let balanceAfter = 0;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return;
      const current: number = snap.get(USER_FIELDS.credits) ?? 0;
      balanceAfter = current + amount;
      tx.update(userRef, { [USER_FIELDS.credits]: balanceAfter });
    });
    await logUsageEvent(uid, "refund", amount, "refunded");
    await logCreditLedger({
      uid,
      amount,
      balance_after: balanceAfter,
      reason: "tool_refund",
    });
  } catch (err) {
    console.error("refundCredits failed", { uid, amount, err });
  }
}
