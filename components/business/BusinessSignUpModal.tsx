
import React, { useEffect, useRef, useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { data } from '@/lib/data';
import { firebaseAuth } from '@/lib/firebaseClient';
import { createSubscriptionCheckout, setUserSubscription } from '@/services/subscriptionClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { PasswordInput } from '../ui/PasswordInput';
import { Button } from '../ui/button';
import { Check } from 'lucide-react';
import CheckoutRedirectNotice from '../billing/CheckoutRedirectNotice';
import { businessPlanDefs, type BusinessPlanId } from './businessPlans';

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToSignIn: () => void;
  onSignedUp?: () => Promise<void> | void;
  initialPlan?: BusinessPlanId;
  t: (key: string) => string;
}

export default function BusinessSignUpModal({ isOpen, onOpenChange, onSwitchToSignIn, onSignedUp, initialPlan = 'starter', t }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<BusinessPlanId>(initialPlan);
  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedBusinessPlan = businessPlanDefs.find((plan) => plan.id === selectedPlan) ?? businessPlanDefs[0];
  // Ref latch (state lags a render → a double Enter could fire two signUp /
  // setUserSubscription calls). mountedRef drops tail setState if the modal unmounts.
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (isOpen) setSelectedPlan(initialPlan);
  }, [initialPlan, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedOrgName = orgName.trim();
    const trimmedContactName = contactName.trim();
    if (trimmedContactName.length < 2 || trimmedContactName.length > 80) {
      setError(t('auth_contact_name'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth_error_password_mismatch'));
      return;
    }
    if (submittingRef.current) return; // block synchronous double-submit
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data: authData, error: authError } = await data.auth.signUp(email, password);
      if (!mountedRef.current) return;

      if (authError) {
        if (authError.message.includes('email-already-in-use') || authError.message.includes('already registered')) {
          setError(t('auth_error_user_exists'));
          onSwitchToSignIn();
        } else {
          setError(authError.message);
        }
        return;
      }

      if (authData) {
        // Write the contact name + organization server-side at doc creation
        // (race-free). The client upsert below is a fallback once the doc exists.
        const pendingPlanKey = `pending_biz_${selectedPlan}`;
        const subscriptionResult = await setUserSubscription(pendingPlanKey, {
          fullName: trimmedContactName,
          companyName: trimmedOrgName,
        });

        const { error: profileError } = await data.profiles.upsert({
          id: authData.id,
          full_name: trimmedContactName,
          company_name: trimmedOrgName || null,
          ...(subscriptionResult.status === 'active' ? { role: 'employer' as const } : {}),
          updated_at: new Date().toISOString(),
        });

        // Paid plan → Stripe checkout. Do this BEFORE the mount guard below: the
        // auth listener routes the new session to /portal, unmounting this modal,
        // so a `!mountedRef.current` return here would SKIP the redirect and strand
        // a paid signup in the portal with an unpaid pending account.
        // window.location.assign is a navigation — safe regardless of mount state.
        if (!profileError && subscriptionResult.status === 'pending_payment') {
          const checkout = await createSubscriptionCheckout(pendingPlanKey);
          window.location.assign(checkout.url);
          return;
        }
        if (!mountedRef.current) return;

        if (profileError) {
          setError(`${t('auth_profile_setup_failed')} ${profileError.message}`);
        } else {
          // (pending_payment is handled above, before the mount guard.)
          // Send a verification email (non-blocking, production-readiness step).
          try {
            if (firebaseAuth.currentUser && !firebaseAuth.currentUser.emailVerified) {
              await sendEmailVerification(firebaseAuth.currentUser);
            }
          } catch {
            // non-fatal — verification can be re-triggered later
          }
          // The account was successfully created. Swallow any transient error from
          // the post-signup callback (e.g. refreshProfile network failure) so the
          // form does not freeze — the success message is still shown to the user.
          try {
            await onSignedUp?.();
          } catch {
            // intentionally ignored — account creation succeeded
          }
          if (mountedRef.current) setMessage(t('auth_business_account_created'));
        }
      }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : t('auth_unexpected_error'));
    } finally {
      // Always release the loading state + latch, even if an unexpected error is thrown.
      submittingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="lg" className="p-5 sm:p-8">
        <DialogHeader>
          <DialogTitle>{t('auth_create_employer_account')}</DialogTitle>
          <DialogDescription>{t('auth_business_signup_desc')}</DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm mt-4 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-md text-sm mt-4 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-300">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Plan picker */}
          <div>
            <p className="text-center mb-3 text-gray-700 dark:text-gray-300 text-sm">{t('auth_choose_posting_plan')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {businessPlanDefs.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  aria-pressed={selectedPlan === plan.id}
                  className={`relative text-left p-4 rounded-lg border-2 transition-all duration-150 ${
                    selectedPlan === plan.id
                      ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-900/30 dark:border-blue-500'
                      : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                >
                  <h3 className="text-base text-gray-900 dark:text-gray-100 mb-2">{t(plan.nameKey)}</h3>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">${plan.price}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('site_pricing_per_month')}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {plan.featureKeys.map((featureKey) => (
                      <li key={featureKey} className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{t(featureKey)}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            {selectedBusinessPlan.id !== 'free' && (
              <CheckoutRedirectNotice className="mt-3">
                {t(selectedBusinessPlan.nameKey)} · {t('portal_billing_available_desc')}
              </CheckoutRedirectNotice>
            )}
          </div>

          <Input
            type="text"
            placeholder={t('auth_placeholder_org_name')}
            aria-label={t('auth_placeholder_org_name')}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
          />
          <Input
            type="text"
            placeholder={t('auth_contact_name_ph')}
            aria-label={t('auth_contact_name')}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
          />
          <Input
            type="email"
            placeholder={t('auth_placeholder_email_business')}
            aria-label={t('auth_placeholder_email_business')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <PasswordInput
            t={t}
            placeholder={t('auth_placeholder_password')}
            aria-label={t('auth_placeholder_password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
          <PasswordInput
            t={t}
            placeholder={t('auth_placeholder_confirm_password')}
            aria-label={t('auth_placeholder_confirm_password')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('auth_creating_account') : t('auth_signup_for_jobs')}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-3">
          {t('auth_employer_exists')}{' '}
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            {t('auth_signin_link')}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
