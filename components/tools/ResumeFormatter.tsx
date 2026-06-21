
import React, { useState, useEffect } from 'react';
import { FileText, Info } from 'lucide-react';
import { convertResumeFormat } from '../../services/aiClient';
import type { FormattedResume } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { DownloadButtons, SavedResultBar } from './ToolUtils';
import { useToolResults } from '../../contexts/ToolResultsContext';
import { SUPPORTED_MARKETS } from '../../config';
import ResumePreview from '../ResumePreview';
import { getResumeMarketStyle } from '../../lib/resumePreview';

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
      setResult(apiResult);
      setFromSaved(false);
      persist(apiResult);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const renderInput = () => (
    <div className="space-y-4 animate-fade-in">
      {/* (a) INTRO CARD */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{t('tool_resume_formatter_intro_title')}</p>
        <p>{t('tool_resume_formatter_intro_desc')}</p>
      </div>

      <div>
        <label htmlFor="target-market" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_resume_formatter_target_market_label')}</label>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('tool_resume_formatter_target_market_desc')}</p>
        <select
          id="target-market"
          value={targetMarket}
          onChange={(e) => setTargetMarket(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          {SUPPORTED_MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {MARKET_HINT_KEY[targetMarket] && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" aria-hidden="true" />
            <p className="text-xs text-blue-700 dark:text-blue-300">{t(MARKET_HINT_KEY[targetMarket])}</p>
          </div>
        )}
      </div>

      <div className="relative flex items-start">
        <div className="flex h-6 items-center">
          <input
            id="include-cover-letter"
            type="checkbox"
            checked={includeCoverLetter}
            onChange={(e) => setIncludeCoverLetter(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
        <div className="ml-3 text-sm leading-6">
          <label htmlFor="include-cover-letter" className="font-medium text-gray-900 dark:text-gray-100">{t('tool_resume_formatter_include_cover_letter_label')}</label>
          <p className="text-gray-500 dark:text-gray-400">{t('tool_resume_formatter_include_cover_letter_desc')}</p>
        </div>
      </div>
      {includeCoverLetter && (
        <div className="animate-fade-in space-y-1">
          <div className="flex justify-between items-center">
            <label htmlFor="cover-letter-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tool_resume_formatter_cover_letter_label')}</label>
            {/* (b) SAMPLE FILL — only fills cover letter, never touches resumeText */}
            <button
              type="button"
              onClick={() => setCoverLetterForFormatting(SAMPLE_COVER_LETTER)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('tool_try_example')}
            </button>
          </div>
          <textarea
            id="cover-letter-text"
            rows={10}
            className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
            placeholder={t('tool_resume_formatter_cover_letter_placeholder')}
            value={coverLetterForFormatting}
            onChange={(e) => setCoverLetterForFormatting(e.target.value)}
          />
        </div>
      )}
      <button
        onClick={() => runTool({ coverLetter: includeCoverLetter ? coverLetterForFormatting : undefined })}
        disabled={loading}
        className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
        {loading ? t('tool_resume_formatter_formatting_button') : t('tool_resume_formatter_format_button')}
      </button>
    </div>
  );

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

    const { formattedText } = result;
    const marketStyle = getResumeMarketStyle(targetMarket);
    return (
      <div className="space-y-4 animate-fade-in">
        <SavedResultBar t={t} canSave={canSave} isSaved={fromSaved} savedAt={saved?.savedAt ?? null} onTryNext={() => { setResult(null); setFromSaved(false); setError(null); }} />
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
