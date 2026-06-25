import React from 'react';
import type { ResumeValidation } from '../../lib/resumePreview';
import { DownloadButtons } from './ToolUtils';

export const canDownloadFormattedResume = (validation: ResumeValidation): boolean =>
  validation.status !== 'needs_regen';

interface ResumeFormatterDownloadGateProps {
  validation: ResumeValidation;
  formattedText: string;
  generatedMarket: string;
  loading: boolean;
  onRegenerate: () => void;
  t: (key: string) => string;
}

export const ResumeFormatterDownloadGate: React.FC<ResumeFormatterDownloadGateProps> = ({
  validation,
  formattedText,
  generatedMarket,
  loading,
  onRegenerate,
  t,
}) => {
  if (!canDownloadFormattedResume(validation)) {
    return (
      <button
        type="button"
        onClick={onRegenerate}
        disabled={loading}
        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        data-qa="resume-formatter-download-blocked-regenerate"
      >
        {t('tool_resume_formatter_regen_cta')}
      </button>
    );
  }

  return (
    <DownloadButtons
      textContent={formattedText}
      baseFilename={`${generatedMarket.toLowerCase().replace(/\s/g, '_')}_resume`}
    />
  );
};
