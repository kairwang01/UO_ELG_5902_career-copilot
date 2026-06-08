import React from 'react';
import { BetaLayout } from '../components/BetaLayout';
import { BetaButton } from '../components/BetaButton';
import { BETA_ROUTES } from '../../config/beta';

/**
 * Portal entry bridge — forwards to MVP app auth/portal flow.
 * Full EmployerPortal integration ships in P1 when beta routes share App session state.
 */
export const PortalBridgePage: React.FC = () => (
  <BetaLayout showBanner={false}>
    <section className="py-[var(--beta-section)]">
      <div className="max-w-lg mx-auto px-4 sm:px-6 text-center">
        <h1 className="text-2xl font-semibold mb-4">Sign in to Career CoPilot</h1>
        <p className="text-[var(--beta-text-muted)] mb-8">
          The employer portal and resume tools use the production app. Beta marketing pages link here until portal is mounted on this route.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <BetaButton href="/app">Continue to app</BetaButton>
          <BetaButton variant="secondary" to={BETA_ROUTES.employers}>
            Back to employers
          </BetaButton>
        </div>
      </div>
    </section>
  </BetaLayout>
);
