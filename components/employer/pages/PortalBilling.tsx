import React from 'react';
import { Check, CreditCard, Zap } from 'lucide-react';
import type { UserProfile } from '../../../types';
import { PortalTopBar } from '../PortalTopBar';

interface PortalBillingProps {
  profile: UserProfile;
  darkMode: boolean;
  activeJobs: number;
  onSelectPlan: (planKey: string) => void;
  /** True while a plan change request is in flight — disables plan buttons. */
  planSaving?: boolean;
  navigateToBusinessPricing: () => void;
  t: (key: string) => string;
}

const PLAN_DISPLAY = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    jobLimit: 3,
    features: ['3 active job posts', '30-day job listing', 'Basic AI job creation', 'Standard applicant view'],
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$79',
    period: '/month',
    jobLimit: 8,
    features: ['8 active job posts', '30-day job visibility', 'AI job description generator', 'Basic candidate matching'],
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '$199',
    period: '/month',
    jobLimit: 20,
    features: ['20 active job posts', '45-day job visibility', 'Advanced AI matching', 'Analytics & company branding'],
  },
  {
    key: 'pro',
    name: 'Pro / Enterprise',
    price: '$499',
    period: '/month',
    jobLimit: 100,
    features: ['100 active job posts', '60-day premium visibility', 'Full AI + verified talent access', 'Priority support'],
  },
];

export function PortalBilling({ profile, darkMode, activeJobs, onSelectPlan, planSaving = false, navigateToBusinessPricing }: PortalBillingProps) {
  const dm = darkMode;
  const currentStatus = profile.subscription_status || 'free';
  const card = `rounded-xl border p-6 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`;
  const text = dm ? 'text-white' : 'text-gray-900';
  const muted = dm ? 'text-gray-400' : 'text-gray-500';
  const divider = dm ? 'border-gray-700' : 'border-gray-200';
  // match design: text-sm (not text-xs)
  const sectionLabel = `text-sm font-semibold uppercase tracking-widest mb-5 ${muted}`;

  const currentPlanKey = currentStatus.startsWith('pending_biz_')
    ? currentStatus.replace('pending_biz_', '')
    : currentStatus.startsWith('pending_')
    ? currentStatus.replace('pending_', '')
    : currentStatus;

  const currentPlanIndex = PLAN_DISPLAY.findIndex((p) => p.key === currentPlanKey);
  const currentPlan = PLAN_DISPLAY[currentPlanIndex] ?? PLAN_DISPLAY[0];
  const isActive = currentStatus !== 'free' && !currentStatus.startsWith('pending');

  // Job Posts Used progress bar values
  const planLimit = currentPlan.jobLimit;
  const usedCount = Math.min(activeJobs, planLimit);
  const usedPct = planLimit > 0 ? Math.round((usedCount / planLimit) * 100) : 0;

  return (
    <>
      <PortalTopBar title="Billing & Plan" darkMode={dm} />
      <div className="max-w-[1088px] mx-auto p-8 space-y-8">

        {/* Current plan */}
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

          {/* Job Posts Used progress bar */}
          <div className={`mt-5 pt-5 border-t ${divider}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${text}`}>Job Posts Used</span>
              <span className={`text-sm font-semibold ${text}`}>{usedCount} / {planLimit}</span>
            </div>
            <div className={`w-full h-2 rounded-full ${dm ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div className="h-2 rounded-full bg-[#1d4ed8]" style={{ width: `${usedPct}%` }} />
            </div>
            <p className={`text-sm mt-2 ${muted}`}>{Math.max(0, planLimit - usedCount)} job post{planLimit - usedCount !== 1 ? 's' : ''} remaining this cycle</p>
          </div>
        </div>

        {/* Available plans */}
        <div>
          <p className={sectionLabel}>Available Plans</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLAN_DISPLAY.map((plan, idx) => {
              const isCurrent = plan.key === currentPlanKey;
              const isUpgrade = idx > currentPlanIndex;
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
                  ) : isUpgrade ? (
                    <button
                      onClick={() => onSelectPlan(plan.key)}
                      disabled={planSaving}
                      className="w-full py-2 rounded-lg text-sm font-semibold bg-blue-50 text-[#1d4ed8] border border-[#1d4ed8] hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {planSaving ? 'Updating…' : 'Upgrade'}
                    </button>
                  ) : (
                    <button
                      onClick={() => onSelectPlan(plan.key)}
                      disabled={planSaving}
                      className={`w-full py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {planSaving ? 'Updating…' : 'Switch Plan'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Billing history placeholder */}
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
