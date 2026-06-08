import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SITE_ROUTES } from '../config/site';
import { JobseekerHomePage } from './pages/JobseekerHomePage';
import { EmployerLandingPage } from './pages/EmployerLandingPage';
import { SampleReportPage } from './pages/SampleReportPage';
import { PricingPage } from './pages/PricingPage';

const MvpApp = React.lazy(() => import('../CareerApp'));

const MvpFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm">
    Loading app…
  </div>
);

/**
 * Marketing routes stay lightweight; authenticated workspaces lazy-load the app shell.
 */
export const SiteRouter: React.FC = () => (
  <Routes>
    <Route path="/app/*" element={<Navigate to="/workspace" replace />} />
    <Route
      path="/workspace/*"
      element={
        <Suspense fallback={<MvpFallback />}>
          <MvpApp siteShell />
        </Suspense>
      }
    />
    <Route path={SITE_ROUTES.home} element={<JobseekerHomePage />} />
    <Route path={SITE_ROUTES.employers} element={<EmployerLandingPage />} />
    <Route path={SITE_ROUTES.sampleReport} element={<SampleReportPage />} />
    <Route path={SITE_ROUTES.pricing} element={<PricingPage />} />
    <Route
      path={`${SITE_ROUTES.portal}/*`}
      element={
        <Suspense fallback={<MvpFallback />}>
          <MvpApp siteShell entry="portal" />
        </Suspense>
      }
    />
  </Routes>
);
