import React from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { BetaButton } from '../components/BetaButton';
import { CandidateMatchPreview } from '../components/CandidateMatchPreview';
import { WorkflowSteps } from '../components/WorkflowSteps';
import { BETA_ROUTES } from '../../config/beta';
import { useBetaI18n } from '../hooks/useBetaI18n';

const portalTasks = [
  { labelKey: 'beta_emp_task_roles', severity: 'gap' as const },
  { labelKey: 'beta_emp_task_candidates', severity: 'ready' as const },
  { labelKey: 'beta_emp_task_listings', severity: 'risk' as const },
  { labelKey: 'beta_emp_task_waiting', severity: 'gap' as const },
];

export const EmployerLandingPage: React.FC = () => {
  const { t } = useBetaI18n();

  return (
    <BetaLayout>
      <section className="py-[var(--beta-section)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight">
              {t('beta_emp_hero_title')}
            </h1>
            <p className="mt-4 text-lg text-[var(--beta-text-muted)]">{t('beta_emp_hero_subtitle')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <BetaButton to={BETA_ROUTES.portal}>{t('beta_cta_post_job')}</BetaButton>
              <BetaButton variant="secondary" to={BETA_ROUTES.pricing}>
                {t('beta_cta_employer_pricing')}
              </BetaButton>
            </div>
          </div>
          <CandidateMatchPreview t={t} />
        </div>
      </section>

      <section id="workflow" className="py-[var(--beta-section)] bg-[var(--beta-surface-muted)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-semibold mb-8">{t('beta_emp_workflow_title')}</h2>
          <WorkflowSteps
            steps={[
              { title: t('beta_emp_workflow_post_title'), description: t('beta_emp_workflow_post_desc') },
              { title: t('beta_emp_workflow_match_title'), description: t('beta_emp_workflow_match_desc') },
              { title: t('beta_emp_workflow_review_title'), description: t('beta_emp_workflow_review_desc') },
              { title: t('beta_emp_workflow_contact_title'), description: t('beta_emp_workflow_contact_desc') },
            ]}
          />
        </div>
      </section>

      <section className="py-[var(--beta-section)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-semibold mb-6">{t('beta_emp_portal_tasks_title')}</h2>
            <div className="space-y-3">
              {portalTasks.map((task) => (
                <div
                  key={task.labelKey}
                  className="flex items-center justify-between border border-[var(--beta-border)] rounded-[var(--beta-radius)] px-4 py-3"
                >
                  <span className="font-medium">{t(task.labelKey)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      task.severity === 'ready'
                        ? 'bg-[var(--beta-ready-bg)] text-[var(--beta-ready)]'
                        : task.severity === 'risk'
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
            <h3 className="font-semibold mb-4">{t('beta_emp_post_job_assistant')}</h3>
            <ul className="space-y-3 text-sm text-[var(--beta-text-muted)]">
              <li>· {t('beta_emp_assistant_must_have')}</li>
              <li>· {t('beta_emp_assistant_salary')}</li>
              <li>· {t('beta_emp_assistant_inclusive')}</li>
              <li>· {t('beta_emp_assistant_market')}</li>
              <li>· {t('beta_emp_assistant_clarity')}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 text-center border-t border-[var(--beta-border)]">
        <p className="text-sm text-[var(--beta-text-muted)] mb-4">{t('beta_emp_trust_line')}</p>
        <BetaButton to={BETA_ROUTES.portal}>{t('beta_cta_enter_portal')}</BetaButton>
      </section>
    </BetaLayout>
  );
};
