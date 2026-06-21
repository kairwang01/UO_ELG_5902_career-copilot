import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { confirmSimulatedCheckout } from '../../services/subscriptionClient';

/**
 * Simulated Stripe Checkout (demo/test mode).
 *
 * This is the in-app fake-payment page createCheckoutSession redirects to when the
 * backend has BILLING_SIMULATION enabled. It mimics Stripe Checkout (card form, test
 * card prefilled) but charges nothing — "Pay" calls confirmSimulatedCheckout, which
 * runs the SAME server entitlement path as the real Stripe webhook, then redirects to
 * the SAME success URL real Stripe would. The real Stripe path is untouched; this page
 * is never reached in production (the flag is off, so checkout returns a Stripe URL).
 */

// Display-only amounts (the real charge is the Stripe Price in production).
const PLAN_LABELS: Record<string, { name: string; amount: string; cadence: string }> = {
  essentials: { name: 'Career Essentials', amount: '$15.00', cadence: 'per month' },
  accelerator: { name: 'Career Accelerator', amount: '$30.00', cadence: 'per month' },
  executive: { name: 'Career Executive', amount: '$50.00', cadence: 'per month' },
  starter: { name: 'Business Starter', amount: '$79.00', cadence: 'per month' },
  growth: { name: 'Business Growth', amount: '$199.00', cadence: 'per month' },
  pro: { name: 'Business Pro', amount: '$499.00', cadence: 'per month' },
  single_post: { name: 'Single Job Post', amount: '$49.00', cadence: 'one-time' },
  job_pack: { name: 'Job Pack', amount: '$199.00', cadence: 'one-time' },
};

const SimulatedCheckoutPage: React.FC = () => {
  const [params] = useSearchParams();
  const { session, ready, profile } = useSession();
  const plan = params.get('plan') ?? '';
  const audience = params.get('audience') === 'business' ? 'business' : 'candidate';
  const info = PLAN_LABELS[plan];

  const [card, setCard] = useState('4242 4242 4242 4242');
  const [exp, setExp] = useState('12 / 34');
  const [cvc, setCvc] = useState('123');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const successUrl = audience === 'business' ? '/portal?checkout=success' : '/workspace/billing?checkout=success';
  const cancelUrl = audience === 'business' ? '/pricing?audience=employer&checkout=cancel' : '/pricing?checkout=cancel';

  const handlePay = async () => {
    if (paying) return;
    setPaying(true);
    setError(null);
    try {
      await confirmSimulatedCheckout(plan);
      window.location.assign(successUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment simulation failed. Please try again.');
      setPaying(false);
    }
  };

  if (!plan || !info) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-slate-600">
        <p>Unknown or missing plan. <a className="text-blue-600 underline" href="/pricing">Back to pricing</a></p>
      </div>
    );
  }

  if (ready && !session) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-slate-600">
        <p>Please sign in to continue checkout. <a className="text-blue-600 underline" href="/workspace?auth=signin">Sign in</a></p>
      </div>
    );
  }

  // Guard the back-button-after-pay path: if this plan is already active, don't show a
  // live Pay button that would re-run confirmSimulatedCheckout.
  if (ready && session && profile?.subscription_status === plan) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">You're already on {info.name}.</p>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          No need to pay again.{' '}
          <a className="text-blue-600 underline" href={audience === 'business' ? '/portal' : '/workspace'}>Go to your workspace</a>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-md">
        <div className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
          TEST MODE · simulated payment — no real charge
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Subscribe to {info.name}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">
              {info.amount} <span className="text-base font-normal text-slate-500">{info.cadence}</span>
            </p>
          </div>

          <div className="space-y-4 px-6 py-6">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Card number</span>
              <input
                value={card}
                onChange={(e) => setCard(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                inputMode="numeric"
              />
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Expiry</span>
                <input value={exp} onChange={(e) => setExp(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </label>
              <label className="flex-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">CVC</span>
                <input value={cvc} onChange={(e) => setCvc(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </label>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="button"
              onClick={handlePay}
              disabled={paying}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {paying ? 'Confirming your plan…' : `Pay ${info.amount}`}
            </button>
            <button
              type="button"
              onClick={() => window.location.assign(cancelUrl)}
              disabled={paying}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancel
            </button>
            <p className="pt-1 text-center text-[11px] text-slate-400">
              Simulated checkout for demo/testing. Test card 4242 4242 4242 4242. Real Stripe Checkout is used once STRIPE_* keys are configured.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulatedCheckoutPage;
