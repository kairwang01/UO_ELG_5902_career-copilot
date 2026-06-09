import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SiteLayout } from '../components/SiteLayout';
import { SiteButton } from '../components/SiteButton';
import { SiteCard } from '../components/SiteCard';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';
import { employerAddOnPlans, employerPlans, jobseekerPlans, planKey, type BetaPlanConfig } from '../config/pricingPlans';
import { CREDIT_PACKS } from '../../config/credits';

/**
 * Literal copy for LLM/model access — intentionally not i18n keys so every
 * locale gets readable English text instead of raw key fallbacks.
 */
const PLAN_LLM_COPY: Record<string, string> = {
  js_free:       'Standard AI model · 25 runs/day',
  js_essentials: 'Premium models',
  js_accelerator:'Premium models',
  js_executive:  'Premium models',
  emp_free:      'Standard AI model',
  emp_starter:   'Bring your own LLM API (custom endpoint)',
  emp_growth:    'Bring your own LLM API (custom endpoint)',
  emp_team:      'Bring your own LLM API (custom endpoint)',
  emp_single_post: 'AI-powered candidate matching',
  emp_job_pack:    'AI-powered candidate matching',
};

interface PlanGridProps {
  plans: BetaPlanConfig[];
  ctaHref: string;
  t: (key: string) => string;
}

const PlanGrid: React.FC<PlanGridProps> = ({ plans, ctaHref, t }) => (
  <div
    className={`grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5 items-stretch ${
      plans.length > 2 ? 'lg:grid-cols-4' : ''
    }`}
  >
    {plans.map((plan) => (
      <SiteCard
        key={plan.id}
        className={`relative flex flex-col p-6 sm:p-7 transition-colors ${
          plan.recommended
            ? 'border-[var(--site-action)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] ring-1 ring-[var(--site-action)]'
            : 'hover:border-slate-300'
        }`}
      >
        {plan.recommended && (
          <p className="mb-4 w-fit rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase text-[var(--site-action)]">
            {t('site_pricing_recommended')}
          </p>
        )}
        <h3 className="font-bold text-xl tracking-tight text-[var(--site-text)]">{t(planKey(plan.id, 'name'))}</h3>
        <p className="text-4xl sm:text-5xl font-bold tracking-[-0.045em] mt-4 text-[var(--site-text)]">
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
        <div className="my-1 h-px bg-[var(--site-border)]" />
        <ul className="mt-5 text-sm space-y-3 flex-1 text-[var(--site-text-muted)]">
          {Array.from({ length: plan.featureCount }, (_, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--site-ready-bg)] text-[10px] font-bold text-[var(--site-ready)]">✓</span>
              <span>{t(planKey(plan.id, `f${i + 1}` as `f${number}`))}</span>
            </li>
          ))}
          {PLAN_LLM_COPY[plan.id] && (
            <li className="flex gap-2.5">
              <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-500">✦</span>
              <span className="text-[var(--site-text-muted)]">{PLAN_LLM_COPY[plan.id]}</span>
            </li>
          )}
        </ul>
        <SiteButton variant={plan.recommended ? 'primary' : 'secondary'} href={ctaHref} className="mt-7 w-full py-3 font-semibold">
          {t('site_pricing_get_started')}
        </SiteButton>
      </SiteCard>
    ))}
  </div>
);

export const PricingPage: React.FC = () => {
  const { t } = useMarketingI18n();
  const location = useLocation();
  const [audience, setAudience] = useState<'jobseeker' | 'employer'>('jobseeker');
  const [upsellDismissed, setUpsellDismissed] = useState(false);
  const plans = audience === 'jobseeker' ? jobseekerPlans : employerPlans;
  const ctaHref = audience === 'jobseeker' ? SITE_ROUTES.workspace : SITE_ROUTES.portal;
  const showBusinessUpsell =
    !upsellDismissed &&
    new URLSearchParams(location.search).get('from') === 'business-upsell';

  return (
    <SiteLayout pageId="pricing">
      {showBusinessUpsell && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm text-amber-900"
        >
          <span>{t('site_pricing_business_upsell_banner')}</span>
          <button
            type="button"
            onClick={() => setUpsellDismissed(true)}
            className="shrink-0 rounded p-1 hover:bg-amber-100 transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_55%,#f8fafc_100%)] py-14 sm:py-20">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-blue-100/55 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-action)]">
              Pricing
            </p>
            <h1 className="mt-4 text-[clamp(2.25rem,5vw,4.5rem)] font-bold leading-[1] tracking-[-0.055em] text-[var(--site-text)]">
              {t('site_pricing_title')}
            </h1>
            <p className="mt-5 text-base sm:text-lg leading-8 text-[var(--site-text-muted)]">
              {audience === 'jobseeker' ? t('site_pricing_js_desc') : t('site_pricing_emp_desc')}
            </p>
          </div>

          <div className="mx-auto mt-8 mb-10 sm:mb-12 flex w-full max-w-md rounded-full border border-[var(--site-border)] bg-white p-1 shadow-sm">
            {(['jobseeker', 'employer'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAudience(option)}
                className={`min-h-[42px] flex-1 rounded-full px-4 text-sm font-semibold transition-colors ${
                  audience === option
                    ? 'bg-[var(--site-text)] text-white'
                    : 'text-[var(--site-text-muted)] hover:text-[var(--site-text)]'
                }`}
              >
                {option === 'jobseeker' ? t('site_pricing_jobseekers') : t('site_pricing_employers')}
              </button>
            ))}
          </div>

          <PlanGrid plans={plans} ctaHref={ctaHref} t={t} />

          <p className="mt-5 text-center text-xs text-[var(--site-text-muted)]">
            {audience === 'jobseeker'
              ? 'Free plan includes our standard AI model · Paid plans unlock premium models and remove the daily run cap'
              : 'Business plans support a custom LLM endpoint — connect your own OpenAI-compatible API key'}
          </p>

          {audience === 'jobseeker' ? (
            <section className="mt-16 rounded-[calc(var(--site-radius)*2)] border border-[var(--site-border)] bg-white p-6 sm:p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.035em]">{t('site_pricing_topup_title')}</h2>
                <p className="mt-2 text-sm sm:text-base text-[var(--site-text-muted)]">
                  {t('site_pricing_topup_desc')}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {CREDIT_PACKS.map((pack) => (
                  <SiteCard key={pack.key} className="text-center bg-[var(--site-surface-muted)]">
                    <h3 className="font-semibold">{pack.name}</h3>
                    <p className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--site-text)]">{pack.credits.toLocaleString()}</p>
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
            <section className="mt-16 rounded-[calc(var(--site-radius)*2)] border border-[var(--site-border)] bg-white p-6 sm:p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.035em]">{t('site_pricing_job_posts_title')}</h2>
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
