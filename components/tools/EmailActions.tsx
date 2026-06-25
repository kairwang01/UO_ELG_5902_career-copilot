import React from 'react';
import { MailCheck } from 'lucide-react';
import {
  BlockedRegenerateButton,
  canExportQualityGate,
  QualityGateNotice,
  type QualityValidationStatus,
} from './QualityGate';
import { CopyButton, DownloadButtons } from './ToolUtils';

export type EmailValidationStatus = QualityValidationStatus;

export interface EmailValidation {
  status: EmailValidationStatus;
  issues: string[];
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const hasCjkText = (text: string) => /[\u3040-\u30ff\u3400-\u9fff]/.test(text);

export const assessEmailDraft = (subject: string, body: string): EmailValidation => {
  const normalizedSubject = subject.replace(/[ \t]+/g, ' ').trim();
  const normalizedBody = body.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const combined = `${normalizedSubject}\n\n${normalizedBody}`.trim();

  if (!normalizedSubject && !normalizedBody) return { status: 'needs_regen', issues: ['empty'] };

  const issues: string[] = [];
  const bodyWordCount = countWords(normalizedBody);

  if (!normalizedSubject) issues.push('missing_subject');
  if (!normalizedBody) issues.push('missing_body');

  if (normalizedSubject.length > 120) issues.push('long_subject');
  if (hasCjkText(normalizedBody)) {
    if (normalizedBody.length < 80) issues.push('too_short');
  } else if (bodyWordCount < 45) {
    issues.push('too_short');
  }

  if (/\[[^\]]{2,}\]|\{\{[^}]+\}\}|<[^>\n]{2,}>/.test(combined)) {
    issues.push('placeholder');
  }

  if (/\b(?:Your Name|Recipient Name|Company Name|Job Title|Hiring Manager|Interviewer Name|Contact Person)\b/i.test(combined)) {
    issues.push('placeholder');
  }

  if (/specific (?:detail|reason|achievement|next step|action)|measurable or clear outcome|insert (?:detail|context|name)|customize this/i.test(combined)) {
    issues.push('template_language');
  }

  if (normalizedBody && !/[.!?。！？]\s*$/.test(normalizedBody)) issues.push('unfinished_ending');
  if (!hasCjkText(normalizedBody) && bodyWordCount > 260) issues.push('too_long');

  const uniqueIssues = Array.from(new Set(issues));
  const blockingIssues = uniqueIssues.filter((issue) => !['long_subject', 'too_long'].includes(issue));
  if (blockingIssues.length > 0) return { status: 'needs_regen', issues: uniqueIssues };
  if (uniqueIssues.length > 0) return { status: 'warn', issues: uniqueIssues };
  return { status: 'ok', issues: [] };
};

export const canExportEmail = (validation: EmailValidation): boolean =>
  canExportQualityGate(validation);

export const emailIssueLabel = (issue: string): string => {
  const labels: Record<string, string> = {
    empty: 'No email draft was generated.',
    missing_subject: 'Add a specific subject line.',
    missing_body: 'Add an email body.',
    too_short: 'The draft is too short to send.',
    placeholder: 'Placeholders are still present.',
    template_language: 'Template instructions are still visible.',
    unfinished_ending: 'The draft appears unfinished.',
    long_subject: 'The subject is long; trim it before sending.',
    too_long: 'The email is long; trim it before sending.',
  };
  return labels[issue] || issue.replace(/_/g, ' ');
};

interface EmailExportGateProps {
  validation: EmailValidation;
  text: string;
  copyLabel: string;
  copiedLabel: string;
  regenerateLabel: string;
  onRegenerate: () => void;
}

export const EmailExportGate: React.FC<EmailExportGateProps> = ({
  validation,
  text,
  copyLabel,
  copiedLabel,
  regenerateLabel,
  onRegenerate,
}) => {
  if (!canExportEmail(validation)) {
    return (
      <BlockedRegenerateButton
        label={regenerateLabel}
        onClick={onRegenerate}
        dataQa="email-export-blocked-regenerate"
      />
    );
  }

  return (
    <>
      <CopyButton text={text} label={copyLabel} copiedLabel={copiedLabel} />
      <DownloadButtons textContent={text} baseFilename="email_draft" />
    </>
  );
};

interface EmailQualityNoticeProps {
  validation: EmailValidation;
}

export const EmailQualityNotice: React.FC<EmailQualityNoticeProps> = ({ validation }) => {
  return (
    <QualityGateNotice
      validation={validation}
      dataQa="email-quality-notice"
      statusDataAttribute="data-qa-email-quality"
      blockingTitle="Fix this draft before exporting"
      warningTitle="Review before sending"
      issueLabel={emailIssueLabel}
      warningIcon={MailCheck}
    />
  );
};
