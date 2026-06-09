
import React, { useState } from 'react';
import { convertResumeFormat } from '../../services/aiClient';
import type { FormattedResume } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { DownloadButtons, renderFormattedText } from './ToolUtils';
import { SUPPORTED_MARKETS } from '../../config';

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
  const [includeCoverLetter, setIncludeCoverLetter] = useState(false);
  const [coverLetterForFormatting, setCoverLetterForFormatting] = useState('');
  const [targetMarket, setTargetMarket] = useState<string>(market);

  const runTool = async (options: { coverLetter?: string } = {}) => {
    const alive = begin();
    setError(null);
    setResult(null);
    try {
      const apiResult = await convertResumeFormat(resumeText, targetMarket, options.coverLetter);
      if (!alive()) return;
      setResult(apiResult);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const renderInput = () => (
    <div className="space-y-4 animate-fade-in">
      <div>
        <label htmlFor="target-market" className="block text-sm font-medium text-gray-700">Target Market</label>
        <p className="text-xs text-gray-500">The AI will adapt the format, language, and ATS standards for this country.</p>
        <select
          id="target-market"
          value={targetMarket}
          onChange={(e) => setTargetMarket(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          {SUPPORTED_MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
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
          <label htmlFor="include-cover-letter" className="font-medium text-gray-900">{t('tool_resume_formatter_include_cover_letter_label')}</label>
          <p className="text-gray-500">{t('tool_resume_formatter_include_cover_letter_desc')}</p>
        </div>
      </div>
      {includeCoverLetter && (
        <div className="animate-fade-in">
          <label htmlFor="cover-letter-text" className="block text-sm font-medium text-gray-700 mb-1">{t('tool_resume_formatter_cover_letter_label')}</label>
          <textarea
            id="cover-letter-text"
            rows={10}
            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
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
    if (loading) return <StagedLoader title="Reformatting your resume" steps={["Reading your resume…","Reformatting the layout…","Polishing the final document…"]} onCancel={cancel} />;
    if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;
    if (!result) return null;

    const { formattedText } = result;
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-bold">{t('tool_resume_formatter_results_title')} for {targetMarket}</h4>
          <DownloadButtons textContent={formattedText} baseFilename={`${targetMarket.toLowerCase().replace(/\s/g, '_')}_resume`} />
        </div>
        <div className="p-4 border rounded-lg bg-white max-h-96 overflow-y-auto font-serif text-sm">
          {renderFormattedText(formattedText)}
        </div>
        <button onClick={() => setResult(null)} className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200">
            &larr; Localize for Another Market
        </button>
      </div>
    );
  };

  return result ? renderResult() : renderInput();
};

export default ResumeFormatter;
