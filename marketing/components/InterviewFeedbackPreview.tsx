import React from 'react';
import { interviewFeedback } from '../mock/interviewFeedback';
import { ToolPanelChrome } from './ToolPanelChrome';
import { ScoreBar } from './ScoreBar';

interface InterviewFeedbackPreviewProps {
  t: (key: string) => string;
}

export const InterviewFeedbackPreview: React.FC<InterviewFeedbackPreviewProps> = ({ t }) => {
  const f = interviewFeedback;
  const starRows = [
    { key: 'S', label: t('site_interview_star_s'), text: f.starFeedback.situation },
    { key: 'T', label: t('site_interview_star_t'), text: f.starFeedback.task },
    { key: 'A', label: t('site_interview_star_a'), text: f.starFeedback.action },
    { key: 'R', label: t('site_interview_star_r'), text: f.starFeedback.result },
  ];

  return (
    <ToolPanelChrome title={t('site_tool_interview')} subtitle={t('site_interview_session_subtitle')}>
      <p className="text-sm font-medium mb-4">{f.question}</p>
      <p className="text-xs text-[var(--site-text-muted)] mb-4 border-l-2 border-[var(--site-border)] pl-3">
        {f.userAnswerSummary}
      </p>
      <div className="grid sm:grid-cols-2 gap-2 mb-4">
        {starRows.map((row) => (
          <div key={row.key} className="text-xs p-2 rounded border border-[var(--site-border)] bg-[var(--site-surface-muted)]">
            <span className="font-semibold text-[var(--site-action)]">{row.label}</span>
            <span className="text-[var(--site-text-muted)] ml-1">— {row.text}</span>
          </div>
        ))}
      </div>
      <div className="mb-3 p-3 rounded border border-[var(--site-gap)]/30 bg-[var(--site-gap-bg)] text-sm">
        <span className="font-medium text-[var(--site-gap)]">{t('site_interview_gap')}: </span>
        {f.starFeedback.missing}
      </div>
      <ScoreBar label={t('site_interview_clarity')} value={f.clarityScore} tone="gap" />
      <p className="text-xs text-[var(--site-text-muted)] mt-3">{t('site_interview_next')}: {f.nextDrill}</p>
    </ToolPanelChrome>
  );
};
