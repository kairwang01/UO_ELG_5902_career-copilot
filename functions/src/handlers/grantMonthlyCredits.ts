/**
 * grantMonthlyCredits — scheduled Cloud Function (runs 00:10 UTC on the 1st of
 * each month).
 *
 * Tops up every PAID subscriber's balance by their plan's monthly AI-credit
 * allotment (credits/planCredits.ts). Balances accumulate — unused credits never
 * expire — matching the pricing-page promise.
 *
 * ENTITLEMENT GATE (decision 2026-06-17): a recurring top-up is granted ONLY to
 * users with an active billing entitlement (`billing/{uid}.active === true`),
 * which is written exclusively by a real payment (the future Stripe webhook) or
 * an admin — NEVER by self-service plan selection. Until billing is wired, no
 * entitlement exists, so this scheduled grant tops up nobody: the recurring
 * free-credit faucet is OFF. (Self-service grant-on-select still runs in
 * setSubscriptionStatus for the demo; that one is plan-aware and un-farmable.)
 *
 * Idempotency: each user's last grant period lives in a server-only
 * `credit_renewals/{uid}` doc. A user is topped up only when that period differs
 * from the current "YYYY-MM", so a retried or doubly-fired schedule can never
 * double-grant.
 *
 * Free / add-on plans have a 0 allotment and are skipped.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";
import {
  CREDIT_RENEWALS_COLLECTION,
  currentCreditPeriod,
  monthlyCreditsFor,
} from "../credits/planCredits";
import { PLAN_KEYS } from "../admin/quotaDefaults";
import { ensurePlatformCaches } from "../config/env";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/** Server-only entitlement collection — written ONLY by a real payment (Stripe
 *  webhook) or an admin, never by the client. Gates recurring credit grants. */
const BILLING_COLLECTION = "billing";

export const grantMonthlyCreditsFunction = onSchedule(
  { schedule: "10 0 1 * *", timeZone: "UTC", timeoutSeconds: 540, memory: "256MiB" },
  async () => {
    await ensurePlatformCaches();
    const period = currentCreditPeriod();
    let granted = 0;
    let skipped = 0;

    // Firestore `in` accepts up to 30 values; PAID_PLANS is well under that.
    const snap = await db
      .collection(USERS_COLLECTION)
      .where(USER_FIELDS.subscriptionStatus, "in", PLAN_KEYS)
      .get();

    for (const userDoc of snap.docs) {
      const uid = userDoc.id;
      const plan = userDoc.get(USER_FIELDS.subscriptionStatus) as string;
      const monthlyGrant = monthlyCreditsFor(plan);
      if (monthlyGrant <= 0) {
        skipped++;
        continue;
      }
      const renewalRef = db.collection(CREDIT_RENEWALS_COLLECTION).doc(uid);
      const billingRef = db.collection(BILLING_COLLECTION).doc(uid);
      try {
        const did = await db.runTransaction(async (tx) => {
          const renewalSnap = await tx.get(renewalRef);
          const billingSnap = await tx.get(billingRef);
          // Gate: only a real, server-written billing entitlement earns a recurring
          // top-up. No entitlement (today's state, pre-Stripe) → grant nobody.
          if (!(billingSnap.exists && billingSnap.get("active") === true)) {
            return false;
          }
          if (renewalSnap.exists && renewalSnap.get("period") === period) {
            return false; // already granted this month
          }
          const now = FieldValue.serverTimestamp();
          tx.set(userDoc.ref, { [USER_FIELDS.credits]: FieldValue.increment(monthlyGrant), [USER_FIELDS.updatedAt]: now }, { merge: true });
          tx.set(renewalRef, { period, plan, granted_amount: monthlyGrant, granted_at: now }, { merge: true });
          return true;
        });
        if (did) granted++;
        else skipped++;
      } catch (err) {
        logger.error(`grantMonthlyCredits: failed for users/${uid}`, err);
      }
    }

    logger.info(`grantMonthlyCredits ${period}: granted ${granted}, skipped ${skipped}, scanned ${snap.size}`);
  },
);
