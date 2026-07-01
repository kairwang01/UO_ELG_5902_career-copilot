export const CANDIDATE_SUBSCRIPTION_PLANS = ['free', 'essentials', 'accelerator', 'executive'] as const;
export const EMPLOYER_SUBSCRIPTION_PLANS = ['free', 'starter', 'growth', 'pro', 'single_post', 'job_pack'] as const;
export const AGENCY_SUBSCRIPTION_PLANS = ['free'] as const;

export function subscriptionPlansForRole(role?: string | null): readonly string[] {
  if (role === 'candidate') return CANDIDATE_SUBSCRIPTION_PLANS;
  if (role === 'employer') return EMPLOYER_SUBSCRIPTION_PLANS;
  if (role === 'agency') return AGENCY_SUBSCRIPTION_PLANS;
  return ['free'];
}
