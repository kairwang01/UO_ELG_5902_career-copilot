import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MailCheck, RefreshCw, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebaseClient';
import { mapVerificationEmailError, sendAccountVerificationEmail, wasVerificationEmailDispatchedRecently } from '@/lib/auth/sendVerificationEmail';

interface VerifyEmailGateProps {
  email: string | null;
  t: (key: string) => string;
}

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Full-screen gate shown to a signed-in user whose email is not yet verified.
 * The session exists (Firebase auth resolved) but the portal is withheld until
 * they click the verification link. Google/SSO sign-ins are auto-verified and
 * never land here. Paid signups reach this AFTER completing Stripe checkout.
 */
export const VerifyEmailGate: React.FC<VerifyEmailGateProps> = ({ email, t }) => {
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialSendStartedRef = useRef(false);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        return c <= 1 ? 0 : c - 1;
      });
    }, 1000);
  }, []);

  const sendVerification = useCallback(async (options?: { startCooldown?: boolean }) => {
    setError(null);
    setNotice(null);
    const user = firebaseAuth.currentUser;
    if (!user || user.emailVerified) return false;
    setSending(true);
    try {
      await sendAccountVerificationEmail(user);
      setNotice(t('verify_gate_resent'));
      if (options?.startCooldown !== false) startCooldown();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      if (import.meta.env.DEV) console.warn('VerifyEmailGate send failed:', code || message, err);
      setError(mapVerificationEmailError(message, t, code));
      return false;
    } finally {
      setSending(false);
    }
  }, [startCooldown, t]);

  useEffect(() => {
    // Paid employer signups land here after Stripe; signup may have sent mail
    // before redirect, but that send is easy to miss (timing, spam, rate limit).
    // Auto-send once when the gate opens so recruiters are not stuck with no mail.
    if (initialSendStartedRef.current) return;
    initialSendStartedRef.current = true;
    if (wasVerificationEmailDispatchedRecently()) {
      setNotice(t('verify_gate_resent'));
      startCooldown();
      return;
    }
    void sendVerification({ startCooldown: true });
  }, [sendVerification, startCooldown, t]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleResend = useCallback(async () => {
    await sendVerification({ startCooldown: true });
  }, [sendVerification]);

  const handleCheck = useCallback(async () => {
    setError(null); setNotice(null);
    const user = firebaseAuth.currentUser;
    if (!user) return;
    setChecking(true);
    try {
      await user.reload();
      if (firebaseAuth.currentUser?.emailVerified) {
        // Re-init the app so SessionContext picks up the verified user and the
        // gate falls away, landing them in the portal.
        window.location.reload();
        return;
      }
      setError(t('verify_gate_still_unverified'));
    } catch {
      setError(t('verify_gate_still_unverified'));
    } finally {
      setChecking(false);
    }
  }, [t]);

  const handleSignOut = useCallback(async () => {
    try { await signOut(firebaseAuth); } finally { window.location.assign('/'); }
  }, []);

  return (
    <div className="beta-root flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <MailCheck className="h-7 w-7 text-blue-700" aria-hidden="true" />
        </div>
        <h1 className="text-center text-xl font-bold text-slate-900">{t('verify_gate_title')}</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
          {t('verify_gate_body').replace('{email}', email || t('verify_gate_your_email'))}
        </p>
        <p className="mt-2 text-center text-xs font-medium text-slate-500">
          {t('verify_gate_spam_hint')}
        </p>

        {notice && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800" role="status">{notice}</div>
        )}
        {error && (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-800" role="alert">{error}</div>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
            {checking ? t('verify_gate_checking') : t('verify_gate_check')}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={sending || cooldown > 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cooldown > 0 ? t('verify_gate_resend_cooldown').replace('{seconds}', String(cooldown)) : t('verify_gate_resend')}
          </button>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">{t('verify_gate_typo_hint')}</p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mx-auto mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          {t('verify_gate_signout')}
        </button>
      </div>
    </div>
  );
};
