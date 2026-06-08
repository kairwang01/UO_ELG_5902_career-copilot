import React, { useState } from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { BetaButton } from '../components/BetaButton';
import { BetaCard } from '../components/BetaCard';
import { BETA_ROUTES } from '../../config/beta';
import { useBetaI18n } from '../hooks/useBetaI18n';
import { employerPlans, jobseekerPlans, planKey } from '../config/pricingPlans';

export const PricingPage: React.FC = () => {
  const { t } = useBetaI18n();
  const [audience, setAudience] = useState<'jobseeker' | 'employer'>('jobseeker');
  const plans = audience === 'jobseeker' ? jobseekerPlans : employerPlans;

  return (
    <BetaLayout pageId="pricing">
      <section className="py-12 sm:py-[var(--beta-section)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-center mb-4">{t('beta_pricing_title')}</h1>
          <p className="text-center text-[var(--beta-text-muted)] mb-8 max-w-xl mx-auto text-sm sm:text-base">
            {audience === 'jobseeker' ? t('beta_pricing_js_desc') : t('beta_pricing_emp_desc')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-2 mb-10 sm:mb-12">
            <button
              type="button"
              onClick={() => setAudience('jobseeker')}
              className={`px-4 py-2.5 min-h-[44px] rounded-[var(--beta-radius)] text-sm font-medium ${
                audience === 'jobseeker'
                  ? 'bg-[var(--beta-action)] text-white'
                  : 'border border-[var(--beta-border)] text-[var(--beta-text-muted)]'
              }`}
            >
              {t('beta_pricing_jobseekers')}
            </button>
            <button
              type="button"
              onClick={() => setAudience('employer')}
              className={`px-4 py-2.5 min-h-[44px] rounded-[var(--beta-radius)] text-sm font-medium ${
                audience === 'employer'
                  ? 'bg-[var(--beta-action)] text-white'
                  : 'border border-[var(--beta-border)] text-[var(--beta-text-muted)]'
              }`}
            >
              {t('beta_pricing_employers')}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {plans.map((plan) => (
              <BetaCard
                key={plan.id}
                className={`flex flex-col ${
                  plan.recommended ? 'border-2 border-[var(--beta-action)] lg:-mt-2 lg:mb-2' : ''
                }`}
              >
                {plan.recommended && (
                  <p className="text-xs font-medium text-[var(--beta-action)] mb-2">{t('beta_pricing_recommended')}</p>
                )}
                <h3 className="font-semibold text-lg">{t(planKey(plan.id, 'name'))}</h3>
                <p className="text-2xl font-semibold mt-2">
                  {t(planKey(plan.id, 'price'))}
                  {!plan.isCustomPrice && (
                    <span className="text-sm font-normal text-[var(--beta-text-muted)]">
                      {t('beta_pricing_per_month')}
                    </span>
                  )}
                </p>
                <p className="text-sm text-[var(--beta-text-muted)] mt-1 mb-4">{t(planKey(plan.id, 'desc'))}</p>
                <ul className="text-sm space-y-2 flex-1 text-[var(--beta-text-muted)]">
                  {Array.from({ length: plan.featureCount }, (_, i) => (
                    <li key={i}>· {t(planKey(plan.id, `f${i + 1}` as `f${number}`))}</li>
                  ))}
                </ul>
                <BetaButton
                  variant={plan.recommended ? 'primary' : 'secondary'}
                  href={BETA_ROUTES.mvpApp}
                  className="mt-6 w-full"
                >
                  {t('beta_pricing_get_started')}
                </BetaButton>
              </BetaCard>
            ))}
          </div>
        </div>
      </section>
    </BetaLayout>
  );
};
