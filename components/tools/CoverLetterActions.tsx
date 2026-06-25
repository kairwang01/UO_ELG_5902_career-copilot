import React from 'react';
import { Copy } from 'lucide-react';
import {
  BlockedRegenerateButton,
  canExportQualityGate,
  QualityGateNotice,
  type QualityValidationStatus,
} from './QualityGate';
import { CopyButton, DownloadButtons } from './ToolUtils';

export type CoverLetterValidationStatus = QualityValidationStatus;

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
  canExportQualityGate(validation);

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
      <BlockedRegenerateButton
        label={regenerateLabel}
        onClick={onRegenerate}
        dataQa="cover-letter-export-blocked-regenerate"
      />
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
  return (
    <QualityGateNotice
      validation={validation}
      dataQa="cover-letter-quality-notice"
      statusDataAttribute="data-qa-cover-letter-quality"
      blockingTitle="Fix this draft before exporting"
      warningTitle="Review before sending"
      issueLabel={coverLetterIssueLabel}
      warningIcon={Copy}
    />
  );
};
