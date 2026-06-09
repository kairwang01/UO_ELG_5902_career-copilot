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
import { checkQuotasOrThrow, logCreditLedger, logUsageEvent } from "../admin/usageLog";
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
  tool: string
): Promise<void> {
  // Guard against an unknown/missing tool cost (e.g. TOOL_CREDIT_COSTS["typo"] === undefined).
  // Without this, `current - undefined` writes NaN to the balance and corrupts the account.
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid credit cost for ${tool}. This is a configuration error.`
    );
  }

  await ensurePlatformCaches();
  await checkQuotasOrThrow(uid, cost, tool);

  const userRef = db.collection(USERS_COLLECTION).doc(uid);

  let attempt = 0;
  let balanceAfter = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await db.runTransaction(async (tx) => {
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
        tx.update(userRef, { [USER_FIELDS.credits]: balanceAfter });
      });

      await logUsageEvent(uid, tool, cost, "deducted");
      await logCreditLedger({
        uid,
        amount: -cost,
        balance_after: balanceAfter,
        reason: "tool_deduction",
        tool,
      });
      return;
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
