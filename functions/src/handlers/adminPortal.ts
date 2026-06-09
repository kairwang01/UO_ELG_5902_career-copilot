/**
 * Admin portal callables — platform config, quotas, usage reports, user management.
 * All endpoints require admin access (see middleware/auth.ts requireAdmin).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { isAdminUid, requireAdmin } from "../middleware/auth";
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
const BUSINESS_PLANS = new Set(["single_post", "job_pack"]);

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function startOfUtcDaysAgo(days: number): admin.firestore.Timestamp {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return admin.firestore.Timestamp.fromDate(d);
}

/** Dashboard summary: users, today's usage, 7-day tool breakdown. */
export const adminGetDashboardFunction = onCall({ invoker: "public" }, async (request) => {
  await requireAdmin(request);

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

  const recent = recentSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    created_at: doc.data().created_at?.toDate?.()?.toISOString?.() ?? null,
  }));

  const quotas = await getQuotasConfigForAdmin();

  return {
    user_count: usersSnap.size,
    // Surface read caps so the admin knows when the dashboard aggregates are partial.
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

/** Masked LLM config for the settings form. */
export const adminGetLlmConfigFunction = onCall({ invoker: "public" }, async (request) => {
  await requireAdmin(request);
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
  const adminUid = await requireAdmin(request);
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
      // NEVER log raw keys — only whether they were rotated.
      gemini_api_key_changed: !!data.gemini_api_key?.trim(),
      kairllm_api_key_changed: !!data.kairllm_api_key?.trim(),
      deepseek_api_key_changed: !!data.deepseek_api_key?.trim(),
    },
  });
  return getLlmConfigMasked();
});

/** Get quota settings. */
export const adminGetQuotasFunction = onCall({ invoker: "public" }, async (request) => {
  await requireAdmin(request);
  return getQuotasConfigForAdmin();
});

/** Update global / per-user daily limits (0 = unlimited). */
export const adminUpdateQuotasFunction = onCall({ invoker: "public" }, async (request) => {
  const adminUid = await requireAdmin(request);
  const data = (request.data ?? {}) as QuotasDoc;

  const patch: QuotasDoc = {
    daily_tool_run_limit: Number(data.daily_tool_run_limit ?? 0),
    daily_credit_spend_limit: Number(data.daily_credit_spend_limit ?? 0),
    per_user_daily_credit_limit: Number(data.per_user_daily_credit_limit ?? 0),
    enabled: data.enabled !== false,
    updated_at: new Date().toISOString(),
    updated_by: adminUid,
  };

  await db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.quotas).set(patch, { merge: true });
  await refreshPlatformCaches();
  await logAdminAction({
    admin_uid: adminUid,
    action: "update_quotas",
    details: patch as unknown as Record<string, unknown>,
  });
  return getQuotasConfigForAdmin();
});

interface ListUsersRequest {
  limit?: number;
  start_after_uid?: string;
}

/** Paginated user list for the admin table. */
export const adminListUsersFunction = onCall({ invoker: "public" }, async (request) => {
  await requireAdmin(request);
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
  await requireAdmin(request);
  const { uid } = (request.data ?? {}) as UserReportRequest;
  if (!uid) throw new HttpsError("invalid-argument", "uid is required.");

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

  // Email + auth metadata live in Firebase Auth, not the Firestore user doc — fetch
  // them so the admin sees the real address even when the doc has no email field.
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

interface AdjustCreditsRequest {
  uid: string;
  delta: number;
  reason?: string;
}

/** Add or remove credits with audit trail. */
export const adminAdjustCreditsFunction = onCall({ invoker: "public" }, async (request) => {
  const adminUid = await requireAdmin(request);
  const { uid, delta, reason } = (request.data ?? {}) as AdjustCreditsRequest;

  if (!uid || typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
    throw new HttpsError("invalid-argument", "uid and non-zero numeric delta are required.");
  }

  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  let balanceAfter = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError("not-found", "User not found.");
    const current = snap.get(USER_FIELDS.credits) ?? 0;
    balanceAfter = current + delta;
    if (balanceAfter < 0) {
      throw new HttpsError("failed-precondition", "Adjustment would make credits negative.");
    }
    tx.update(userRef, {
      [USER_FIELDS.credits]: balanceAfter,
      [USER_FIELDS.updatedAt]: new Date().toISOString(),
    });
  });

  await logCreditLedger({
    uid,
    amount: delta,
    balance_after: balanceAfter,
    reason: reason || "admin_adjustment",
    admin_uid: adminUid,
  });
  await logAdminAction({
    admin_uid: adminUid,
    action: "adjust_credits",
    target_uid: uid,
    details: { delta, balance_after: balanceAfter, reason: reason || "admin_adjustment" },
  });

  return { uid, credits: balanceAfter };
});

interface SetSubscriptionRequest {
  uid: string;
  subscription_status: string;
}

/** Set a user's subscription tier (admin override). Does NOT grant credits — use
 *  adminAdjustCredits for that, same policy as setSubscriptionStatus. */
export const adminSetSubscriptionFunction = onCall({ invoker: "public" }, async (request) => {
  const adminUid = await requireAdmin(request);
  const { uid, subscription_status } = (request.data ?? {}) as SetSubscriptionRequest;
  if (!uid || typeof subscription_status !== "string") {
    throw new HttpsError("invalid-argument", "uid and subscription_status are required.");
  }
  const plan = subscription_status.trim();
  if (!CANDIDATE_PLANS.has(plan) && !BUSINESS_PLANS.has(plan)) {
    throw new HttpsError("invalid-argument", `Unknown plan: ${plan}`);
  }

  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "User not found.");
  const previous = snap.get(USER_FIELDS.subscriptionStatus) ?? null;

  await userRef.update({
    [USER_FIELDS.subscriptionStatus]: plan,
    [USER_FIELDS.updatedAt]: new Date().toISOString(),
  });
  await logAdminAction({
    admin_uid: adminUid,
    action: "set_subscription",
    target_uid: uid,
    details: { from: previous, to: plan },
  });

  return { uid, subscription_status: plan };
});

interface SetAdminRequest {
  uid?: string;
  email?: string;
  makeAdmin: boolean;
}

/** Grant or revoke admin access (platform_config/access.admin_uids + custom claim). */
export const adminSetAdminFunction = onCall({ invoker: "public" }, async (request) => {
  const adminUid = await requireAdmin(request);
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

  // Confirm the target exists in Auth (and capture email/claims).
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
    { admin_uids: nextUids, updated_at: new Date().toISOString(), updated_by: adminUid },
    { merge: true }
  );
  // Sync the custom claim so the gate is fast; the access-doc check above already
  // takes effect immediately even before the target's token refreshes.
  await admin.auth().setCustomUserClaims(targetUid, { ...existingClaims, admin: makeAdmin });

  await logAdminAction({
    admin_uid: adminUid,
    action: "set_admin",
    target_uid: targetUid,
    details: { makeAdmin, email: targetEmail ?? null },
  });

  return { uid: targetUid, email: targetEmail ?? null, admin: makeAdmin, admin_uids: nextUids };
});

/** List current admins (access doc + ADMIN_UIDS env bootstrap), emails resolved from Auth. */
export const adminListAdminsFunction = onCall({ invoker: "public" }, async (request) => {
  await requireAdmin(request);
  const accessSnap = await db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.access).get();
  const docUids: string[] = accessSnap.data()?.admin_uids ?? [];
  const envUids = (process.env.ADMIN_UIDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Merge both sources; access-doc entries win (they are portal-managed / revocable).
  const sources = new Map<string, "env" | "doc">();
  envUids.forEach((uid) => sources.set(uid, "env"));
  docUids.forEach((uid) => sources.set(uid, "doc"));

  const admins = await Promise.all(
    Array.from(sources.entries()).map(async ([uid, source]) => {
      try {
        const u = await admin.auth().getUser(uid);
        return { uid, email: u.email ?? null, display_name: u.displayName ?? null, source };
      } catch {
        return { uid, email: null, display_name: null, source };
      }
    })
  );
  return { admins };
});

/** Check if the signed-in user has admin access (for UI gate). */
export const adminCheckAccessFunction = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) return { admin: false };
  const uid = request.auth.uid;
  const ok = await isAdminUid(uid, request.auth.token as Record<string, unknown> | undefined);
  return { admin: ok, uid };
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
  await requireAdmin(request);

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
