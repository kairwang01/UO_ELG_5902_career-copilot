import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';
import { useSiteSession } from '../hooks/useSiteSession';
import { SiteLanguageSwitcher } from './SiteLanguageSwitcher';

export const SiteMobileNav: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isEmployerSurface = pathname.startsWith(SITE_ROUTES.employers) || pathname.startsWith(SITE_ROUTES.portal);
  const { t } = useMarketingI18n();
  const { session, isAdmin, isBusiness } = useSiteSession();
  const workspaceHref = isBusiness ? SITE_ROUTES.portal : SITE_ROUTES.workspace;
  const workflowHref = isEmployerSurface ? `${SITE_ROUTES.employers}#workflow` : `${SITE_ROUTES.home}#workflow`;
  const signInHref = isEmployerSurface ? `${SITE_ROUTES.portal}?auth=signin` : `${SITE_ROUTES.workspace}?auth=signin`;
  const primaryCtaHref = isEmployerSurface ? `${SITE_ROUTES.portal}?auth=signup` : SITE_ROUTES.workspace;

  const linkClass = 'block py-3 text-sm border-b border-[var(--site-border)]';

  // Close the menu on Escape, matching the app's modal behavior.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
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
          <Link to={workflowHref} className={linkClass} onClick={() => setOpen(false)}>
            {isEmployerSurface ? t('site_nav_hiring_workflow') : t('site_nav_how_it_works')}
          </Link>
          {!isEmployerSurface && (
            <Link to={SITE_ROUTES.sampleReport} className={linkClass} onClick={() => setOpen(false)}>
              {t('site_nav_sample_report')}
            </Link>
          )}
          {isEmployerSurface && (
            <Link to={`${SITE_ROUTES.portal}?start=post-job`} className={linkClass} onClick={() => setOpen(false)}>
              {t('site_cta_post_job')}
            </Link>
          )}
          <Link
            to={isEmployerSurface ? `${SITE_ROUTES.pricing}?audience=employer` : SITE_ROUTES.pricing}
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            {t('site_nav_pricing')}
          </Link>
          {/* ONE audience switch per surface (no self-referential "Business"
              item while already on the business surface). */}
          {isEmployerSurface ? (
            <Link to={SITE_ROUTES.home} className={`${linkClass} font-semibold`} onClick={() => setOpen(false)}>
              {t('site_switch_jobseekers')} →
            </Link>
          ) : (
            <Link to={SITE_ROUTES.employers} className={`${linkClass} font-semibold`} onClick={() => setOpen(false)}>
              {t('site_switch_business')} →
            </Link>
          )}
          {session ? (
            <>
              {isAdmin && (
                <Link to={SITE_ROUTES.admin} className={`${linkClass} text-indigo-600 font-medium`} onClick={() => setOpen(false)}>
                  Admin Portal
                </Link>
              )}
              <Link
                to={isBusiness ? SITE_ROUTES.portal : SITE_ROUTES.employers}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {isBusiness ? t('site_nav_business_portal') : t('site_nav_join_business')}
              </Link>
              <Link
                to={workspaceHref}
                className="block rounded-[var(--site-radius)] bg-[var(--site-action)] px-3 py-3 text-center text-sm font-semibold text-white mt-3"
                onClick={() => setOpen(false)}
              >
                {t('site_nav_workspace')}
              </Link>
            </>
          ) : (
            <>
              <Link
                to={signInHref}
                className="block py-3 text-sm font-medium text-[var(--site-action)]"
                onClick={() => setOpen(false)}
              >
                {t('site_nav_sign_in')}
              </Link>
              <Link
                to={primaryCtaHref}
                className="block rounded-[var(--site-radius)] bg-[var(--site-action)] px-3 py-3 text-center text-sm font-semibold text-white mt-3"
                onClick={() => setOpen(false)}
              >
                {isEmployerSurface ? t('business_hero_get_started_button') : t('site_cta_analyze_resume')}
              </Link>
            </>
          )}
          <div className="py-3">
            <SiteLanguageSwitcher variant="mobile" />
          </div>
        </nav>
      )}
    </div>
  );
};
