import React from 'react';
import { AlertTriangle, Wallet } from 'lucide-react';
import type { SalaryNegotiationResult } from '../../types';
import { CopyButton, DownloadButtons } from './ToolUtils';

export type SalaryValidationStatus = 'ok' | 'warn' | 'needs_regen';

export interface SalaryValidation {
  status: SalaryValidationStatus;
  issues: string[];
}

type SalaryDraft = Partial<SalaryNegotiationResult>;

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const hasCjkText = (text: string) => /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
const normalize = (text: string | undefined) =>
  (text || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();

const hasPlaceholder = (text: string) => (
  /\[[^\]]{2,}\]|\{\{[^}]+\}\}|<[^>\n]{2,}>/.test(text) ||
  /\b(?:Your Name|Hiring Manager Name|Company Name|Job Title|Desired Salary|specific reason|relevant achievement)\b/i.test(text)
);

const hasTemplateLanguage = (text: string) =>
  /specific (?:reason|achievement|metric|number|range|ask)|insert (?:salary|range|detail|number)|customize this|measurable result/i.test(text);

export const buildSalaryDownloadText = (
  result: SalaryDraft,
  labels: {
    title: string;
    offer: string;
    marketAnalysis: string;
    recommendedRange: string;
    keyStrengths: string;
    strategy: string;
    emailDraft: string;
    objections: string;
  },
  context: { job: string; employer: string; offerLabel: string; rangeLabel: string },
) => {
  const strengths = Array.isArray(result.keyStrengths) ? result.keyStrengths : [];
  const steps = Array.isArray(result.negotiationStrategy) ? result.negotiationStrategy : [];
  const objections = Array.isArray(result.objectionHandlers) ? result.objectionHandlers : [];
  const rangeExplanation = result.recommendedRange?.explanation || '';

  return [
    `${labels.title}: ${context.job} at ${context.employer}`,
    `${labels.offer}: ${context.offerLabel}`,
    `${labels.marketAnalysis}\n${result.marketAnalysisSummary || ''}`,
    `\n${labels.recommendedRange}\n${context.rangeLabel}\n${rangeExplanation}`,
    `\n${labels.keyStrengths}\n${strengths.map((strength) => `- ${strength}`).join('\n')}`,
    `\n${labels.strategy}\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
    `\n${labels.emailDraft}\n${result.counterOfferEmailDraft || ''}`,
    `\n${labels.objections}\n${objections.map((item) => `- ${item.objection || ''}: ${item.response || ''}`).join('\n')}`,
  ].join('\n\n');
};

export const assessSalaryNegotiation = (result: SalaryDraft | null | undefined): SalaryValidation => {
  if (!result) return { status: 'needs_regen', issues: ['empty'] };

  const marketAnalysis = normalize(result.marketAnalysisSummary);
  const range = result.recommendedRange;
  const strengths = Array.isArray(result.keyStrengths) ? result.keyStrengths.map(normalize).filter(Boolean) : [];
  const strategy = Array.isArray(result.negotiationStrategy) ? result.negotiationStrategy.map(normalize).filter(Boolean) : [];
  const email = normalize(result.counterOfferEmailDraft);
  const objections = Array.isArray(result.objectionHandlers) ? result.objectionHandlers : [];
  const objectionTexts = objections.flatMap((item) => [normalize(item?.objection), normalize(item?.response)]).filter(Boolean);
  const combined = [
    marketAnalysis,
    range?.explanation || '',
    ...strengths,
    ...strategy,
    email,
    ...objectionTexts,
  ].join('\n');

  if (!combined.trim() && !range) return { status: 'needs_regen', issues: ['empty'] };

  const issues: string[] = [];
  if (!marketAnalysis) issues.push('missing_market_analysis');
  if (!range) issues.push('missing_range');
  if (range) {
    const min = Number(range.baseMin);
    const max = Number(range.baseMax);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min > max) {
      issues.push('invalid_range');
    }
    if (!normalize(range.currency)) issues.push('missing_currency');
    if (!normalize(range.explanation)) issues.push('missing_range_explanation');
  }

  if (strengths.length === 0) issues.push('missing_strengths');
  if (strategy.length < 2) issues.push('thin_strategy');
  if (!email) issues.push('missing_email');
  if (objections.length === 0) issues.push('missing_objections');

  if (marketAnalysis) {
    if (hasCjkText(marketAnalysis)) {
      if (marketAnalysis.length < 90) issues.push('thin_market_analysis');
    } else if (countWords(marketAnalysis) < 30) {
      issues.push('thin_market_analysis');
    }
    if (!/[.!?。！？]\s*$/.test(marketAnalysis)) issues.push('unfinished_market_analysis');
  }

  strategy.forEach((step) => {
    if (hasCjkText(step)) {
      if (step.length < 35) issues.push('thin_strategy_step');
    } else if (countWords(step) < 10) {
      issues.push('thin_strategy_step');
    }
  });

  if (email) {
    const emailWords = countWords(email);
    if (hasCjkText(email)) {
      if (email.length < 120) issues.push('thin_email');
    } else if (emailWords < 55) {
      issues.push('thin_email');
    }
    if (!/[.!?。！？]\s*$/.test(email)) issues.push('unfinished_email');
    if (!hasCjkText(email) && emailWords > 320) issues.push('long_email');
  }

  objections.forEach((item) => {
    const objection = normalize(item?.objection);
    const response = normalize(item?.response);
    if (!objection || !response) issues.push('incomplete_objection');
    if (response) {
      if (hasCjkText(response)) {
        if (response.length < 45) issues.push('thin_objection_response');
      } else if (countWords(response) < 14) {
        issues.push('thin_objection_response');
      }
    }
  });

  if (hasPlaceholder(combined)) issues.push('placeholder');
  if (hasTemplateLanguage(combined)) issues.push('template_language');

  const uniqueIssues = Array.from(new Set(issues));
  const blockingIssues = uniqueIssues.filter((issue) => issue !== 'long_email');
  if (blockingIssues.length > 0) return { status: 'needs_regen', issues: uniqueIssues };
  if (uniqueIssues.length > 0) return { status: 'warn', issues: uniqueIssues };
  return { status: 'ok', issues: [] };
};

export const canExportSalaryNegotiation = (validation: SalaryValidation): boolean =>
  validation.status !== 'needs_regen';

export const salaryIssueLabel = (issue: string): string => {
  const labels: Record<string, string> = {
    empty: 'No salary negotiation plan was generated.',
    missing_market_analysis: 'Add market analysis.',
    missing_range: 'Add a recommended salary range.',
    invalid_range: 'Fix the recommended salary range.',
    missing_currency: 'Add the range currency.',
    missing_range_explanation: 'Explain the salary range.',
    missing_strengths: 'Add negotiation strengths.',
    thin_strategy: 'Add more negotiation steps.',
    thin_strategy_step: 'A negotiation step needs more detail.',
    missing_email: 'Add a counter-offer email draft.',
    thin_email: 'The counter-offer email is too short to send.',
    unfinished_email: 'The counter-offer email appears unfinished.',
    long_email: 'The counter-offer email is long; trim it before sending.',
    missing_objections: 'Add objection handlers.',
    incomplete_objection: 'Complete each objection and response.',
    thin_objection_response: 'An objection response needs more usable detail.',
    thin_market_analysis: 'The market analysis needs more substance.',
    unfinished_market_analysis: 'The market analysis appears unfinished.',
    placeholder: 'Placeholders are still present.',
    template_language: 'Template instructions are still visible.',
  };
  return labels[issue] || issue.replace(/_/g, ' ');
};

interface SalaryExportGateProps {
  validation: SalaryValidation;
  text: string;
  baseFilename: string;
  regenerateLabel: string;
  onRegenerate: () => void;
}

export const SalaryExportGate: React.FC<SalaryExportGateProps> = ({
  validation,
  text,
  baseFilename,
  regenerateLabel,
  onRegenerate,
}) => {
  if (!canExportSalaryNegotiation(validation)) {
    return (
      <button
        type="button"
        onClick={onRegenerate}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
        data-qa="salary-export-blocked-regenerate"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {regenerateLabel}
      </button>
    );
  }

  return <DownloadButtons textContent={text} baseFilename={baseFilename} />;
};

interface SalaryCopyGateProps {
  validation: SalaryValidation;
  text: string;
  label: string;
}

export const SalaryCopyGate: React.FC<SalaryCopyGateProps> = ({ validation, text, label }) => {
  if (!canExportSalaryNegotiation(validation)) {
    return (
      <span
        className="inline-flex min-h-9 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
        data-qa="salary-copy-blocked"
      >
        Review needed
      </span>
    );
  }

  return <CopyButton text={text} label={label} />;
};

interface SalaryQualityNoticeProps {
  validation: SalaryValidation;
}

export const SalaryQualityNotice: React.FC<SalaryQualityNoticeProps> = ({ validation }) => {
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
      data-qa="salary-quality-notice"
      data-qa-salary-quality={validation.status}
    >
      <div className="flex items-start gap-3">
        {isBlocking ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <Wallet className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isBlocking ? 'Fix this negotiation plan before exporting' : 'Review before using'}
          </p>
          <p className="mt-1 text-sm leading-6 opacity-85">
            {validation.issues.map(salaryIssueLabel).join(' ')}
          </p>
        </div>
      </div>
    </div>
  );
};
