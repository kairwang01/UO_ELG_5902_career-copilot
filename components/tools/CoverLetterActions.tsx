import React from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import { CopyButton, DownloadButtons } from './ToolUtils';

export type CoverLetterValidationStatus = 'ok' | 'warn' | 'needs_regen';

export interface CoverLetterValidation {
  status: CoverLetterValidationStatus;
  issues: string[];
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const hasCjkText = (text: string) => /[\u3040-\u30ff\u3400-\u9fff]/.test(text);

export const assessCoverLetterDraft = (text: string): CoverLetterValidation => {
  const normalized = text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!normalized) return { status: 'needs_regen', issues: ['empty'] };

  const issues: string[] = [];
  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const wordCount = countWords(normalized);

  if (hasCjkText(normalized)) {
    if (normalized.length < 220) issues.push('too_short');
  } else if (wordCount < 90) {
    issues.push('too_short');
  }

  if (/\[[^\]]{2,}\]|\{\{[^}]+\}\}|<[^>\n]{2,}>/.test(normalized)) {
    issues.push('placeholder');
  }

  if (/\b(?:Your Name|Your Address|Your Email|Your Phone Number|Company Name|Job Title|Hiring Manager Name)\b/i.test(normalized)) {
    issues.push('placeholder');
  }

  if (/specific (?:action|project|achievement|skill area|reason)|measurable or clear outcome|relevant skill area/i.test(normalized)) {
    issues.push('template_language');
  }

  if (paragraphs.length < 3) issues.push('thin_structure');
  if (!/[.!?。！？]\s*$/.test(normalized)) issues.push('unfinished_ending');
  if (!hasCjkText(normalized) && wordCount > 520) issues.push('too_long');

  const blockingIssues = issues.filter((issue) => issue !== 'too_long');
  if (blockingIssues.length > 0) return { status: 'needs_regen', issues: Array.from(new Set(issues)) };
  if (issues.length > 0) return { status: 'warn', issues: Array.from(new Set(issues)) };
  return { status: 'ok', issues: [] };
};

export const canExportCoverLetter = (validation: CoverLetterValidation): boolean =>
  validation.status !== 'needs_regen';

export const coverLetterIssueLabel = (issue: string): string => {
  const labels: Record<string, string> = {
    empty: 'No cover letter text was generated.',
    too_short: 'The draft is too short to send.',
    placeholder: 'Placeholders are still present.',
    template_language: 'Template instructions are still visible.',
    thin_structure: 'The draft needs a clearer opening, body, and close.',
    unfinished_ending: 'The draft appears unfinished.',
    too_long: 'The draft is long; trim it before sending.',
  };
  return labels[issue] || issue.replace(/_/g, ' ');
};

interface CoverLetterExportGateProps {
  validation: CoverLetterValidation;
  text: string;
  copyLabel: string;
  copiedLabel: string;
  regenerateLabel: string;
  onRegenerate: () => void;
}

export const CoverLetterExportGate: React.FC<CoverLetterExportGateProps> = ({
  validation,
  text,
  copyLabel,
  copiedLabel,
  regenerateLabel,
  onRegenerate,
}) => {
  if (!canExportCoverLetter(validation)) {
    return (
      <button
        type="button"
        onClick={onRegenerate}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
        data-qa="cover-letter-export-blocked-regenerate"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {regenerateLabel}
      </button>
    );
  }

  return (
    <>
      <CopyButton text={text} label={copyLabel} copiedLabel={copiedLabel} />
      <DownloadButtons textContent={text} baseFilename="cover_letter" />
    </>
  );
};

interface CoverLetterQualityNoticeProps {
  validation: CoverLetterValidation;
}

export const CoverLetterQualityNotice: React.FC<CoverLetterQualityNoticeProps> = ({ validation }) => {
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
      data-qa="cover-letter-quality-notice"
      data-qa-cover-letter-quality={validation.status}
    >
      <div className="flex items-start gap-3">
        {isBlocking ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <Copy className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isBlocking ? 'Fix this draft before exporting' : 'Review before sending'}
          </p>
          <p className="mt-1 text-sm leading-6 opacity-85">
            {validation.issues.map(coverLetterIssueLabel).join(' ')}
          </p>
        </div>
      </div>
    </div>
  );
};
