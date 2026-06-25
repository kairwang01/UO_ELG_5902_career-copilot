export const BUSINESS_PORTAL_STATUSES = new Set(['starter', 'growth', 'pro', 'single_post', 'job_pack']);

export function normalizeBusinessSubscriptionStatus(status?: string | null): string {
  return (status ?? '').replace(/^pending_biz_/, '');
}

export function isPendingBusinessSubscriptionStatus(status?: string | null): boolean {
  return (status ?? '').startsWith('pending_biz_');
}

export function hasBusinessPortalAccess(role?: string | null, subscriptionStatus?: string | null): boolean {
  if (role === 'employer') return true;
  if (isPendingBusinessSubscriptionStatus(subscriptionStatus)) return false;
  return BUSINESS_PORTAL_STATUSES.has(subscriptionStatus ?? '');
}
