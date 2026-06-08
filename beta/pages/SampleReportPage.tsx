import React from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { ReportPreview } from '../components/ReportPreview';
import { BetaButton } from '../components/BetaButton';
import { sampleReport } from '../mock/sampleReport';
import { interviewFeedback } from '../mock/interviewFeedback';
import { BETA_ROUTES } from '../../config/beta';

export const SampleReportPage: React.FC = () => (
  <BetaLayout>
    <section className="py-[var(--beta-section)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-10">
        <h1 className="text-3xl font-semibold">Sample Resume Readiness Report</h1>
        <p className="mt-3 text-[var(--beta-text-muted)]">
          Mock data for {sampleReport.candidateName} targeting {sampleReport.targetRole}. This is what users see after upload — not a marketing score card.
        </p>
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
        <ReportPreview />
        <div className="border border-[var(--beta-border)] rounded-[var(--beta-radius)] p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--beta-text-muted)] mb-2">Rewrite suggestion</p>
          <p className="text-sm">{sampleReport.rewriteSuggestion}</p>
        </div>
        <div className="border border-[var(--beta-border)] rounded-[var(--beta-radius)] p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--beta-text-muted)] mb-2">Interview Practice preview</p>
          <p className="font-medium text-sm mb-2">{interviewFeedback.question}</p>
          <p className="text-sm text-[var(--beta-text-muted)] mb-3">{interviewFeedback.starFeedback.missing}</p>
          <p className="text-sm">
            Clarity score: <strong>{interviewFeedback.clarityScore}</strong> · Next: {interviewFeedback.nextDrill}
          </p>
        </div>
        <div className="text-center pt-4">
          <BetaButton href={BETA_ROUTES.mvpApp}>Upload your resume</BetaButton>
        </div>
      </div>
    </section>
  </BetaLayout>
);
