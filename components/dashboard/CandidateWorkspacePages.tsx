import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  FileText,
  ListFilter,
  MessageSquare,
  Target,
} from 'lucide-react';
import ResumePreview from '../ResumePreview';
import { sampleReport } from '../../marketing/mock/sampleReport';
import { interviewFeedback } from '../../marketing/mock/interviewFeedback';
import { careerPathPlan } from '../../marketing/mock/careerPath';

type WorkspaceView = 'dashboard' | 'resume' | 'jobs' | 'interview' | 'plan' | 'toolkit';

interface WorkspacePageProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
  onUploadResume: () => void;
  onOpenTool: (tool: string) => void;
  onViewChange: (view: WorkspaceView) => void;
}

const jobMatches = [
  {
    id: 'j1',
    title: 'Technical Product Owner',
    company: 'Northstar CRM',
    location: 'Toronto, ON · Hybrid',
    score: 84,
    priority: 'Apply this week',
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
    priority: 'Review after resume edits',
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
    priority: 'Good bridge role',
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

const practiceQuestions = [
  'Tell me about a time you had to prioritize conflicting requests from stakeholders.',
  'Walk me through a product decision you made with incomplete information.',
  'Describe a time you used data to change a team decision.',
];

const StatusPill: React.FC<{ tone: 'ready' | 'gap' | 'risk' | 'neutral'; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const styles = {
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    gap: 'border-amber-200 bg-amber-50 text-amber-700',
    risk: 'border-red-200 bg-red-50 text-red-700',
    neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  };

  return <span className={`rounded border px-2 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
};

const Panel: React.FC<{ title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  description,
  children,
  action,
}) => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        {description && <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>}
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
  <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>
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
  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
      <FileText className="h-5 w-5" />
    </div>
    <h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3>
    <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{description}</p>
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-lg font-semibold text-slate-950">{value}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white">
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
        label="Resume readiness"
        title="Resume report built for screening decisions"
        description="Review ATS risks, missing keywords, evidence quality, and the highest-priority edits before sending applications."
        icon={FileText}
        primaryLabel={hasResume ? 'Update resume' : 'Upload resume'}
        onPrimary={onUploadResume}
      />

      {!hasResume ? (
        <EmptyWorkbenchState
          title="Upload a resume to generate the readiness report"
          description="After upload, this page shows a score, ATS risks, keyword gaps, content quality findings, and a ranked fix list."
          buttonLabel="Upload resume"
          onClick={onUploadResume}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Panel
              title="Readiness summary"
              description="The report separates formatting risk from content gaps so you know what to fix first."
              action={<StatusPill tone="gap">4 priority fixes</StatusPill>}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ScoreBlock label="ATS readiness" value={sampleReport.atsReadiness} />
                <ScoreBlock label="Target role fit" value={sampleReport.roleFit} tone="gap" />
              </div>
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900">
                Next action: {sampleReport.nextAction}
              </div>
            </Panel>

            <Panel title="ATS risks and keyword gaps">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">ATS risks</p>
                  <div className="space-y-2">
                    {sampleReport.issues
                      .filter((issue) => issue.severity !== 'ready')
                      .map((issue) => (
                        <div key={issue.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-slate-950">{issue.issue}</p>
                            <StatusPill tone={issue.severity === 'risk' ? 'risk' : 'gap'}>{issue.severity}</StatusPill>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-600">{issue.fix}</p>
                        </div>
                      ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Missing keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {sampleReport.missingKeywords.map((keyword) => (
                      <StatusPill key={keyword} tone="gap">
                        {keyword}
                      </StatusPill>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-emerald-700">Matched signals</p>
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
              title="Content quality suggestions"
              description="Edits are framed as recruiter-visible improvements, not generic writing advice."
            >
              <div className="space-y-3">
                {sampleReport.issues.slice(0, 3).map((issue) => (
                  <div key={issue.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="font-medium text-slate-950">{issue.issue}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{issue.whyItMatters}</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">Fix: {issue.fix}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onOpenTool('resume-formatter')}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                Open resume formatter
                <ArrowRight className="h-4 w-4" />
              </button>
            </Panel>
          </div>

          <Panel title="Current resume preview" description={`Market: ${market}`}>
            <ResumePreview resumeText={resumeText} market={market} t={t} />
          </Panel>
        </div>
      )}
    </div>
  );
};

export const JobMatchPage: React.FC<WorkspacePageProps> = ({ resumeText, onUploadResume, onOpenTool }) => {
  const [sort, setSort] = useState<'priority' | 'score'>('priority');
  const hasResume = resumeText.trim().length > 0;
  const sortedJobs = useMemo(
    () => [...jobMatches].sort((a, b) => (sort === 'score' ? b.score - a.score : a.id.localeCompare(b.id))),
    [sort],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        label="Job match"
        title="Matches ranked by evidence, not just keywords"
        description="Compare fit score, match reason, missing skills, resume evidence, and application priority before spending time on a role."
        icon={Briefcase}
        primaryLabel={hasResume ? 'Find more matches' : 'Upload resume'}
        onPrimary={() => (hasResume ? onOpenTool('opportunity-finder') : onUploadResume())}
      />

      {!hasResume ? (
        <EmptyWorkbenchState
          title="Upload a resume to rank jobs against your experience"
          description="The match view needs your resume to explain why a job is strong, which gaps matter, and whether to apply now or later."
          buttonLabel="Upload resume"
          onClick={onUploadResume}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
          <Panel title="Filters" description="Basic controls for MVP sorting.">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSort('priority')}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  sort === 'priority' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700'
                }`}
              >
                <ListFilter className="h-4 w-4" />
                Apply priority
              </button>
              <button
                type="button"
                onClick={() => setSort('score')}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  sort === 'score' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700'
                }`}
              >
                <Target className="h-4 w-4" />
                Match score
              </button>
            </div>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Priority uses score, missing required skills, and whether your resume has clear evidence.
            </div>
          </Panel>

          <div className="space-y-4">
            {sortedJobs.map((job) => (
              <article key={job.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-950">{job.title}</h3>
                      <StatusPill tone={job.score >= 80 ? 'ready' : 'gap'}>{job.score}% match</StatusPill>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {job.company} · {job.location}
                    </p>
                  </div>
                  <StatusPill tone="neutral">{job.priority}</StatusPill>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resume evidence</p>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                      {job.evidence.map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Skill gaps</p>
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
                          <tr key={req.label} className="border-t border-slate-200">
                            <td className="py-2 pr-2 text-slate-700">{req.label}</td>
                            <td className={`py-2 text-right font-medium ${req.met ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {req.met ? 'Met' : 'Gap'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export const InterviewPracticePage: React.FC<WorkspacePageProps> = ({ resumeText, onUploadResume, onOpenTool }) => {
  const [question, setQuestion] = useState(practiceQuestions[0]);
  const [answer, setAnswer] = useState(
    'In the sprint planning cycle, sales needed a demo feature while support needed a billing fix. I reviewed ticket volume, revenue impact, and customer renewal risk...',
  );
  const hasResume = resumeText.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        label="Interview practice"
        title="Practice answers against the roles you are targeting"
        description="Use role-relevant prompts, draft an answer, and review STAR structure, completeness, clarity, and the next drill."
        icon={MessageSquare}
        primaryLabel={hasResume ? 'Start guided practice' : 'Upload resume'}
        onPrimary={() => (hasResume ? onOpenTool('mock-interview') : onUploadResume())}
      />

      {!hasResume ? (
        <EmptyWorkbenchState
          title="Upload a resume to tailor interview questions"
          description="Without a resume, practice can only be generic. Upload first to generate role and experience-specific prompts."
          buttonLabel="Upload resume"
          onClick={onUploadResume}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Question set" description="Choose a likely interview prompt for the next practice round.">
            <div className="space-y-2">
              {practiceQuestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuestion(item)}
                  className={`w-full rounded-lg border p-3 text-left text-sm font-medium transition ${
                    question === item ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Answer workspace" description="Draft the answer in STAR form, then compare it to the feedback model.">
            <label htmlFor="practice-answer" className="text-sm font-medium text-slate-800">
              Your answer
            </label>
            <textarea
              id="practice-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              className="mt-2 min-h-[150px] w-full rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ['Situation', interviewFeedback.starFeedback.situation],
                ['Task', interviewFeedback.starFeedback.task],
                ['Action', interviewFeedback.starFeedback.action],
                ['Result', interviewFeedback.starFeedback.result],
              ].map(([label, detail]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-blue-700">{label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              <span className="font-semibold">Improve next: </span>
              {interviewFeedback.starFeedback.missing}
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">Clarity score</span>
                <span className="text-lg font-semibold text-slate-950">{interviewFeedback.clarityScore}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-amber-500" style={{ width: `${interviewFeedback.clarityScore}%` }} />
              </div>
              <p className="mt-3 text-sm text-slate-600">Next drill: {interviewFeedback.nextDrill}</p>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};

export const CareerPlanPage: React.FC<WorkspacePageProps> = ({ resumeText, onUploadResume, onOpenTool }) => {
  const hasResume = resumeText.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        label="Career plan"
        title="Turn the target role into weekly actions"
        description="Plan the bridge role, skill gaps, learning path, project proof, application rhythm, and next milestone."
        icon={CalendarCheck}
        primaryLabel={hasResume ? 'Generate updated plan' : 'Upload resume'}
        onPrimary={() => (hasResume ? onOpenTool('career-path-planner') : onUploadResume())}
      />

      {!hasResume ? (
        <EmptyWorkbenchState
          title="Upload a resume to create a role path"
          description="The plan needs your current role and evidence level to estimate skill gaps, bridge roles, and weekly actions."
          buttonLabel="Upload resume"
          onClick={onUploadResume}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Target path" description={`${careerPathPlan.currentRole} to ${careerPathPlan.targetRole}`}>
            <div className="space-y-0">
              {careerPathPlan.timeline.map((step, index) => (
                <div key={step.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`mt-1 h-3 w-3 rounded-full ${
                        step.status === 'done'
                          ? 'bg-emerald-600'
                          : step.status === 'in_progress'
                            ? 'bg-blue-700 ring-4 ring-blue-100'
                            : 'bg-slate-300'
                      }`}
                    />
                    {index < careerPathPlan.timeline.length - 1 && <div className="my-1 min-h-10 w-px flex-1 bg-slate-200" />}
                  </div>
                  <div className="pb-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-950">{step.label}</p>
                      <StatusPill tone={step.status === 'done' ? 'ready' : step.status === 'in_progress' ? 'neutral' : 'gap'}>
                        {step.status.replace('_', ' ')}
                      </StatusPill>
                    </div>
                    {step.detail && <p className="mt-1 text-sm text-slate-600">{step.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              Recommended bridge role: <span className="font-semibold">{careerPathPlan.bridgeRole}</span>
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel title="Skill gaps" description="Gap progress is used to shape learning and portfolio tasks.">
              <div className="grid gap-3 sm:grid-cols-2">
                {careerPathPlan.skillGaps.map((gap) => (
                  <div key={gap.skill} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{gap.skill}</p>
                      <StatusPill tone={gap.priority === 'high' ? 'gap' : 'neutral'}>{gap.priority}</StatusPill>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-blue-700" style={{ width: `${gap.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Four-week action plan" description="A concrete operating cadence for resume, projects, practice, and applications.">
              <div className="grid gap-3 sm:grid-cols-2">
                {careerPathPlan.fourWeekPlan.map((week) => (
                  <div key={week.week} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-950">
                        Week {week.week}: {week.focus}
                      </p>
                      <StatusPill tone={week.status === 'done' ? 'ready' : week.status === 'in_progress' ? 'neutral' : 'gap'}>
                        {week.status.replace('_', ' ')}
                      </StatusPill>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
                      {week.tasks.map((task) => (
                        <li key={task} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Project and application rhythm">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Project proof', 'Build one product case study from a current workflow improvement.'],
                  ['Learning', 'Complete one roadmap prioritization exercise and one user interview synthesis.'],
                  ['Applications', 'Apply to 5 bridge roles after resume title and evidence edits.'],
                ].map(([title, detail]) => (
                  <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="font-medium text-slate-950">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{detail}</p>
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
