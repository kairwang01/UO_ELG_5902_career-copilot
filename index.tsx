
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const SiteApp = React.lazy(() => import('./marketing/SiteApp'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>
      }
    >
      <SiteApp />
    </React.Suspense>
  </React.StrictMode>
);
