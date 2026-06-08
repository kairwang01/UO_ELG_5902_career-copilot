import React from 'react';
import '../beta-theme.css';
import { BetaHeader } from './BetaHeader';
import { BetaFooter } from './BetaFooter';

interface BetaLayoutProps {
  children: React.ReactNode;
  showBanner?: boolean;
}

export const BetaLayout: React.FC<BetaLayoutProps> = ({ children, showBanner = true }) => (
  <div className="beta-root min-h-screen flex flex-col">
    {showBanner && (
      <div className="bg-[var(--beta-surface-muted)] border-b border-[var(--beta-border)] text-center py-1.5 text-xs text-[var(--beta-text-muted)]">
        Beta redesign preview — MVP production unchanged when feature flag is off
      </div>
    )}
    <BetaHeader />
    <main className="flex-1">{children}</main>
    <BetaFooter />
  </div>
);
