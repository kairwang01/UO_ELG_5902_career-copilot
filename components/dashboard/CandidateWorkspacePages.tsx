import React, { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  MessageSquare,
  Target,
  Zap,
} from 'lucide-react';
import ResumePreview from '../ResumePreview';
import CareerGoalsPanel from '../CareerGoalsPanel';
import BrowseJobs from '../BrowseJobs';
import { firestoreDb } from '../../lib/firebaseClient';
import { useRecentApplications } from '../../hooks/useRecentApplications';
import { getApplicationStatusLabelKey } from '../../lib/applicationPipeline';
import type { AppSession as Session } from '../../lib/data';
import type { AnalysisResult, Improvement, UserProfile } from '../../types';
import { ALL_PLANS, PLAN_HIERARCHY } from '../../config';
import { createBillingPortalSession } from '../../services/subscriptionClient';

type WorkspaceView = 'dashboard' | 'resume' | 'talent_profile' | 'jobs' | 'interview' | 'plan' | 'toolkit' | 'billing';

interface WorkspacePageProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
  onUploadResume: () => void;
  onOpenTool: (tool: string) => void;
  onViewChange: (view: WorkspaceView) => void;
  session?: Session | null;
}

const candidatePlanKeys = ['free', 'essentials', 'accelerator', 'executive'] as const;
type CandidatePlanKey = typeof candidatePlanKeys[number];

type LatestResumeAnalysis = AnalysisResult & {
  market_name?: string;
  created_at?: { toDate?: () => Date } | string | null;
};

const formatWorkspaceCopy = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)), template);

const formatAnalysisDate = (value: LatestResumeAnalysis['created_at']): string => {
  if (!value) return '';
  try {
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString();
    }
    const date = value.toDate?.();
    return date ? date.toLocaleDateString() : '';
  } catch {
    return '';
  }
};

const normalizeImprovements = (value: unknown): Improvement[] =>
  Array.isArray(value)
    ? value
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          const area = typeof record.area === 'string' ? record.area.trim() : '';
          const suggestion = typeof record.suggestion === 'string' ? record.suggestion.trim() : '';
          return area || suggestion ? { area, suggestion } : null;
        })
        .filter((item): item is Improvement => Boolean(item))
    : [];

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : [];

const useLatestResumeAnalysis = (session?: Session | null) => {
  const uid = session?.user?.id ?? null;
  const [analysis, setAnalysis] = useState<LatestResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!uid) {
      setAnalysis(null);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getDocs(query(
      collection(firestoreDb, 'users', uid, 'resume_analyses'),
      orderBy('created_at', 'desc'),
      limit(1),
    ))
      .then((snap) => {
        if (cancelled) return;
        const row = snap.docs[0]?.data() as Record<string, unknown> | undefined;
        if (!row) {
          setAnalysis(null);
          return;
        }
        setAnalysis({
          score: Number(row.score ?? 0),
          summary: typeof row.summary === 'string' ? row.summary : '',
          strengths: normalizeStringArray(row.strengths),
          improvements: normalizeImprovements(row.improvements),
          keywords: normalizeStringArray(row.keywords),
          market_name: typeof row.market_name === 'string' ? row.market_name : undefined,
          created_at: (row.created_at ?? null) as LatestResumeAnalysis['created_at'],
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAnalysis(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return { analysis, loading, error };
};

const StatusPill: React.FC<{ tone: 'ready' | 'gap' | 'risk' | 'neutral'; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const styles = {
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-300',
    gap: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-300',
    risk: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-900/30 dark:text-red-300',
    neutral: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
  };

  return <span className={`rounded border px-2 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
};

const Panel: React.FC<{ title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  description,
  children,
  action,
}) => (
  <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{title}</h3>
        {description && <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const PageHeader: React.FC<{
  label: string;
  title: string;
  description: string;
  icon: React.ElementType;
  primaryLabel: string;
  onPrimary: () => void;
}> = ({ label, title, description, icon: Icon, primaryLabel, onPrimary }) => (
  <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={onPrimary}
        className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
      >
        {primaryLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  </div>
);

const EmptyWorkbenchState: React.FC<{
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
}> = ({ title, description, buttonLabel, onClick }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 p-8 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/30 dark:text-blue-300">
      <FileText className="h-5 w-5" />
    </div>
    <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-100">{title}</h3>
    <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
    <button
      type="button"
      onClick={onClick}
      className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
    >
      {buttonLabel}
    </button>
  </div>
);

const ScoreBlock: React.FC<{ label: string; value: number; tone?: 'ready' | 'gap' | 'risk' }> = ({
  label,
  value,
  tone = 'ready',
}) => {
  const bar = tone === 'risk' ? 'bg-red-600' : tone === 'gap' ? 'bg-amber-500' : 'bg-emerald-600';

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-lg font-semibold text-slate-950 dark:text-slate-100">{value}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white dark:bg-slate-700">
        <div className={`h-2 rounded-full ${bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
};

const getResumeScoreTone = (score: number): 'ready' | 'gap' | 'risk' =>
  score >= 75 ? 'ready' : score >= 55 ? 'gap' : 'risk';

const ResumeScoreStrip: React.FC<{
  score: number;
  fixesCount: number;
  latestDate: string;
  marketName: string;
  t: (key: string) => string;
}> = ({ score, fixesCount, latestDate, marketName, t }) => {
  const tone = getResumeScoreTone(score);
  const toneStyles = {
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-300',
    gap: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-300',
    risk: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-3 md:grid-cols-4">
        <div className={`rounded-lg border p-4 ${toneStyles[tone]}`}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{t('ws_resume_score_label')}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-3xl font-semibold tracking-tight">{score}</span>
            <span className="text-xs font-semibold">/100</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/70 dark:bg-slate-950/40">
            <div className="h-1.5 rounded-full bg-current" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('ws_resume_improvements_title')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">{fixesCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('ws_resume_latest_report')}</p>
          <p className="mt-2 text-base font-semibold text-slate-950 dark:text-slate-100">{latestDate || t('ws_resume_latest_report_unknown')}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {formatWorkspaceCopy(t('ws_resume_preview_desc'), { market: marketName }).replace(marketName, '').replace(/[：:]\s*$/, '').trim()}
          </p>
          <p className="mt-2 text-base font-semibold text-slate-950 dark:text-slate-100">{marketName}</p>
        </div>
      </div>
    </section>
  );
};

const ResumeFixQueue: React.FC<{
  improvements: Improvement[];
  summary: string;
  t: (key: string) => string;
  onOpenFormatter: () => void;
}> = ({ improvements, summary, t, onOpenFormatter }) => {
  const topFixes = improvements.slice(0, 3);
  const remainingFixes = improvements.slice(3);

  return (
    <Panel
      title={formatWorkspaceCopy(t('ws_resume_priority_fixes'), { count: improvements.length })}
      description={summary}
      action={
        <button
          type="button"
          onClick={onOpenFormatter}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          {t('ws_resume_open_formatter')}
          <ArrowRight className="h-4 w-4" />
        </button>
      }
    >
      {topFixes.length > 0 ? (
        <div className="space-y-3">
          {topFixes.map((issue, index) => (
            <article
              key={`${issue.area}-${index}`}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-blue-800 dark:hover:bg-blue-900/20"
            >
              <div className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-300">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <p className="font-semibold text-slate-950 dark:text-slate-100">{issue.area || t('ws_resume_improvement_fallback')}</p>
                    <StatusPill tone={index < 2 ? 'risk' : 'gap'}>
                      {index < 2 ? t('workspace_priority_high') : t('workspace_priority_medium')}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{issue.suggestion}</p>
                </div>
              </div>
            </article>
          ))}
          {remainingFixes.length > 0 && (
            <details className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <summary className="cursor-pointer text-sm font-semibold text-blue-700 dark:text-blue-400">
                {t('ws_resume_improvements_title')} · {remainingFixes.length}
              </summary>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {remainingFixes.map((issue, index) => (
                  <div key={`${issue.area}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">{issue.area || t('ws_resume_improvement_fallback')}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{issue.suggestion}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
          {t('ws_resume_no_improvements')}
        </div>
      )}
    </Panel>
  );
};

const ResumeSignalsPanel: React.FC<{
  strengths: string[];
  keywords: string[];
  t: (key: string) => string;
}> = ({ strengths, keywords, t }) => (
  <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
    <Panel title={t('ws_resume_strengths_title')} description={t('ws_resume_quality_desc')}>
      <div className="space-y-2">
        {strengths.length > 0 ? strengths.slice(0, 4).map((strength) => (
          <div key={strength} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">{strength}</p>
          </div>
        )) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('ws_resume_no_strengths')}</p>
        )}
      </div>
    </Panel>

    <Panel title={t('ws_resume_keywords_title')}>
      <div className="flex flex-wrap gap-2">
        {keywords.length > 0 ? keywords.slice(0, 14).map((keyword) => (
          <StatusPill key={keyword} tone="ready">
            {keyword}
          </StatusPill>
        )) : <span className="text-sm text-slate-500 dark:text-slate-400">{t('ws_resume_no_keywords')}</span>}
      </div>
    </Panel>
  </div>
);

const StickyResumePreviewPanel: React.FC<{
  resumeText: string;
  market: string;
  t: (key: string) => string;
  onOpenFormatter: () => void;
}> = ({ resumeText, market, t, onOpenFormatter }) => (
  <aside className="xl:sticky xl:top-6">
    <Panel
      title={t('ws_resume_preview_title')}
      description={formatWorkspaceCopy(t('ws_resume_preview_desc'), { market })}
      action={
        <button
          type="button"
          onClick={onOpenFormatter}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
        >
          {t('ws_resume_open_formatter')}
          <ArrowRight className="h-4 w-4" />
        </button>
      }
    >
      <ResumePreview resumeText={resumeText} market={market} t={t} />
    </Panel>
  </aside>
);

export const ResumeReadinessPage: React.FC<WorkspacePageProps> = ({
  resumeText,
  market,
  t,
  onUploadResume,
  onOpenTool,
  session,
}) => {
  const hasResume = resumeText.trim().length > 0;
  const { analysis, loading: analysisLoading, error: analysisError } = useLatestResumeAnalysis(session);
  const latestDate = formatAnalysisDate(analysis?.created_at);
  const improvements = analysis?.improvements ?? [];
  const strengths = analysis?.strengths ?? [];
  const keywords = analysis?.keywords ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        label={t('ws_resume_label')}
        title={t('ws_resume_title')}
        description={t('ws_resume_desc')}
        icon={FileText}
        primaryLabel={hasResume ? t('ws_update_resume') : t('ws_upload_resume')}
        onPrimary={onUploadResume}
      />

      {!hasResume ? (
        <EmptyWorkbenchState
          title={t('ws_resume_empty_title')}
          description={t('ws_resume_empty_desc')}
          buttonLabel={t('ws_upload_resume')}
          onClick={onUploadResume}
        />
      ) : analysisLoading ? (
        <Panel title={t('ws_resume_summary_title')} description={t('ws_resume_analysis_loading')}>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('ws_resume_analysis_loading')}
          </div>
        </Panel>
      ) : !analysis ? (
        <div className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel
            title={t('ws_resume_no_report_title')}
            description={analysisError ? t('ws_resume_analysis_unavailable') : t('ws_resume_no_report_desc')}
            action={
              <button
                type="button"
                onClick={onUploadResume}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                {t('ws_resume_run_analysis')}
                <ArrowRight className="h-4 w-4" />
              </button>
            }
          >
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900 dark:border-blue-800/50 dark:bg-blue-900/30 dark:text-blue-200">
              {t('ws_resume_no_report_hint')}
            </div>
          </Panel>
          <StickyResumePreviewPanel
            resumeText={resumeText}
            market={market}
            t={t}
            onOpenFormatter={() => onOpenTool('resume-formatter')}
          />
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.78fr)]">
          <div className="space-y-5">
            <ResumeScoreStrip
              score={Math.max(0, Math.min(100, Math.round(analysis.score || 0)))}
              fixesCount={improvements.length}
              latestDate={latestDate}
              marketName={analysis.market_name || market}
              t={t}
            />
            <ResumeFixQueue
              improvements={improvements}
              summary={analysis.summary || formatWorkspaceCopy(t('ws_resume_next_action'), { action: t('ws_resume_run_analysis') })}
              t={t}
              onOpenFormatter={() => onOpenTool('resume-formatter')}
            />
            <ResumeSignalsPanel strengths={strengths} keywords={keywords} t={t} />
          </div>

          <StickyResumePreviewPanel
            resumeText={resumeText}
            market={analysis.market_name || market}
            t={t}
            onOpenFormatter={() => onOpenTool('resume-formatter')}
          />
        </div>
      )}
    </div>
  );
};

export const JobMatchPage: React.FC<WorkspacePageProps> = ({ resumeText, t, onUploadResume, onOpenTool, onViewChange, session }) => {
  const hasResume = resumeText.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Page intro first, then goals, the live job feed, and the match deep-dives. */}
      <PageHeader
        label={t('ws_job_match_label')}
        title={t('ws_job_match_title')}
        description={t('ws_job_match_desc')}
        icon={Briefcase}
        primaryLabel={hasResume ? t('ws_job_match_find_more') : t('ws_upload_resume')}
        onPrimary={() => (hasResume ? onOpenTool('opportunity-finder') : onUploadResume())}
      />
      <CareerGoalsPanel t={t} />
      <BrowseJobs session={session ?? null} t={t} onEditProfile={() => onViewChange('talent_profile')} />

      {!hasResume ? (
        <EmptyWorkbenchState
          title={t('ws_job_match_empty_title')}
          description={t('ws_job_match_empty_desc')}
          buttonLabel={t('ws_upload_resume')}
          onClick={onUploadResume}
        />
      ) : (
        <Panel title={t('ws_job_match_live_title')} description={t('ws_job_match_live_desc')}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenTool('opportunity-finder')}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              <Target className="h-4 w-4" />
              {t('ws_job_match_find_more')}
            </button>
            <button
              type="button"
              onClick={() => onOpenTool('cover-letter')}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
            >
              <FileText className="h-4 w-4" />
              {t('workspace_draft_cover_letter')}
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
};

export const InterviewPracticePage: React.FC<WorkspacePageProps> = ({ resumeText, t, onUploadResume, onOpenTool, session }) => {
  const hasResume = resumeText.trim().length > 0;
  const { applications, loading } = useRecentApplications(session ?? null);
  const interviewReady = applications.filter((app) => {
    const labelKey = getApplicationStatusLabelKey(app.status);
    return labelKey.includes('interview') || labelKey.includes('offer');
  });

  return (
    <div className="space-y-6">
      <PageHeader
        label={t('ws_interview_label')}
        title={t('ws_interview_title')}
        description={t('ws_interview_desc')}
        icon={MessageSquare}
        primaryLabel={hasResume ? t('ws_interview_start_practice') : t('ws_upload_resume')}
        onPrimary={() => (hasResume ? onOpenTool('mock-interview') : onUploadResume())}
      />

      {!hasResume ? (
        <EmptyWorkbenchState
          title={t('ws_interview_empty_title')}
          description={t('ws_interview_empty_desc')}
          buttonLabel={t('ws_upload_resume')}
          onClick={onUploadResume}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title={t('ws_interview_context_title')} description={t('ws_interview_context_desc')}>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('dashboard_app_stage_loading')}
              </div>
            ) : applications.length > 0 ? (
              <div className="space-y-3">
                {applications.slice(0, 4).map((app) => (
                  <div key={app.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">{app.job_title || t('applications_unknown_role')}</p>
                      <StatusPill tone={interviewReady.some((item) => item.id === app.id) ? 'ready' : 'neutral'}>
                        {t(getApplicationStatusLabelKey(app.status))}
                      </StatusPill>
                    </div>
                    {app.application_date && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatWorkspaceCopy(t('ws_interview_applied_on'), { date: new Date(app.application_date).toLocaleDateString() })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                {t('ws_interview_no_applications')}
              </div>
            )}
          </Panel>

          <Panel title={t('ws_interview_tool_title')} description={t('ws_interview_tool_desc')}>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['site_interview_star_s', 'ws_interview_prepare_story'],
                ['site_interview_star_t', 'ws_interview_prepare_role'],
                ['site_interview_star_r', 'ws_interview_prepare_metric'],
              ].map(([labelKey, detailKey]) => (
                <div key={labelKey} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{t(labelKey)}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t(detailKey)}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onOpenTool('mock-interview')}
              className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              <MessageSquare className="h-4 w-4" />
              {t('ws_interview_start_practice')}
            </button>
          </Panel>
        </div>
      )}
    </div>
  );
};

export const CareerPlanPage: React.FC<WorkspacePageProps> = ({ resumeText, t, onUploadResume, onOpenTool, session }) => {
  const hasResume = resumeText.trim().length > 0;
  const { analysis, loading: analysisLoading, error: analysisError } = useLatestResumeAnalysis(session);
  const { applications, loading: applicationsLoading } = useRecentApplications(session ?? null);
  const improvements = analysis?.improvements ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        label={t('ws_plan_label')}
        title={t('ws_plan_title')}
        description={t('ws_plan_desc')}
        icon={CalendarCheck}
        primaryLabel={hasResume ? t('ws_plan_generate_updated') : t('ws_upload_resume')}
        onPrimary={() => (hasResume ? onOpenTool('career-path') : onUploadResume())}
      />

      {!hasResume ? (
        <EmptyWorkbenchState
          title={t('ws_plan_empty_title')}
          description={t('ws_plan_empty_desc')}
          buttonLabel={t('ws_upload_resume')}
          onClick={onUploadResume}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title={t('ws_plan_current_signals')} description={t('ws_plan_current_signals_desc')}>
            <div className="grid gap-3 sm:grid-cols-3">
              <ScoreBlock
                label={t('ws_resume_score_label')}
                value={analysis ? Math.max(0, Math.min(100, Math.round(analysis.score || 0))) : 0}
                tone={!analysis ? 'gap' : analysis.score >= 75 ? 'ready' : 'gap'}
              />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('applications_title')}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">
                  {applicationsLoading ? '...' : applications.length}
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('ws_plan_applications_helper')}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('ws_resume_priority_fixes').replace('{count}', String(improvements.length))}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">
                  {analysisLoading ? '...' : improvements.length}
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('ws_plan_fixes_helper')}</p>
              </div>
            </div>
            {!analysis && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-200">
                {/* Distinguish a fetch failure from "never analyzed" so an existing user
                    isn't falsely told to run an analysis. */}
                {analysisError ? t('ws_resume_analysis_unavailable') : t('ws_plan_needs_analysis')}
              </div>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel title={t('ws_plan_skill_gaps')} description={t('ws_plan_skill_gaps_desc')}>
              {improvements.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {improvements.slice(0, 4).map((gap, index) => (
                    <div key={`${gap.area}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{gap.area || t('ws_resume_improvement_fallback')}</p>
                        <StatusPill tone={index < 2 ? 'gap' : 'neutral'}>{index < 2 ? t('workspace_priority_high') : t('workspace_priority_medium')}</StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{gap.suggestion}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">{t('ws_plan_no_gaps_yet')}</p>
              )}
            </Panel>

            <Panel title={t('ws_plan_four_week_title')} description={t('ws_plan_four_week_desc')}>
              <div className="space-y-3">
                {[
                  ['ws_plan_action_analyze', analysis ? 'ready' : 'gap'],
                  ['ws_plan_action_profile', 'neutral'],
                  ['ws_plan_action_portfolio', 'neutral'],
                  ['ws_plan_action_apply', applications.length > 0 ? 'ready' : 'gap'],
                ].map(([key, tone]) => (
                  <div key={key} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{t(key)}</p>
                    <StatusPill tone={tone as 'ready' | 'gap' | 'neutral'}>{tone === 'ready' ? t('workspace_status_done') : t('workspace_status_pending')}</StatusPill>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title={t('ws_plan_rhythm_title')}>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenTool('career-path')}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                >
                  <CalendarCheck className="h-4 w-4" />
                  {t('ws_plan_generate_updated')}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTool('skill-learning-plan')}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
                >
                  {t('tool_skill_learning_plan_title')}
                </button>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
};

interface CandidateBillingPageProps {
  profile: UserProfile;
  credits: number;
  t: (key: string) => string;
  onSelectPlan: (planKey: CandidatePlanKey) => void;
  savingPlan: CandidatePlanKey | null;
  onViewPricing: () => void;
}

const normalizePlanStatus = (status: string) => status.replace('pending_biz_', '').replace('pending_', '');
const getPlanPeriodLabel = (planKey: string, t: (key: string) => string) => {
  const periodKey = `plan_${planKey}_period_desc`;
  const translated = t(periodKey);
  return translated === periodKey ? t(`plan_${planKey}_price_desc`) : translated;
};

const getPlanFeatureLabel = (planKey: string, index: number, fallback: string, t: (key: string) => string) => {
  const featureKey = `plan_${planKey}_feature_${index + 1}`;
  const translated = t(featureKey);
  return translated === featureKey ? fallback : translated;
};

export const CandidateBillingPage: React.FC<CandidateBillingPageProps> = ({
  profile,
  credits,
  t,
  onSelectPlan,
  savingPlan,
  onViewPricing,
}) => {
  const currentStatus = profile.subscription_status || 'free';
  const currentPlanKey = normalizePlanStatus(currentStatus) as CandidatePlanKey;
  const currentPlan = ALL_PLANS[currentPlanKey] ?? ALL_PLANS.free;
  const currentLevel = PLAN_HIERARCHY[currentPlanKey] ?? 0;
  const isPending = currentStatus.startsWith('pending_');
  const hasActivePaidPlan = currentLevel > 0 && !isPending;
  const [openingPortal, setOpeningPortal] = useState(false);

  const handleManageSubscription = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      const { url } = await createBillingPortalSession();
      window.location.assign(url);
    } catch {
      setOpeningPortal(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        label={t('ws_billing_label')}
        title={t('ws_billing_title')}
        description={t('ws_billing_desc')}
        icon={CreditCard}
        primaryLabel={t('ws_billing_view_public_pricing')}
        onPrimary={onViewPricing}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel title={t('ws_billing_current_plan')} description={t('ws_billing_current_desc')}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/30 dark:text-blue-300">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
                    {t(`plan_${currentPlan.key}_name`)}
                  </h3>
                  <StatusPill tone={isPending ? 'gap' : currentLevel > 0 ? 'ready' : 'neutral'}>
                    {isPending ? t('ws_billing_pending') : currentLevel > 0 ? t('ws_billing_active') : t('ws_plan_free')}
                  </StatusPill>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {currentPlan.price} · {getPlanPeriodLabel(currentPlan.key, t)}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-right dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">{t('ws_credits_label')}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-100">{credits.toLocaleString()} CR</p>
            </div>
          </div>
          {hasActivePaidPlan && (
            <div className="mt-5">
              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={openingPortal}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {openingPortal ? t('ws_billing_opening_portal') : t('ws_billing_manage_subscription')}
              </button>
            </div>
          )}
          {isPending && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-200">
              {t('ws_billing_pending_notice')}
            </div>
          )}
        </Panel>

        <Panel title={t('ws_billing_usage_title')} description={t('ws_billing_usage_desc')}>
          <div className="space-y-3">
            {[
              [t('studio_phase_resume'), t('studio_stat_resume_helper')],
              [t('studio_phase_matching'), t('studio_stat_match_helper')],
              [t('studio_phase_interview'), t('studio_stat_interview_helper')],
            ].map(([label, helper]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{helper}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title={t('ws_billing_available_plans')} description={t('ws_billing_available_desc')}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {candidatePlanKeys.map((planKey) => {
            const plan = ALL_PLANS[planKey];
            const planLevel = PLAN_HIERARCHY[planKey] ?? 0;
            const isCurrent = planKey === currentPlanKey;
            const isSaving = savingPlan === planKey;
            const isUpgrade = planLevel > currentLevel;
            const actionLabel = isSaving
              ? t('ws_billing_updating')
              : isCurrent
                ? t('ws_billing_selected_plan')
                : isUpgrade
                  ? t('ws_billing_upgrade')
                  : t('ws_billing_switch');

            return (
              <article
                key={planKey}
                className={`flex min-h-[330px] flex-col rounded-lg border p-5 transition ${
                  isCurrent
                    ? 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:ring-blue-900/30'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800'
                }`}
              >
                <div className="mb-4">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{t(`plan_${plan.key}_name`)}</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-950 dark:text-slate-100">{plan.price}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{getPlanPeriodLabel(plan.key, t)}</span>
                  </div>
                </div>

                <ul className="mb-5 flex-1 space-y-2">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={feature} className="flex gap-2 text-sm leading-5 text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{getPlanFeatureLabel(plan.key, featureIndex, feature, t)}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => onSelectPlan(planKey)}
                  disabled={isCurrent || savingPlan !== null}
                  className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-400/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isCurrent
                      ? 'bg-blue-700 text-white'
                      : isUpgrade
                        ? 'border border-blue-700 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {actionLabel}
                </button>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
};
