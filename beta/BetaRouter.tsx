import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { BETA_ROUTES } from '../config/beta';
import { JobseekerHomePage } from './pages/JobseekerHomePage';
import { EmployerLandingPage } from './pages/EmployerLandingPage';
import { SampleReportPage } from './pages/SampleReportPage';
import { PricingPage } from './pages/PricingPage';
import { PortalBridgePage } from './pages/PortalBridgePage';
import MvpApp from '../App';

/**
 * Beta marketing routes at top-level paths.
 * MVP app (auth, dashboard, payments, employer portal) lives under /app/* so June 17 deliverable stays isolated.
 */
export const BetaRouter: React.FC = () => (
  <Routes>
    <Route path="/app/*" element={<MvpApp />} />
    <Route path={BETA_ROUTES.home} element={<JobseekerHomePage />} />
    <Route path={BETA_ROUTES.employers} element={<EmployerLandingPage />} />
    <Route path={BETA_ROUTES.sampleReport} element={<SampleReportPage />} />
    <Route path={BETA_ROUTES.pricing} element={<PricingPage />} />
    <Route path={BETA_ROUTES.portal} element={<PortalBridgePage />} />
  </Routes>
);
