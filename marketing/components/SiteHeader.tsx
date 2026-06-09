import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';
import { SiteMobileNav } from './SiteMobileNav';
import { SiteLanguageSwitcher } from './SiteLanguageSwitcher';
import { useSiteSession } from '../hooks/useSiteSession';

export const SiteHeader: React.FC = () => {
  const { pathname } = useLocation();
  const isEmployerSurface = pathname.startsWith(SITE_ROUTES.employers) || pathname.startsWith(SITE_ROUTES.portal);
  const { t } = useMarketingI18n();
  const { session, isAdmin, isBusiness } = useSiteSession();
  const workspaceHref = isBusiness ? SITE_ROUTES.portal : SITE_ROUTES.workspace;
  const workflowHref = isEmployerSurface ? `${SITE_ROUTES.employers}#workflow` : `${SITE_ROUTES.home}#workflow`;
  const signInHref = isEmployerSurface ? `${SITE_ROUTES.portal}?auth=signin` : `${SITE_ROUTES.workspace}?auth=signin`;
  const primaryCtaHref = isEmployerSurface ? `${SITE_ROUTES.portal}?auth=signup` : SITE_ROUTES.workspace;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--site-border)] bg-[var(--site-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--site-surface)]/85">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-[72px] flex items-center justify-between gap-4">
        <Link
          to={SITE_ROUTES.home}
          className="text-base sm:text-lg font-semibold text-[var(--site-text)] tracking-tight truncate shrink-0"
        >
          Career CoPilot
        </Link>

        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium">
          <a href={workflowHref} className="text-[var(--site-text-muted)] hover:text-[var(--site-text)]">
            {isEmployerSurface ? t('site_nav_hiring_workflow') : t('site_nav_how_it_works')}
          </a>
          {!isEmployerSurface && (
            <Link to={SITE_ROUTES.sampleReport} className="text-[var(--site-text-muted)] hover:text-[var(--site-text)]">
              {t('site_nav_sample_report')}
            </Link>
          )}
          {isEmployerSurface && (
            <Link to={`${SITE_ROUTES.portal}?start=post-job`} className="text-[var(--site-text-muted)] hover:text-[var(--site-text)]">
              {t('site_cta_post_job')}
            </Link>
          )}
          <Link to={SITE_ROUTES.pricing} className="text-[var(--site-text-muted)] hover:text-[var(--site-text)]">
            {t('site_nav_pricing')}
          </Link>
          <Link
            to={SITE_ROUTES.employers}
            className={
              isEmployerSurface
                ? 'text-[var(--site-text)]'
                : 'text-[var(--site-text-muted)] hover:text-[var(--site-text)]'
            }
          >
            {t('site_nav_for_employers')}
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden md:block">
            <SiteLanguageSwitcher />
          </div>
          {session ? (
            <>
              {isAdmin && (
                <Link
                  to={SITE_ROUTES.admin}
                  className="hidden sm:inline-flex min-h-[38px] items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
                >
                  Admin Portal
                </Link>
              )}
              {isBusiness ? (
                <Link
                  to={SITE_ROUTES.portal}
                  className="hidden sm:inline-flex min-h-[38px] items-center text-sm font-medium text-[var(--site-text-muted)] hover:text-[var(--site-text)] whitespace-nowrap"
                >
                  Business Portal
                </Link>
              ) : (
                <Link
                  to={SITE_ROUTES.employers}
                  className="hidden sm:inline-flex min-h-[38px] items-center text-sm font-medium text-[var(--site-text-muted)] hover:text-[var(--site-text)] whitespace-nowrap"
                >
                  Want to Join Business?
                </Link>
              )}
              <Link
                to={workspaceHref}
                className="hidden sm:inline-flex min-h-[40px] items-center justify-center rounded-[var(--site-radius)] bg-[var(--site-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--site-action-hover)] whitespace-nowrap"
              >
                Workspace
              </Link>
            </>
          ) : (
            <>
              <Link
                to={signInHref}
                className="hidden sm:inline-flex min-h-[38px] items-center text-sm font-medium text-[var(--site-text-muted)] hover:text-[var(--site-text)] whitespace-nowrap"
              >
                {t('site_nav_sign_in')}
              </Link>
              <Link
                to={primaryCtaHref}
                className="hidden sm:inline-flex min-h-[40px] items-center justify-center rounded-[var(--site-radius)] bg-[var(--site-action)] px-4 text-sm font-semibold text-white hover:bg-[var(--site-action-hover)] whitespace-nowrap"
              >
                {isEmployerSurface ? t('business_hero_get_started_button') : t('site_cta_analyze_resume')}
              </Link>
            </>
          )}
          <SiteMobileNav />
        </div>
      </div>
    </header>
  );
};
