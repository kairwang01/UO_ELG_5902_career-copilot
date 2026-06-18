import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  FileText,
  ListFilter,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  Target,
  Zap,
} from 'lucide-react';
import ResumePreview from '../ResumePreview';
import CareerGoalsPanel from '../CareerGoalsPanel';
import BrowseJobs from '../BrowseJobs';
import { sampleReport } from '../../marketing/mock/sampleReport';
import { interviewFeedback } from '../../marketing/mock/interviewFeedback';
import { careerPathPlan } from '../../marketing/mock/careerPath';
import type { AppSession as Session } from '../../lib/data';
import type { UserProfile } from '../../types';
import { ALL_PLANS, PLAN_HIERARCHY } from '../../config';

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

const jobMatches = [
  {
    id: 'j1',
    title: 'Technical Product Owner',
    company: 'Northstar CRM',
    location: 'Toronto, ON · Hybrid',
    score: 84,
    priorityKey: 'ws_job_match_priority_week',
    evidence: [
      'Billing workflow redesign maps to product operations scope.',
      'Cross-functional backlog ownership appears in recent experience.',
      'Support-ticket reduction gives a measurable impact story.',
    ],
    gaps: ['Pricing discovery', 'Roadmap governance'],
    requirements: [
      { label: 'Stakeholder prioritization', met: true },
      { label: 'Technical delivery background', met: true },
      { label: 'Customer discovery', met: false },
    ],
  },
  {
    id: 'j2',
    title: 'Associate Product Manager, Platform',
    company: 'Canopy Labs',
    location: 'Remote Canada',
    score: 78,
    priorityKey: 'ws_job_match_priority_after_edits',
    evidence: [
      'Developer background supports API/platform credibility.',
      'A/B testing and SQL keywords align with screening filters.',
    ],
    gaps: ['PM title signal', 'User research synthesis'],
    requirements: [
      { label: 'SQL and analytics', met: true },
      { label: 'Feature discovery', met: false },
      { label: 'Agile delivery', met: true },
    ],
  },
  {
    id: 'j3',
    title: 'Product Operations Analyst',
    company: 'BrightHire',
    location: 'Ottawa, ON',
    score: 72,
    priorityKey: 'ws_job_match_priority_bridge',
    evidence: [
      'Process improvement examples transfer well.',
      'Operational metrics can be reframed into product evidence.',
    ],
    gaps: ['Stakeholder roadmap language', 'Interview examples'],
    requirements: [
      { label: 'Process improvement', met: true },
      { label: 'Dashboard reporting', met: true },
      { label: 'Product lifecycle', met: false },
    ],
  },
];

const practiceQuestionKeys = [
  'ws_interview_question_prioritize',
  'ws_interview_question_incomplete_info',
  'ws_interview_question_data_decision',
];

const candidatePlanKeys = ['free', 'essentials', 'accelerator', 'executive'] as const;
type CandidatePlanKey = typeof candidatePlanKeys[number];

const formatWorkspaceCopy = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)), template);

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
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-3xl">{title}</h2>
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

export const ResumeReadinessPage: React.FC<WorkspacePageProps> = ({
  resumeText,
  market,
  t,
  onUploadResume,
  onOpenTool,
}) => {
  const hasResume = resumeText.trim().length > 0;

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
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Panel
              title={t('ws_resume_summary_title')}
              description={t('ws_resume_summary_desc')}
              action={<StatusPill tone="gap">{formatWorkspaceCopy(t('ws_resume_priority_fixes'), { count: 4 })}</StatusPill>}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ScoreBlock label={t('ws_resume_ats_readiness')} value={sampleReport.atsReadiness} />
                <ScoreBlock label={t('ws_resume_target_fit')} value={sampleReport.roleFit} tone="gap" />
              </div>
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900 dark:border-blue-800/50 dark:bg-blue-900/30 dark:text-blue-200">
                {formatWorkspaceCopy(t('ws_resume_next_action'), { action: sampleReport.nextAction })}
              </div>
            </Panel>

            <Panel title={t('ws_resume_risks_title')}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">{t('ws_resume_ats_risks')}</p>
                  <div className="space-y-2">
                    {sampleReport.issues
                      .filter((issue) => issue.severity !== 'ready')
                      .map((issue) => (
                        <div key={issue.id} className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-slate-950 dark:text-slate-100">{issue.issue}</p>
                            <StatusPill tone={issue.severity === 'risk' ? 'risk' : 'gap'}>{t(`workspace_status_${issue.severity}`)}</StatusPill>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{issue.fix}</p>
                        </div>
                      ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">{t('ws_resume_missing_keywords')}</p>
                  <div className="flex flex-wrap gap-2">
                    {sampleReport.missingKeywords.map((keyword) => (
                      <StatusPill key={keyword} tone="gap">
                        {keyword}
                      </StatusPill>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{t('ws_resume_matched_signals')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sampleReport.matchedKeywords.slice(0, 5).map((keyword) => (
                      <StatusPill key={keyword} tone="ready">
                        {keyword}
                      </StatusPill>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              title={t('ws_resume_quality_title')}
              description={t('ws_resume_quality_desc')}
            >
              <div className="space-y-3">
                {sampleReport.issues.slice(0, 3).map((issue) => (
                  <div key={issue.id} className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
                    <p className="font-medium text-slate-950 dark:text-slate-100">{issue.issue}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{issue.whyItMatters}</p>
                    <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">{formatWorkspaceCopy(t('ws_resume_fix_prefix'), { fix: issue.fix })}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onOpenTool('resume-formatter')}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                {t('ws_resume_open_formatter')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </Panel>
          </div>

          <Panel title={t('ws_resume_preview_title')} description={formatWorkspaceCopy(t('ws_resume_preview_desc'), { market })}>
            <ResumePreview resumeText={resumeText} market={market} t={t} />
          </Panel>
        </div>
      )}
    </div>
  );
};

export const JobMatchPage: React.FC<WorkspacePageProps> = ({ resumeText, t, onUploadResume, onOpenTool, onViewChange, session }) => {
  const [sort, setSort] = useState<'priority' | 'score'>('priority');
  const hasResume = resumeText.trim().length > 0;
  const sortedJobs = useMemo(
    () => [...jobMatches].sort((a, b) => (sort === 'score' ? b.score - a.score : a.id.localeCompare(b.id))),
    [sort],
  );

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
        <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
          <Panel title={t('ws_job_match_controls_title')} description={t('ws_job_match_controls_desc')}>
            <div className="space-y-2">
              <button
                type="button"
                aria-pressed={sort === 'priority'}
                onClick={() => setSort('priority')}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  sort === 'priority' ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <ListFilter className="h-4 w-4" />
                {t('ws_job_match_sort_priority')}
              </button>
              <button
                type="button"
                aria-pressed={sort === 'score'}
                onClick={() => setSort('score')}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  sort === 'score' ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <Target className="h-4 w-4" />
                {t('ws_job_match_sort_score')}
              </button>
            </div>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 p-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t('ws_job_match_priority_note')}
            </div>
          </Panel>

          <div className="space-y-4">
            {sortedJobs.map((job) => (
              <article key={job.id} className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{job.title}</h3>
                      <StatusPill tone={job.score >= 80 ? 'ready' : 'gap'}>
                        {t('ws_job_match_score_badge').replace('{score}', String(job.score))}
                      </StatusPill>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {job.company} · {job.location}
                    </p>
                  </div>
                  <StatusPill tone="neutral">{t(job.priorityKey)}</StatusPill>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">{t('ws_job_match_evidence')}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {job.evidence.map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">{t('ws_job_match_skill_gaps')}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {job.gaps.map((gap) => (
                          <StatusPill key={gap} tone="gap">
                            {gap}
                          </StatusPill>
                        ))}
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {job.requirements.map((req) => (
                          <tr key={req.label} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="py-2 pr-2 text-slate-700 dark:text-slate-300">{req.label}</td>
                            <td className={`py-2 text-right font-medium ${req.met ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                              {req.met ? t('ws_job_match_requirement_met') : t('ws_job_match_requirement_gap')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('ws_job_match_next_step')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenTool('cover-letter')}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
                    >
                      <Mail className="h-4 w-4" />
                      {t('workspace_draft_cover_letter')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenTool('email-crafter')}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                      <Send className="h-4 w-4" />
                      {t('workspace_prepare_outreach')}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const InterviewPracticePage: React.FC<WorkspacePageProps> = ({ resumeText, t, onUploadResume, onOpenTool }) => {
  const [questionKey, setQuestionKey] = useState(practiceQuestionKeys[0]);
  const [answer, setAnswer] = useState(
    t('ws_interview_default_answer'),
  );
  const hasResume = resumeText.trim().length > 0;

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
          <Panel title={t('ws_interview_question_set_title')} description={t('ws_interview_question_set_desc')}>
            <div className="space-y-2">
              {practiceQuestionKeys.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuestionKey(item)}
                  className={`w-full rounded-lg border p-3 text-left text-sm font-medium transition ${
                    questionKey === item ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {t(item)}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title={t('ws_interview_answer_title')} description={t('ws_interview_answer_desc')}>
            <label htmlFor="practice-answer" className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {t('ws_interview_your_answer')}
            </label>
            <textarea
              id="practice-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              className="mt-2 min-h-[150px] w-full rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-3 text-sm leading-relaxed text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                [t('site_interview_star_s'), interviewFeedback.starFeedback.situation],
                [t('site_interview_star_t'), interviewFeedback.starFeedback.task],
                [t('site_interview_star_a'), interviewFeedback.starFeedback.action],
                [t('site_interview_star_r'), interviewFeedback.starFeedback.result],
              ].map(([label, detail]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 p-3">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-200">
              <span className="font-semibold">{t('ws_interview_improve_next')} </span>
              {interviewFeedback.starFeedback.missing}
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('site_interview_clarity')}</span>
                <span className="text-lg font-semibold text-slate-950 dark:text-slate-100">{interviewFeedback.clarityScore}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-2 rounded-full bg-amber-500" style={{ width: `${interviewFeedback.clarityScore}%` }} />
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{formatWorkspaceCopy(t('ws_interview_next_drill'), { drill: interviewFeedback.nextDrill })}</p>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};

export const CareerPlanPage: React.FC<WorkspacePageProps> = ({ resumeText, t, onUploadResume, onOpenTool }) => {
  const hasResume = resumeText.trim().length > 0;

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
          <Panel title={t('ws_plan_target_path')} description={formatWorkspaceCopy(t('ws_plan_role_path'), {
            current: careerPathPlan.currentRole,
            target: careerPathPlan.targetRole,
          })}>
            <div className="space-y-0">
              {careerPathPlan.timeline.map((step, index) => (
                <div key={step.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`mt-1 h-3 w-3 rounded-full ${
                        step.status === 'done'
                          ? 'bg-emerald-600'
                          : step.status === 'in_progress'
                            ? 'bg-blue-700 ring-4 ring-blue-100 dark:ring-blue-900/50'
                            : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                    {index < careerPathPlan.timeline.length - 1 && <div className="my-1 min-h-10 w-px flex-1 bg-slate-200 dark:bg-slate-700" />}
                  </div>
                  <div className="pb-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-950 dark:text-slate-100">{step.label}</p>
                      <StatusPill tone={step.status === 'done' ? 'ready' : step.status === 'in_progress' ? 'neutral' : 'gap'}>
                        {t(`workspace_status_${step.status}`)}
                      </StatusPill>
                    </div>
                    {step.detail && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{step.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800/50 dark:bg-blue-900/30 dark:text-blue-200">
              {formatWorkspaceCopy(t('ws_plan_bridge_role'), { role: careerPathPlan.bridgeRole })}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel title={t('ws_plan_skill_gaps')} description={t('ws_plan_skill_gaps_desc')}>
              <div className="grid gap-3 sm:grid-cols-2">
                {careerPathPlan.skillGaps.map((gap) => (
                  <div key={gap.skill} className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{gap.skill}</p>
                      <StatusPill tone={gap.priority === 'high' ? 'gap' : 'neutral'}>{t(`workspace_priority_${gap.priority}`)}</StatusPill>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white dark:bg-slate-700">
                      <div className="h-2 rounded-full bg-blue-700" style={{ width: `${gap.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title={t('ws_plan_four_week_title')} description={t('ws_plan_four_week_desc')}>
              <div className="grid gap-3 sm:grid-cols-2">
                {careerPathPlan.fourWeekPlan.map((week) => (
                  <div key={week.week} className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-950 dark:text-slate-100">
                        {formatWorkspaceCopy(t('ws_plan_week_label'), { week: week.week, focus: week.focus })}
                      </p>
                      <StatusPill tone={week.status === 'done' ? 'ready' : week.status === 'in_progress' ? 'neutral' : 'gap'}>
                        {t(`workspace_status_${week.status}`)}
                      </StatusPill>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {week.tasks.map((task) => (
                        <li key={task} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-600" />
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title={t('ws_plan_rhythm_title')}>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [t('ws_plan_rhythm_project'), t('ws_plan_rhythm_project_desc')],
                  [t('ws_plan_rhythm_learning'), t('ws_plan_rhythm_learning_desc')],
                  [t('ws_plan_rhythm_applications'), t('ws_plan_rhythm_applications_desc')],
                ].map(([title, detail]) => (
                  <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 p-4">
                    <p className="font-medium text-slate-950 dark:text-slate-100">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{detail}</p>
                  </div>
                ))}
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
