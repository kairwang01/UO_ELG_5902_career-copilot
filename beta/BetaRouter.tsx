import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { BETA_ROUTES } from '../config/beta';
import { JobseekerHomePage } from './pages/JobseekerHomePage';
import { EmployerLandingPage } from './pages/EmployerLandingPage';
import { SampleReportPage } from './pages/SampleReportPage';
import { PricingPage } from './pages/PricingPage';
import { PortalBridgePage } from './pages/PortalBridgePage';

const MvpApp = React.lazy(() => import('../App'));

const MvpFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm">
    Loading app…
  </div>
);

/**
 * Beta marketing routes at top-level paths.
 * MVP app lazy-loaded under /app/* so Beta pages do not pull the full MVP bundle upfront.
 */
export const BetaRouter: React.FC = () => (
  <Routes>
    <Route
      path="/app/*"
      element={
        <Suspense fallback={<MvpFallback />}>
          <MvpApp />
        </Suspense>
      }
    />
    <Route path={BETA_ROUTES.home} element={<JobseekerHomePage />} />
    <Route path={BETA_ROUTES.employers} element={<EmployerLandingPage />} />
    <Route path={BETA_ROUTES.sampleReport} element={<SampleReportPage />} />
    <Route path={BETA_ROUTES.pricing} element={<PricingPage />} />
    <Route path={BETA_ROUTES.portal} element={<PortalBridgePage />} />
  </Routes>
);
