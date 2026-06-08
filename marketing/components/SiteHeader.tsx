import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';
import { SiteMobileNav } from './SiteMobileNav';
import { SiteLanguageSwitcher } from './SiteLanguageSwitcher';

export const SiteHeader: React.FC = () => {
  const { pathname } = useLocation();
  const isEmployer = pathname.startsWith(SITE_ROUTES.employers);
  const { t } = useMarketingI18n();

  return (
    <header className="relative border-b border-[var(--site-border)] bg-[var(--site-surface)] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link
          to={SITE_ROUTES.home}
          className="text-base sm:text-lg font-semibold text-[var(--site-text)] truncate shrink-0"
        >
          Career CoPilot
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm">
          {!isEmployer && (
            <>
              <a href="#workflow" className="text-[var(--site-text-muted)] hover:text-[var(--site-text)]">
                {t('site_nav_how_it_works')}
              </a>
              <Link to={SITE_ROUTES.sampleReport} className="text-[var(--site-text-muted)] hover:text-[var(--site-text)]">
                {t('site_nav_sample_report')}
              </Link>
            </>
          )}
          {isEmployer && (
            <a href="#workflow" className="text-[var(--site-text-muted)] hover:text-[var(--site-text)]">
              {t('site_nav_hiring_workflow')}
            </a>
          )}
          <Link to={SITE_ROUTES.pricing} className="text-[var(--site-text-muted)] hover:text-[var(--site-text)]">
            {t('site_nav_pricing')}
          </Link>
        </nav>
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <Link
            to={isEmployer ? SITE_ROUTES.home : SITE_ROUTES.employers}
            className="hidden md:inline text-sm text-[var(--site-text-muted)] hover:text-[var(--site-text)] max-w-[7rem] truncate"
          >
            {isEmployer ? t('site_nav_for_jobseekers') : t('site_nav_for_employers')}
          </Link>
          <div className="hidden sm:block">
            <SiteLanguageSwitcher />
          </div>
          <Link
            to={SITE_ROUTES.portal}
            className="hidden lg:inline text-sm text-[var(--site-text-muted)] hover:text-[var(--site-text)] whitespace-nowrap"
          >
            {t('site_nav_sign_in')}
          </Link>
          <Link
            to={isEmployer ? SITE_ROUTES.portal : SITE_ROUTES.workspace}
            className="hidden sm:inline-flex min-h-[38px] items-center justify-center rounded-[var(--site-radius)] bg-[var(--site-action)] px-3 text-sm font-semibold text-white hover:bg-[var(--site-action-hover)] whitespace-nowrap"
          >
            {isEmployer ? t('site_cta_post_job') : t('site_cta_analyze_resume')}
          </Link>
          <SiteMobileNav />
        </div>
      </div>
    </header>
  );
};
