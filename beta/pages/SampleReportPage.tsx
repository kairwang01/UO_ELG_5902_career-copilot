import React from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { ReportPreview } from '../components/ReportPreview';
import { InterviewFeedbackPreview } from '../components/InterviewFeedbackPreview';
import { BetaButton } from '../components/BetaButton';
import { sampleReport } from '../mock/sampleReport';
import { BETA_ROUTES } from '../../config/beta';
import { useBetaI18n } from '../hooks/useBetaI18n';

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--beta-text-muted)] mb-2">
    {children}
  </p>
);

export const SampleReportPage: React.FC = () => {
  const { t } = useBetaI18n();
  const intro = t('beta_sample_intro')
    .replace('{name}', sampleReport.candidateName)
    .replace('{role}', sampleReport.targetRole);

  return (
    <BetaLayout pageId="sample-report">
      <section className="py-8 sm:py-[var(--beta-section)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-5 sm:mb-10">
          <h1 className="text-xl sm:text-3xl font-semibold leading-tight">{t('beta_sample_title')}</h1>
          <p className="mt-2 text-sm sm:text-base text-[var(--beta-text-muted)]">{intro}</p>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-8">
          <ReportPreview t={t} />

          <div>
            <SectionLabel>{t('beta_sample_rewrite')}</SectionLabel>
            <div className="border border-[var(--beta-border)] rounded-[var(--beta-radius)] p-3.5 sm:p-5 bg-[var(--beta-surface-muted)]">
              <p className="text-sm leading-relaxed">{sampleReport.rewriteSuggestion}</p>
            </div>
          </div>

          <InterviewFeedbackPreview t={t} />

          <div className="pt-2 sm:pt-4">
            <BetaButton href={BETA_ROUTES.mvpApp} className="w-full sm:w-auto sm:mx-auto sm:flex justify-center">
              {t('beta_cta_upload_resume')}
            </BetaButton>
          </div>
        </div>
      </section>
    </BetaLayout>
  );
};
