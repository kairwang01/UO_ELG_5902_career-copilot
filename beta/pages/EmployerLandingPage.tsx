import React from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { BetaButton } from '../components/BetaButton';
import { CandidateMatchPreview } from '../components/CandidateMatchPreview';
import { WorkflowSteps } from '../components/WorkflowSteps';
import { BETA_ROUTES } from '../../config/beta';

const portalTasks = [
  { label: '3 roles need attention', severity: 'gap' as const },
  { label: '8 high-match candidates', severity: 'ready' as const },
  { label: '2 listings underperforming', severity: 'risk' as const },
  { label: '5 candidates waiting for response', severity: 'gap' as const },
];

export const EmployerLandingPage: React.FC = () => (
  <BetaLayout>
    <section className="py-[var(--beta-section)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-12">
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight">
            See why a candidate matches before you spend time screening.
          </h1>
          <p className="mt-4 text-lg text-[var(--beta-text-muted)]">
            Post jobs, review match reasons and resume evidence, and move faster on candidates who are actually ready.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BetaButton to={BETA_ROUTES.portal}>Post a job</BetaButton>
            <BetaButton variant="secondary" to={BETA_ROUTES.pricing}>
              Employer pricing
            </BetaButton>
          </div>
        </div>
        <CandidateMatchPreview />
      </div>
    </section>

    <section id="workflow" className="py-[var(--beta-section)] bg-[var(--beta-surface-muted)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl font-semibold mb-8">Post → Match → Review evidence → Contact</h2>
        <WorkflowSteps
          steps={[
            { title: 'Post job', description: 'Role clarity score and must-have vs nice-to-have before you publish.' },
            { title: 'Match candidates', description: 'Ranked list with fit % and explained match reasons.' },
            { title: 'Review evidence', description: 'Resume bullets that support each skill claim.' },
            { title: 'Contact', description: 'Shortlist actions tied to availability and location.' },
          ]}
        />
      </div>
    </section>

    <section className="py-[var(--beta-section)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12">
        <div>
          <h2 className="text-2xl font-semibold mb-6">Portal first screen — tasks, not wallpaper</h2>
          <div className="space-y-3">
            {portalTasks.map((t) => (
              <div
                key={t.label}
                className="flex items-center justify-between border border-[var(--beta-border)] rounded-[var(--beta-radius)] px-4 py-3"
              >
                <span className="font-medium">{t.label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    t.severity === 'ready'
                      ? 'bg-[var(--beta-ready-bg)] text-[var(--beta-ready)]'
                      : t.severity === 'risk'
                        ? 'bg-[var(--beta-risk-bg)] text-[var(--beta-risk)]'
                        : 'bg-[var(--beta-gap-bg)] text-[var(--beta-gap)]'
                  }`}
                >
                  action
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-[var(--beta-border)] rounded-[var(--beta-radius)] p-6 bg-[var(--beta-surface-muted)]">
          <h3 className="font-semibold mb-4">Post Job — hiring quality assistant</h3>
          <ul className="space-y-3 text-sm text-[var(--beta-text-muted)]">
            <li>Must-have / nice-to-have skill layers</li>
            <li>Salary benchmark for role + market</li>
            <li>Inclusive language check</li>
            <li>Candidate-market fit preview</li>
            <li>Role clarity score before publish</li>
          </ul>
        </div>
      </div>
    </section>

    <section className="py-16 text-center border-t border-[var(--beta-border)]">
      <p className="text-sm text-[var(--beta-text-muted)] mb-4">
        Data handling: candidate data used only for matching. No resale to third parties.
      </p>
      <BetaButton to={BETA_ROUTES.portal}>Enter employer portal</BetaButton>
    </section>
  </BetaLayout>
);
