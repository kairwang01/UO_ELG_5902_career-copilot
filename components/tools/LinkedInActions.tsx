import React from 'react';
import { AlertTriangle, Link2 } from 'lucide-react';
import type { LinkedInOptimization } from '../../types';
import { DownloadButtons } from './ToolUtils';

export type LinkedInValidationStatus = 'ok' | 'warn' | 'needs_regen';

export interface LinkedInValidation {
  status: LinkedInValidationStatus;
  issues: string[];
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const hasCjkText = (text: string) => /[\u3040-\u30ff\u3400-\u9fff]/.test(text);

const normalize = (text: string | undefined) =>
  (text || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();

const hasPlaceholder = (text: string) => (
  /\[[^\]]{2,}\]|\{\{[^}]+\}\}|<[^>\n]{2,}>/.test(text) ||
  /\b(?:Your Name|Current Role|Target Role|Company Name|Job Title|Employer Name|specific achievement|relevant skill)\b/i.test(text)
);

const hasTemplateLanguage = (text: string) =>
  /specific (?:achievement|metric|result|skill|keyword|role)|insert (?:metric|achievement|keyword|role)|measurable result|customize this/i.test(text);

export const buildLinkedInDownloadText = (
  result: LinkedInOptimization,
  labels: { headline: string; summary: string; experience: string },
) => [
  `## ${labels.headline}\n${result.headline || ''}`,
  `\n## ${labels.summary}\n${result.summary || ''}`,
  `\n## ${labels.experience}`,
  ...(Array.isArray(result.experienceSuggestions)
    ? result.experienceSuggestions.map((item) => `\n**${item.title || ''}**\n${item.suggestion || ''}`)
    : []),
].join('\n');

export const assessLinkedInOptimization = (result: Partial<LinkedInOptimization> | null | undefined): LinkedInValidation => {
  if (!result) return { status: 'needs_regen', issues: ['empty'] };

  const headline = normalize(result.headline);
  const summary = normalize(result.summary);
  const suggestions = Array.isArray(result.experienceSuggestions) ? result.experienceSuggestions : [];
  const suggestionBodies = suggestions.map((item) => normalize(item?.suggestion)).filter(Boolean);
  const combined = [
    headline,
    summary,
    ...suggestions.flatMap((item) => [normalize(item?.title), normalize(item?.suggestion)]),
  ].join('\n');

  if (!headline && !summary && suggestionBodies.length === 0) return { status: 'needs_regen', issues: ['empty'] };

  const issues: string[] = [];
  if (!headline) issues.push('missing_headline');
  if (!summary) issues.push('missing_summary');
  if (suggestionBodies.length === 0) issues.push('missing_experience_suggestions');

  if (headline && headline.length < 24) issues.push('thin_headline');
  if (headline.length > 240) issues.push('long_headline');

  if (summary) {
    if (hasCjkText(summary)) {
      if (summary.length < 140) issues.push('thin_summary');
    } else if (countWords(summary) < 55) {
      issues.push('thin_summary');
    }
    if (!/[.!?。！？]\s*$/.test(summary)) issues.push('unfinished_summary');
  }

  if (suggestionBodies.length > 0) {
    const thinSuggestion = suggestionBodies.some((suggestion) => (
      hasCjkText(suggestion) ? suggestion.length < 60 : countWords(suggestion) < 18
    ));
    if (thinSuggestion) issues.push('thin_experience_suggestions');
  }

  if (hasPlaceholder(combined)) issues.push('placeholder');
  if (hasTemplateLanguage(combined)) issues.push('template_language');

  const uniqueIssues = Array.from(new Set(issues));
  const blockingIssues = uniqueIssues.filter((issue) => !['long_headline'].includes(issue));
  if (blockingIssues.length > 0) return { status: 'needs_regen', issues: uniqueIssues };
  if (uniqueIssues.length > 0) return { status: 'warn', issues: uniqueIssues };
  return { status: 'ok', issues: [] };
};

export const canExportLinkedInOptimization = (validation: LinkedInValidation): boolean =>
  validation.status !== 'needs_regen';

export const linkedInIssueLabel = (issue: string): string => {
  const labels: Record<string, string> = {
    empty: 'No LinkedIn optimization was generated.',
    missing_headline: 'Add a specific headline.',
    missing_summary: 'Add a profile summary.',
    missing_experience_suggestions: 'Add at least one experience rewrite.',
    thin_headline: 'The headline is too thin to use.',
    thin_summary: 'The summary needs more substance.',
    thin_experience_suggestions: 'Experience suggestions need more usable detail.',
    unfinished_summary: 'The summary appears unfinished.',
    placeholder: 'Placeholders are still present.',
    template_language: 'Template instructions are still visible.',
    long_headline: 'The headline is long; trim it before using.',
  };
  return labels[issue] || issue.replace(/_/g, ' ');
};

interface LinkedInExportGateProps {
  validation: LinkedInValidation;
  text: string;
  regenerateLabel: string;
  onRegenerate: () => void;
}

export const LinkedInExportGate: React.FC<LinkedInExportGateProps> = ({
  validation,
  text,
  regenerateLabel,
  onRegenerate,
}) => {
  if (!canExportLinkedInOptimization(validation)) {
    return (
      <button
        type="button"
        onClick={onRegenerate}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
        data-qa="linkedin-export-blocked-regenerate"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {regenerateLabel}
      </button>
    );
  }

  return <DownloadButtons textContent={text} baseFilename="linkedin_optimization" />;
};

interface LinkedInQualityNoticeProps {
  validation: LinkedInValidation;
}

export const LinkedInQualityNotice: React.FC<LinkedInQualityNoticeProps> = ({ validation }) => {
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
      data-qa="linkedin-quality-notice"
      data-qa-linkedin-quality={validation.status}
    >
      <div className="flex items-start gap-3">
        {isBlocking ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <Link2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isBlocking ? 'Fix this profile draft before exporting' : 'Review before using'}
          </p>
          <p className="mt-1 text-sm leading-6 opacity-85">
            {validation.issues.map(linkedInIssueLabel).join(' ')}
          </p>
        </div>
      </div>
    </div>
  );
};
