import React from 'react';
import { Check, CreditCard, Zap } from 'lucide-react';
import type { UserProfile } from '../../../types';
import { PortalTopBar } from '../PortalTopBar';
import { BUSINESS_PLANS } from '../../../config';

interface PortalBillingProps {
  profile: UserProfile;
  darkMode: boolean;
  onSelectPlan: (planKey: string) => void;
  navigateToBusinessPricing: () => void;
  t: (key: string) => string;
}

const PLAN_DISPLAY = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    features: ['3 active job posts', '30-day job listing', 'Basic AI job creation', 'Standard applicant view'],
  },
  {
    key: 'single_post',
    name: 'Starter',
    price: '$79',
    period: '/month',
    features: ['8 active job posts', '30-day job visibility', 'AI job description generator', 'Basic candidate matching'],
  },
  {
    key: 'job_pack',
    name: 'Growth',
    price: '$199',
    period: '/month',
    features: ['20 active job posts', '45-day job visibility', 'Advanced AI matching', 'Analytics & company branding'],
  },
  {
    key: 'pro',
    name: 'Pro / Enterprise',
    price: '$499',
    period: '/month',
    features: ['100 active job posts', '60-day premium visibility', 'Full AI + verified talent access', 'Priority support'],
  },
];

export function PortalBilling({ profile, darkMode, onSelectPlan, navigateToBusinessPricing }: PortalBillingProps) {
  const dm = darkMode;
  const currentStatus = profile.subscription_status || 'free';
  const card = `rounded-xl border p-6 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`;
  const text = dm ? 'text-white' : 'text-gray-900';
  const muted = dm ? 'text-gray-400' : 'text-gray-500';
  const divider = dm ? 'border-gray-700' : 'border-gray-200';
  const sectionLabel = `text-xs font-semibold uppercase tracking-widest mb-5 ${muted}`;

  // Map subscription_status to a display-friendly name
  const currentPlanKey = currentStatus.startsWith('pending_biz_')
    ? currentStatus.replace('pending_biz_', '')
    : currentStatus.startsWith('pending_')
    ? currentStatus.replace('pending_', '')
    : currentStatus;

  const currentPlan = PLAN_DISPLAY.find((p) => p.key === currentPlanKey) ?? PLAN_DISPLAY[0];
  const isActive = currentStatus !== 'free' && !currentStatus.startsWith('pending');

  return (
    <>
      <PortalTopBar title="Billing & Plan" darkMode={dm} />
      <div className="max-w-[1088px] mx-auto p-8 space-y-8">

        {/* Current plan — real subscription_status from Firestore/Supabase profile */}
        <div className={card}>
          <p className={sectionLabel}>Current Plan</p>
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={18} className="text-[#1d4ed8]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className={`text-xl font-bold ${text}`}>{currentPlan.name} Plan</h2>
                  {isActive && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-[#1d4ed8]">
                      Active
                    </span>
                  )}
                  {currentStatus.startsWith('pending') && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                      Pending
                    </span>
                  )}
                </div>
                <p className={`text-sm ${muted}`}>
                  {currentPlan.price}{currentPlan.period}
                  {isActive && (
                    <> &nbsp;·&nbsp; <span className={dm ? 'text-gray-300' : 'text-gray-700'}>Billed monthly</span></>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={navigateToBusinessPricing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CreditCard size={15} />
              Manage Billing
            </button>
          </div>
        </div>

        {/* Available plans */}
        <div>
          <p className={sectionLabel}>Available Plans</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLAN_DISPLAY.map((plan) => {
              const isCurrent = plan.key === currentPlanKey;
              return (
                <div
                  key={plan.key}
                  className={`rounded-xl border p-5 flex flex-col transition-shadow ${
                    isCurrent
                      ? `border-[#1d4ed8] ring-2 ring-[#1d4ed8] ${dm ? 'bg-gray-800' : 'bg-white'}`
                      : dm
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <p className={`text-sm font-semibold mb-1 ${isCurrent ? 'text-[#1d4ed8]' : muted}`}>{plan.name}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className={`text-2xl font-bold ${text}`}>{plan.price}</span>
                    <span className={`text-sm ${muted}`}>{plan.period}</span>
                  </div>
                  <ul className="space-y-2 flex-1 mb-5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check size={13} className="text-[#1d4ed8] mt-0.5 shrink-0" />
                        <span className={`text-sm ${muted}`}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <button disabled className="w-full py-2 rounded-lg text-sm font-semibold bg-[#1d4ed8] text-white cursor-default">
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => onSelectPlan(plan.key)}
                      className="w-full py-2 rounded-lg text-sm font-medium border border-[#1d4ed8] text-[#1d4ed8] hover:bg-[#1d4ed8] hover:text-white transition-colors"
                    >
                      {plan.key === 'free' ? 'Downgrade' : 'Upgrade'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/*
          TODO: Billing history — requires a Stripe webhook to persist invoice records
          in Supabase/Firestore. No real data source exists yet. This is a placeholder
          until a billing_events table is set up.
        */}
        <div className={card}>
          <p className={sectionLabel}>Billing History</p>
          <p className={`text-sm ${muted}`}>
            Billing history will appear here once payment records are available.
          </p>
        </div>
      </div>
    </>
  );
}
