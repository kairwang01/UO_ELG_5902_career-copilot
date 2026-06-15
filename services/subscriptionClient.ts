import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions } from '../lib/firebaseClient';

export interface SubscriptionUpdateResult {
  subscription_status: string;
  credits: number;
  role?: 'candidate' | 'employer' | 'agency';
}

const setSubscriptionStatusCallable = httpsCallable<
  { planKey: string; fullName?: string; companyName?: string },
  SubscriptionUpdateResult
>(firebaseFunctions, 'setSubscriptionStatus');

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
