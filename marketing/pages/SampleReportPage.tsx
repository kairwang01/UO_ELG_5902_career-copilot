import React from 'react';
import { SiteLayout } from '../components/SiteLayout';
import { ReportPreview } from '../components/ReportPreview';
import { InterviewFeedbackPreview } from '../components/InterviewFeedbackPreview';
import { SiteButton } from '../components/SiteButton';
import { sampleReport } from '../mock/sampleReport';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--site-text-muted)] mb-2">
    {children}
  </p>
);

export const SampleReportPage: React.FC = () => {
  const { t } = useMarketingI18n();
  const intro = t('site_sample_intro')
    .replace('{name}', sampleReport.candidateName)
    .replace('{role}', sampleReport.targetRole);

  return (
    <SiteLayout pageId="sample-report">
      <section className="py-8 sm:py-[var(--site-section)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-5 sm:mb-10">
          <h1 className="text-xl sm:text-3xl font-semibold leading-tight">{t('site_sample_title')}</h1>
          <p className="mt-2 text-sm sm:text-base text-[var(--site-text-muted)]">{intro}</p>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-8">
          <ReportPreview t={t} />

          <div>
            <SectionLabel>{t('site_sample_rewrite')}</SectionLabel>
            <div className="border border-[var(--site-border)] rounded-[var(--site-radius)] p-3.5 sm:p-5 bg-[var(--site-surface-muted)]">
              <p className="text-sm leading-relaxed">{sampleReport.rewriteSuggestion}</p>
            </div>
          </div>

          <InterviewFeedbackPreview t={t} />

          <div className="pt-2 sm:pt-4">
            <SiteButton href={SITE_ROUTES.workspace} className="w-full sm:w-auto sm:mx-auto sm:flex justify-center">
              {t('site_cta_upload_resume')}
            </SiteButton>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
};
