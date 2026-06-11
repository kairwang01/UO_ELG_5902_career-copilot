import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ApiStatusProvider } from '../contexts/ApiStatusContext';
import { CreditsProvider } from '../contexts/CreditsContext';
import { SiteRouter } from './SiteRouter';
import { MarketingI18nProvider } from './contexts/MarketingI18nContext';
import ErrorBoundary from '../components/ErrorBoundary';

// After a deploy, a returning tab may hold stale lazy-chunk URLs; importing one
// 404s and React throws a blank-screen "Failed to fetch dynamically imported
// module". Vite raises `vite:preloadError` for exactly this — recover by doing a
// one-time hard reload (guarded against a reload loop) to fetch the new chunks.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    const KEY = 'cc_preload_reloaded_at';
    const last = Number(sessionStorage.getItem(KEY) || '0');
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
    }
  });
}

/** Public marketing shell at /; resume tools lazy-load at /workspace. */
const SiteApp: React.FC = () => (
  <ErrorBoundary>
    <ApiStatusProvider>
      <CreditsProvider>
        <MarketingI18nProvider>
          <BrowserRouter>
            <SiteRouter />
          </BrowserRouter>
        </MarketingI18nProvider>
      </CreditsProvider>
    </ApiStatusProvider>
  </ErrorBoundary>
);

export default SiteApp;
