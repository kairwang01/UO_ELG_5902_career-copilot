import React from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { BetaButton } from '../components/BetaButton';
import { BETA_ROUTES } from '../../config/beta';
import { useBetaI18n } from '../hooks/useBetaI18n';

export const PortalBridgePage: React.FC = () => {
  const { t } = useBetaI18n();

  return (
    <BetaLayout showBanner={false}>
      <section className="py-[var(--beta-section)]">
        <div className="max-w-lg mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-2xl font-semibold mb-4">{t('beta_portal_title')}</h1>
          <p className="text-[var(--beta-text-muted)] mb-8">{t('beta_portal_desc')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <BetaButton href={BETA_ROUTES.mvpApp}>{t('beta_portal_continue')}</BetaButton>
            <BetaButton variant="secondary" to={BETA_ROUTES.employers}>
              {t('beta_portal_back_employers')}
            </BetaButton>
          </div>
        </div>
      </section>
    </BetaLayout>
  );
};
