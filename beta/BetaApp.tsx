import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ApiStatusProvider } from '../contexts/ApiStatusContext';
import { CreditsProvider } from '../contexts/CreditsContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { BetaRouter } from './BetaRouter';
import { BetaI18nProvider } from './contexts/BetaI18nContext';

/**
 * Marketing shell at /. Production app tools lazy-load at /app.
 * Set VITE_BETA_REDESIGN=false to restore the legacy MVP homepage.
 */
const BetaApp: React.FC = () => (
  <ApiStatusProvider>
    <CreditsProvider>
      <SettingsProvider>
        <BetaI18nProvider>
          <BrowserRouter>
            <BetaRouter />
          </BrowserRouter>
        </BetaI18nProvider>
      </SettingsProvider>
    </CreditsProvider>
  </ApiStatusProvider>
);

export default BetaApp;
