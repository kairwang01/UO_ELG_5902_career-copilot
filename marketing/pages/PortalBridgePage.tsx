import React from 'react';
import { SiteLayout } from '../components/SiteLayout';
import { SiteButton } from '../components/SiteButton';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';

export const PortalBridgePage: React.FC = () => {
  const { t } = useMarketingI18n();

  return (
    <SiteLayout showBanner={false} pageId="portal">
      <section className="py-[var(--site-section)]">
        <div className="max-w-lg mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-2xl font-semibold mb-4">{t('site_portal_title')}</h1>
          <p className="text-[var(--site-text-muted)] mb-8">{t('site_portal_desc')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <SiteButton href={SITE_ROUTES.workspace}>{t('site_portal_continue')}</SiteButton>
            <SiteButton variant="secondary" to={SITE_ROUTES.employers}>
              {t('site_portal_back_employers')}
            </SiteButton>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
};
