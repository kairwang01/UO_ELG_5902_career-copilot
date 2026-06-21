/**
 * planCredits — authoritative map of subscription plan → monthly AI credit grant.
 *
 * MODEL (decided 2026-06-17): paid plans grant their allotment EVERY month and the
 * balance ACCUMULATES (unused credits never expire — matches the pricing-page copy
 * "Unused credits never expire"). The grant is applied:
 *   1. immediately when a user selects/changes a plan (setSubscriptionStatus), and
 *   2. once per calendar month thereafter by the grantMonthlyCredits scheduled fn.
 *
 * Idempotency is tracked OUTSIDE the users/{uid} doc — in a server-only
 * `credit_renewals/{uid}` doc — so we never add a field to users/{uid} that the
 * client-side firestore.rules `validUser` allowlist would reject on the next
 * profile update.
 *
 * The numbers mirror the frontend pricing copy (localization en.json + marketing/
 * config/pricingPlans.ts). If a plan's advertised credits change, update BOTH.
 *
 *   Candidate:  essentials 200 · accelerator 750 · executive 2000  ($15/$30/$50 mo)
 *   Business:   starter 3000 · growth 8000 · pro 20000             ($79/$199/$499 mo)
 *
 * `free` is intentionally 0 here: the free tier is a ONE-TIME 100-credit grant at
 * signup (onUserCreated), not a recurring monthly allotment. The one-time add-on
 * SKUs (single_post, job_pack) are job-posting purchases, NOT AI credits, so they
 * grant nothing here.
 */

/** Recurring monthly AI-credit allotment per plan key (bare key, prefixes stripped). */
export const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  free: 0,
  // candidate
  essentials: 200,
  accelerator: 750,
  executive: 2000,
  // business (employer)
  starter: 3000,
  growth: 8000,
  pro: 20000,
  // one-time add-ons grant no recurring AI credits
  single_post: 0,
  job_pack: 0,
};

/** Monthly allotment for a plan, 0 if the plan grants no recurring credits. */
export function monthlyCreditsFor(plan: string): number {
  return PLAN_MONTHLY_CREDITS[plan] ?? 0;
}

/** Current grant period as "YYYY-MM" (UTC). One grant per plan per period. */
export function currentCreditPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Server-only collection tracking the last monthly grant per user. */
export const CREDIT_RENEWALS_COLLECTION = "credit_renewals";
