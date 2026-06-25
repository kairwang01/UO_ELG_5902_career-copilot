import React from 'react';
import { Wallet } from 'lucide-react';
import type { SalaryNegotiationResult } from '../../types';
import {
  BlockedCopyBadge,
  BlockedRegenerateButton,
  canExportQualityGate,
  QualityGateNotice,
  type QualityValidationStatus,
} from './QualityGate';
import { CopyButton, DownloadButtons } from './ToolUtils';

export type SalaryValidationStatus = QualityValidationStatus;

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
  canExportQualityGate(validation);

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
      <BlockedRegenerateButton
        label={regenerateLabel}
        onClick={onRegenerate}
        dataQa="salary-export-blocked-regenerate"
      />
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
    return <BlockedCopyBadge dataQa="salary-copy-blocked" />;
  }

  return <CopyButton text={text} label={label} />;
};

interface SalaryQualityNoticeProps {
  validation: SalaryValidation;
}

export const SalaryQualityNotice: React.FC<SalaryQualityNoticeProps> = ({ validation }) => {
  return (
    <QualityGateNotice
      validation={validation}
      dataQa="salary-quality-notice"
      statusDataAttribute="data-qa-salary-quality"
      blockingTitle="Fix this negotiation plan before exporting"
      warningTitle="Review before using"
      issueLabel={salaryIssueLabel}
      warningIcon={Wallet}
    />
  );
};
