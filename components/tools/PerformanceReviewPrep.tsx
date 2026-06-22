import React, { useState, useMemo, useEffect } from 'react';
import { BadgeCheck, BookOpenCheck, CheckCircle2, MessageSquareQuote, Target, TrendingUp } from 'lucide-react';
import { generatePerformanceReviewPrep } from '../../services/aiClient';
import type { PerformanceReviewResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { DownloadButtons, SavedResultBar } from './ToolUtils';
import { useToolResults } from '../../contexts/ToolResultsContext';
import { deriveSmartSuggestions, SmartSuggestChips } from '../SmartSuggest';

interface PerformanceReviewPrepProps {
  resumeText: string;
  t: (key: string) => string;
}

type SavedPerformanceReviewResult = PerformanceReviewResult & {
  jobTitle?: string;
};

const SAMPLE_JOB_TITLE = 'Software Engineer II';
const SAMPLE_ACCOMPLISHMENTS = `- Led the migration of the legacy authentication service to OAuth 2.0, reducing login errors by 40%.
- Mentored two junior developers through weekly 1-on-1s and code reviews.
- Refactored the payment module, cutting server costs by 12% and improving p99 latency by 200 ms.
- Drove adoption of automated integration tests; coverage rose from 45% to 78%.`;

const CardShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
    {children}
  </section>
);

const MetricTile: React.FC<{ label: string; value: string | number; icon: React.ElementType }> = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
    <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
      <Icon className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
      {label}
    </div>
    <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{value}</p>
  </div>
);

const PerformanceReviewPrep: React.FC<PerformanceReviewPrepProps> = ({ resumeText, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SavedPerformanceReviewResult | null>(null);
  const { canSave, saved, persist } = useToolResults<SavedPerformanceReviewResult>();
  const [fromSaved, setFromSaved] = useState(false);
  const [accomplishments, setAccomplishments] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const suggestions = useMemo(() => deriveSmartSuggestions(resumeText), [resumeText]);

  useEffect(() => {
    if (saved && !result) {
      setResult(saved.result);
      setFromSaved(true);
      if (saved.result.jobTitle) setJobTitle(saved.result.jobTitle);
    }
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetResult = () => {
    setResult(null);
    setFromSaved(false);
    setError(null);
  };

  const runTool = async () => {
    const title = jobTitle.trim();
    const evidence = accomplishments.trim();
    if (!evidence || !title) {
      setError(t('tool_perf_review_error_required'));
      return;
    }
    setJobTitle(title);
    setAccomplishments(evidence);
    const alive = begin();
    setError(null);
    setResult(null);
    try {
      const apiResult = await generatePerformanceReviewPrep(resumeText, evidence, title);
      if (!alive()) return;
      const nextResult: SavedPerformanceReviewResult = { ...apiResult, jobTitle: title };
      setResult(nextResult);
      setFromSaved(false);
      persist(nextResult);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runTool();
  };

  const formatForDownload = (res: SavedPerformanceReviewResult): string => {
    const title = res.jobTitle || jobTitle || 'Current role';
    let content = `# Performance Review Prep: ${title}\n\n`;
    content += `## Opening Statement\n${res.summary}\n\n`;
    content += `## Key Strengths\n`;
    (res.strengthsToHighlight ?? []).forEach((strength) => { content += `* ${strength}\n`; });
    content += `\n## STAR Talking Points\n`;
    (res.talkingPoints ?? []).forEach((point) => {
      content += `### ${point.accomplishment}\n${point.starMethodPoint}\n\n`;
    });
    content += `## Growth Area Discussion Points\n`;
    (res.growthAreaDiscussionPoints ?? []).forEach((point) => { content += `* ${point}\n`; });
    return content;
  };

  const renderInput = () => (
    <div className="mx-auto max-w-6xl space-y-5">
      <CardShell className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
          <form onSubmit={handleSubmit} className="min-w-0 p-5 sm:p-6 lg:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700 dark:text-indigo-300">
              <TrendingUp className="h-4 w-4" />
              {t('tool_performance_review_prep_title')}
            </div>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-3xl">
              {t('tool_perf_review_intro_line1')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t('tool_perf_review_intro_line2')}
            </p>

            <div className="mt-7 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="performance-review-job-title" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t('tool_perf_review_job_title_label')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setJobTitle(SAMPLE_JOB_TITLE);
                      setAccomplishments(SAMPLE_ACCOMPLISHMENTS);
                    }}
                    className="text-sm font-semibold text-indigo-700 transition hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
                  >
                    {t('try_example')}
                  </button>
                </div>

                {resumeText && (
                  <div className="mb-3">
                    <SmartSuggestChips
                      items={suggestions.roles}
                      onPick={(value) => setJobTitle(value)}
                      label={t('smart_suggest_target_roles')}
                    />
                  </div>
                )}

                <input
                  type="text"
                  id="performance-review-job-title"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  required
                  className="block min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder={t('tool_perf_review_job_title_placeholder')}
                />
              </div>

              <div>
                <label htmlFor="performance-review-accomplishments" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t('tool_perf_review_accomplishments_label')}
                </label>
                <textarea
                  id="performance-review-accomplishments"
                  value={accomplishments}
                  onChange={(event) => setAccomplishments(event.target.value)}
                  rows={8}
                  className="mt-2 block min-h-[220px] w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base leading-relaxed text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder={t('tool_perf_review_accomplishments_placeholder')}
                  required
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300" role="alert">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="leading-relaxed">{error}</p>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:hover:bg-red-900/30"
                    >
                      {t('try_again')}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-indigo-400"
              >
                {loading ? t('tool_perf_review_generating_button') : t('tool_perf_review_generate_button')}
              </button>
            </div>
          </form>

          <aside className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40 sm:p-6 lg:border-l lg:border-t-0">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-100">
              <div className="flex items-start gap-3">
                <Target className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm font-semibold leading-relaxed">{t('tool_perf_review_setup_desc')}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {([
                { label: t('tool_perf_review_opening_label'), Icon: MessageSquareQuote },
                { label: t('tool_perf_review_strengths_label'), Icon: BadgeCheck },
                { label: t('tool_perf_review_star_label'), Icon: BookOpenCheck },
                { label: t('tool_perf_review_growth_label'), Icon: CheckCircle2 },
              ] satisfies Array<{ label: string; Icon: React.ElementType }>).map(({ label, Icon }, index) => (
                <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {index + 1}
                  </span>
                  <Icon className="h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-300" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </CardShell>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;

    const strengths = result.strengthsToHighlight ?? [];
    const talkingPoints = result.talkingPoints ?? [];
    const growthPoints = result.growthAreaDiscussionPoints ?? [];
    const title = result.jobTitle || jobTitle || t('tool_performance_review_prep_title');
    const downloadTitle = title.replace(/\s/g, '_');

    return (
      <div className="mx-auto max-w-7xl space-y-5 animate-fade-in">
        <SavedResultBar
          t={t}
          canSave={canSave}
          isSaved={fromSaved}
          savedAt={saved?.savedAt ?? null}
          onTryNext={resetResult}
        />

        <CardShell className="overflow-hidden">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700 dark:text-indigo-300">
                <TrendingUp className="h-4 w-4" />
                {t('tool_perf_review_results_title')}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-3xl">
                {title}
              </h2>
              <p className="mt-4 max-w-4xl text-base leading-relaxed text-slate-700 dark:text-slate-300">{result.summary}</p>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40 sm:p-6 xl:border-l xl:border-t-0">
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <MetricTile label={t('tool_perf_review_strengths_label')} value={strengths.length} icon={BadgeCheck} />
                <MetricTile label={t('tool_perf_review_star_label')} value={talkingPoints.length} icon={BookOpenCheck} />
                <MetricTile label={t('tool_perf_review_growth_label')} value={growthPoints.length} icon={CheckCircle2} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <DownloadButtons textContent={formatForDownload(result)} baseFilename={`performance_review_prep_${downloadTitle}`} />
                <button
                  type="button"
                  onClick={resetResult}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t('tool_start_over')}
                </button>
              </div>
            </div>
          </div>
        </CardShell>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <CardShell className="p-5">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{t('tool_perf_review_star_label')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t('tool_perf_review_intro_line2')}</p>
            </div>
            <div className="grid gap-4">
              {talkingPoints.map((point, index) => (
                <article key={`${point.accomplishment}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-700 text-xs font-semibold text-white">{index + 1}</span>
                    <div className="min-w-0">
                      <h4 className="text-base font-semibold text-slate-950 dark:text-slate-100">{point.accomplishment}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{point.starMethodPoint}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </CardShell>

          <div className="space-y-5">
            <CardShell className="p-5">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
                <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{t('tool_perf_review_strengths_label')}</h3>
              </div>
              <ul className="mt-4 space-y-3">
                {strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </CardShell>

            <CardShell className="p-5">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
                <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{t('tool_perf_review_growth_label')}</h3>
              </div>
              <ul className="mt-4 space-y-3">
                {growthPoints.map((point, index) => (
                  <li key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    {point}
                  </li>
                ))}
              </ul>
            </CardShell>
          </div>
        </div>

        <button
          type="button"
          onClick={resetResult}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t('tool_start_over')}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <StagedLoader
        title={t('tool_perf_review_loader_title')}
        steps={[t('tool_perf_review_step1'), t('tool_perf_review_step2'), t('tool_perf_review_step3')]}
        onCancel={cancel}
        cancelLabel={t('tool_loader_hide_button')}
        cancelHint={t('tool_loader_hide_hint')}
        icon={<TrendingUp />}
        accent="indigo"
      />
    );
  }

  return result ? renderResult() : renderInput();
};

export default PerformanceReviewPrep;
