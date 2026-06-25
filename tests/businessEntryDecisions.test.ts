import { describe, expect, it } from 'vitest';
import { decideBusinessPortalAction } from '../lib/access/businessEntryDecisions';

describe('business entry decisions', () => {
  it('opens sign-up for logged-out users', () => {
    expect(decideBusinessPortalAction({
      hasSession: false,
      canEnterBusinessPortal: false,
      hasPortalHandler: true,
    })).toBe('open_signup');
  });

  it('does not send a signed-in candidate directly into portal or payment', () => {
    expect(decideBusinessPortalAction({
      hasSession: true,
      canEnterBusinessPortal: false,
      hasPortalHandler: true,
    })).toBe('open_business_access_prompt');
  });

  it('enters the portal only for accounts with business access', () => {
    expect(decideBusinessPortalAction({
      hasSession: true,
      canEnterBusinessPortal: true,
      hasPortalHandler: true,
    })).toBe('enter_portal');
  });

  it('falls back to the parent route for business accounts without a portal handler', () => {
    expect(decideBusinessPortalAction({
      hasSession: true,
      canEnterBusinessPortal: true,
      hasPortalHandler: false,
    })).toBe('go_back');
  });
});
