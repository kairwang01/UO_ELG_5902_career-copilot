/**
 * Admin portal callables — platform config, quotas, usage reports, user management.
 *
 * Role matrix (enforced server-side — frontend hiding is NOT sufficient):
 *   reviewer : adminGetDashboard, adminGetAuditLog, adminCheckAccess, adminWhoAmI
 *   admin    : + adminGetLlmConfig, adminUpdateLlmConfig, adminGetQuotas,
 *                adminUpdateQuotas, adminListUsers, adminGetUserReport,
 *                adminAdjustCredits, adminSetSubscription, adminGetPrompts,
 *                adminUpdatePrompt, adminResetPrompt, adminListModels,
 *                adminUpsertModel, adminDeleteModel, adminTestModel
 *   super    : + adminSetAdmin (LEGACY, deprecated), adminInviteAdmin,
 *                adminSetAdminRole, adminRemoveAdmin, adminListAdmins
 *
 * Security audit fixes applied (Sprint 3 Phase-0):
 *   A1  CRITICAL  Credit delta capped: |delta| ≤ 5000 per call; daily totals
 *                 ±20000 (operator) / ±100000 (super) via admin_daily_totals.
 *   A2  HIGH      adminSetAdmin now requires 'super' role.
 *   A3  HIGH      adminSetAdmin no longer returns admin_uids list.
 *   A4/A10 HIGH   reason: required, trimmed, minLength 10, maxLength 300.
 *   A6  MEDIUM    typeof uid === 'string' checks on all uid params.
 *   A7  MEDIUM    adminListAdmins now requires 'super' role (env UIDs hidden from admin).
 *   A12 LOW       Dashboard recent_events: uid masked to first 6 chars + '…'.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { isAdminUid } from "../middleware/auth";
import { requireRole, getAdminRole, invalidateAccessCache, AdminEntry, AdminRole } from "../admin/roles";
import {
  CREDIT_LEDGER_COLLECTION,
  PLATFORM_CONFIG_COLLECTION,
  PLATFORM_DOCS,
  USAGE_EVENTS_COLLECTION,
  ADMIN_AUDIT_LOG_COLLECTION,
  QuotasDoc,
  LlmConfigDoc,
} from "../admin/schema";
import {
  ensurePlatformCaches,
  getLlmConfigMasked,
  getQuotasConfigForAdmin,
  refreshPlatformCaches,
} from "../admin/platformConfig";
import { getTodayUsageTotals, logAdminAction, logCreditLedger } from "../admin/usageLog";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";

/** Plan keys an admin may assign (mirror of setSubscriptionStatus / config.ts). */
const CANDIDATE_PLANS = new Set(["free", "essentials", "accelerator", "executive"]);
const BUSINESS_PLANS = new Set(["starter", "growth", "pro", "single_post", "job_pack"]);

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------------------

/**
 * Validates a uid param: must be a non-empty string, trimmed, max 128 chars.
 * Throws HttpsError('invalid-argument') on failure.
 */
function assertUid(uid: unknown, label = "uid"): string {
  if (typeof uid !== "string" || uid.trim().length === 0) {
    throw new HttpsError("invalid-argument", `${label} must be a non-empty string.`);
  }
  const trimmed = uid.trim();
  if (trimmed.length > 128) {
    throw new HttpsError("invalid-argument", `${label} is too long (max 128 chars).`);
  }
  return trimmed;
}

/**
 * Validates a reason param: required, trimmed, min 10, max 300 chars.
 * Throws HttpsError('invalid-argument') on failure.
 * Used by every callable that logs a reason (A4/A10).
 */
function assertReason(reason: unknown): string {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new HttpsError("invalid-argument", "reason is required and must be a non-empty string.");
  }
  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    throw new HttpsError("invalid-argument", "reason must be at least 10 characters.");
  }
  if (trimmed.length > 300) {
    throw new HttpsError("invalid-argument", "reason must not exceed 300 characters.");
  }
  return trimmed;
}

function startOfUtcDaysAgo(days: number): admin.firestore.Timestamp {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return admin.firestore.Timestamp.fromDate(d);
}

/** Returns today's UTC date string as YYYYMMDD, used for daily-total doc ids. */
function utcTodayKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Collection for per-operator daily credit-adjustment totals (A1). */
const ADMIN_DAILY_TOTALS_COLLECTION = "admin_daily_totals";

// ---------------------------------------------------------------------------
// A1: Credit adjustment caps
// ---------------------------------------------------------------------------

const PER_CALL_DELTA_CAP = 5_000;
const DAILY_TOTAL_CAP_ADMIN = 20_000;
const DAILY_TOTAL_CAP_SUPER = 100_000;

/**
 * Checks and records the operator's daily credit-adjustment total.
 * Runs inside a Firestore transaction so concurrent calls are safe.
 * Throws 'resource-exhausted' if the daily cap would be breached.
 */
async function checkAndRecordDailyTotal(
  operatorUid: string,
  operatorRole: AdminRole,
  delta: number
): Promise<void> {
  const dayKey = utcTodayKey();
  const docId = `${operatorUid}_${dayKey}`;
  const ref = db.collection(ADMIN_DAILY_TOTALS_COLLECTION).doc(docId);
  const cap = operatorRole === "super" ? DAILY_TOTAL_CAP_SUPER : DAILY_TOTAL_CAP_ADMIN;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current: number = snap.exists ? (snap.data()?.total ?? 0) : 0;
    const next = current + Math.abs(delta);
    if (next > cap) {
      throw new HttpsError(
        "resource-exhausted",
        `Daily credit-adjustment cap exceeded. Limit: ±${cap} per day.`
      );
    }
    tx.set(ref, { total: next, operator_uid: operatorUid, date: dayKey }, { merge: true });
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Dashboard summary: users, today's usage, 7-day tool breakdown. */
export const adminGetDashboardFunction = onCall({ invoker: "public" }, async (request) => {
  await requireRole(request, "reviewer");

  const usersSnap = await db.collection(USERS_COLLECTION).limit(2000).get();
  const today = await getTodayUsageTotals();

  const weekStart = startOfUtcDaysAgo(7);
  const usageSnap = await db
    .collection(USAGE_EVENTS_COLLECTION)
    .where("created_at", ">=", weekStart)
    .where("status", "==", "deducted")
    .limit(5000)
    .get();

  const byTool: Record<string, { runs: number; credits: number }> = {};
  const byUser: Record<string, number> = {};

  usageSnap.forEach((doc) => {
    const d = doc.data();
    const tool = d.tool as string;
    const cost = d.credit_cost ?? 0;
    const uid = d.uid as string;
    if (!byTool[tool]) byTool[tool] = { runs: 0, credits: 0 };
    byTool[tool].runs += 1;
    byTool[tool].credits += cost;
    byUser[uid] = (byUser[uid] ?? 0) + cost;
  });

  const topUsers = Object.entries(byUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uid, credits_spent]) => ({ uid, credits_spent }));

  const recentSnap = await db
    .collection(USAGE_EVENTS_COLLECTION)
    .orderBy("created_at", "desc")
    .limit(25)
    .get();

  // A12: mask uid to first 6 chars + '…'; explicitly select fields (no spread).
  const recent = recentSnap.docs.map((doc) => {
    const d = doc.data();
    const rawUid = typeof d.uid === "string" ? d.uid : "";
    return {
      id: doc.id,
      uid: rawUid.length > 6 ? rawUid.slice(0, 6) + "…" : rawUid,
      tool: d.tool ?? null,
      credit_cost: d.credit_cost ?? null,
      status: d.status ?? null,
      created_at: d.created_at?.toDate?.()?.toISOString?.() ?? null,
    };
  });

  const quotas = await getQuotasConfigForAdmin();

  return {
    user_count: usersSnap.size,
    users_truncated: usersSnap.size >= 2000,
    today_runs: today.runs,
    today_credits: today.credits,
    week_tool_breakdown: byTool,
    week_usage_truncated: usageSnap.size >= 5000,
    top_users_week: topUsers,
    recent_events: recent,
    quotas,
  };
});

// ---------------------------------------------------------------------------
// LLM Config
// ---------------------------------------------------------------------------

/** Masked LLM config for the settings form. */
export const adminGetLlmConfigFunction = onCall({ invoker: "public" }, async (request) => {
  await requireRole(request, "admin");
  return getLlmConfigMasked();
});

interface UpdateLlmRequest {
  gemini_api_key?: string;
  gemini_model?: string;
  gemini_fallback_model?: string;
  kairllm_api_key?: string;
  kairllm_base_url?: string;
  deepseek_api_key?: string;
  deepseek_base_url?: string;
}

/** Update API keys / models (empty string = leave unchanged). */
export const adminUpdateLlmConfigFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: adminUid } = await requireRole(request, "admin");
  const data = (request.data ?? {}) as UpdateLlmRequest;

  const ref = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.llm);
  const existing = (await ref.get()).data() as LlmConfigDoc | undefined;
  const patch: LlmConfigDoc = {
    gemini_model: data.gemini_model?.trim() || existing?.gemini_model,
    gemini_fallback_model:
      data.gemini_fallback_model?.trim() || existing?.gemini_fallback_model,
    kairllm_base_url: data.kairllm_base_url?.trim() || existing?.kairllm_base_url,
    deepseek_base_url: data.deepseek_base_url?.trim() || existing?.deepseek_base_url,
    updated_at: new Date().toISOString(),
    updated_by: adminUid,
  };

  if (data.gemini_api_key?.trim()) patch.gemini_api_key = data.gemini_api_key.trim();
  if (data.kairllm_api_key?.trim()) patch.kairllm_api_key = data.kairllm_api_key.trim();
  if (data.deepseek_api_key?.trim()) patch.deepseek_api_key = data.deepseek_api_key.trim();

  await ref.set(patch, { merge: true });
  await refreshPlatformCaches();
  await logAdminAction({
    admin_uid: adminUid,
    action: "update_llm_config",
    details: {
      gemini_model: patch.gemini_model ?? null,
      gemini_fallback_model: patch.gemini_fallback_model ?? null,
      kairllm_base_url: patch.kairllm_base_url ?? null,
      deepseek_base_url: patch.deepseek_base_url ?? null,
      gemini_api_key_changed: !!data.gemini_api_key?.trim(),
      kairllm_api_key_changed: !!data.kairllm_api_key?.trim(),
      deepseek_api_key_changed: !!data.deepseek_api_key?.trim(),
    },
  });
  return getLlmConfigMasked();
});

// ---------------------------------------------------------------------------
// Quotas
// ---------------------------------------------------------------------------

/** Get quota settings. */
export const adminGetQuotasFunction = onCall({ invoker: "public" }, async (request) => {
  await requireRole(request, "admin");
  return getQuotasConfigForAdmin();
});

/** Update global / per-user daily limits (0 = unlimited). */
export const adminUpdateQuotasFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: adminUid } = await requireRole(request, "admin");
  const data = (request.data ?? {}) as QuotasDoc;

  const patch: QuotasDoc = {
    daily_tool_run_limit: Number(data.daily_tool_run_limit ?? 0),
    daily_credit_spend_limit: Number(data.daily_credit_spend_limit ?? 0),
    per_user_daily_credit_limit: Number(data.per_user_daily_credit_limit ?? 0),
    enabled: data.enabled !== false,
    updated_at: new Date().toISOString(),
    updated_by: adminUid,
  };

  // free_max_output_tokens: optional positive int, 256–32768.
  if (data.free_max_output_tokens !== undefined && data.free_max_output_tokens !== null) {
    const v = Number(data.free_max_output_tokens);
    if (!Number.isInteger(v) || v < 256 || v > 32768) {
      throw new HttpsError(
        "invalid-argument",
        "free_max_output_tokens must be an integer between 256 and 32768."
      );
    }
    patch.free_max_output_tokens = v;
  }

  // Mock-interview gate: which tier may run the simulation (post-MVP decision knob).
  if (data.mi_min_tier !== undefined && data.mi_min_tier !== null) {
    if (data.mi_min_tier !== "free" && data.mi_min_tier !== "paid") {
      throw new HttpsError("invalid-argument", 'mi_min_tier must be "free" or "paid".');
    }
    patch.mi_min_tier = data.mi_min_tier;
  }
  // Report unlock price for non-included tiers (0 = free unlock).
  if (data.mi_report_unlock_credits !== undefined && data.mi_report_unlock_credits !== null) {
    const v = Number(data.mi_report_unlock_credits);
    if (!Number.isInteger(v) || v < 0 || v > 100000) {
      throw new HttpsError(
        "invalid-argument",
        "mi_report_unlock_credits must be an integer between 0 and 100000."
      );
    }
    patch.mi_report_unlock_credits = v;
  }

  await db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.quotas).set(patch, { merge: true });
  await refreshPlatformCaches();
  await logAdminAction({
    admin_uid: adminUid,
    action: "update_quotas",
    details: patch as unknown as Record<string, unknown>,
  });
  return getQuotasConfigForAdmin();
});

// ---------------------------------------------------------------------------
// User listing and reports
// ---------------------------------------------------------------------------

interface ListUsersRequest {
  limit?: number;
  start_after_uid?: string;
}

/** Paginated user list for the admin table. */
export const adminListUsersFunction = onCall({ invoker: "public" }, async (request) => {
  await requireRole(request, "admin");
  const { limit = 50, start_after_uid } = (request.data ?? {}) as ListUsersRequest;
  const pageSize = Math.min(Math.max(limit, 1), 100);

  let q = db.collection(USERS_COLLECTION).orderBy(USER_FIELDS.createdAt, "desc").limit(pageSize);
  if (start_after_uid) {
    const cursor = await db.collection(USERS_COLLECTION).doc(start_after_uid).get();
    if (cursor.exists) q = q.startAfter(cursor);
  }

  const snap = await q.get();
  return {
    users: snap.docs.map((doc) => {
      const d = doc.data();
      return {
        uid: doc.id,
        full_name: d.full_name ?? null,
        role: d.role ?? null,
        subscription_status: d.subscription_status ?? null,
        credits: d.credits ?? 0,
        created_at: d.created_at ?? null,
        updated_at: d.updated_at ?? null,
      };
    }),
    next_cursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1].id : null,
  };
});

interface UserReportRequest {
  uid: string;
}

/** Per-user usage report (7-day events + credit ledger). */
export const adminGetUserReportFunction = onCall({ invoker: "public" }, async (request) => {
  await requireRole(request, "admin");
  const rawData = (request.data ?? {}) as UserReportRequest;
  // A6: explicit string type-check
  const uid = assertUid(rawData.uid);

  const userSnap = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!userSnap.exists) throw new HttpsError("not-found", "User not found.");

  const weekStart = startOfUtcDaysAgo(7);
  const [usageSnap, ledgerSnap] = await Promise.all([
    db
      .collection(USAGE_EVENTS_COLLECTION)
      .where("uid", "==", uid)
      .where("created_at", ">=", weekStart)
      .limit(200)
      .get(),
    db
      .collection(CREDIT_LEDGER_COLLECTION)
      .where("uid", "==", uid)
      .limit(50)
      .get(),
  ]);

  const byTool: Record<string, number> = {};
  usageSnap.forEach((doc) => {
    const tool = doc.data().tool as string;
    byTool[tool] = (byTool[tool] ?? 0) + 1;
  });

  let authInfo: {
    email: string | null;
    email_verified: boolean;
    disabled: boolean;
    display_name: string | null;
    auth_created_at: string | null;
    last_sign_in: string | null;
  } | null = null;
  try {
    const authUser = await admin.auth().getUser(uid);
    authInfo = {
      email: authUser.email ?? null,
      email_verified: authUser.emailVerified,
      disabled: authUser.disabled,
      display_name: authUser.displayName ?? null,
      auth_created_at: authUser.metadata.creationTime ?? null,
      last_sign_in: authUser.metadata.lastSignInTime ?? null,
    };
  } catch {
    // User exists in Firestore but not in Auth (edge case) — leave authInfo null.
  }

  const docData = userSnap.data() ?? {};
  return {
    profile: { uid, ...docData, email: authInfo?.email ?? docData.email ?? null },
    auth: authInfo,
    week_runs: usageSnap.size,
    week_by_tool: byTool,
    usage_events: usageSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString?.() ?? null,
    })),
    credit_ledger: ledgerSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString?.() ?? null,
    })),
  };
});

// ---------------------------------------------------------------------------
// Credit adjustment — A1/A4/A6
// ---------------------------------------------------------------------------

interface AdjustCreditsRequest {
  uid: string;
  delta: number;
  reason: string;
}

/** Add or remove credits with audit trail. */
export const adminAdjustCreditsFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: adminUid, role: adminRole } = await requireRole(request, "admin");
  const rawData = (request.data ?? {}) as AdjustCreditsRequest;

  // A6: explicit string check
  const uid = assertUid(rawData.uid);
  const { delta } = rawData;

  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
    throw new HttpsError("invalid-argument", "delta must be a non-zero finite number.");
  }

  // A1: per-call delta cap
  if (Math.abs(delta) > PER_CALL_DELTA_CAP) {
    throw new HttpsError(
      "invalid-argument",
      `|delta| must not exceed ${PER_CALL_DELTA_CAP} per call.`
    );
  }

  // A4/A10: reason required, trimmed, min/max length
  const reason = assertReason(rawData.reason);

  // A1: check + record daily total cap (transaction)
  await checkAndRecordDailyTotal(adminUid, adminRole, delta);

  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  let beforeCredits = 0;
  let afterCredits = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError("not-found", "User not found.");
    beforeCredits = snap.get(USER_FIELDS.credits) ?? 0;
    afterCredits = beforeCredits + delta;
    if (afterCredits < 0) {
      throw new HttpsError("failed-precondition", "Adjustment would make credits negative.");
    }
    tx.update(userRef, {
      [USER_FIELDS.credits]: afterCredits,
      [USER_FIELDS.updatedAt]: new Date().toISOString(),
    });
  });

  await logCreditLedger({
    uid,
    amount: delta,
    balance_after: afterCredits,
    reason,
    admin_uid: adminUid,
  });
  await logAdminAction({
    admin_uid: adminUid,
    action: "adjust_credits",
    target_uid: uid,
    details: {
      operatorUid: adminUid,
      operatorRole: adminRole,
      targetUid: uid,
      delta,
      beforeCredits,
      afterCredits,
      reason,
      createdAt: new Date().toISOString(),
    },
  });

  return { uid, credits: afterCredits };
});

// ---------------------------------------------------------------------------
// Subscription management
// ---------------------------------------------------------------------------

interface SetSubscriptionRequest {
  uid: string;
  subscription_status: string;
}

/** Set a user's subscription tier (admin override). */
export const adminSetSubscriptionFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: adminUid } = await requireRole(request, "admin");
  const rawData = (request.data ?? {}) as SetSubscriptionRequest;
  // A6: explicit string check
  const uid = assertUid(rawData.uid);
  if (typeof rawData.subscription_status !== "string") {
    throw new HttpsError("invalid-argument", "subscription_status must be a string.");
  }
  const plan = rawData.subscription_status.trim();
  if (!CANDIDATE_PLANS.has(plan) && !BUSINESS_PLANS.has(plan)) {
    throw new HttpsError("invalid-argument", `Unknown plan: ${plan}`);
  }

  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "User not found.");
  const previous = snap.get(USER_FIELDS.subscriptionStatus) ?? null;

  const patch: Record<string, unknown> = {
    [USER_FIELDS.subscriptionStatus]: plan,
    [USER_FIELDS.updatedAt]: new Date().toISOString(),
  };
  if (BUSINESS_PLANS.has(plan)) patch[USER_FIELDS.role] = "employer";

  await userRef.update(patch);
  await logAdminAction({
    admin_uid: adminUid,
    action: "set_subscription",
    target_uid: uid,
    details: { from: previous, to: plan },
  });

  return { uid, subscription_status: plan };
});

// ---------------------------------------------------------------------------
// Admin management — LEGACY set_admin (super-only, A2)
// ---------------------------------------------------------------------------

interface SetAdminRequest {
  uid?: string;
  email?: string;
  makeAdmin: boolean;
}

/**
 * Grant or revoke legacy admin access (platform_config/access.admin_uids + custom claim).
 * Now requires 'super' role (A2). Does NOT return admin_uids list (A3).
 *
 * @deprecated Prefer adminInviteAdmin / adminSetAdminRole / adminRemoveAdmin.
 */
export const adminSetAdminFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: callerUid } = await requireRole(request, "super");
  const { uid: rawUid, email, makeAdmin } = (request.data ?? {}) as SetAdminRequest;
  if (typeof makeAdmin !== "boolean") {
    throw new HttpsError("invalid-argument", "makeAdmin (boolean) is required.");
  }

  // Resolve target uid from an explicit uid or an email lookup.
  let targetUid = (rawUid ?? "").trim();
  let targetEmail: string | undefined;
  if (!targetUid && email?.trim()) {
    try {
      const u = await admin.auth().getUserByEmail(email.trim());
      targetUid = u.uid;
      targetEmail = u.email ?? undefined;
    } catch {
      throw new HttpsError("not-found", `No Auth user with email ${email}.`);
    }
  }
  if (!targetUid) throw new HttpsError("invalid-argument", "uid or email is required.");
  // A6
  assertUid(targetUid, "uid");

  // Prevent super from demoting/disabling themselves
  if (targetUid === callerUid && !makeAdmin) {
    throw new HttpsError("failed-precondition", "You cannot revoke your own admin access.");
  }

  let existingClaims: Record<string, unknown> = {};
  try {
    const u = await admin.auth().getUser(targetUid);
    targetEmail = targetEmail ?? u.email ?? undefined;
    existingClaims = (u.customClaims ?? {}) as Record<string, unknown>;
  } catch {
    throw new HttpsError("not-found", "Target user not found in Auth.");
  }

  const accessRef = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.access);
  const accessSnap = await accessRef.get();
  const currentUids: string[] = accessSnap.data()?.admin_uids ?? [];
  const set = new Set(currentUids);

  if (makeAdmin) {
    set.add(targetUid);
  } else {
    set.delete(targetUid);
    if (set.size === 0) {
      throw new HttpsError("failed-precondition", "Cannot remove the last admin.");
    }
  }
  const nextUids = Array.from(set);

  await accessRef.set(
    { admin_uids: nextUids, updated_at: new Date().toISOString(), updated_by: callerUid },
    { merge: true }
  );
  await admin.auth().setCustomUserClaims(targetUid, { ...existingClaims, admin: makeAdmin });
  invalidateAccessCache();

  await logAdminAction({
    admin_uid: callerUid,
    action: "set_admin",
    target_uid: targetUid,
    details: { makeAdmin, email: targetEmail ?? null },
  });

  // A3: do NOT return admin_uids list
  return { uid: targetUid, email: targetEmail ?? null, admin: makeAdmin };
});

// ---------------------------------------------------------------------------
// New RBAC admin management callables (super-only)
// ---------------------------------------------------------------------------

interface InviteAdminRequest {
  email: string;
  role: "admin" | "reviewer";
}

/**
 * Invite a registered user as an admin or reviewer by email.
 * The user must already have a Firebase Auth account — they cannot be invited
 * before signing up ("ask them to register first" on not-found).
 * Super-only.
 */
export const adminInviteAdminFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: callerUid } = await requireRole(request, "super");
  const { email: rawEmail, role } = (request.data ?? {}) as InviteAdminRequest;

  if (typeof rawEmail !== "string" || rawEmail.trim().length === 0) {
    throw new HttpsError("invalid-argument", "email must be a non-empty string.");
  }
  const email = rawEmail.trim();
  if (email.length > 254) {
    throw new HttpsError("invalid-argument", "email is too long.");
  }
  if (role !== "admin" && role !== "reviewer") {
    throw new HttpsError("invalid-argument", "role must be 'admin' or 'reviewer'.");
  }

  // Resolve Auth user — require them to already have an account.
  let targetUid: string;
  let targetEmail: string | undefined;
  try {
    const u = await admin.auth().getUserByEmail(email);
    targetUid = u.uid;
    targetEmail = u.email ?? email;
  } catch {
    throw new HttpsError(
      "not-found",
      `No Firebase Auth account found for ${email}. Ask them to register first.`
    );
  }

  const invitedAt = new Date().toISOString();
  const entry: AdminEntry = {
    role,
    email: targetEmail ?? null,
    invited_by: callerUid,
    invited_at: invitedAt,
    status: "active",
  };

  const accessRef = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.access);
  await accessRef.set(
    {
      admins: { [targetUid]: entry },
      updated_at: invitedAt,
      updated_by: callerUid,
    },
    { merge: true }
  );

  // Set custom claim for fast-path checks
  const existingUser = await admin.auth().getUser(targetUid);
  const existingClaims = (existingUser.customClaims ?? {}) as Record<string, unknown>;
  await admin.auth().setCustomUserClaims(targetUid, { ...existingClaims, admin: true });
  invalidateAccessCache();

  await logAdminAction({
    admin_uid: callerUid,
    action: "invite_admin",
    target_uid: targetUid,
    details: { email: targetEmail ?? null, role, invited_at: invitedAt },
  });

  return {
    uid: targetUid,
    email: targetEmail ?? null,
    role,
    status: "active",
    invited_at: invitedAt,
  };
});

interface SetAdminRoleRequest {
  uid: string;
  role: AdminRole;
}

/**
 * Change the role of an existing admin/reviewer entry.
 * Super-only. A super cannot change their own role.
 */
export const adminSetAdminRoleFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: callerUid } = await requireRole(request, "super");
  const rawData = (request.data ?? {}) as SetAdminRoleRequest;
  const targetUid = assertUid(rawData.uid);
  const { role } = rawData;

  if (role !== "super" && role !== "admin" && role !== "reviewer") {
    throw new HttpsError("invalid-argument", "role must be 'super', 'admin', or 'reviewer'.");
  }
  if (targetUid === callerUid) {
    throw new HttpsError("failed-precondition", "You cannot change your own role.");
  }

  const accessRef = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.access);
  const accessSnap = await accessRef.get();
  const adminsMap: Record<string, AdminEntry> = accessSnap.data()?.admins ?? {};

  if (!adminsMap[targetUid]) {
    throw new HttpsError("not-found", "Admin entry not found. Use adminInviteAdmin to add them first.");
  }

  adminsMap[targetUid] = { ...adminsMap[targetUid], role };

  await accessRef.set(
    { admins: { [targetUid]: adminsMap[targetUid] }, updated_at: new Date().toISOString(), updated_by: callerUid },
    { merge: true }
  );
  invalidateAccessCache();

  await logAdminAction({
    admin_uid: callerUid,
    action: "set_admin_role",
    target_uid: targetUid,
    details: { role },
  });

  return { uid: targetUid, role, status: adminsMap[targetUid].status };
});

interface RemoveAdminRequest {
  uid: string;
}

/**
 * Disable (soft-delete) an admin/reviewer entry (status → 'disabled').
 * Super-only. A super cannot remove themselves.
 */
export const adminRemoveAdminFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: callerUid } = await requireRole(request, "super");
  const rawData = (request.data ?? {}) as RemoveAdminRequest;
  const targetUid = assertUid(rawData.uid);

  if (targetUid === callerUid) {
    throw new HttpsError("failed-precondition", "You cannot remove your own admin access.");
  }

  const accessRef = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.access);
  const accessSnap = await accessRef.get();
  const adminsMap: Record<string, AdminEntry> = accessSnap.data()?.admins ?? {};

  if (!adminsMap[targetUid]) {
    throw new HttpsError("not-found", "Admin entry not found.");
  }

  adminsMap[targetUid] = { ...adminsMap[targetUid], status: "disabled" };

  await accessRef.set(
    { admins: { [targetUid]: adminsMap[targetUid] }, updated_at: new Date().toISOString(), updated_by: callerUid },
    { merge: true }
  );

  // Revoke custom claim
  try {
    const u = await admin.auth().getUser(targetUid);
    const existing = (u.customClaims ?? {}) as Record<string, unknown>;
    await admin.auth().setCustomUserClaims(targetUid, { ...existing, admin: false });
    // Also revoke refresh tokens for immediate effect (partial A8 mitigation)
    await admin.auth().revokeRefreshTokens(targetUid);
  } catch {
    // Non-fatal: entry is already disabled in the access doc
  }
  invalidateAccessCache();

  await logAdminAction({
    admin_uid: callerUid,
    action: "remove_admin",
    target_uid: targetUid,
    details: { status: "disabled" },
  });

  return { uid: targetUid, status: "disabled" };
});

/**
 * List active admin/reviewer entries.
 * Super-only (A7: env UIDs must not be exposed to plain admins).
 * Returns minimal fields only (A3).
 */
export const adminListAdminsFunction = onCall({ invoker: "public" }, async (request) => {
  await requireRole(request, "super");

  const accessSnap = await db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.access).get();
  const adminsMap: Record<string, AdminEntry> = accessSnap.data()?.admins ?? {};
  const legacyDocUids: string[] = accessSnap.data()?.admin_uids ?? [];
  const envUids = (process.env.ADMIN_UIDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // New RBAC entries
  const rbacAdmins = await Promise.all(
    Object.entries(adminsMap).map(async ([uid, entry]) => {
      return {
        uid,
        email: entry.email ?? null,
        role: entry.role,
        status: entry.status,
        invited_at: entry.invited_at ?? null,
        source: "rbac" as const,
      };
    })
  );

  // Legacy doc entries (not already in RBAC map)
  const legacyAdmins = await Promise.all(
    legacyDocUids
      .filter((uid) => !adminsMap[uid])
      .map(async (uid) => {
        try {
          const u = await admin.auth().getUser(uid);
          return { uid, email: u.email ?? null, role: "admin" as AdminRole, status: "active" as const, invited_at: null, source: "legacy_doc" as const };
        } catch {
          return { uid, email: null, role: "admin" as AdminRole, status: "active" as const, invited_at: null, source: "legacy_doc" as const };
        }
      })
  );

  // Env bootstrap entries (super-only visibility, A7)
  const envAdmins = await Promise.all(
    envUids
      .filter((uid) => !adminsMap[uid] && !legacyDocUids.includes(uid))
      .map(async (uid) => {
        try {
          const u = await admin.auth().getUser(uid);
          return { uid, email: u.email ?? null, role: "super" as AdminRole, status: "active" as const, invited_at: null, source: "env" as const };
        } catch {
          return { uid, email: null, role: "super" as AdminRole, status: "active" as const, invited_at: null, source: "env" as const };
        }
      })
  );

  return { admins: [...rbacAdmins, ...legacyAdmins, ...envAdmins] };
});

// ---------------------------------------------------------------------------
// Utility callables
// ---------------------------------------------------------------------------

/** Check if the signed-in user has admin access (for UI gate). */
export const adminCheckAccessFunction = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) return { admin: false };
  const uid = request.auth.uid;
  const ok = await isAdminUid(uid, request.auth.token as Record<string, unknown> | undefined);
  return { admin: ok, uid };
});

/**
 * Returns the caller's admin role.
 * Any valid admin role (reviewer, admin, super) can call this.
 * Used by the admin UI to render role-gated sections.
 */
export const adminWhoAmIFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid, role } = await requireRole(request, "reviewer");
  return { uid, role };
});

export interface AuditLogEntry {
  id: string;
  admin_uid: string;
  action: string;
  target_uid: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
}

/** Recent admin audit log (last 100 entries, newest first). */
export const adminGetAuditLogFunction = onCall({ invoker: "public" }, async (request) => {
  await requireRole(request, "reviewer");

  const snap = await db
    .collection(ADMIN_AUDIT_LOG_COLLECTION)
    .orderBy("created_at", "desc")
    .limit(100)
    .get();

  const entries: AuditLogEntry[] = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      admin_uid: d.admin_uid as string,
      action: d.action as string,
      target_uid: (d.target_uid as string | null) ?? null,
      details: (d.details as Record<string, unknown>) ?? {},
      created_at: d.created_at?.toDate?.()?.toISOString?.() ?? null,
    };
  });

  return { entries };
});
