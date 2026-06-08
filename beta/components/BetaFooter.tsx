import React from 'react';
import { Link } from 'react-router-dom';
import { BETA_ROUTES } from '../../config/beta';
import { useBetaI18n } from '../hooks/useBetaI18n';

export const BetaFooter: React.FC = () => {
  const { t } = useBetaI18n();

  return (
    <footer className="border-t border-[var(--beta-border)] bg-[var(--beta-surface-muted)] py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between gap-6 text-sm text-[var(--beta-text-muted)]">
        <div>
          <p className="font-semibold text-[var(--beta-text)]">Career CoPilot</p>
          <p className="mt-1">{t('beta_footer_tagline')}</p>
        </div>
        <div className="flex gap-8">
          <Link to={BETA_ROUTES.home} className="hover:text-[var(--beta-text)]">
            {t('beta_footer_jobseekers')}
          </Link>
          <Link to={BETA_ROUTES.employers} className="hover:text-[var(--beta-text)]">
            {t('beta_footer_employers')}
          </Link>
          <Link to={BETA_ROUTES.pricing} className="hover:text-[var(--beta-text)]">
            {t('beta_nav_pricing')}
          </Link>
        </div>
      </div>
    </footer>
  );
};
