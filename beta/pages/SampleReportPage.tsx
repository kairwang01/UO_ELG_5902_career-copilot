import React from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { ReportPreview } from '../components/ReportPreview';
import { InterviewFeedbackPreview } from '../components/InterviewFeedbackPreview';
import { BetaButton } from '../components/BetaButton';
import { sampleReport } from '../mock/sampleReport';
import { BETA_ROUTES } from '../../config/beta';
import { useBetaI18n } from '../hooks/useBetaI18n';

export const SampleReportPage: React.FC = () => {
  const { t } = useBetaI18n();
  const intro = t('beta_sample_intro')
    .replace('{name}', sampleReport.candidateName)
    .replace('{role}', sampleReport.targetRole);

  return (
    <BetaLayout>
      <section className="py-12 sm:py-[var(--beta-section)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold">{t('beta_sample_title')}</h1>
          <p className="mt-3 text-sm sm:text-base text-[var(--beta-text-muted)]">{intro}</p>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8">
          <ReportPreview t={t} />
          <div className="border border-[var(--beta-border)] rounded-[var(--beta-radius)] p-4 sm:p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--beta-text-muted)] mb-2">
              {t('beta_sample_rewrite')}
            </p>
            <p className="text-sm">{sampleReport.rewriteSuggestion}</p>
          </div>
          <InterviewFeedbackPreview t={t} />
          <div className="text-center pt-4">
            <BetaButton href={BETA_ROUTES.mvpApp} className="w-full sm:w-auto justify-center">
              {t('beta_cta_upload_resume')}
            </BetaButton>
          </div>
        </div>
      </section>
    </BetaLayout>
  );
};
