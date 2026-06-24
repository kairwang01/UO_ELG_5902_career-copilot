import React, { useState } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { cancelSubscriptionSimulated } from '../../services/subscriptionClient';

/**
 * Simulated Stripe Customer Portal (demo/test mode).
 *
 * The in-app stand-in createBillingPortalSession redirects to when the backend has
 * BILLING_SIMULATION enabled. "Cancel subscription" calls cancelSubscriptionSimulated,
 * which runs the SAME downgrade path as the real subscription.deleted webhook, then
 * returns to the right billing surface for the signed-in role. Never reached in
 * production (the flag is off, so the portal call returns a real Stripe URL instead).
 */
const PLAN_LABELS: Record<string, string> = {
  essentials: 'Basic',
  accelerator: 'Pro',
  executive: 'Premium',
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  single_post: 'Single Post',
  job_pack: 'Job Pack',
};

const SimulatedManagePage: React.FC = () => {
  const { session, ready, profile } = useSession();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = profile?.subscription_status ?? 'free';
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const isBusiness = profile?.role === 'employer' || profile?.role === 'agency';
  const billingPath = isBusiness ? '/portal?billing=return' : '/workspace/billing';

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelSubscriptionSimulated();
      window.location.assign(`${billingPath}${billingPath.includes('?') ? '&' : '?'}cancelled=success`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancellation failed. Please try again.');
      setCancelling(false);
    }
  };

  if (ready && !session) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-slate-600">
        <p>Please sign in to manage your subscription. <a className="text-blue-600 underline" href="/workspace?auth=signin">Sign in</a></p>
      </div>
    );
  }

  if (ready && plan === 'free') {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">You have no active subscription.</p>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          <a className="text-blue-600 underline" href={billingPath}>Back to billing</a>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-md">
        <div className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
          TEST MODE · simulated subscription management
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Current plan</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">{planLabel}</p>
          </div>
          <div className="space-y-4 px-6 py-6">
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {cancelling ? 'Cancelling…' : 'Cancel subscription'}
            </button>
            <button
              type="button"
              onClick={() => window.location.assign(billingPath)}
              disabled={cancelling}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
            >
              Back
            </button>
            <p className="pt-1 text-center text-[11px] text-slate-400">
              Simulated portal for demo/testing. Real Stripe Customer Portal is used once STRIPE_* keys are configured.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulatedManagePage;
