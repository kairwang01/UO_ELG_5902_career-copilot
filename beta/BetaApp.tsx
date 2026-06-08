import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ApiStatusProvider } from '../contexts/ApiStatusContext';
import { CreditsProvider } from '../contexts/CreditsContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { BetaRouter } from './BetaRouter';

/**
 * Beta redesign shell — enabled via VITE_BETA_REDESIGN=true.
 * MVP production uses App.tsx directly when flag is off.
 */
const BetaApp: React.FC = () => (
  <ApiStatusProvider>
    <CreditsProvider>
      <SettingsProvider>
        <BrowserRouter>
          <BetaRouter />
        </BrowserRouter>
      </SettingsProvider>
    </CreditsProvider>
  </ApiStatusProvider>
);

export default BetaApp;
