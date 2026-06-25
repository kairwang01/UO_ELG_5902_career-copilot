import React from 'react';
import { AlertTriangle, Network } from 'lucide-react';
import type { NetworkingStrategyResult } from '../../types';
import { CopyButton, DownloadButtons } from './ToolUtils';

export type NetworkingValidationStatus = 'ok' | 'warn' | 'needs_regen';

export interface NetworkingValidation {
  status: NetworkingValidationStatus;
  issues: string[];
}

type SavedNetworkingStrategy = Partial<NetworkingStrategyResult> & {
  targetCompany?: string;
  targetRole?: string;
  targetLocation?: string;
};

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const hasCjkText = (text: string) => /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
const normalize = (text: string | undefined) =>
  (text || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();

const hasPlaceholder = (text: string) => (
  /\[[^\]]{2,}\]|\{\{[^}]+\}\}|<[^>\n]{2,}>/.test(text) ||
  /\b(?:Contact Name|Recipient Name|Company Name|Target Company|Target Role|Job Title|Your Name|specific reason|relevant skill)\b/i.test(text)
);

const hasTemplateLanguage = (text: string) =>
  /specific (?:reason|detail|skill|achievement|question|next step)|insert (?:reason|detail|name|company)|customize this|low-friction ask/i.test(text);

export const buildNetworkingDownloadText = (
  result: SavedNetworkingStrategy,
  labels: { strategy: string; contacts: string; why: string; outreach: string },
  fallback: { company: string; role: string; location: string },
) => {
  const company = result.targetCompany || fallback.company;
  const role = result.targetRole || fallback.role;
  const location = result.targetLocation || fallback.location;
  const contacts = Array.isArray(result.contactSuggestions) ? result.contactSuggestions : [];
  let content = `# Networking Strategy: ${role} at ${company} (${location})\n\n`;
  content += `## ${labels.strategy}\n${result.strategySummary || ''}\n\n`;
  content += `## ${labels.contacts}\n`;
  contacts.forEach((suggestion, index) => {
    content += `### Contact ${index + 1}: ${suggestion.contactType || ''}\n`;
    content += `**${labels.why}:** ${suggestion.reason || ''}\n\n`;
    content += `**${labels.outreach}:**\n${suggestion.outreachMessage || ''}\n\n`;
  });
  return content;
};

export const assessNetworkingStrategy = (result: SavedNetworkingStrategy | null | undefined): NetworkingValidation => {
  if (!result) return { status: 'needs_regen', issues: ['empty'] };

  const strategy = normalize(result.strategySummary);
  const contacts = Array.isArray(result.contactSuggestions) ? result.contactSuggestions : [];
  const combined = [
    strategy,
    ...contacts.flatMap((item) => [
      normalize(item?.contactType),
      normalize(item?.reason),
      normalize(item?.outreachMessage),
    ]),
  ].join('\n');

  if (!strategy && contacts.length === 0) return { status: 'needs_regen', issues: ['empty'] };

  const issues: string[] = [];
  if (!strategy) issues.push('missing_strategy');
  if (contacts.length === 0) issues.push('missing_contacts');
  if (contacts.length > 0 && contacts.length < 3) issues.push('few_contacts');

  if (strategy) {
    if (hasCjkText(strategy)) {
      if (strategy.length < 100) issues.push('thin_strategy');
    } else if (countWords(strategy) < 35) {
      issues.push('thin_strategy');
    }
    if (!/[.!?。！？]\s*$/.test(strategy)) issues.push('unfinished_strategy');
  }

  contacts.forEach((contact) => {
    const contactType = normalize(contact?.contactType);
    const reason = normalize(contact?.reason);
    const message = normalize(contact?.outreachMessage);
    if (!contactType) issues.push('missing_contact_type');
    if (!reason) issues.push('missing_reason');
    if (!message) issues.push('missing_outreach');

    if (reason) {
      if (hasCjkText(reason)) {
        if (reason.length < 35) issues.push('thin_reason');
      } else if (countWords(reason) < 12) {
        issues.push('thin_reason');
      }
    }

    if (message) {
      const messageWords = countWords(message);
      if (hasCjkText(message)) {
        if (message.length < 70) issues.push('thin_outreach');
      } else if (messageWords < 30) {
        issues.push('thin_outreach');
      }
      if (!hasCjkText(message) && messageWords > 130) issues.push('long_outreach');
      if (!/[.!?。！？]\s*$/.test(message)) issues.push('unfinished_outreach');
    }
  });

  if (hasPlaceholder(combined)) issues.push('placeholder');
  if (hasTemplateLanguage(combined)) issues.push('template_language');

  const uniqueIssues = Array.from(new Set(issues));
  const blockingIssues = uniqueIssues.filter((issue) => !['few_contacts', 'long_outreach'].includes(issue));
  if (blockingIssues.length > 0) return { status: 'needs_regen', issues: uniqueIssues };
  if (uniqueIssues.length > 0) return { status: 'warn', issues: uniqueIssues };
  return { status: 'ok', issues: [] };
};

export const canExportNetworkingStrategy = (validation: NetworkingValidation): boolean =>
  validation.status !== 'needs_regen';

export const networkingIssueLabel = (issue: string): string => {
  const labels: Record<string, string> = {
    empty: 'No networking strategy was generated.',
    missing_strategy: 'Add a strategy summary.',
    missing_contacts: 'Add contact suggestions.',
    few_contacts: 'The plan has fewer than three contact ideas.',
    thin_strategy: 'The strategy summary needs more substance.',
    unfinished_strategy: 'The strategy summary appears unfinished.',
    missing_contact_type: 'A contact suggestion is missing its persona.',
    missing_reason: 'A contact suggestion is missing the reason to reach out.',
    missing_outreach: 'A contact suggestion is missing its outreach message.',
    thin_reason: 'A contact reason is too thin.',
    thin_outreach: 'An outreach message is too short to send.',
    long_outreach: 'An outreach message is long; trim it before sending.',
    unfinished_outreach: 'An outreach message appears unfinished.',
    placeholder: 'Placeholders are still present.',
    template_language: 'Template instructions are still visible.',
  };
  return labels[issue] || issue.replace(/_/g, ' ');
};

interface NetworkingExportGateProps {
  validation: NetworkingValidation;
  text: string;
  baseFilename: string;
  regenerateLabel: string;
  onRegenerate: () => void;
}

export const NetworkingExportGate: React.FC<NetworkingExportGateProps> = ({
  validation,
  text,
  baseFilename,
  regenerateLabel,
  onRegenerate,
}) => {
  if (!canExportNetworkingStrategy(validation)) {
    return (
      <button
        type="button"
        onClick={onRegenerate}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
        data-qa="networking-export-blocked-regenerate"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {regenerateLabel}
      </button>
    );
  }

  return <DownloadButtons textContent={text} baseFilename={baseFilename} />;
};

interface NetworkingCopyGateProps {
  validation: NetworkingValidation;
  text: string;
  label: string;
}

export const NetworkingCopyGate: React.FC<NetworkingCopyGateProps> = ({ validation, text, label }) => {
  if (!canExportNetworkingStrategy(validation)) {
    return (
      <span
        className="inline-flex min-h-9 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
        data-qa="networking-copy-blocked"
      >
        Review needed
      </span>
    );
  }

  return <CopyButton text={text} label={label} />;
};

interface NetworkingQualityNoticeProps {
  validation: NetworkingValidation;
}

export const NetworkingQualityNotice: React.FC<NetworkingQualityNoticeProps> = ({ validation }) => {
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
      data-qa="networking-quality-notice"
      data-qa-networking-quality={validation.status}
    >
      <div className="flex items-start gap-3">
        {isBlocking ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <Network className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isBlocking ? 'Fix this networking plan before exporting' : 'Review before using'}
          </p>
          <p className="mt-1 text-sm leading-6 opacity-85">
            {validation.issues.map(networkingIssueLabel).join(' ')}
          </p>
        </div>
      </div>
    </div>
  );
};
