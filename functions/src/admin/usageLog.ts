/**
 * Usage + credit ledger — written server-side from deductCredits / admin actions.
 */

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  ADMIN_AUDIT_LOG_COLLECTION,
  CREDIT_LEDGER_COLLECTION,
  USAGE_COUNTERS_COLLECTION,
  USAGE_EVENTS_COLLECTION,
  UsageEventDoc,
} from "./schema";
import { HttpsError } from "firebase-functions/v2/https";
import { ensurePlatformCaches, getPlanQuota, getQuotasConfig, getToolQuota } from "./platformConfig";
import { tierFromSubscription, isBusinessUser } from "../llm/models";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";
import { normalizePlanKey } from "./quotaDefaults";

/**
 * Default daily tool-run cap for free-tier users (次数限制).
 * Applies only to users whose tier resolves to "free" AND who are not
 * business users. Runtime enforcement uses the admin-configurable plan quota;
 * this exported value is only the default used by tests and fallbacks.
 */
export const FREE_TIER_DAILY_RUN_LIMIT = 10;

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function utcDayStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function utcDayKey(date = new Date()): string {
  return utcDayStart(date).toISOString().slice(0, 10);
}

function globalUsageCounterId(dayKey: string): string {
  return `global_${dayKey}`;
}

function userUsageCounterId(uid: string, dayKey: string): string {
  return `user_${Buffer.from(uid).toString("base64url")}_${dayKey}`;
}

function counterTotals(data: admin.firestore.DocumentData | undefined): { runs: number; credits: number } {
  return {
    runs: Number(data?.runs ?? 0),
    credits: Number(data?.credits ?? 0),
  };
}

async function scanTodayUsageTotals(): Promise<{ runs: number; credits: number }> {
  const dayStartTs = Timestamp.fromDate(utcDayStart());
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

async function scanUserTodayUsage(uid: string): Promise<{ runs: number; credits: number }> {
  const dayStartTs = Timestamp.fromDate(utcDayStart());
  const snap = await db
    .collection(USAGE_EVENTS_COLLECTION)
    .where("uid", "==", uid)
    .where("created_at", ">=", dayStartTs)
    .where("status", "==", "deducted")
    .get();
  let credits = 0;
  snap.forEach((doc) => { credits += doc.data().credit_cost ?? 0; });
  return { runs: snap.size, credits };
}

export async function getTodayUsageTotals(): Promise<{ runs: number; credits: number }> {
  const dayKey = utcDayKey();
  const doc = await db.collection(USAGE_COUNTERS_COLLECTION).doc(globalUsageCounterId(dayKey)).get();
  if (doc.exists) return counterTotals(doc.data());
  return scanTodayUsageTotals();
}

export async function getUserTodayUsage(uid: string): Promise<{ runs: number; credits: number }> {
  const dayKey = utcDayKey();
  const doc = await db.collection(USAGE_COUNTERS_COLLECTION).doc(userUsageCounterId(uid, dayKey)).get();
  if (doc.exists) return counterTotals(doc.data());
  return scanUserTodayUsage(uid);
}

export async function getUserTodayCredits(uid: string): Promise<number> {
  return (await getUserTodayUsage(uid)).credits;
}

/** Returns the number of successful tool runs the user has made today (UTC). */
export async function getUserTodayRuns(uid: string): Promise<number> {
  return (await getUserTodayUsage(uid)).runs;
}

export function writeUsageCounters(
  tx: admin.firestore.Transaction,
  uid: string,
  creditCost: number,
  dayKey = utcDayKey()
): void {
  const updatedAt = FieldValue.serverTimestamp();
  const delta = {
    runs: FieldValue.increment(1),
    credits: FieldValue.increment(creditCost),
    updated_at: updatedAt,
  };
  tx.set(
    db.collection(USAGE_COUNTERS_COLLECTION).doc(globalUsageCounterId(dayKey)),
    {
      day_key: dayKey,
      scope: "global",
      ...delta,
    },
    { merge: true }
  );
  tx.set(
    db.collection(USAGE_COUNTERS_COLLECTION).doc(userUsageCounterId(uid, dayKey)),
    {
      day_key: dayKey,
      scope: "user",
      uid,
      ...delta,
    },
    { merge: true }
  );
}

export async function logUsageEvent(
  uid: string,
  tool: string,
  creditCost: number,
  status: "deducted" | "refunded"
): Promise<void> {
  const payload: Omit<UsageEventDoc, "created_at"> & { created_at: FieldValue } = {
    uid,
    tool,
    credit_cost: creditCost,
    status,
    day_key: utcDayKey(),
    request_id: null,
    created_at: FieldValue.serverTimestamp(),
  };
  await db.collection(USAGE_EVENTS_COLLECTION).add(payload);
}

/**
 * Records an uncharged tool call for admin VOLUME visibility only.
 *
 * Unlike recordFreeToolRun, this deliberately does NOT (a) enforce any quota
 * (checkQuotasOrThrow) or (b) bump usage counters — so it can never throw
 * resource-exhausted and never inflates the run counter the free-tier cap reads.
 * It is therefore invisible to the user's experience: zero behavior change, just an
 * observability breadcrumb. Best-effort and non-throwing — a logging failure must
 * never break the tool it instruments.
 */
export async function recordObservedToolRun(uid: string, tool: string): Promise<void> {
  try {
    await db.collection(USAGE_EVENTS_COLLECTION).add({
      uid,
      tool,
      credit_cost: 0,
      status: "observed",
      day_key: utcDayKey(),
      request_id: null,
      balance_after: null,
      created_at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("recordObservedToolRun failed", { uid, tool, err });
  }
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
    created_at: FieldValue.serverTimestamp(),
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
    created_at: FieldValue.serverTimestamp(),
  });
}

export async function checkQuotasOrThrow(uid: string, cost: number, tool: string): Promise<void> {
  await ensurePlatformCaches();
  const quotas = getQuotasConfig();
  const enforceLimits = quotas.enabled !== false;

  // Run these reads in parallel for performance.
  const [totals, userUsage, userSnap] = await Promise.all([
    getTodayUsageTotals(),
    getUserTodayUsage(uid),
    admin.firestore().collection(USERS_COLLECTION).doc(uid).get(),
  ]);

  // --- Platform-wide guards (admin-configurable) ---
  const runLimit = quotas.daily_tool_run_limit ?? 0;
  const creditLimit = quotas.daily_credit_spend_limit ?? 0;
  const userLimit = quotas.per_user_daily_credit_limit ?? 0;

  if (enforceLimits && runLimit > 0 && totals.runs >= runLimit) {
    throw new HttpsError("resource-exhausted", "Platform daily analysis limit reached. Try again tomorrow.");
  }
  if (enforceLimits && creditLimit > 0 && totals.credits + cost > creditLimit) {
    throw new HttpsError("resource-exhausted", "Platform daily credit spend limit reached.");
  }
  if (enforceLimits && userLimit > 0 && userUsage.credits + cost > userLimit) {
    throw new HttpsError("resource-exhausted", "Your daily usage limit has been reached.");
  }

  // --- Per-plan/user-visible tool guards (admin-configurable) ---
  const subscriptionStatus = userSnap.get(USER_FIELDS.subscriptionStatus) as string | undefined;
  const role = userSnap.get(USER_FIELDS.role) as string | undefined;
  const tier = tierFromSubscription(subscriptionStatus);
  const business = isBusinessUser(role, subscriptionStatus);
  const planKey = normalizePlanKey(subscriptionStatus);

  const toolQuota = getToolQuota(tool);
  if (toolQuota) {
    if (!toolQuota.enabled) {
      throw new HttpsError("failed-precondition", "This tool is temporarily unavailable.");
    }
    if (!toolQuota.allowed_plans.includes(planKey)) {
      throw new HttpsError("permission-denied", "Your current plan does not include this tool.");
    }
  }

  // Default-compatible behavior: the free candidate cap is plan-configured.
  // Business users with role-based access keep their historical exemption unless
  // they hold a business subscription plan with its own configured cap.
  const planQuota = getPlanQuota(planKey);
  const shouldApplyPlanRunLimit = planKey !== "free" || (tier === "free" && !business);
  if (enforceLimits && shouldApplyPlanRunLimit && planQuota.daily_run_limit > 0) {
    if (userUsage.runs >= planQuota.daily_run_limit) {
      throw new HttpsError(
        "resource-exhausted",
        `You have reached your daily limit of ${planQuota.daily_run_limit} tool runs. ` +
          "Upgrade your plan for higher limits, or try again tomorrow."
      );
    }
  }

  if (enforceLimits && planQuota.daily_credit_limit > 0 && userUsage.credits + cost > planQuota.daily_credit_limit) {
    throw new HttpsError("resource-exhausted", "Your plan's daily credit limit has been reached.");
  }
}
