
import React, { useState, useEffect } from 'react';
import { CheckCircle2, FileText, Globe2, Info } from 'lucide-react';
import { convertResumeFormat } from '../../services/aiClient';
import type { FormattedResume } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { DownloadButtons, SavedResultBar, ToolError } from './ToolUtils';
import { useToolResults } from '../../contexts/ToolResultsContext';
import { SUPPORTED_MARKETS } from '../../config';
import ResumePreview from '../ResumePreview';
import { assessFormattedResume, cleanResumeDisplay, getResumeMarketStyle } from '../../lib/resumePreview';

const MARKET_HINT_KEY: Record<string, string> = {
  'Canada':         'resume_market_hint_canada',
  'United States':  'resume_market_hint_united_states',
  'United Kingdom': 'resume_market_hint_united_kingdom',
  'Germany':        'resume_market_hint_germany',
  'France':         'resume_market_hint_france',
  'Japan':          'resume_market_hint_japan',
  'Vietnam':        'resume_market_hint_vietnam',
  'Singapore':      'resume_market_hint_singapore',
  'Australia':      'resume_market_hint_australia',
};

// (b) sample cover letter — does NOT touch resumeText
const SAMPLE_COVER_LETTER =
  'Dear Hiring Manager,\n\nI am excited to apply for the Software Engineer role at Acme Corp. ' +
  'With 4 years of experience building scalable web applications using React and Node.js, ' +
  'I am confident I can contribute from day one.\n\nThank you for your consideration.\n\nSincerely,\nAlex Chen';

interface ResumeFormatterProps {
  resumeText: string;
  market: string;
  onClose: () => void;
  t: (key: string) => string;
}

const ResumeFormatter: React.FC<ResumeFormatterProps> = ({ resumeText, market, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FormattedResume | null>(null);
  const { canSave, saved, persist } = useToolResults<FormattedResume>();
  const [fromSaved, setFromSaved] = useState(false);
  const [includeCoverLetter, setIncludeCoverLetter] = useState(false);
  const [coverLetterForFormatting, setCoverLetterForFormatting] = useState('');
  const [targetMarket, setTargetMarket] = useState<string>(market);
  const hasResume = resumeText.trim().length > 0;

  useEffect(() => { if (saved && !result) { setResult(saved.result); setFromSaved(true); } }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const runTool = async (options: { coverLetter?: string } = {}) => {
    if (!resumeText?.trim()) {
      setError(t('tool_resume_required_error'));
      return;
    }
    const alive = begin();
    setError(null);
    setResult(null);
    try {
      const apiResult = await convertResumeFormat(resumeText, targetMarket, options.coverLetter);
      if (!alive()) return;
      const normalizedResult = { ...apiResult, formattedText: cleanResumeDisplay(apiResult.formattedText) };
      setResult(normalizedResult);
      setFromSaved(false);
      persist(normalizedResult);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const renderInput = () => {
    const marketStyle = getResumeMarketStyle(targetMarket);
    return (
      <div className="animate-fade-in space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                <Globe2 className="h-4 w-4" aria-hidden="true" />
                {t('tool_resume_formatter_intro_title')}
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                {t('tool_resume_formatter_intro_desc')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
              <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />
              {hasResume
                ? t('ob_resume_chars').replace('{n}', resumeText.trim().length.toLocaleString())
                : t('tool_resume_required_error')}
            </div>
          </div>
        </div>

        {!hasResume && (
          <ToolError message={t('tool_resume_required_error')} />
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                <span className="text-sm font-bold">1</span>
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="target-market" className="block text-sm font-semibold text-slate-950 dark:text-slate-100">
                  {t('tool_resume_formatter_target_market_label')}
                </label>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {t('tool_resume_formatter_target_market_desc')}
                </p>
                <select
                  id="target-market"
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                  className="mt-3 block min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
                >
                  {SUPPORTED_MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
                <span>{marketStyle.label}</span>
                <span aria-hidden="true">·</span>
                <span>{marketStyle.pageSize.toUpperCase()}</span>
              </div>
              {MARKET_HINT_KEY[targetMarket] && (
                <p className="mt-2 text-sm leading-6 text-blue-950 dark:text-blue-100">{t(MARKET_HINT_KEY[targetMarket])}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {marketStyle.principles.slice(0, 3).map((principle) => (
                  <span key={principle} className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                    {principle}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <span className="text-sm font-bold">2</span>
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor="include-cover-letter" className="block text-sm font-semibold text-slate-950 dark:text-slate-100">
                  {t('tool_resume_formatter_include_cover_letter_label')}
                </label>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {t('tool_resume_formatter_include_cover_letter_desc')}
                </p>
              </div>
              <input
                id="include-cover-letter"
                type="checkbox"
                checked={includeCoverLetter}
                onChange={(e) => setIncludeCoverLetter(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
              />
            </div>

            {includeCoverLetter ? (
              <div className="mt-4 animate-fade-in space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="cover-letter-text" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('tool_resume_formatter_cover_letter_label')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setCoverLetterForFormatting(SAMPLE_COVER_LETTER)}
                    className="shrink-0 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {t('tool_try_example')}
                  </button>
                </div>
                <textarea
                  id="cover-letter-text"
                  rows={8}
                  className="block w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
                  placeholder={t('tool_resume_formatter_cover_letter_placeholder')}
                  value={coverLetterForFormatting}
                  onChange={(e) => setCoverLetterForFormatting(e.target.value)}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                {t('tool_resume_formatter_intro_desc')}
              </div>
            )}
          </section>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <CheckCircle2 className={`h-4 w-4 ${hasResume ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}`} aria-hidden="true" />
              {t('tool_resume_formatter_intro_title')}
            </div>
            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              {MARKET_HINT_KEY[targetMarket] ? t(MARKET_HINT_KEY[targetMarket]) : t('tool_resume_formatter_target_market_desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => runTool({ coverLetter: includeCoverLetter ? coverLetterForFormatting : undefined })}
            disabled={loading || !hasResume}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300 disabled:text-white/90 dark:disabled:bg-blue-900/60 sm:mt-0 sm:w-auto"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {loading ? t('tool_resume_formatter_formatting_button') : t('tool_resume_formatter_format_button')}
          </button>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    // (c) StagedLoader already has onCancel + icon + accent — preserved as-is
    if (loading) return <StagedLoader title="Reformatting your resume" steps={["Reading your resume…","Reformatting the layout…","Polishing the final document…"]} onCancel={cancel} icon={<FileText />} accent="blue" />;

    // (e) ERROR RETRY
    if (error) return (
      <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => runTool({ coverLetter: includeCoverLetter ? coverLetterForFormatting : undefined })}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          {t('tool_try_again')}
        </button>
      </div>
    );

    if (!result) return null;

    const formattedText = cleanResumeDisplay(result.formattedText);
    const marketStyle = getResumeMarketStyle(targetMarket);
    const validation = assessFormattedResume(formattedText);
    return (
      <div className="space-y-4 animate-fade-in">
        <SavedResultBar t={t} canSave={canSave} isSaved={fromSaved} savedAt={saved?.savedAt ?? null} onTryNext={() => { setResult(null); setFromSaved(false); setError(null); }} />

        {/* Post-generation validator gate: don't present a garbled/blob output as final. */}
        {validation.status === 'needs_regen' && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/30" role="alert">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{t('tool_resume_formatter_regen_title')}</p>
                <p className="mt-0.5 text-sm leading-6 text-amber-800 dark:text-amber-200">{t('tool_resume_formatter_regen_desc')}</p>
                <button
                  onClick={() => runTool({ coverLetter: includeCoverLetter ? coverLetterForFormatting : undefined })}
                  disabled={loading}
                  className="mt-2 inline-flex min-h-9 items-center rounded-md bg-amber-600 px-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  {t('tool_resume_formatter_regen_cta')}
                </button>
              </div>
            </div>
          </div>
        )}
        {validation.status === 'warn' && validation.issues.includes('sensitive_fields') && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200" role="note">
            {t('tool_resume_formatter_sensitive_note')}
          </p>
        )}

        {/* (d) DownloadButtons already present; "format for another market" button already present — preserved */}
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h4 className="text-lg font-bold dark:text-gray-100">{t('tool_resume_formatter_results_title')} {t('tool_resume_formatter_results_for').replace('{market}', targetMarket)}</h4>
          <DownloadButtons textContent={formattedText} baseFilename={`${targetMarket.toLowerCase().replace(/\s/g, '_')}_resume`} />
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
            <span>{marketStyle.label}</span>
            <span aria-hidden="true">·</span>
            <span>{marketStyle.pageSize.toUpperCase()}</span>
          </div>
          {MARKET_HINT_KEY[targetMarket] && (
            <p className="mt-1 text-sm leading-6 text-blue-900 dark:text-blue-100">{t(MARKET_HINT_KEY[targetMarket])}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {marketStyle.principles.map((principle) => (
              <span key={principle} className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                {principle}
              </span>
            ))}
          </div>
        </div>

        <ResumePreview resumeText={formattedText} market={targetMarket} t={t} heightClassName="h-[560px] max-h-[72vh]" />
        <button onClick={() => setResult(null)} className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 dark:border-slate-600 dark:text-gray-300">
            &larr; {t('tool_resume_formatter_localize_again')}
        </button>
      </div>
    );
  };

  return result ? renderResult() : renderInput();
};

export default ResumeFormatter;
