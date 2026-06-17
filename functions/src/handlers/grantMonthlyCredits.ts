/**
 * grantMonthlyCredits — scheduled Cloud Function (runs 00:10 UTC on the 1st of
 * each month).
 *
 * Tops up every PAID subscriber's balance by their plan's monthly AI-credit
 * allotment (credits/planCredits.ts). Balances accumulate — unused credits never
 * expire — matching the pricing-page promise.
 *
 * Idempotency: each user's last grant period lives in a server-only
 * `credit_renewals/{uid}` doc. A user is topped up only when that period differs
 * from the current "YYYY-MM", so a retried or doubly-fired schedule can never
 * double-grant. setSubscriptionStatus stamps the same doc when a plan is selected,
 * so a brand-new subscriber is not granted twice in their first month.
 *
 * Free / add-on plans have a 0 allotment and are skipped.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";
import {
  CREDIT_RENEWALS_COLLECTION,
  PLAN_MONTHLY_CREDITS,
  currentCreditPeriod,
  monthlyCreditsFor,
} from "../credits/planCredits";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/** Plan keys that carry a recurring (>0) monthly allotment. */
const PAID_PLANS = Object.keys(PLAN_MONTHLY_CREDITS).filter(
  (p) => PLAN_MONTHLY_CREDITS[p] > 0,
);

export const grantMonthlyCreditsFunction = onSchedule(
  { schedule: "10 0 1 * *", timeZone: "UTC", timeoutSeconds: 540, memory: "256MiB" },
  async () => {
    const period = currentCreditPeriod();
    let granted = 0;
    let skipped = 0;

    // Firestore `in` accepts up to 30 values; PAID_PLANS is well under that.
    const snap = await db
      .collection(USERS_COLLECTION)
      .where(USER_FIELDS.subscriptionStatus, "in", PAID_PLANS)
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
      try {
        const did = await db.runTransaction(async (tx) => {
          const renewalSnap = await tx.get(renewalRef);
          if (renewalSnap.exists && renewalSnap.get("period") === period) {
            return false; // already granted this month
          }
          const now = admin.firestore.FieldValue.serverTimestamp();
          tx.set(userDoc.ref, { [USER_FIELDS.credits]: admin.firestore.FieldValue.increment(monthlyGrant), [USER_FIELDS.updatedAt]: now }, { merge: true });
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
