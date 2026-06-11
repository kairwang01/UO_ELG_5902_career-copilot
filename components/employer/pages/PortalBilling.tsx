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

// Names and feature lines come from i18n: portal_plan_<key>_name / _f1.._f4
const PLAN_DISPLAY = [
  { key: 'free', price: '$0', period: '/month', jobLimit: 3 },
  { key: 'starter', price: '$79', period: '/month', jobLimit: 8 },
  { key: 'growth', price: '$199', period: '/month', jobLimit: 20 },
  { key: 'pro', price: '$499', period: '/month', jobLimit: 100 },
];

const PLAN_FEATURE_SLOTS = [1, 2, 3, 4] as const;

export function PortalBilling({ profile, darkMode, activeJobs, onSelectPlan, planSaving = false, navigateToBusinessPricing, t }: PortalBillingProps) {
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
      <PortalTopBar title={t('portal_nav_billing')} darkMode={dm} />
      <div className="max-w-[1088px] mx-auto p-8 space-y-8 animate-view-fade">

        {/* Current plan */}
        <div className={card}>
          <p className={sectionLabel}>{t('portal_billing_current_plan')}</p>
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={18} className="text-[#1d4ed8]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className={`text-xl font-bold ${text}`}>
                    {t('portal_billing_plan_title').replace('{name}', t(`portal_plan_${currentPlan.key}_name`))}
                  </h2>
                  {isActive && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-[#1d4ed8]">
                      {t('portal_billing_active')}
                    </span>
                  )}
                  {currentStatus.startsWith('pending') && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                      {t('portal_billing_pending')}
                    </span>
                  )}
                </div>
                <p className={`text-sm ${muted}`}>
                  {currentPlan.price}{currentPlan.period}
                  {isActive && (
                    <> &nbsp;·&nbsp; <span className={dm ? 'text-gray-300' : 'text-gray-700'}>{t('portal_billing_billed_monthly')}</span></>
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
              {t('portal_billing_manage')}
            </button>
          </div>

          {/* Job Posts Used progress bar */}
          <div className={`mt-5 pt-5 border-t ${divider}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${text}`}>{t('portal_billing_posts_used')}</span>
              <span className={`text-sm font-semibold ${text}`}>{usedCount} / {planLimit}</span>
            </div>
            <div className={`w-full h-2 rounded-full ${dm ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div className="h-2 rounded-full bg-[#1d4ed8]" style={{ width: `${usedPct}%` }} />
            </div>
            <p className={`text-sm mt-2 ${muted}`}>
              {t('portal_billing_posts_remaining').replace('{n}', String(Math.max(0, planLimit - usedCount)))}
            </p>
          </div>
        </div>

        {/* Available plans */}
        <div>
          <p className={sectionLabel}>{t('portal_billing_available_plans')}</p>
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
                  <p className={`text-sm font-semibold mb-1 ${isCurrent ? 'text-[#1d4ed8]' : muted}`}>{t(`portal_plan_${plan.key}_name`)}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className={`text-2xl font-bold ${text}`}>{plan.price}</span>
                    <span className={`text-sm ${muted}`}>{plan.period}</span>
                  </div>
                  <ul className="space-y-2 flex-1 mb-5">
                    {PLAN_FEATURE_SLOTS.map((slot) => (
                      <li key={slot} className="flex items-start gap-2">
                        <Check size={13} className="text-[#1d4ed8] mt-0.5 shrink-0" />
                        <span className={`text-sm ${muted}`}>{t(`portal_plan_${plan.key}_f${slot}`)}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <button disabled className="w-full py-2 rounded-lg text-sm font-semibold bg-[#1d4ed8] text-white cursor-default">
                      {t('portal_billing_current_plan')}
                    </button>
                  ) : isUpgrade ? (
                    <button
                      onClick={() => onSelectPlan(plan.key)}
                      disabled={planSaving}
                      className="w-full py-2 rounded-lg text-sm font-semibold bg-blue-50 text-[#1d4ed8] border border-[#1d4ed8] hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {planSaving ? t('portal_billing_updating') : t('portal_billing_upgrade')}
                    </button>
                  ) : (
                    <button
                      onClick={() => onSelectPlan(plan.key)}
                      disabled={planSaving}
                      className={`w-full py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {planSaving ? t('portal_billing_updating') : t('portal_billing_switch')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Billing history placeholder */}
        <div className={card}>
          <p className={sectionLabel}>{t('portal_billing_history')}</p>
          <p className={`text-sm ${muted}`}>
            {t('portal_billing_history_empty')}
          </p>
        </div>
      </div>
    </>
  );
}
