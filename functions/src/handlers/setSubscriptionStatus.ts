/**
 * setSubscriptionStatus — HTTPS Callable Cloud Function.
 *
 * Sets the caller's users/{uid}.subscription_status to a validated plan key.
 * This is a SERVER-ONLY write: firestore.rules forbids the client from changing
 * subscription_status directly, so this callable (Admin SDK, bypasses rules) is
 * the single authorized path.
 *
 * The four frontend call sites send the plan key in three different shapes
 * (see CareerApp.tsx), so this handler normalizes them:
 *   - "pending_biz_<plan>"  → business plan "<plan>"   (e.g. pending_biz_starter → starter)
 *   - "pending_<plan>"      → candidate plan "<plan>"   (e.g. pending_essentials → essentials)
 *   - "<plan>"              → used as-is (already stripped, or "free", or a dev-mode key)
 *
 * CREDITS POLICY (updated 2026-06-17): selecting a plan now grants that plan's
 * monthly AI-credit allotment (see credits/planCredits.ts) and the balance
 * ACCUMULATES — matching the pricing copy "Unused credits never expire". To stop the
 * bypassable dev-mode / pending-plan paths from acting as a free credit faucet, the
 * grant is applied AT MOST ONCE per calendar month, tracked in a server-only
 * `credit_renewals/{uid}` doc (NOT a field on users/{uid}, which would trip the
 * client firestore.rules validUser allowlist). The grantMonthlyCredits scheduled
 * function applies the same allotment on the 1st of each month thereafter.
 *
 * Frontend integration:
 *   const fn = httpsCallable(getFunctions(), "setSubscriptionStatus");
 *   const { data } = await fn({ planKey });  // → { subscription_status, credits }
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth } from "../middleware/auth";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";
import {
  CREDIT_RENEWALS_COLLECTION,
  currentCreditPeriod,
  monthlyCreditsFor,
} from "../credits/planCredits";
import { ensurePlatformCaches } from "../config/env";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/** Candidate subscription plans (mirror of config.ts ALL_PLANS keys). */
const CANDIDATE_PLANS = new Set(["free", "essentials", "accelerator", "executive"]);

/** Business / employer plans (mirror of businessPlans.ts + legacy add-ons). */
const BUSINESS_PLANS = new Set(["free", "starter", "growth", "pro", "single_post", "job_pack"]);

const INITIAL_CREDITS = 100;

interface SetSubscriptionStatusRequest {
  planKey: string;
  /**
   * Optional profile fields captured at signup. Writing them here (Admin SDK,
   * server-side) is the authoritative, race-free path: the client's own
   * profiles.upsert can be rejected by Firestore rules when it races the
   * onUserCreated trigger (a merge-write on a not-yet-created doc becomes a
   * CREATE that lacks credits/created_at and fails validUser). Setting the
   * name here at doc-creation guarantees it persists.
   */
  fullName?: string;
  companyName?: string;
}

/** Trims and length-caps an optional free-text profile string from the client. */
function cleanName(raw: unknown, maxLen: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

/**
 * Normalizes a raw planKey into a bare plan name, stripping the
 * "pending_" / "pending_biz_" routing prefixes the frontend adds.
 */
function normalizePlanKey(raw: string): { plan: string; audience: "candidate" | "business" } {
  if (raw.startsWith("pending_biz_")) {
    return { plan: raw.slice("pending_biz_".length), audience: "business" };
  }
  if (raw.startsWith("pending_")) {
    return { plan: raw.slice("pending_".length), audience: "candidate" };
  }
  if (raw === "starter" || raw === "growth" || raw === "pro" || raw === "single_post" || raw === "job_pack") {
    return { plan: raw, audience: "business" };
  }
  return { plan: raw, audience: "candidate" };
}

/** Server-only entitlement/intent doc (same collection grantMonthlyCredits gates on).
 *  Clients are denied by firestore.rules; only a real payment (Stripe webhook) or an
 *  admin sets `active: true`. We also park unpaid plan intents here as `pending_plan`. */
const BILLING_COLLECTION = "billing";

/**
 * Explicit, opt-in DEMO/PREVIEW switch (ALLOW_DEMO_GRANTS="true", set ONLY in a
 * demo/staging functions/.env). When on, selecting a paid/business plan activates
 * immediately without payment — but the grant is tagged grant_source:"demo_preview"
 * and NEVER writes billing.active, so it can never masquerade as a real paid
 * subscription. Off (production default): an unpaid privileged selection is held as
 * pending intent and grants nothing. Read at call-time so config/tests can toggle it.
 */
function demoGrantsEnabled(): boolean {
  return process.env.ALLOW_DEMO_GRANTS === "true";
}

export interface SubscriptionSelectionResult {
  status: "active" | "pending_payment";
  subscription_status: string;
  credits: number;
  role: string;
  /** How the activation was authorized — absent on pending. */
  grant_source?: "paid" | "demo_preview" | "self_service";
  /** The plan awaiting payment — present only on pending_payment. */
  pending_plan?: string;
}

/**
 * Applies a plan selection for `uid` (exported for tests; the callable wraps it).
 *
 * PAID-ENTITLEMENT GATE: a "privileged" selection — the employer role and/or a paid
 * monthly credit allotment — only activates when the user has a real billing
 * entitlement (`billing/{uid}.active === true`) OR demo grants are enabled. Otherwise
 * the selection is parked as pending intent and NOTHING is granted (no role flip, no
 * credits). A plain free candidate plan is not privileged and stays self-service.
 * The admin/manual path (adminSetSubscription) is unaffected.
 */
export async function applySubscriptionSelection(
  uid: string,
  rawKeyInput: unknown,
  opts: { fullName?: unknown; companyName?: unknown } = {},
): Promise<SubscriptionSelectionResult> {
  await ensurePlatformCaches();

  const rawKey = typeof rawKeyInput === "string" ? rawKeyInput.trim() : "";
  if (!rawKey) {
    throw new HttpsError("invalid-argument", "planKey is required.");
  }

  const { plan, audience } = normalizePlanKey(rawKey);

  if (
    (audience === "candidate" && !CANDIDATE_PLANS.has(plan)) ||
    (audience === "business" && !BUSINESS_PLANS.has(plan))
  ) {
    throw new HttpsError("invalid-argument", `Unknown plan key: ${rawKey}`);
  }

  const fullName = cleanName(opts.fullName, 120);
  const companyName = cleanName(opts.companyName, 160);

  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const renewalRef = db.collection(CREDIT_RENEWALS_COLLECTION).doc(uid);
  const billingRef = db.collection(BILLING_COLLECTION).doc(uid);

  // This month's allotment for the selected plan (0 for free / add-ons / unknown).
  const period = currentCreditPeriod();
  const monthlyGrant = monthlyCreditsFor(plan);

  // Privileged = grants paid entitlements (employer role and/or paid credits). These
  // must be earned. A free candidate plan is not privileged and needs no entitlement.
  const isPrivileged = audience === "business" || monthlyGrant > 0;
  const demo = demoGrantsEnabled();

  // Transaction so this can't race the onUserCreated trigger (which may create the
  // doc with the default role:'candidate'). Whichever writer commits first wins the
  // read; the second aborts+retries, re-reads, and takes the no-clobber update path
  // — so a business account can never settle back to role:'candidate'.
  return db.runTransaction(async (tx) => {
    // All reads must precede all writes in a Firestore transaction.
    const snap = await tx.get(userRef);
    const renewalSnap = await tx.get(renewalRef);
    const billingSnap = isPrivileged ? await tx.get(billingRef) : null;
    const now = admin.firestore.FieldValue.serverTimestamp();

    const entitled = !!(billingSnap?.exists && billingSnap.get("active") === true);

    // GATE: an unpaid privileged selection (no entitlement, demo off) never activates.
    // Park the intent so a future Stripe webhook can complete it; grant nothing.
    if (isPrivileged && !entitled && !demo) {
      tx.set(
        billingRef,
        {
          pending_plan: plan,
          pending_audience: audience,
          pending_requested_at: now,
          active: false, // only a real payment/admin may ever set this true
        },
        { merge: true },
      );
      if (!snap.exists) {
        const doc: Record<string, unknown> = {
          [USER_FIELDS.credits]: INITIAL_CREDITS,
          [USER_FIELDS.role]: "candidate",
          [USER_FIELDS.subscriptionStatus]: "free",
          [USER_FIELDS.createdAt]: now,
          [USER_FIELDS.updatedAt]: now,
        };
        if (fullName) doc[USER_FIELDS.fullName] = fullName;
        if (companyName) doc[USER_FIELDS.companyName] = companyName;
        tx.set(userRef, doc, { merge: true });
      } else {
        const patch: Record<string, unknown> = { [USER_FIELDS.updatedAt]: now };
        if (fullName && !snap.get(USER_FIELDS.fullName)) patch[USER_FIELDS.fullName] = fullName;
        if (companyName && !snap.get(USER_FIELDS.companyName)) patch[USER_FIELDS.companyName] = companyName;
        tx.set(userRef, patch, { merge: true });
      }
      return {
        status: "pending_payment",
        subscription_status: snap.exists ? (snap.get(USER_FIELDS.subscriptionStatus) ?? "free") : "free",
        credits: snap.exists ? (Number(snap.get(USER_FIELDS.credits)) || 0) : INITIAL_CREDITS,
        role: snap.exists ? (snap.get(USER_FIELDS.role) ?? "candidate") : "candidate",
        pending_plan: plan,
      };
    }

    // ACTIVATION — real entitlement, an explicit demo grant, or a non-privileged free
    // plan. grant_source keeps a demo grant from ever looking like a real paid one.
    const grantSource: "paid" | "demo_preview" | "self_service" =
      !isPrivileged ? "self_service" : entitled ? "paid" : "demo_preview";

    // Grant the plan's monthly credits at most once per calendar month, PLAN-AWARE:
    // pay only the positive difference. A first selection grants the full allotment;
    // an in-month UPGRADE grants (new − already-granted); a downgrade or repeat grants
    // 0. granted_amount is stored as the high-water mark, so toggling plans within a
    // month can never farm credits. (Recurring monthly top-ups are gated off until
    // real billing is wired — see grantMonthlyCredits.)
    const renewalThisPeriod = renewalSnap.exists && renewalSnap.get("period") === period;
    const grantedThisPeriod = renewalThisPeriod ? (Number(renewalSnap.get("granted_amount")) || 0) : 0;
    const deltaGrant = monthlyGrant > 0 ? Math.max(0, monthlyGrant - grantedThisPeriod) : 0;
    const newGrantedAmount = Math.max(monthlyGrant, grantedThisPeriod);

    if (monthlyGrant > 0) {
      tx.set(
        renewalRef,
        { period, plan, granted_amount: newGrantedAmount, granted_at: now, grant_source: grantSource },
        { merge: true },
      );
    }

    if (!snap.exists) {
      const startingCredits = INITIAL_CREDITS + deltaGrant;
      const doc: Record<string, unknown> = {
        [USER_FIELDS.credits]: startingCredits,
        [USER_FIELDS.role]: audience === "business" ? "employer" : "candidate",
        [USER_FIELDS.subscriptionStatus]: plan,
        [USER_FIELDS.createdAt]: now,
        [USER_FIELDS.updatedAt]: now,
      };
      if (fullName) doc[USER_FIELDS.fullName] = fullName;
      if (audience === "business" && companyName) doc[USER_FIELDS.companyName] = companyName;
      tx.set(userRef, doc);
      return {
        status: "active",
        subscription_status: plan,
        credits: startingCredits,
        role: audience === "business" ? "employer" : "candidate",
        grant_source: grantSource,
      };
    }

    const baseCredits: number = snap.get(USER_FIELDS.credits) ?? INITIAL_CREDITS;
    const newCredits = baseCredits + deltaGrant;

    const patch: Record<string, unknown> = {
      [USER_FIELDS.subscriptionStatus]: plan,
      [USER_FIELDS.updatedAt]: now,
    };
    // Always write the (possibly unchanged) balance so a missing field is backfilled
    // and a fresh grant is persisted in the same atomic write.
    patch[USER_FIELDS.credits] = newCredits;
    if (snap.get(USER_FIELDS.createdAt) == null) patch[USER_FIELDS.createdAt] = now;
    if (audience === "business") patch[USER_FIELDS.role] = "employer";
    // Backfill name/org from signup only when the doc doesn't already carry one,
    // so a later plan change can never wipe a name the user has since edited.
    if (fullName && !snap.get(USER_FIELDS.fullName)) patch[USER_FIELDS.fullName] = fullName;
    if (audience === "business" && companyName && !snap.get(USER_FIELDS.companyName)) {
      patch[USER_FIELDS.companyName] = companyName;
    }

    tx.set(userRef, patch, { merge: true });

    // Return the authoritative values so the frontend can sync its local state.
    return {
      status: "active",
      subscription_status: plan,
      credits: newCredits,
      role: audience === "business" ? "employer" : snap.get(USER_FIELDS.role),
      grant_source: grantSource,
    };
  });
}

export const setSubscriptionStatusFunction = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as SetSubscriptionStatusRequest;
  return applySubscriptionSelection(uid, data?.planKey, {
    fullName: data?.fullName,
    companyName: data?.companyName,
  });
});
