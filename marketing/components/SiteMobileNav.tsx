import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';
import { SiteLanguageSwitcher } from './SiteLanguageSwitcher';

export const SiteMobileNav: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isEmployer = pathname.startsWith(SITE_ROUTES.employers);
  const { t } = useMarketingI18n();

  const linkClass = 'block py-3 text-sm border-b border-[var(--site-border)]';

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen(!open)}
        className="p-2 -mr-2 text-[var(--site-text)] min-h-[44px] min-w-[44px]"
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
        <nav className="absolute left-0 right-0 top-16 border-b border-[var(--site-border)] bg-[var(--site-surface)] px-4 shadow-sm z-40">
          {!isEmployer && (
            <>
              <a href="#workflow" className={linkClass} onClick={() => setOpen(false)}>
                {t('site_nav_how_it_works')}
              </a>
              <Link to={SITE_ROUTES.sampleReport} className={linkClass} onClick={() => setOpen(false)}>
                {t('site_nav_sample_report')}
              </Link>
            </>
          )}
          {isEmployer && (
            <a href="#workflow" className={linkClass} onClick={() => setOpen(false)}>
              {t('site_nav_hiring_workflow')}
            </a>
          )}
          <Link to={SITE_ROUTES.pricing} className={linkClass} onClick={() => setOpen(false)}>
            {t('site_nav_pricing')}
          </Link>
          {isEmployer ? (
            <Link to={SITE_ROUTES.home} className={linkClass} onClick={() => setOpen(false)}>
              {t('site_nav_for_jobseekers')}
            </Link>
          ) : (
            <Link to={SITE_ROUTES.employers} className={linkClass} onClick={() => setOpen(false)}>
              {t('site_nav_for_employers')}
            </Link>
          )}
          <Link
            to={SITE_ROUTES.portal}
            className="block py-3 text-sm font-medium text-[var(--site-action)]"
            onClick={() => setOpen(false)}
          >
            {t('site_nav_sign_in')}
          </Link>
          <Link
            to={isEmployer ? SITE_ROUTES.portal : SITE_ROUTES.workspace}
            className="block rounded-[var(--site-radius)] bg-[var(--site-action)] px-3 py-3 text-center text-sm font-semibold text-white mt-3"
            onClick={() => setOpen(false)}
          >
            {isEmployer ? t('site_cta_post_job') : t('site_cta_analyze_resume')}
          </Link>
          <div className="py-3">
            <SiteLanguageSwitcher variant="mobile" />
          </div>
        </nav>
      )}
    </div>
  );
};
