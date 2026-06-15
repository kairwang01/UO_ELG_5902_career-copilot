import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions } from '../lib/firebaseClient';

export interface SubscriptionUpdateResult {
  subscription_status: string;
  credits: number;
  role?: 'candidate' | 'employer' | 'agency';
}

const setSubscriptionStatusCallable = httpsCallable<
  { planKey: string },
  SubscriptionUpdateResult
>(firebaseFunctions, 'setSubscriptionStatus');

export async function setUserSubscription(planKey: string): Promise<SubscriptionUpdateResult> {
  const result = await setSubscriptionStatusCallable({ planKey });
  return result.data;
}
