import { sendEmailVerification, type User } from 'firebase/auth';

const DISPATCHED_KEY = 'cc_verify_email_dispatched_at';

/** Where Firebase should return the user after they click the verification link. */
export function verificationContinueUrl(): string {
  if (typeof window === 'undefined') return '/';
  const { origin, pathname } = window.location;
  if (pathname.startsWith('/portal') || pathname.startsWith('/workspace') || pathname.startsWith('/admin')) {
    return `${origin}${pathname}`;
  }
  return `${origin}/portal`;
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
 * Send Firebase's verification email. Prefer a portal continue URL when the
 * domain is authorized; fall back to the default template link when it is not
 * (common on staging hosts not yet added to Firebase Auth authorized domains).
 */
export async function sendAccountVerificationEmail(user: User): Promise<void> {
  const continueUrl = verificationContinueUrl();

  try {
    await sendEmailVerification(user, {
      url: continueUrl,
      // Web clients should open the link in the browser, not as an app deep link.
      handleCodeInApp: false,
    });
    markVerificationEmailDispatched();
    return;
  } catch (err) {
    const code = getAuthErrorCode(err);
    const message = err instanceof Error ? err.message : '';
    if (import.meta.env.DEV) {
      console.warn('sendEmailVerification with continue URL failed:', code || message, err);
    }
    if (!isContinueUriError(code, message)) throw err;
  }

  // Continue URL not on Firebase's authorized-domain list — default link still works.
  await sendEmailVerification(user);
  markVerificationEmailDispatched();
}

export function mapVerificationEmailError(message: string, t: (key: string) => string, code = ''): string {
  const normalized = code || message;
  if (normalized.includes('too-many-requests')) return t('auth_error_too_many_requests');
  if (normalized.includes('network-request-failed')) return t('auth_error_network');
  return t('verify_gate_send_failed');
}
