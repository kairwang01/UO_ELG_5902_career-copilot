import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BETA_ROUTES } from '../../config/beta';
import { useBetaI18n } from '../hooks/useBetaI18n';

export const BetaHeader: React.FC = () => {
  const { pathname } = useLocation();
  const isEmployer = pathname.startsWith(BETA_ROUTES.employers);
  const { t } = useBetaI18n();

  return (
    <header className="border-b border-[var(--beta-border)] bg-[var(--beta-surface)] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to={BETA_ROUTES.home} className="text-lg font-semibold text-[var(--beta-text)]">
          Career CoPilot
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm">
          {!isEmployer && (
            <>
              <a href="#workflow" className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
                {t('beta_nav_how_it_works')}
              </a>
              <Link to={BETA_ROUTES.sampleReport} className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
                {t('beta_nav_sample_report')}
              </Link>
            </>
          )}
          {isEmployer && (
            <a href="#workflow" className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
              {t('beta_nav_hiring_workflow')}
            </a>
          )}
          <Link to={BETA_ROUTES.pricing} className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
            {t('beta_nav_pricing')}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          {isEmployer ? (
            <Link
              to={BETA_ROUTES.home}
              className="text-sm text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]"
            >
              {t('beta_nav_for_jobseekers')}
            </Link>
          ) : (
            <Link
              to={BETA_ROUTES.employers}
              className="text-sm text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]"
            >
              {t('beta_nav_for_employers')}
            </Link>
          )}
          <Link
            to={BETA_ROUTES.portal}
            className="text-sm font-medium text-[var(--beta-action)] hover:underline"
          >
            {t('beta_nav_sign_in')}
          </Link>
        </div>
      </div>
    </header>
  );
};
