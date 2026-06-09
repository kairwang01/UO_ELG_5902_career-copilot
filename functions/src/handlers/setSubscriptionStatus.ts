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
 *   - "pending_biz_<plan>"  → business plan "<plan>"   (e.g. pending_biz_single_post → single_post)
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

/** Business / employer plans (mirror of config.ts BUSINESS_PLANS keys). */
const BUSINESS_PLANS = new Set(["single_post", "job_pack"]);

interface SetSubscriptionStatusRequest {
  planKey: string;
}

/**
 * Normalizes a raw planKey into a bare plan name, stripping the
 * "pending_" / "pending_biz_" routing prefixes the frontend adds.
 */
function normalizePlanKey(raw: string): string {
  if (raw.startsWith("pending_biz_")) return raw.slice("pending_biz_".length);
  if (raw.startsWith("pending_")) return raw.slice("pending_".length);
  return raw;
}

export const setSubscriptionStatusFunction = onCall(async (request) => {
  const uid = requireAuth(request);

  const data = request.data as SetSubscriptionStatusRequest;
  const rawKey = typeof data?.planKey === "string" ? data.planKey.trim() : "";

  if (!rawKey) {
    throw new HttpsError("invalid-argument", "planKey is required.");
  }

  const plan = normalizePlanKey(rawKey);

  if (!CANDIDATE_PLANS.has(plan) && !BUSINESS_PLANS.has(plan)) {
    throw new HttpsError("invalid-argument", `Unknown plan key: ${rawKey}`);
  }

  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    throw new HttpsError(
      "not-found",
      "User profile not found. Please sign out and sign back in."
    );
  }

  await userRef.set(
    {
      [USER_FIELDS.subscriptionStatus]: plan,
      [USER_FIELDS.updatedAt]: new Date().toISOString(),
    },
    { merge: true }
  );

  // Return the authoritative values so the frontend can sync its local state.
  const credits: number = snap.get(USER_FIELDS.credits) ?? 0;
  return { subscription_status: plan, credits };
});
