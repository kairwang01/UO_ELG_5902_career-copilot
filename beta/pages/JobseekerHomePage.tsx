import React from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { BetaButton } from '../components/BetaButton';
import { ReportPreview } from '../components/ReportPreview';
import { WorkflowSteps } from '../components/WorkflowSteps';
import { BETA_ROUTES } from '../../config/beta';
import { careerPathPlan } from '../mock/careerPath';

const coreTools = [
  { name: 'Resume Readiness Report', desc: 'ATS issues, keyword gaps, rewrite suggestions' },
  { name: 'Role Match', desc: 'Jobs ranked by fit with evidence from your resume' },
  { name: 'Interview Practice', desc: 'STAR feedback and clarity scoring per answer' },
  { name: 'Career Path Planner', desc: 'Bridge roles and a 4-week action plan' },
  { name: 'Outreach Drafts', desc: 'Tailored follow-ups and networking messages' },
  { name: 'Verified Talent Profile', desc: 'Portable credentials employers can trust' },
];

export const JobseekerHomePage: React.FC = () => (
  <BetaLayout>
    <section className="py-[var(--beta-section)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-start">
        <div>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight">
            Upload your resume. See the gaps blocking interviews, then fix them step by step.
          </h1>
          <p className="mt-4 text-lg text-[var(--beta-text-muted)] max-w-xl">
            Resume readiness, role fit, missing keywords, bridge roles, and a clear next action — not a generic score.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BetaButton to={BETA_ROUTES.sampleReport}>View sample report</BetaButton>
            <BetaButton variant="secondary" href={BETA_ROUTES.mvpApp}>
              Upload resume
            </BetaButton>
          </div>
        </div>
        <ReportPreview compact />
      </div>
    </section>

    <section id="workflow" className="py-[var(--beta-section)] bg-[var(--beta-surface-muted)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl font-semibold mb-8">Analyze → Match → Practice → Plan</h2>
        <WorkflowSteps
          steps={[
            { title: 'Analyze', description: 'Resume Readiness Report flags ATS issues and keyword gaps.' },
            { title: 'Match', description: 'Role Match ranks opportunities with evidence from your experience.' },
            { title: 'Practice', description: 'Interview Practice gives STAR feedback on real answers.' },
            { title: 'Plan', description: 'Career Path Planner maps bridge roles and weekly actions.' },
          ]}
        />
      </div>
    </section>

    <section className="py-[var(--beta-section)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12">
        <div>
          <p className="text-sm font-medium text-[var(--beta-action)]">Career switcher scenario</p>
          <h2 className="text-2xl font-semibold mt-2 mb-4">
            {careerPathPlan.currentRole} → {careerPathPlan.targetRole}
          </h2>
          <p className="text-[var(--beta-text-muted)] mb-4">
            Bridge role: <strong>{careerPathPlan.bridgeRole}</strong>
          </p>
          <ul className="space-y-2 text-sm">
            {careerPathPlan.skillGaps.map((g) => (
              <li key={g.skill} className="flex justify-between border-b border-[var(--beta-border)] pb-2">
                <span>{g.skill}</span>
                <span className={g.priority === 'high' ? 'text-[var(--beta-gap)]' : 'text-[var(--beta-text-muted)]'}>
                  {g.priority}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">4-week plan preview</p>
          {careerPathPlan.fourWeekPlan.map((w) => (
            <div key={w.week} className="border border-[var(--beta-border)] rounded-[var(--beta-radius)] p-4">
              <p className="text-xs text-[var(--beta-text-muted)]">Week {w.week}</p>
              <p className="font-medium">{w.focus}</p>
              <ul className="mt-2 text-sm text-[var(--beta-text-muted)] list-disc list-inside">
                {w.tasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-[var(--beta-section)] bg-[var(--beta-surface-muted)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl font-semibold mb-8">Core tools</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {coreTools.map((tool, i) => (
            <div
              key={tool.name}
              className={`border border-[var(--beta-border)] rounded-[var(--beta-radius)] p-5 bg-[var(--beta-surface)] ${
                i === 0 ? 'sm:col-span-2 lg:col-span-1 lg:row-span-2 border-[var(--beta-action)] border-2' : ''
              }`}
            >
              <h3 className="font-semibold">{tool.name}</h3>
              <p className="text-sm text-[var(--beta-text-muted)] mt-1">{tool.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 text-center border-t border-[var(--beta-border)]">
      <BetaButton to={BETA_ROUTES.pricing}>See pricing</BetaButton>
    </section>
  </BetaLayout>
);
