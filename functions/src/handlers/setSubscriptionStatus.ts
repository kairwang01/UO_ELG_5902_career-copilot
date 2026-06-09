/**
 * setSubscriptionStatus — HTTPS Callable Cloud Function.
 *
 * Allows authenticated users to set their own subscription_status via the
 * Firebase Admin SDK (which bypasses Firestore security rules).
 *
 * Why server-side? The Firestore security rules block client writes to
 * subscription_status to prevent self-granting of paid plans. This Cloud
 * Function is the only trusted path for legitimate status updates that
 * originate from the client (e.g., selecting a business plan, dev mode
 * plan switching for testing).
 *
 * In production, paid plan upgrades will be triggered by the Stripe webhook
 * instead. This function covers:
 *   - Business plan selection intent ("pending_biz_*")
 *   - Dev mode plan switching (internal testing only)
 *
 * Frontend usage:
 *   import { getFunctions, httpsCallable } from "firebase/functions";
 *   const fn = httpsCallable(getFunctions(), "setSubscriptionStatus");
 *   await fn({ planKey: "pro" });
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

// Initialise the Admin SDK once (other handlers may have already done this).
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

interface SetSubscriptionStatusRequest {
  /** The plan key to set, e.g. "free", "pro", "pending_biz_startup". */
  planKey: string;
}

// Allowed subscription status values.
// Add new plan keys here as plans are introduced.
const ALLOWED_PLAN_KEYS = new Set([
  // Candidate plans
  "free",
  "essentials",
  "accelerator",
  "executive",
  // Legacy aliases
  "pro",
  "agency",
  // Candidate pending (Stripe not yet confirmed)
  "pending_essentials",
  "pending_accelerator",
  "pending_executive",
  // Business plans (active, set by Stripe webhook or demo bypass)
  "single_post",
  "job_pack",
  // Business plans pending (intent, before Stripe payment)
  "pending_biz_single_post",
  "pending_biz_job_pack",
  // Legacy business pending keys (kept for backward compatibility)
  "pending_biz_startup",
  "pending_biz_growth",
  "pending_biz_enterprise",
  // Dev / testing aliases
  "dev_free",
  "dev_pro",
  "dev_agency",
]);

export const setSubscriptionStatusFunction = onCall(
  { region: "us-central1" },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { planKey } = request.data as SetSubscriptionStatusRequest;

    // 2. Validate input
    if (!planKey || typeof planKey !== "string") {
      throw new HttpsError("invalid-argument", "planKey must be a non-empty string.");
    }

    if (!ALLOWED_PLAN_KEYS.has(planKey)) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid planKey: "${planKey}". Allowed values: ${[...ALLOWED_PLAN_KEYS].join(", ")}.`,
      );
    }

    const uid = request.auth.uid;

    // 3. Update via Admin SDK (bypasses Firestore security rules safely).
    await db.collection("users").doc(uid).update({
      subscription_status: planKey,
      updated_at: FieldValue.serverTimestamp(),
    });

    return { success: true, planKey };
  },
);
