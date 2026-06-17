import React from 'react';
import { SiteLayout } from '../components/SiteLayout';
import { SiteButton } from '../components/SiteButton';
import { HeroProductScene } from '../components/HeroProductScene';
import { CareerPathPreview } from '../components/CareerPathPreview';
import { InterviewFeedbackPreview } from '../components/InterviewFeedbackPreview';
import { CaseSnapshots } from '../components/CaseSnapshots';
import { UserVoices } from '../components/UserVoices';
import { SiteFaq } from '../components/SiteFaq';
import { WorkflowSteps } from '../components/WorkflowSteps';
import { FeatureShowcase } from '../components/FeatureShowcase';
import { ToolLibrary } from '../components/ToolLibrary';
import { SiteVerifiedTalent } from '../components/SiteVerifiedTalent';
import { Navigate, useLocation } from 'react-router-dom';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';
import { useSiteSession } from '../hooks/useSiteSession';

export const JobseekerHomePage: React.FC = () => {
  const { t } = useMarketingI18n();
  const { session, ready, isAdmin, isBusiness } = useSiteSession();
  const { search } = useLocation();

  // A signed-in user landing on bare "/" is routed to their workspace (or the
  // hiring portal) — they have no reason to sit on the marketing home. BUT the
  // workspace "home" button passes ?home=1 to explicitly VIEW the public homepage,
  // so that path must not redirect (otherwise "return to homepage" bounces back).
  const forceHomeView = new URLSearchParams(search).get('home') === '1';
  if (ready && session && !forceHomeView) {
    return <Navigate to={isAdmin ? SITE_ROUTES.admin : isBusiness ? SITE_ROUTES.portal : SITE_ROUTES.workspace} replace />;
  }
  const proofPoints = [
    t('site_tool_resume_report'),
    t('site_workflow_practice_title'),
    t('site_workflow_plan_title'),
  ];

  return (
    <SiteLayout pageId="jobseeker-home">
      <section className="relative overflow-hidden border-b border-[var(--site-border)] bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_68%)] py-14 sm:py-20 lg:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[64%] opacity-[0.38] lg:block [mask-image:linear-gradient(270deg,black_0%,black_60%,transparent_100%)]"
          style={{
            backgroundImage:
              "linear-gradient(270deg, rgba(248,250,252,0.08) 0%, rgba(255,255,255,0.58) 68%, rgba(255,255,255,0.96) 100%), url('https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1974&auto=format&fit=crop')",
            backgroundPosition: 'center right',
            backgroundSize: 'cover',
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-75">
          <div className="absolute inset-y-0 right-0 w-2/3 bg-[linear-gradient(270deg,rgba(248,250,252,0.18)_0%,rgba(255,255,255,0.5)_58%,rgba(255,255,255,0)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--site-border)]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[minmax(0,0.95fr)_minmax(480px,1.05fr)] gap-10 lg:gap-16 items-center">
          <div className="min-w-0">
            <p className="inline-flex rounded-full border border-white/70 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-text-muted)] shadow-sm backdrop-blur">
              Career tools with real output
            </p>
            <h1 className="mt-5 max-w-2xl text-[clamp(2.25rem,3.9vw,3.35rem)] font-bold leading-[1.07] tracking-normal text-[var(--site-text)]">
              {t('site_js_hero_title')}
            </h1>
            <p className="mt-6 max-w-2xl text-base sm:text-lg leading-8 text-[var(--site-text-muted)]">
              {t('site_js_hero_subtitle')}
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              <SiteButton href={SITE_ROUTES.workspace} className="w-full sm:w-auto justify-center px-7 py-3 font-semibold">
                {t('site_cta_analyze_resume')}
              </SiteButton>
              <SiteButton variant="secondary" to={SITE_ROUTES.sampleReport} className="w-full sm:w-auto justify-center px-7 py-3 font-semibold">
                {t('site_cta_sample_report')}
              </SiteButton>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--site-text-muted)]">
              {proofPoints.map((point) => (
                <span key={point} className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--site-action)]" />
                  {point}
                </span>
              ))}
            </div>
          </div>
          <div className="min-w-0 w-full">
            <div className="rounded-[calc(var(--site-radius)*2)] border border-[var(--site-border)] bg-white/80 p-3 shadow-sm">
              <HeroProductScene t={t} />
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="py-14 sm:py-[var(--site-section)] bg-[var(--site-surface-muted)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 grid gap-3 lg:grid-cols-[0.7fr_1fr] lg:items-end">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-action)]">
              Product flow
            </p>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-[-0.035em] text-[var(--site-text)]">
              {t('site_workflow_title')}
            </h2>
          </div>
          <WorkflowSteps
            steps={[
              { title: t('site_workflow_analyze_title'), description: t('site_workflow_analyze_desc') },
              { title: t('site_workflow_match_title'), description: t('site_workflow_match_desc') },
              { title: t('site_workflow_practice_title'), description: t('site_workflow_practice_desc') },
              { title: t('site_workflow_plan_title'), description: t('site_workflow_plan_desc') },
            ]}
          />
        </div>
      </section>

      <FeatureShowcase t={t} />

      <section className="py-14 sm:py-[var(--site-section)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-8 lg:gap-10">
          <InterviewFeedbackPreview t={t} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-action)] mb-4">{t('site_career_switcher_label')}</p>
            <CareerPathPreview t={t} compact />
          </div>
        </div>
      </section>

      <CaseSnapshots t={t} />

      <UserVoices t={t} />

      <ToolLibrary t={t} />

      <SiteVerifiedTalent t={t} />

      <SiteFaq t={t} />

      <section className="py-12 text-center border-t border-[var(--site-border)]">
        <SiteButton to={SITE_ROUTES.pricing}>{t('site_cta_see_pricing')}</SiteButton>
      </section>
    </SiteLayout>
  );
};
