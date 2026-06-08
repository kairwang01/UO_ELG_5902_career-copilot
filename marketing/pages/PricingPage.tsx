import React, { useState } from 'react';
import { SiteLayout } from '../components/SiteLayout';
import { SiteButton } from '../components/SiteButton';
import { SiteCard } from '../components/SiteCard';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';
import { employerAddOnPlans, employerPlans, jobseekerPlans, planKey, type BetaPlanConfig } from '../config/pricingPlans';
import { CREDIT_PACKS } from '../../config/credits';

interface PlanGridProps {
  plans: BetaPlanConfig[];
  ctaHref: string;
  t: (key: string) => string;
}

const PlanGrid: React.FC<PlanGridProps> = ({ plans, ctaHref, t }) => (
  <div
    className={`grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch ${
      plans.length > 2 ? 'lg:grid-cols-4' : ''
    }`}
  >
    {plans.map((plan) => (
      <SiteCard
        key={plan.id}
        className={`flex flex-col ${
          plan.recommended ? 'border-2 border-[var(--site-action)] lg:-mt-2 lg:mb-2' : ''
        }`}
      >
        {plan.recommended && (
          <p className="text-xs font-semibold tracking-wide uppercase text-[var(--site-action)] mb-3">
            {t('site_pricing_recommended')}
          </p>
        )}
        <h3 className="font-semibold text-lg text-[var(--site-text)]">{t(planKey(plan.id, 'name'))}</h3>
        <p className="text-4xl font-bold tracking-tight mt-3 text-[var(--site-text)]">
          {t(planKey(plan.id, 'price'))}
          {!plan.isCustomPrice && (
            <span className="ml-1 text-sm font-medium text-[var(--site-text-muted)]">
              {t('site_pricing_per_month')}
            </span>
          )}
        </p>
        <p className="text-sm font-medium text-[var(--site-text-muted)] mt-2 mb-5">
          {t(planKey(plan.id, 'desc'))}
        </p>
        <ul className="text-sm space-y-2 flex-1 text-[var(--site-text-muted)]">
          {Array.from({ length: plan.featureCount }, (_, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[var(--site-ready)]">✓</span>
              <span>{t(planKey(plan.id, `f${i + 1}` as `f${number}`))}</span>
            </li>
          ))}
        </ul>
        <SiteButton variant={plan.recommended ? 'primary' : 'secondary'} href={ctaHref} className="mt-6 w-full">
          {t('site_pricing_get_started')}
        </SiteButton>
      </SiteCard>
    ))}
  </div>
);

export const PricingPage: React.FC = () => {
  const { t } = useMarketingI18n();
  const [audience, setAudience] = useState<'jobseeker' | 'employer'>('jobseeker');
  const plans = audience === 'jobseeker' ? jobseekerPlans : employerPlans;
  const ctaHref = audience === 'jobseeker' ? SITE_ROUTES.workspace : SITE_ROUTES.portal;

  return (
    <SiteLayout pageId="pricing">
      <section className="py-12 sm:py-[var(--site-section)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-center mb-4">{t('site_pricing_title')}</h1>
          <p className="text-center text-[var(--site-text-muted)] mb-8 max-w-xl mx-auto text-sm sm:text-base">
            {audience === 'jobseeker' ? t('site_pricing_js_desc') : t('site_pricing_emp_desc')}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-2 mb-10 sm:mb-12">
            <button
              type="button"
              onClick={() => setAudience('jobseeker')}
              className={`px-4 py-2.5 min-h-[44px] rounded-[var(--site-radius)] text-sm font-medium ${
                audience === 'jobseeker'
                  ? 'bg-[var(--site-action)] text-white'
                  : 'border border-[var(--site-border)] text-[var(--site-text-muted)]'
              }`}
            >
              {t('site_pricing_jobseekers')}
            </button>
            <button
              type="button"
              onClick={() => setAudience('employer')}
              className={`px-4 py-2.5 min-h-[44px] rounded-[var(--site-radius)] text-sm font-medium ${
                audience === 'employer'
                  ? 'bg-[var(--site-action)] text-white'
                  : 'border border-[var(--site-border)] text-[var(--site-text-muted)]'
              }`}
            >
              {t('site_pricing_employers')}
            </button>
          </div>
          <PlanGrid plans={plans} ctaHref={ctaHref} t={t} />

          {audience === 'jobseeker' ? (
            <section className="mt-16">
              <div className="text-center mb-8">
                <h2 className="text-xl sm:text-2xl font-semibold">{t('site_pricing_topup_title')}</h2>
                <p className="mt-2 text-sm sm:text-base text-[var(--site-text-muted)]">
                  {t('site_pricing_topup_desc')}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {CREDIT_PACKS.map((pack) => (
                  <SiteCard key={pack.key} className="text-center">
                    <h3 className="font-semibold">{pack.name}</h3>
                    <p className="mt-3 text-4xl font-bold text-[var(--site-text)]">{pack.credits.toLocaleString()}</p>
                    <p className="text-sm text-[var(--site-text-muted)]">{t('site_pricing_credits_label')}</p>
                    <p className="mt-5 text-lg font-semibold">{pack.price}</p>
                    <p className="text-xs text-[var(--site-text-muted)]">{pack.priceDescription}</p>
                    <SiteButton href={SITE_ROUTES.workspace} variant="secondary" className="mt-5 w-full">
                      {t('site_pricing_buy_credits')}
                    </SiteButton>
                  </SiteCard>
                ))}
              </div>
            </section>
          ) : (
            <section className="mt-16">
              <div className="text-center mb-8">
                <h2 className="text-xl sm:text-2xl font-semibold">{t('site_pricing_job_posts_title')}</h2>
                <p className="mt-2 text-sm sm:text-base text-[var(--site-text-muted)]">
                  {t('site_pricing_job_posts_desc')}
                </p>
              </div>
              <div className="max-w-4xl mx-auto">
                <PlanGrid plans={employerAddOnPlans} ctaHref={SITE_ROUTES.portal} t={t} />
              </div>
            </section>
          )}
        </div>
      </section>
    </SiteLayout>
  );
};
