import { describe, expect, it } from 'vitest';
import { hasBusinessPortalAccess, normalizeBusinessSubscriptionStatus } from '../lib/access/businessAccess';

describe('business portal access', () => {
  it('allows employer-role accounts', () => {
    expect(hasBusinessPortalAccess('employer', 'free')).toBe(true);
  });

  it('allows candidate-role accounts with a business subscription', () => {
    expect(hasBusinessPortalAccess('candidate', 'starter')).toBe(true);
    expect(hasBusinessPortalAccess('candidate', 'pending_biz_growth')).toBe(true);
  });

  it('does not treat an ordinary free candidate as a business account', () => {
    expect(hasBusinessPortalAccess('candidate', 'free')).toBe(false);
  });

  it('normalizes pending business status prefixes', () => {
    expect(normalizeBusinessSubscriptionStatus('pending_biz_pro')).toBe('pro');
  });
});
