import { applyActionCode, checkActionCode, type Auth } from 'firebase/auth';

export type AuthActionMode = 'verifyEmail' | 'resetPassword' | 'recoverEmail' | string;

export type AuthActionOutcome =
  | { status: 'success'; mode: 'verifyEmail' }
  | { status: 'ready'; mode: 'resetPassword'; oobCode: string }
  | { status: 'error'; reason: 'missing_params' | 'expired_or_invalid' | 'unsupported_mode' | 'apply_failed' };

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

function isExpiredOrInvalidCode(err: unknown): boolean {
  const code = getAuthErrorCode(err);
  return (
    code === 'auth/invalid-action-code' ||
    code === 'auth/expired-action-code' ||
    code === 'auth/user-disabled' ||
    code === 'auth/user-not-found'
  );
}

/** Complete a Firebase email action from the query string on /auth/action. */
export async function completeAuthActionFromSearch(
  auth: Auth,
  search: string,
): Promise<AuthActionOutcome> {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  if (!mode || !oobCode) {
    return { status: 'error', reason: 'missing_params' };
  }

  try {
    await checkActionCode(auth, oobCode);
  } catch (err) {
    if (isExpiredOrInvalidCode(err)) {
      return { status: 'error', reason: 'expired_or_invalid' };
    }
    return { status: 'error', reason: 'apply_failed' };
  }

  if (mode === 'verifyEmail') {
    try {
      await applyActionCode(auth, oobCode);
      if (auth.currentUser) {
        await auth.currentUser.reload();
      }
      return { status: 'success', mode: 'verifyEmail' };
    } catch (err) {
      if (isExpiredOrInvalidCode(err)) {
        return { status: 'error', reason: 'expired_or_invalid' };
      }
      return { status: 'error', reason: 'apply_failed' };
    }
  }

  if (mode === 'resetPassword') {
    return { status: 'ready', mode: 'resetPassword', oobCode };
  }

  return { status: 'error', reason: 'unsupported_mode' };
}
