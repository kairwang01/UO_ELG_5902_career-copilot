import { sendEmailVerification, type User } from 'firebase/auth';

const DISPATCHED_KEY = 'cc_verify_email_dispatched_at';
const DEFAULT_ACTION_ORIGIN = 'https://copilot.kairwang.cloud';

/** Landing route for verification links — handled in-app via applyActionCode. */
export function verificationActionUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/action`;
  }
  return `${DEFAULT_ACTION_ORIGIN}/auth/action`;
}

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

function getAuthErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code: string }).code);
  }
  if (err instanceof Error) {
    const match = err.message.match(/auth\/[a-z0-9-]+/i);
    return match?.[0] ?? '';
  }
  return '';
}

function isContinueUriError(code: string, message: string): boolean {
  return (
    code === 'auth/unauthorized-continue-uri' ||
    code === 'auth/invalid-continue-uri' ||
    message.includes('unauthorized-continue-uri') ||
    message.includes('invalid-continue-uri')
  );
}

/**
 * Send a verification email whose link opens /auth/action on this site (in-app
 * handler) instead of Firebase's hosted page that shows a bare "Error encountered".
 */
export async function sendAccountVerificationEmail(user: User): Promise<void> {
  const actionUrl = verificationActionUrl();
  try {
    await sendEmailVerification(user, {
      url: actionUrl,
      handleCodeInApp: true,
    });
  } catch (err) {
    const code = getAuthErrorCode(err);
    const message = err instanceof Error ? err.message : '';
    if (import.meta.env.DEV) {
      console.warn('sendEmailVerification with action URL failed:', code || message, err);
    }
    if (!isContinueUriError(code, message)) throw err;
    await sendEmailVerification(user);
  }
  markVerificationEmailDispatched();
}

export function mapVerificationEmailError(message: string, t: (key: string) => string, code = ''): string {
  const normalized = code || message;
  if (normalized.includes('too-many-requests')) return t('auth_error_too_many_requests');
  if (normalized.includes('network-request-failed')) return t('auth_error_network');
  return t('verify_gate_send_failed');
}
