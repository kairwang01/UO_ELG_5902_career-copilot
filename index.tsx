
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BETA_REDESIGN_ENABLED } from './config/beta';

const RootApp = BETA_REDESIGN_ENABLED
  ? React.lazy(() => import('./beta/BetaApp'))
  : App;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {BETA_REDESIGN_ENABLED ? (
      <React.Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>
        }
      >
        <RootApp />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
