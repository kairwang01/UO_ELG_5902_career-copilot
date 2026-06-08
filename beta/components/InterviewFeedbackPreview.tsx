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
    { key: 'S', label: t('beta_interview_star_s'), text: f.starFeedback.situation },
    { key: 'T', label: t('beta_interview_star_t'), text: f.starFeedback.task },
    { key: 'A', label: t('beta_interview_star_a'), text: f.starFeedback.action },
    { key: 'R', label: t('beta_interview_star_r'), text: f.starFeedback.result },
  ];

  return (
    <ToolPanelChrome title={t('beta_tool_interview')} subtitle={t('beta_interview_session_subtitle')}>
      <p className="text-sm font-medium mb-4">{f.question}</p>
      <p className="text-xs text-[var(--beta-text-muted)] mb-4 border-l-2 border-[var(--beta-border)] pl-3">
        {f.userAnswerSummary}
      </p>
      <div className="grid sm:grid-cols-2 gap-2 mb-4">
        {starRows.map((row) => (
          <div key={row.key} className="text-xs p-2 rounded border border-[var(--beta-border)] bg-[var(--beta-surface-muted)]">
            <span className="font-semibold text-[var(--beta-action)]">{row.label}</span>
            <span className="text-[var(--beta-text-muted)] ml-1">— {row.text}</span>
          </div>
        ))}
      </div>
      <div className="mb-3 p-3 rounded border border-[var(--beta-gap)]/30 bg-[var(--beta-gap-bg)] text-sm">
        <span className="font-medium text-[var(--beta-gap)]">{t('beta_interview_gap')}: </span>
        {f.starFeedback.missing}
      </div>
      <ScoreBar label={t('beta_interview_clarity')} value={f.clarityScore} tone="gap" />
      <p className="text-xs text-[var(--beta-text-muted)] mt-3">{t('beta_interview_next')}: {f.nextDrill}</p>
    </ToolPanelChrome>
  );
};
