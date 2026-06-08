import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ApiStatusProvider } from '../contexts/ApiStatusContext';
import { CreditsProvider } from '../contexts/CreditsContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { SiteRouter } from './SiteRouter';
import { MarketingI18nProvider } from './contexts/MarketingI18nContext';

/** Public marketing shell at /; resume tools lazy-load at /workspace. */
const SiteApp: React.FC = () => (
  <ApiStatusProvider>
    <CreditsProvider>
      <SettingsProvider>
        <MarketingI18nProvider>
          <BrowserRouter>
            <SiteRouter />
          </BrowserRouter>
        </MarketingI18nProvider>
      </SettingsProvider>
    </CreditsProvider>
  </ApiStatusProvider>
);

export default SiteApp;
