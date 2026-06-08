import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BETA_ROUTES } from '../../config/beta';
import { useBetaI18n } from '../hooks/useBetaI18n';
import { BetaLanguageSwitcher } from './BetaLanguageSwitcher';

export const BetaMobileNav: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isEmployer = pathname.startsWith(BETA_ROUTES.employers);
  const { t } = useBetaI18n();

  const linkClass = 'block py-3 text-sm border-b border-[var(--beta-border)]';

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen(!open)}
        className="p-2 -mr-2 text-[var(--beta-text)] min-h-[44px] min-w-[44px]"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
      {open && (
        <nav className="absolute left-0 right-0 top-16 border-b border-[var(--beta-border)] bg-[var(--beta-surface)] px-4 shadow-sm z-40">
          {!isEmployer && (
            <>
              <a href="#workflow" className={linkClass} onClick={() => setOpen(false)}>
                {t('beta_nav_how_it_works')}
              </a>
              <Link to={BETA_ROUTES.sampleReport} className={linkClass} onClick={() => setOpen(false)}>
                {t('beta_nav_sample_report')}
              </Link>
            </>
          )}
          {isEmployer && (
            <a href="#workflow" className={linkClass} onClick={() => setOpen(false)}>
              {t('beta_nav_hiring_workflow')}
            </a>
          )}
          <Link to={BETA_ROUTES.pricing} className={linkClass} onClick={() => setOpen(false)}>
            {t('beta_nav_pricing')}
          </Link>
          {isEmployer ? (
            <Link to={BETA_ROUTES.home} className={linkClass} onClick={() => setOpen(false)}>
              {t('beta_nav_for_jobseekers')}
            </Link>
          ) : (
            <Link to={BETA_ROUTES.employers} className={linkClass} onClick={() => setOpen(false)}>
              {t('beta_nav_for_employers')}
            </Link>
          )}
          <Link
            to={BETA_ROUTES.portal}
            className="block py-3 text-sm font-medium text-[var(--beta-action)]"
            onClick={() => setOpen(false)}
          >
            {t('beta_nav_sign_in')}
          </Link>
          <div className="py-3">
            <BetaLanguageSwitcher variant="mobile" />
          </div>
        </nav>
      )}
    </div>
  );
};
