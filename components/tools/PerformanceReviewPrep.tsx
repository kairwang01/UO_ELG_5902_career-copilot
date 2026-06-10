import React, { useState, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { generatePerformanceReviewPrep } from '../../services/aiClient';
import type { PerformanceReviewResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { DownloadButtons } from './ToolUtils';
import { deriveSmartSuggestions, SmartSuggestChips } from '../SmartSuggest';

interface PerformanceReviewPrepProps {
  resumeText: string;
  t: (key: string) => string;
}

const SAMPLE_JOB_TITLE = 'Software Engineer II';
const SAMPLE_ACCOMPLISHMENTS = `- Led the migration of the legacy authentication service to OAuth 2.0, reducing login errors by 40%.
- Mentored two junior developers through weekly 1-on-1s and code reviews.
- Refactored the payment module, cutting server costs by 12% and improving p99 latency by 200 ms.
- Drove adoption of automated integration tests; coverage rose from 45% to 78%.`;

const PerformanceReviewPrep: React.FC<PerformanceReviewPrepProps> = ({ resumeText, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PerformanceReviewResult | null>(null);
  const [accomplishments, setAccomplishments] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  // SmartSuggest: derive role chips from resume (pure, no AI)
  const suggestions = useMemo(() => deriveSmartSuggestions(resumeText), [resumeText]);

  const runTool = async () => {
    if (!accomplishments.trim() || !jobTitle.trim()) {
      setError(t('tool_perf_review_error_required'));
      return;
    }
    const alive = begin();
    setError(null);
    try {
      const apiResult = await generatePerformanceReviewPrep(resumeText, accomplishments, jobTitle);
      if (!alive()) return;
      setResult(apiResult);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const formatForDownload = (res: PerformanceReviewResult): string => {
    let content = `# Performance Review Prep: ${jobTitle}\n\n`;
    content += `## Opening Statement\n${res.summary}\n\n`;
    content += `## Key Strengths\n`;
    res.strengthsToHighlight.forEach(s => { content += `* ${s}\n`; });
    content += `\n## STAR Talking Points\n`;
    res.talkingPoints.forEach(tp => {
      content += `### ${tp.accomplishment}\n${tp.starMethodPoint}\n\n`;
    });
    content += `## Growth Area Discussion Points\n`;
    res.growthAreaDiscussionPoints.forEach(s => { content += `* ${s}\n`; });
    return content;
  };

  const renderInput = () => (
    <div className="space-y-4">
      {/* (a) INTRO CARD */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
        <p className="font-medium text-slate-700 dark:text-slate-300">{t('tool_perf_review_intro_line1')}</p>
        <p className="mt-0.5">{t('tool_perf_review_intro_line2')}</p>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">{t('tool_perf_review_setup_desc')}</p>

      {/* (b) SAMPLE-FILL */}
      <button
        type="button"
        onClick={() => {
          setJobTitle(SAMPLE_JOB_TITLE);
          setAccomplishments(SAMPLE_ACCOMPLISHMENTS);
        }}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {t('try_example')}
      </button>

      <div>
        <label htmlFor="job-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_perf_review_job_title_label')}</label>

        {/* SmartSuggestChips for job title */}
        {resumeText && (
          <div className="mt-1 mb-2">
            <SmartSuggestChips
              items={suggestions.roles}
              onPick={(v) => setJobTitle(v)}
              label={t('smart_suggest_target_roles')}
            />
          </div>
        )}

        <input
          type="text"
          id="job-title"
          value={jobTitle}
          onChange={e => setJobTitle(e.target.value)}
          required
          className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 p-2.5"
          placeholder={t('tool_perf_review_job_title_placeholder')}
        />
      </div>
      <div>
        <label htmlFor="accomplishments" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_perf_review_accomplishments_label')}</label>
        <textarea
          id="accomplishments"
          value={accomplishments}
          onChange={(e) => setAccomplishments(e.target.value)}
          rows={8}
          className="mt-1 w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 p-2.5"
          placeholder={t('tool_perf_review_accomplishments_placeholder')}
          required
        />
      </div>

      {/* (e) ERROR RETRY */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-3 flex items-start gap-3">
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button
            type="button"
            onClick={runTool}
            className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            {t('try_again')}
          </button>
        </div>
      )}

      <button
        onClick={runTool}
        disabled={loading}
        className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg"
      >
        {loading ? t('tool_perf_review_generating_button') : t('tool_perf_review_generate_button')}
      </button>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;
    return (
      <div className="space-y-6">
        {/* (d) RESULT ACTIONS */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-lg font-bold dark:text-gray-100">{t('tool_perf_review_results_title')}</h4>
          <div className="flex items-center gap-2">
            <DownloadButtons textContent={formatForDownload(result)} baseFilename={`performance_review_prep_${jobTitle.replace(/\s/g, '_')}`} />
            <button
              type="button"
              onClick={() => { setResult(null); setError(null); }}
              className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              {t('tool_start_over')}
            </button>
          </div>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400">
            <h5 className="font-semibold text-blue-900 dark:text-blue-300">{t('tool_perf_review_opening_label')}</h5>
            <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">{result.summary}</p>
        </div>
        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_perf_review_strengths_label')}</h5>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm dark:text-gray-300">{result.strengthsToHighlight.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_perf_review_star_label')}</h5>
            <div className="space-y-3 mt-2">
                {result.talkingPoints.map((tp, i) => (
                    <div key={i} className="text-sm p-3 bg-gray-50 dark:bg-slate-700 rounded-md border dark:border-slate-600">
                        <p className="font-semibold dark:text-gray-200">{tp.accomplishment}</p>
                        <p className="mt-1 dark:text-gray-300">{tp.starMethodPoint}</p>
                    </div>
                ))}
            </div>
        </div>
         <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_perf_review_growth_label')}</h5>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm dark:text-gray-300">{result.growthAreaDiscussionPoints.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <button
          type="button"
          onClick={() => { setResult(null); setError(null); }}
          className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 dark:border-slate-600 dark:text-gray-300"
        >
          &larr; {t('tool_start_over')}
        </button>
      </div>
    );
  };

  if (loading) return <StagedLoader title={t('tool_perf_review_loader_title')} steps={[t('tool_perf_review_step1'), t('tool_perf_review_step2'), t('tool_perf_review_step3')]} onCancel={cancel} icon={<TrendingUp />} accent="indigo" />;

  return result ? renderResult() : renderInput();
};

export default PerformanceReviewPrep;
