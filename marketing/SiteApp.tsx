import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ApiStatusProvider } from '../contexts/ApiStatusContext';
import { CreditsProvider } from '../contexts/CreditsContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { SiteRouter } from './SiteRouter';
import { MarketingI18nProvider } from './contexts/MarketingI18nContext';
import ErrorBoundary from '../components/ErrorBoundary';

/** Public marketing shell at /; resume tools lazy-load at /workspace. */
const SiteApp: React.FC = () => (
  <ErrorBoundary>
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
  </ErrorBoundary>
);

export default SiteApp;
