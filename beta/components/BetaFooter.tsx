import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BETA_ROUTES } from '../../config/beta';
import { useBetaI18n } from '../hooks/useBetaI18n';
import { BetaLanguageSwitcher } from './BetaLanguageSwitcher';

export const BetaFooter: React.FC = () => {
  const { t } = useBetaI18n();
  const { pathname } = useLocation();
  const onHome = pathname === BETA_ROUTES.home;

  const scrollTo = (id: string) => {
    if (!onHome) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-[var(--beta-border)] bg-[var(--beta-surface-muted)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to={BETA_ROUTES.home} className="font-semibold text-[var(--beta-text)]">
              Career CoPilot
            </Link>
            <p className="mt-2 text-sm text-[var(--beta-text-muted)]">{t('beta_footer_tagline')}</p>
          </div>

          <div>
            <h6 className="font-semibold text-[var(--beta-text)] mb-2 text-sm">{t('footer_toolkit')}</h6>
            <ul className="space-y-1 text-sm">
              <li>
                <Link to={BETA_ROUTES.sampleReport} className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
                  {t('beta_tool_resume_report')}
                </Link>
              </li>
              <li>
                <Link to={BETA_ROUTES.sampleReport} className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
                  {t('beta_tool_interview')}
                </Link>
              </li>
              <li>
                {onHome ? (
                  <button
                    type="button"
                    onClick={() => scrollTo('workflow')}
                    className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]"
                  >
                    {t('beta_tool_career_path')}
                  </button>
                ) : (
                  <Link to={`${BETA_ROUTES.home}#workflow`} className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
                    {t('beta_tool_career_path')}
                  </Link>
                )}
              </li>
              <li>
                <Link to={BETA_ROUTES.pricing} className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
                  {t('beta_nav_pricing')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="font-semibold text-[var(--beta-text)] mb-2 text-sm">{t('footer_company')}</h6>
            <ul className="space-y-1 text-sm">
              <li>
                {onHome ? (
                  <button
                    type="button"
                    onClick={() => scrollTo('cases-section')}
                    className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]"
                  >
                    {t('beta_cases_title')}
                  </button>
                ) : (
                  <Link to={`${BETA_ROUTES.home}#cases-section`} className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
                    {t('beta_cases_title')}
                  </Link>
                )}
              </li>
              <li>
                {onHome ? (
                  <button
                    type="button"
                    onClick={() => scrollTo('faq-section')}
                    className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]"
                  >
                    {t('faq_title')}
                  </button>
                ) : (
                  <Link to={`${BETA_ROUTES.home}#faq-section`} className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
                    {t('faq_title')}
                  </Link>
                )}
              </li>
              <li>
                <a
                  href="/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]"
                >
                  {t('footer_privacy')}
                </a>
              </li>
              <li>
                <span className="text-[var(--beta-text-muted)]">{t('footer_terms')}</span>
              </li>
            </ul>
          </div>

          <div>
            <h6 className="font-semibold text-[var(--beta-text)] mb-2 text-sm">{t('footer_contact')}</h6>
            <ul className="space-y-1 text-sm">
              <li>
                <a href="mailto:support@careercopilot.ai" className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
                  support@careercopilot.ai
                </a>
              </li>
              <li className="text-[var(--beta-text-muted)]">{t('footer_location')}</li>
              <li>
                <Link to={BETA_ROUTES.employers} className="text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]">
                  {t('beta_footer_employers')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[var(--beta-border)] flex flex-col-reverse sm:flex-row items-center justify-between gap-4 text-sm text-[var(--beta-text-muted)]">
          <p>
            &copy; {new Date().getFullYear()} Career CoPilot. {t('footer_copyright_end')}
          </p>
          <BetaLanguageSwitcher variant="header" />
        </div>

        <div className="mt-6 pt-6 border-t border-[var(--beta-border)] text-center text-xs text-[var(--beta-text-muted)] space-y-2">
          <p className="max-w-3xl mx-auto">{t('footer_beta_notice')}</p>
          <p>{t('footer_academic_credit')}</p>
          <p>
            {t('footer_launch_prefix')}
            <a
              href="https://caiot.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--beta-action)] hover:underline"
            >
              caiot.co
            </a>
            {t('footer_launch_suffix')}
          </p>
        </div>
      </div>
    </footer>
  );
};
