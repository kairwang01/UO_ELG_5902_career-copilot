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
 * CREDITS POLICY (deliberate): this handler sets subscription_status ONLY. It does
 * NOT grant credits — granting here would let the bypassable dev-mode / pending-plan
 * paths act as a free credit faucet and would reset balances on every sign-in.
 * Plan credits are the future Stripe webhook's responsibility.
 *
 * Frontend integration:
 *   const fn = httpsCallable(getFunctions(), "setSubscriptionStatus");
 *   const { data } = await fn({ planKey });  // → { subscription_status, credits }
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth } from "../middleware/auth";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";

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

export const setSubscriptionStatusFunction = onCall(async (request) => {
  const uid = requireAuth(request);

  const data = request.data as SetSubscriptionStatusRequest;
  const rawKey = typeof data?.planKey === "string" ? data.planKey.trim() : "";

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

  const fullName = cleanName(data?.fullName, 120);
  const companyName = cleanName(data?.companyName, 160);

  const userRef = db.collection(USERS_COLLECTION).doc(uid);

  // Transaction so this can't race the onUserCreated trigger (which may create the
  // doc with the default role:'candidate'). Whichever writer commits first wins the
  // read; the second aborts+retries, re-reads, and takes the no-clobber update path
  // — so a business account can never settle back to role:'candidate'.
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!snap.exists) {
      const doc: Record<string, unknown> = {
        [USER_FIELDS.credits]: INITIAL_CREDITS,
        [USER_FIELDS.role]: audience === "business" ? "employer" : "candidate",
        [USER_FIELDS.subscriptionStatus]: plan,
        [USER_FIELDS.createdAt]: now,
        [USER_FIELDS.updatedAt]: now,
      };
      if (fullName) doc[USER_FIELDS.fullName] = fullName;
      if (audience === "business" && companyName) doc[USER_FIELDS.companyName] = companyName;
      tx.set(userRef, doc);
      return {
        subscription_status: plan,
        credits: INITIAL_CREDITS,
        role: audience === "business" ? "employer" : "candidate",
      };
    }

    const patch: Record<string, unknown> = {
      [USER_FIELDS.subscriptionStatus]: plan,
      [USER_FIELDS.updatedAt]: now,
    };
    if (snap.get(USER_FIELDS.credits) == null) patch[USER_FIELDS.credits] = INITIAL_CREDITS;
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
    const credits: number = snap.get(USER_FIELDS.credits) ?? INITIAL_CREDITS;
    return {
      subscription_status: plan,
      credits,
      role: audience === "business" ? "employer" : snap.get(USER_FIELDS.role),
    };
  });
});
