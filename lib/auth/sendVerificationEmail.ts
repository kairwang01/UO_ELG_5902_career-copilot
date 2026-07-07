import { sendEmailVerification, type User } from 'firebase/auth';

/** Where Firebase should return the user after they click the verification link. */
export function verificationContinueUrl(): string {
  if (typeof window === 'undefined') return '/';
  const { origin, pathname } = window.location;
  if (pathname.startsWith('/portal') || pathname.startsWith('/workspace') || pathname.startsWith('/admin')) {
    return `${origin}${pathname}`;
  }
  return `${origin}/portal`;
}

export async function sendAccountVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user, {
    url: verificationContinueUrl(),
    handleCodeInApp: true,
  });
}

export function mapVerificationEmailError(message: string, t: (key: string) => string): string {
  if (message.includes('too-many-requests')) return t('auth_error_too_many_requests');
  if (message.includes('network-request-failed')) return t('auth_error_network');
  return t('verify_gate_send_failed');
}
