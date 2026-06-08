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
import { ToolLibrary } from '../components/ToolLibrary';
import { SiteVerifiedTalent } from '../components/SiteVerifiedTalent';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';

export const JobseekerHomePage: React.FC = () => {
  const { t } = useMarketingI18n();

  return (
    <SiteLayout pageId="jobseeker-home">
      <section className="py-12 sm:py-[var(--site-section)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-14 items-center">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-tight tracking-tight">
              {t('site_js_hero_title')}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-[var(--site-text-muted)] max-w-xl">
              {t('site_js_hero_subtitle')}
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              <SiteButton href={SITE_ROUTES.workspace} className="w-full sm:w-auto justify-center">
                {t('site_cta_analyze_resume')}
              </SiteButton>
              <SiteButton variant="secondary" to={SITE_ROUTES.sampleReport} className="w-full sm:w-auto justify-center">
                {t('site_cta_sample_report')}
              </SiteButton>
            </div>
          </div>
          <div className="min-w-0 w-full">
            <HeroProductScene t={t} />
          </div>
        </div>
      </section>

      <section id="workflow" className="py-12 sm:py-[var(--site-section)] bg-[var(--site-surface-muted)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-2xl font-semibold mb-8">{t('site_workflow_title')}</h2>
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

      <section className="py-12 sm:py-[var(--site-section)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-8">
          <InterviewFeedbackPreview t={t} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--site-action)] mb-4">{t('site_career_switcher_label')}</p>
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
