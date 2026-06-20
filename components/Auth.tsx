
import React, { useState, useEffect, useRef } from 'react';
import { sendEmailVerification, updateProfile } from 'firebase/auth';
import { data } from '@/lib/data';
import { firebaseAuth } from '@/lib/firebaseClient';
import { BUSINESS_PLANS } from '@/config';
import type { Plan } from '@/types';
import { X } from 'lucide-react';
import { BrandMark } from './BrandLogo';
import { useModalBehavior } from '../hooks/useModalBehavior';

// Unified input styling (was inconsistent — sign-in inputs lacked dark mode).
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30';
import { markOnboardingPending } from '../lib/onboarding';
import { createSubscriptionCheckout, setUserSubscription } from '../services/subscriptionClient';
import { useToast } from './Toast';

interface AuthProps {
  onClose: () => void;
  initialView?: 'sign_in' | 'sign_up' | 'forgot_password';
  mode: 'candidate' | 'business';
  t: (key: string) => string;
}

const PlanSelectorCard: React.FC<{ plan: Plan & { key: string }; isSelected: boolean; onSelect: () => void; t: (key: string) => string; }> = ({ plan, isSelected, onSelect, t }) => {
    const periodKey = `plan_${plan.key}_period_desc`;
    const translatedPeriod = t(periodKey);
    const priceDescription = translatedPeriod === periodKey ? t(`plan_${plan.key}_price_desc`) : translatedPeriod;
    const featureLabel = (index: number, fallback: string) => {
        const key = `plan_${plan.key}_feature_${index + 1}`;
        const translated = t(key);
        return translated === key ? fallback : translated;
    };
    
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${isSelected ? 'border-blue-600 bg-blue-50/80 shadow-sm' : 'border-gray-300 bg-white hover:border-blue-400'}`}
        >
            <h4 className="font-bold text-gray-900">{t(`plan_${plan.key}_name`)}</h4>
            <div className="flex items-baseline mt-1">
                <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                {plan.price !== '$0' && <span className="ml-1 text-sm font-medium text-gray-500">{priceDescription}</span>}
            </div>
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
                {plan.features.slice(0, 3).map((feature, index) => (
                    <li key={index} className="flex items-start">
                        <svg className="h-4 w-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        <span>{featureLabel(index, feature)}</span>
                    </li>
                ))}
            </ul>
        </button>
    );
};


const getAuthErrorMessage = (message: string, t: AuthProps['t']): string => {
  if (message.includes('invalid-credential') || message.includes('wrong-password') || message.includes('user-not-found')) {
    return t('auth_error_invalid_credentials');
  }
  if (message.includes('email-already-in-use') || message.includes('already registered')) {
    return t('auth_error_user_exists');
  }
  if (message.includes('weak-password')) {
    return t('auth_error_weak_password');
  }
  if (message.includes('invalid-email')) {
    return t('auth_error_invalid_email');
  }
  if (message.includes('too-many-requests')) {
    return t('auth_error_too_many_requests');
  }
  if (message.includes('network-request-failed')) {
    return t('auth_error_network');
  }
  return t('auth_error_generic');
};

const Auth: React.FC<AuthProps> = ({ onClose, initialView = 'sign_in', mode, t }) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  // Ref latch: the `loading` state lags a render, so a fast double Enter/click would fire
  // two auth calls (worst case: two account-creation attempts). mountedRef drops the tail
  // setState — on success the auth listener closes/unmounts this modal.
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authView, setAuthView] = useState<'sign_in' | 'sign_up' | 'forgot_password'>(initialView);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>(mode === 'business' ? 'single_post' : 'free');
  useModalBehavior(onClose, true);

  useEffect(() => {
    setAuthView(initialView);
  }, [initialView]);
  
  useEffect(() => {
    setSelectedPlan(mode === 'business' ? 'single_post' : 'free');
    setError(null);
    setMessage(null);
    // Also reset the in-flight flag: switching views (e.g. Forgot password →
    // back to Sign in) used to leave a stale loading=true behind, so the
    // submit button stayed stuck on "Signing in…" forever.
    setLoading(false);
    inFlightRef.current = false;
  }, [mode, authView]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await data.auth.signInWithPassword(email, password);
      if (!mountedRef.current) return;
      if (error) {
        setError(getAuthErrorMessage(error.message, t));
      } else {
        onClose();
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };
  
  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();

    // Validate full name before hitting the network.
    const trimmedName = fullName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError(t('auth_name_required'));
      return;
    }

    // Catch typos before hitting the network.
    if (password !== confirmPassword) {
      setError(t('auth_error_password_mismatch'));
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    setMessage(null);

    const planKeyForServer = mode === 'business'
        ? `pending_biz_${selectedPlan}`
        : selectedPlan === 'free' ? 'free' : `pending_${selectedPlan}`;

    try {
      const { data: authData, error: authError } = await data.auth.signUp(email, password);
      if (!mountedRef.current) return;

      if (authError) {
        if (authError.message.includes('email-already-in-use') || authError.message.includes('already registered')) {
          setError(t('auth_error_user_exists'));
          setAuthView('sign_in');
        } else {
          setError(getAuthErrorMessage(authError.message, t));
        }
        return;
      }

      if (authData) {
        // Pass the name to the callable so it is written server-side at doc
        // creation (race-free). The client upsert below is a belt-and-suspenders
        // that only succeeds once the doc already exists.
        const subscriptionResult = await setUserSubscription(planKeyForServer, { fullName: trimmedName });

        // onUserCreated trigger usually creates users/{uid}; setUserSubscription
        // also creates the doc if the trigger is still in flight. The client only
        // writes profile fields allowed by Firestore rules.
        const { error: profileError } = await data.profiles.upsert({
          id: authData.id,
          full_name: trimmedName,
          role: mode === 'business' && subscriptionResult.status !== 'active' ? 'candidate' : mode === 'business' ? 'employer' : 'candidate',
          updated_at: new Date().toISOString(),
        });
        if (!mountedRef.current) return;

        if (profileError) {
          setError(t('auth_profile_created_setup_failed').replace('{error}', profileError.message));
        } else {
          if (subscriptionResult.status === 'pending_payment') {
            const checkout = await createSubscriptionCheckout(planKeyForServer);
            window.location.assign(checkout.url);
            return;
          }
          // Best-effort: set Firebase Auth displayName (non-fatal if it fails).
          try {
            if (firebaseAuth.currentUser) {
              await updateProfile(firebaseAuth.currentUser, { displayName: trimmedName });
            }
          } catch {
            // non-fatal — profile row already has the name
          }
          // Send a verification email. Non-blocking: the account is usable now,
          // but confirming ownership is the expected production-readiness step.
          try {
            if (firebaseAuth.currentUser && !firebaseAuth.currentUser.emailVerified) {
              await sendEmailVerification(firebaseAuth.currentUser);
            }
          } catch {
            // non-fatal — the user can re-trigger verification later
          }
          // Fresh candidate accounts go through the guided setup once the
          // workspace mounts (employer signups land in the portal instead).
          if (mode !== 'business') markOnboardingPending(trimmedName);
          // The auth listener navigates away (unmounting this modal) the instant
          // the account is created, so the inline message would never be seen —
          // show the verify-your-email notice as a global toast that persists.
          addToast(t('auth_signup_success_verify'), 'info');
          if (mountedRef.current) setMessage(t('auth_signup_success_verify'));
        }
      } else {
        setError(t('auth_account_create_failed'));
      }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : t('auth_unexpected_error'));
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };
  
  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await data.auth.resetPassword(email);
      if (!mountedRef.current) return;
      if (error) setError(getAuthErrorMessage(error.message, t));
      else setMessage(t('auth_message_reset_link_sent'));
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }
  
  const handleGoogleLogin = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    // Store plan selection for OAuth flow
    sessionStorage.setItem('pending_plan', selectedPlan);
    sessionStorage.setItem('pending_mode', mode);

    setLoading(true);
    setError(null);
    // signInWithGoogle is a POPUP flow (not a redirect — the old comment was a
    // Supabase-era leftover). If the user closes the popup, the promise resolves
    // with an error and, previously, loading was never reset — the button stayed
    // stuck on "Signing in…" until a full reload.
    try {
      const { error } = await data.auth.signInWithGoogle();
      if (!mountedRef.current) return;
      if (error) {
        setError(getAuthErrorMessage(error.message, t));
      }
    } finally {
      // On success the auth listener closes this modal; resetting is harmless.
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }

  const renderContent = () => {
    const businessPlans = [BUSINESS_PLANS.single_post, BUSINESS_PLANS.job_pack];

    // Social-first, low-friction entry (BOSS instant-start + NA one-click norm).
    // Candidate only (business signup uses the email + plan path).
    const googleBlock = mode !== 'business' ? (
      <>
        <button type="button" onClick={handleGoogleLogin} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60">
          <svg className="h-5 w-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.447-2.275 4.482-4.283 5.942l6.19 5.238C42.028 36.318 44 31.019 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
          {t('auth_continue_google')}
        </button>
        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-gray-200 dark:border-slate-700"></div>
          <span className="mx-3 text-xs text-gray-400">{t('auth_or_separator')}</span>
          <div className="flex-grow border-t border-gray-200 dark:border-slate-700"></div>
        </div>
      </>
    ) : null;

    switch (authView) {
      case 'sign_up':
        return (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100">{mode === 'business' ? t('auth_create_employer_account') : t('auth_create_candidate_account')}</h2>

            {/* Business signup is a purchase choice → keep the plan picker.
                Candidate signup is free — no picker; upgrade happens in-app. */}
            {mode === 'business' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">{t('auth_choose_posting_plan')}</p>
                <div className="grid grid-cols-2 gap-3">
                  {businessPlans.map(plan => (
                    <PlanSelectorCard key={plan.key} plan={plan} isSelected={selectedPlan === plan.key} onSelect={() => setSelectedPlan(plan.key)} t={t} />
                  ))}
                </div>
              </div>
            )}

            {googleBlock}

            <form onSubmit={handleSignUp} className="space-y-3">
              <input className={INPUT_CLASS} type="text" placeholder={t('auth_placeholder_full_name')} value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={80} />
              <input className={INPUT_CLASS} type="email" placeholder={mode === 'business' ? t('auth_placeholder_email_business') : t('auth_placeholder_email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input className={INPUT_CLASS} type="password" placeholder={t('auth_placeholder_password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <input className={INPUT_CLASS} type="password" placeholder={t('auth_placeholder_confirm_password')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              <button className="w-full rounded-lg bg-blue-700 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:bg-blue-400" type="submit" disabled={loading}>
                {loading ? t('auth_creating_account') : (mode === 'business' ? t('auth_signup_for_jobs') : t('auth_signup'))}
              </button>
            </form>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              {mode === 'business' ? t('auth_employer_exists') : t('auth_candidate_exists')} <button onClick={() => setAuthView('sign_in')} className="text-blue-600 dark:text-blue-400 hover:underline">{t('auth_signin_link')}</button>
            </p>
          </>
        );
      case 'forgot_password':
        return (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100">{t('auth_reset_password_title')}</h2>
            <form onSubmit={handlePasswordReset} className="space-y-3">
              <input className={INPUT_CLASS} type="email" placeholder={t('auth_placeholder_email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
              <button className="w-full rounded-lg bg-blue-700 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:bg-blue-400" type="submit" disabled={loading}>
                {loading ? t('auth_sending_link') : t('auth_send_reset_link')}
              </button>
            </form>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              {t('auth_remembered_password')} <button onClick={() => setAuthView('sign_in')} className="text-blue-600 dark:text-blue-400 hover:underline">{t('auth_signin_link')}</button>
            </p>
          </>
        );
      default: // sign_in
        return (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100">{mode === 'business' ? t('auth_employer_signin_title') : t('auth_welcome_back')}</h2>
            {googleBlock}
            <form onSubmit={handleLogin} className="space-y-3">
              <input className={INPUT_CLASS} type="email" placeholder={t('auth_placeholder_email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input className={INPUT_CLASS} type="password" placeholder={t('auth_placeholder_password_signin')} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button className="w-full rounded-lg bg-blue-700 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:bg-blue-400" type="submit" disabled={loading}>
                {loading ? t('auth_signing_in') : t('auth_sign_in')}
              </button>
            </form>
            <div className="text-right text-sm">
              <button onClick={() => setAuthView('forgot_password')} className="text-blue-600 dark:text-blue-400 hover:underline">{t('auth_forgot_password_link')}</button>
            </div>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              {mode === 'business' ? t('auth_no_employer_account') : t('auth_no_candidate_account')} <button onClick={() => setAuthView('sign_up')} className="text-blue-600 dark:text-blue-400 hover:underline">{t('auth_signup_link')}</button>
            </p>
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[100] p-4 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-4 relative animate-fade-scale"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Close"
        >
          <X size={24} />
        </button>
        <div className="flex justify-center"><BrandMark className="h-10 w-10" /></div>
        {message && <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-center text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">{message}</div>}
        {error && <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
        {renderContent()}
      </div>
    </div>
  );
};

export default Auth;
