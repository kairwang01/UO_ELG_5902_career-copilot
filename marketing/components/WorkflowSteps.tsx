import React, { useEffect, useState } from 'react';

interface Step {
  title: string;
  description: string;
}

export interface WorkflowPreview {
  label: string;
  scoreLabel: string;
  score: number;
  rows: string[][];
}

interface WorkflowStepsProps {
  steps: Step[];
  /** Audience-specific preview panels, one per step. Defaults to the jobseeker
   *  set so the home page keeps working unchanged; the employer landing page
   *  passes its own set (otherwise employer steps showed candidate previews). */
  previews?: WorkflowPreview[];
}

const JOBSEEKER_PREVIEWS: WorkflowPreview[] = [
  {
    label: 'Resume Readiness Report',
    scoreLabel: 'Readiness score',
    score: 72,
    rows: [
      ['ATS risk', 'Title does not match target role', 'High'],
      ['Keyword gap', 'Roadmap prioritization, OKRs', 'Medium'],
      ['Priority fix', 'Rewrite top 3 bullets with metrics', 'Next'],
    ],
  },
  {
    label: 'Job Match Evidence',
    scoreLabel: 'Role match',
    score: 84,
    rows: [
      ['Evidence', 'Billing workflow redesign maps to product ops', 'Strong'],
      ['Skill gap', 'Pricing discovery', 'Train'],
      ['Apply priority', 'Technical Product Owner', 'This week'],
    ],
  },
  {
    label: 'Interview Practice Feedback',
    scoreLabel: 'Clarity score',
    score: 71,
    rows: [
      ['Question', 'Prioritize conflicting stakeholder requests', 'PM'],
      ['STAR gap', 'Result line needs one measurable outcome', 'Fix'],
      ['Next drill', 'Add stakeholder communication example', 'Retry'],
    ],
  },
  {
    label: 'Career Plan',
    scoreLabel: 'Plan progress',
    score: 40,
    rows: [
      ['Target role', 'Product Manager', 'Goal'],
      ['Gap summary', 'Discovery, roadmap, stakeholder framing', 'Open'],
      ['This week', 'Rewrite bullets and apply to 5 bridge roles', 'Active'],
    ],
  },
];

const statusTone = (status: string) => {
  if (['High', 'Fix', 'Open'].includes(status)) return 'border-red-200 bg-red-50 text-red-700';
  if (['Medium', 'Train', 'Retry', 'Active'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

export const WorkflowSteps: React.FC<WorkflowStepsProps> = ({ steps, previews = JOBSEEKER_PREVIEWS }) => {
  const [active, setActive] = useState(0);
  const preview = previews[active] ?? previews[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % steps.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {steps.map((step, i) => {
          const isActive = active === i;
          return (
            <button
              key={step.title}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-[var(--site-radius)] border p-4 text-left transition-colors ${
                isActive
                  ? 'border-[var(--site-action)] bg-[var(--site-surface)] shadow-sm'
                  : 'border-[var(--site-border)] bg-transparent hover:bg-[var(--site-surface)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-medium text-[var(--site-action)]">Step {i + 1}</span>
                  <h3 className="font-semibold mt-1 mb-2">{step.title}</h3>
                </div>
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    isActive ? 'bg-[var(--site-action)]' : 'bg-[var(--site-border)]'
                  }`}
                  aria-hidden="true"
                />
              </div>
              <p className="text-sm text-[var(--site-text-muted)]">{step.description}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface)] p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--site-action)]">{preview.label}</p>
            <h3 className="mt-1 text-lg font-semibold">{steps[active]?.title}</h3>
          </div>
          <div className="rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface-muted)] px-4 py-3 min-w-32">
            <p className="text-xs text-[var(--site-text-muted)]">{preview.scoreLabel}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-[var(--site-text)]">{preview.score}</p>
          </div>
        </div>

        <div className="mt-5 h-2 rounded-full bg-[var(--site-surface-muted)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--site-action)]" style={{ width: `${preview.score}%` }} />
        </div>

        <div className="mt-5 overflow-hidden rounded-[var(--site-radius)] border border-[var(--site-border)]">
          {preview.rows.map(([label, detail, status]) => (
            <div key={`${label}-${detail}`} className="grid gap-2 border-b border-[var(--site-border)] p-3 last:border-b-0 sm:grid-cols-[0.35fr_1fr_auto] sm:items-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--site-text-muted)]">{label}</p>
              <p className="text-sm text-[var(--site-text)]">{detail}</p>
              <span className={`w-fit rounded border px-2 py-1 text-xs font-medium ${statusTone(status)}`}>
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
