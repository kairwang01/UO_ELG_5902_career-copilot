const DEFER_KEY_PREFIX = 'cc_email_verify_deferred_';

/** Per-user opt-out of the hard verification gate (beta deliverability workaround). */
export function isEmailVerificationDeferred(userId: string): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${DEFER_KEY_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

export function deferEmailVerification(userId: string): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${DEFER_KEY_PREFIX}${userId}`, '1');
  } catch {
    // localStorage unavailable — non-fatal
  }
}

export function clearEmailVerificationDefer(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(`${DEFER_KEY_PREFIX}${userId}`);
  } catch {
    // non-fatal
  }
}
