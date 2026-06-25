import React from 'react';
import { AlertTriangle, MailCheck } from 'lucide-react';
import { CopyButton, DownloadButtons } from './ToolUtils';

export type EmailValidationStatus = 'ok' | 'warn' | 'needs_regen';

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
  validation.status !== 'needs_regen';

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
      <button
        type="button"
        onClick={onRegenerate}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
        data-qa="email-export-blocked-regenerate"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {regenerateLabel}
      </button>
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
  if (validation.status === 'ok') return null;
  const isBlocking = validation.status === 'needs_regen';
  return (
    <div
      className={`rounded-xl border p-4 ${
        isBlocking
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100'
          : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100'
      }`}
      role={isBlocking ? 'alert' : 'note'}
      data-qa="email-quality-notice"
      data-qa-email-quality={validation.status}
    >
      <div className="flex items-start gap-3">
        {isBlocking ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isBlocking ? 'Fix this draft before exporting' : 'Review before sending'}
          </p>
          <p className="mt-1 text-sm leading-6 opacity-85">
            {validation.issues.map(emailIssueLabel).join(' ')}
          </p>
        </div>
      </div>
    </div>
  );
};
