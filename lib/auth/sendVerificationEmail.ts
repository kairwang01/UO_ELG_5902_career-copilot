import { sendEmailVerification, type User } from 'firebase/auth';

const DISPATCHED_KEY = 'cc_verify_email_dispatched_at';

export function markVerificationEmailDispatched(): void {
  try {
    sessionStorage.setItem(DISPATCHED_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — non-fatal
  }
}

export function wasVerificationEmailDispatchedRecently(withinMs = 180_000): boolean {
  try {
    const dispatchedAt = Number(sessionStorage.getItem(DISPATCHED_KEY) || 0);
    return dispatchedAt > 0 && Date.now() - dispatchedAt < withinMs;
  } catch {
    return false;
  }
}

/** Firebase default verification email — no custom continue URL or action settings. */
export async function sendAccountVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
  markVerificationEmailDispatched();
}

export function mapVerificationEmailError(message: string, t: (key: string) => string, code = ''): string {
  const normalized = code || message;
  if (normalized.includes('too-many-requests')) return t('auth_error_too_many_requests');
  if (normalized.includes('network-request-failed')) return t('auth_error_network');
  return t('verify_gate_send_failed');
}
