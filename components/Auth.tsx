
import React, { useState, useEffect } from 'react';
import { updateProfile } from 'firebase/auth';
import { data } from '@/lib/data';
import { firebaseAuth } from '@/lib/firebaseClient';
import { ALL_PLANS, BUSINESS_PLANS } from '@/config';
import type { Plan } from '@/types';
import { X } from 'lucide-react';

interface AuthProps {
  onClose: () => void;
  initialView?: 'sign_in' | 'sign_up' | 'forgot_password';
  mode: 'candidate' | 'business';
  t: (key: string) => string;
}

const PlanSelectorCard: React.FC<{ plan: Plan & { key: string }; isSelected: boolean; onSelect: () => void; t: (key: string) => string; }> = ({ plan, isSelected, onSelect, t }) => {
    const priceDescription = t(`plan_${plan.key}_price_desc`);
    
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
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
        </button>
    );
};


const getAuthErrorMessage = (message: string): string => {
  if (message.includes('invalid-credential') || message.includes('wrong-password') || message.includes('user-not-found')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (message.includes('email-already-in-use') || message.includes('already registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (message.includes('weak-password')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (message.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (message.includes('too-many-requests')) {
    return 'Too many failed attempts. Please wait a few minutes and try again.';
  }
  if (message.includes('network-request-failed')) {
    return 'Network error. Please check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
};

const Auth: React.FC<AuthProps> = ({ onClose, initialView = 'sign_in', mode, t }) => {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authView, setAuthView] = useState<'sign_in' | 'sign_up' | 'forgot_password'>(initialView);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>(mode === 'business' ? 'single_post' : 'free');

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
  }, [mode, authView]);

  // Outside-click no longer closes the modal (QA E10), so give keyboard users
  // Escape as the explicit close.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error } = await data.auth.signInWithPassword(email, password);
    if (error) {
      setError(getAuthErrorMessage(error.message));
    } else {
      onClose();
    }
    setLoading(false);
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

    setLoading(true);
    setError(null);
    setMessage(null);

    const statusForDb = mode === 'business'
        ? `pending_biz_${selectedPlan}`
        : selectedPlan === 'free' ? 'free' : `pending_${selectedPlan}`;

    const { data: authData, error: authError } = await data.auth.signUp(email, password);

    if (authError) {
      if (authError.message.includes('email-already-in-use') || authError.message.includes('already registered')) {
        setError(t('auth_error_user_exists'));
        setAuthView('sign_in');
      } else {
        setError(getAuthErrorMessage(authError.message));
      }
      setLoading(false);
      return;
    }

    if (authData) {
      // onUserCreated trigger auto-creates users/{uid} with 100 credits.
      // We upsert additional profile fields (role, subscription_status) on top.
      const { error: profileError } = await data.profiles.upsert({
        id: authData.id,
        subscription_status: statusForDb,
        full_name: trimmedName,
        role: mode === 'business' ? 'employer' : 'candidate',
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        setError(`Account created, but we failed to set up your profile. Error: ${profileError.message}`);
      } else {
        // Best-effort: set Firebase Auth displayName (non-fatal if it fails).
        try {
          if (firebaseAuth.currentUser) {
            await updateProfile(firebaseAuth.currentUser, { displayName: trimmedName });
          }
        } catch {
          // non-fatal — profile row already has the name
        }
        setMessage('Account created successfully! You are now signed in.');
      }
    } else {
      setError('User account was not created successfully. Please try again.');
    }

    setLoading(false);
  };
  
  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error } = await data.auth.resetPassword(email);
    if (error) setError(getAuthErrorMessage(error.message));
    else setMessage(t('auth_message_reset_link_sent'));
    setLoading(false);
  }
  
  const handleGoogleLogin = async () => {
    // Store plan selection for OAuth flow
    sessionStorage.setItem('pending_plan', selectedPlan);
    sessionStorage.setItem('pending_mode', mode);

    setLoading(true);
    setError(null);
    // signInWithGoogle is a POPUP flow (not a redirect — the old comment was a
    // Supabase-era leftover). If the user closes the popup, the promise resolves
    // with an error and, previously, loading was never reset — the button stayed
    // stuck on "Signing in…" until a full reload.
    const { error } = await data.auth.signInWithGoogle();
    if (error) {
      setError(getAuthErrorMessage(error.message));
    }
    // On success the auth listener closes this modal; resetting is harmless.
    setLoading(false);
  }

  const renderContent = () => {
    const candidatePlans = [ALL_PLANS.free, ALL_PLANS.essentials, ALL_PLANS.accelerator, ALL_PLANS.executive];
    const businessPlans = [BUSINESS_PLANS.single_post, BUSINESS_PLANS.job_pack];
    const plansToShow = mode === 'business' ? businessPlans : candidatePlans;

    switch (authView) {
      case 'sign_up':
        return (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-800">{mode === 'business' ? t('auth_create_employer_account') : t('auth_create_candidate_account')}</h2>
            
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 text-center">{mode === 'business' ? t('auth_choose_posting_plan') : t('auth_choose_your_plan')}</p>
              <div className={`grid gap-3 ${mode === 'business' ? 'grid-cols-2' : 'grid-cols-2'}`}>
                  {plansToShow.map(plan => (
                      <PlanSelectorCard key={plan.key} plan={plan} isSelected={selectedPlan === plan.key} onSelect={() => setSelectedPlan(plan.key)} t={t} />
                  ))}
              </div>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <input className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" type="text" placeholder={t('auth_placeholder_full_name')} value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={80} />
              <input className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" type="email" placeholder={mode === 'business' ? t('auth_placeholder_email_business') : t('auth_placeholder_email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" type="password" placeholder={t('auth_placeholder_password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <input className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" type="password" placeholder={t('auth_placeholder_confirm_password')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              <button className="w-full bg-blue-700 text-white py-2.5 rounded-md hover:bg-blue-800 disabled:bg-blue-400 font-semibold" type="submit" disabled={loading}>
                {loading ? t('auth_creating_account') : (mode === 'business' ? t('auth_signup_for_jobs') : t('auth_signup'))}
              </button>
            </form>
            <p className="text-center text-sm">
              {mode === 'business' ? t('auth_employer_exists') : t('auth_candidate_exists')} <button onClick={() => setAuthView('sign_in')} className="text-blue-600 hover:underline">{t('auth_signin_link')}</button>
            </p>
          </>
        );
      case 'forgot_password':
        return (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-800">{t('auth_reset_password_title')}</h2>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <input className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" type="email" placeholder={t('auth_placeholder_email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
              <button className="w-full bg-blue-700 text-white py-2.5 rounded-md hover:bg-blue-800 disabled:bg-blue-400 font-semibold" type="submit" disabled={loading}>
                {loading ? t('auth_sending_link') : t('auth_send_reset_link')}
              </button>
            </form>
            <p className="text-center text-sm">
              {t('auth_remembered_password')} <button onClick={() => setAuthView('sign_in')} className="text-blue-600 hover:underline">{t('auth_signin_link')}</button>
            </p>
          </>
        );
      default: // sign_in
        return (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-800">{mode === 'business' ? t('auth_employer_signin_title') : t('auth_welcome_back')}</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <input className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" type="email" placeholder={t('auth_placeholder_email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" type="password" placeholder={t('auth_placeholder_password_signin')} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button className="w-full bg-blue-700 text-white py-2.5 rounded-md hover:bg-blue-800 disabled:bg-blue-400 font-semibold" type="submit" disabled={loading}>
                {loading ? t('auth_signing_in') : t('auth_sign_in')}
              </button>
            </form>
             <div className="text-right text-sm">
                <button onClick={() => setAuthView('forgot_password')} className="text-blue-600 hover:underline">{t('auth_forgot_password_link')}</button>
            </div>
            {mode !== 'business' && (
              <>
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="flex-shrink mx-4 text-gray-400 text-sm">{t('auth_or_separator')}</span>
                    <div className="flex-grow border-t border-gray-300"></div>
                </div>
                <button onClick={handleGoogleLogin} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-300 py-2 rounded-md hover:bg-gray-50 disabled:bg-gray-200">
                    <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.447-2.275 4.482-4.283 5.942l6.19 5.238C42.028 36.318 44 31.019 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
                    {t('auth_signin_google')}
                </button>
              </>
            )}
            <p className="text-center text-sm">
              {mode === 'business' ? t('auth_no_employer_account') : t('auth_no_candidate_account')} <button onClick={() => setAuthView('sign_up')} className="text-blue-600 hover:underline">{t('auth_signup_link')}</button>
            </p>
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-md p-8 space-y-4 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Close"
        >
          <X size={24} />
        </button>
        {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md text-center">{message}</div>}
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md text-center">{error}</div>}
        {renderContent()}
      </div>
    </div>
  );
};

export default Auth;
