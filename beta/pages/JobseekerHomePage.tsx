import React from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { BetaButton } from '../components/BetaButton';
import { ReportPreview } from '../components/ReportPreview';
import { CareerPathPreview } from '../components/CareerPathPreview';
import { InterviewFeedbackPreview } from '../components/InterviewFeedbackPreview';
import { CaseSnapshots } from '../components/CaseSnapshots';
import { WorkflowSteps } from '../components/WorkflowSteps';
import { BETA_ROUTES } from '../../config/beta';
import { useBetaI18n } from '../hooks/useBetaI18n';

const coreToolKeys = [
  { name: 'beta_tool_resume_report', desc: 'beta_tool_resume_report_desc', featured: true },
  { name: 'beta_tool_role_match', desc: 'beta_tool_role_match_desc', featured: false },
  { name: 'beta_tool_interview', desc: 'beta_tool_interview_desc', featured: false },
  { name: 'beta_tool_career_path', desc: 'beta_tool_career_path_desc', featured: false },
  { name: 'beta_tool_outreach', desc: 'beta_tool_outreach_desc', featured: false },
  { name: 'beta_tool_verified', desc: 'beta_tool_verified_desc', featured: false },
] as const;

export const JobseekerHomePage: React.FC = () => {
  const { t } = useBetaI18n();

  return (
    <BetaLayout>
      <section className="py-12 sm:py-[var(--beta-section)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-tight tracking-tight">
              {t('beta_js_hero_title')}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-[var(--beta-text-muted)] max-w-xl">
              {t('beta_js_hero_subtitle')}
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              <BetaButton to={BETA_ROUTES.sampleReport} className="w-full sm:w-auto justify-center">
                {t('beta_cta_sample_report')}
              </BetaButton>
              <BetaButton variant="secondary" href={BETA_ROUTES.mvpApp} className="w-full sm:w-auto justify-center">
                {t('beta_cta_upload_resume')}
              </BetaButton>
            </div>
          </div>
          <div className="min-w-0 w-full">
            <ReportPreview t={t} compact />
          </div>
        </div>
      </section>

      <section id="workflow" className="py-12 sm:py-[var(--beta-section)] bg-[var(--beta-surface-muted)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-2xl font-semibold mb-8">{t('beta_workflow_title')}</h2>
          <WorkflowSteps
            steps={[
              { title: t('beta_workflow_analyze_title'), description: t('beta_workflow_analyze_desc') },
              { title: t('beta_workflow_match_title'), description: t('beta_workflow_match_desc') },
              { title: t('beta_workflow_practice_title'), description: t('beta_workflow_practice_desc') },
              { title: t('beta_workflow_plan_title'), description: t('beta_workflow_plan_desc') },
            ]}
          />
        </div>
      </section>

      <section className="py-12 sm:py-[var(--beta-section)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-8">
          <InterviewFeedbackPreview t={t} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--beta-action)] mb-4">{t('beta_career_switcher_label')}</p>
            <CareerPathPreview t={t} compact />
          </div>
        </div>
      </section>

      <CaseSnapshots t={t} />

      <section className="py-12 sm:py-[var(--beta-section)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-2xl font-semibold mb-8">{t('beta_core_tools_title')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coreToolKeys.map((tool) => (
              <div
                key={tool.name}
                className={`border border-[var(--beta-border)] rounded-[var(--beta-radius)] p-5 bg-[var(--beta-surface)] ${
                  tool.featured ? 'sm:col-span-2 lg:col-span-1 border-[var(--beta-action)] border-2' : ''
                }`}
              >
                <h3 className="font-semibold">{t(tool.name)}</h3>
                <p className="text-sm text-[var(--beta-text-muted)] mt-1">{t(tool.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 text-center border-t border-[var(--beta-border)]">
        <BetaButton to={BETA_ROUTES.pricing}>{t('beta_cta_see_pricing')}</BetaButton>
      </section>
    </BetaLayout>
  );
};
