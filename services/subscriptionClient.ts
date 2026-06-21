import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions } from '../lib/firebaseClient';

export interface SubscriptionUpdateResult {
  status?: 'active' | 'pending_payment';
  subscription_status: string;
  credits: number;
  role?: 'candidate' | 'employer' | 'agency';
  pending_plan?: string;
  grant_source?: 'paid' | 'demo_preview' | 'self_service';
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
}

const setSubscriptionStatusCallable = httpsCallable<
  { planKey: string; fullName?: string; companyName?: string },
  SubscriptionUpdateResult
>(firebaseFunctions, 'setSubscriptionStatus');

const createCheckoutSessionCallable = httpsCallable<
  { planKey: string },
  CheckoutSessionResult
>(firebaseFunctions, 'createCheckoutSession');

const confirmSimulatedCheckoutCallable = httpsCallable<
  { planKey: string },
  SubscriptionUpdateResult
>(firebaseFunctions, 'confirmSimulatedCheckout');

/**
 * Sets the caller's subscription_status via the server-only callable.
 *
 * Pass `profile` at signup to have the name/organization written server-side
 * at the same time the user doc is created — this is race-free, unlike a
 * separate client profiles.upsert, which Firestore rules can reject when it
 * runs before the doc exists.
 */
export async function setUserSubscription(
  planKey: string,
  profile?: { fullName?: string; companyName?: string },
): Promise<SubscriptionUpdateResult> {
  const result = await setSubscriptionStatusCallable({ planKey, ...(profile ?? {}) });
  return result.data;
}

export async function createSubscriptionCheckout(planKey: string): Promise<CheckoutSessionResult> {
  const result = await createCheckoutSessionCallable({ planKey });
  return result.data;
}

/**
 * Confirms a SIMULATED (demo/test) checkout — only works when the backend has
 * BILLING_SIMULATION enabled. Runs the same entitlement activation a real Stripe
 * webhook would, so the resulting plan/role/credits are identical.
 */
export async function confirmSimulatedCheckout(planKey: string): Promise<SubscriptionUpdateResult> {
  const result = await confirmSimulatedCheckoutCallable({ planKey });
  return result.data;
}
