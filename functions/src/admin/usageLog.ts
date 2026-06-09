/**
 * Usage + credit ledger — written server-side from deductCredits / admin actions.
 */

import * as admin from "firebase-admin";
import {
  ADMIN_AUDIT_LOG_COLLECTION,
  CREDIT_LEDGER_COLLECTION,
  USAGE_EVENTS_COLLECTION,
  UsageEventDoc,
} from "./schema";
import { HttpsError } from "firebase-functions/v2/https";
import { ensurePlatformCaches, getQuotasConfig } from "./platformConfig";
import { tierFromSubscription, isBusinessUser } from "../llm/models";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";

/**
 * Daily tool-run cap for free-tier users (次数限制).
 * Applies only to users whose tier resolves to "free" AND who are not
 * business users. Tune this constant to adjust the limit without touching logic.
 */
export const FREE_TIER_DAILY_RUN_LIMIT = 25;

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function utcDayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getTodayUsageTotals(): Promise<{ runs: number; credits: number }> {
  const dayStartTs = admin.firestore.Timestamp.fromDate(utcDayStart());
  const snap = await db
    .collection(USAGE_EVENTS_COLLECTION)
    .where("created_at", ">=", dayStartTs)
    .where("status", "==", "deducted")
    .get();
  let runs = 0;
  let credits = 0;
  snap.forEach((doc) => {
    runs += 1;
    credits += doc.data().credit_cost ?? 0;
  });
  return { runs, credits };
}

export async function getUserTodayCredits(uid: string): Promise<number> {
  const dayStartTs = admin.firestore.Timestamp.fromDate(utcDayStart());
  const snap = await db
    .collection(USAGE_EVENTS_COLLECTION)
    .where("uid", "==", uid)
    .where("created_at", ">=", dayStartTs)
    .where("status", "==", "deducted")
    .get();
  let credits = 0;
  snap.forEach((doc) => { credits += doc.data().credit_cost ?? 0; });
  return credits;
}

/** Returns the number of successful tool runs the user has made today (UTC). */
export async function getUserTodayRuns(uid: string): Promise<number> {
  const dayStartTs = admin.firestore.Timestamp.fromDate(utcDayStart());
  const snap = await db
    .collection(USAGE_EVENTS_COLLECTION)
    .where("uid", "==", uid)
    .where("created_at", ">=", dayStartTs)
    .where("status", "==", "deducted")
    .get();
  return snap.size;
}

export async function logUsageEvent(
  uid: string,
  tool: string,
  creditCost: number,
  status: "deducted" | "refunded"
): Promise<void> {
  const payload: Omit<UsageEventDoc, "created_at"> & { created_at: admin.firestore.FieldValue } = {
    uid,
    tool,
    credit_cost: creditCost,
    status,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection(USAGE_EVENTS_COLLECTION).add(payload);
}

export async function logCreditLedger(entry: {
  uid: string;
  amount: number;
  balance_after: number;
  reason: string;
  tool?: string;
  admin_uid?: string;
}): Promise<void> {
  await db.collection(CREDIT_LEDGER_COLLECTION).add({
    ...entry,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Append-only admin audit trail. Every admin mutation (credit adjust, tier
 * change, admin grant/revoke, LLM/quota config) writes one entry here. Never log
 * raw secrets — pass only "_changed" booleans for keys.
 */
export async function logAdminAction(entry: {
  admin_uid: string;
  action: string;
  target_uid?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await db.collection(ADMIN_AUDIT_LOG_COLLECTION).add({
    admin_uid: entry.admin_uid,
    action: entry.action,
    target_uid: entry.target_uid ?? null,
    details: entry.details ?? {},
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function checkQuotasOrThrow(uid: string, cost: number, tool: string): Promise<void> {
  await ensurePlatformCaches();
  const quotas = getQuotasConfig();
  if (quotas.enabled === false) return;

  // Run these reads in parallel for performance.
  const [totals, userCredits, userRuns, userSnap] = await Promise.all([
    getTodayUsageTotals(),
    getUserTodayCredits(uid),
    getUserTodayRuns(uid),
    admin.firestore().collection(USERS_COLLECTION).doc(uid).get(),
  ]);

  // --- Platform-wide guards (admin-configurable) ---
  const runLimit = quotas.daily_tool_run_limit ?? 0;
  const creditLimit = quotas.daily_credit_spend_limit ?? 0;
  const userLimit = quotas.per_user_daily_credit_limit ?? 0;

  if (runLimit > 0 && totals.runs >= runLimit) {
    throw new HttpsError("resource-exhausted", "Platform daily analysis limit reached. Try again tomorrow.");
  }
  if (creditLimit > 0 && totals.credits + cost > creditLimit) {
    throw new HttpsError("resource-exhausted", "Platform daily credit spend limit reached.");
  }
  if (userLimit > 0 && userCredits + cost > userLimit) {
    throw new HttpsError("resource-exhausted", "Your daily usage limit has been reached.");
  }

  // --- Free-tier daily run cap (次数限制) ---
  // Applied to free users who are not business users. Business users (employer
  // role / biz subscription) and paid subscribers are exempt.
  const subscriptionStatus = userSnap.get(USER_FIELDS.subscriptionStatus) as string | undefined;
  const role = userSnap.get(USER_FIELDS.role) as string | undefined;
  const tier = tierFromSubscription(subscriptionStatus);
  const business = isBusinessUser(role, subscriptionStatus);

  if (tier === "free" && !business) {
    if (userRuns >= FREE_TIER_DAILY_RUN_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        `You have reached your daily limit of ${FREE_TIER_DAILY_RUN_LIMIT} free tool runs. ` +
          "Upgrade to a paid plan for unlimited access, or try again tomorrow."
      );
    }
  }
}
