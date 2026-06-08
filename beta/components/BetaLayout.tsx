import React from 'react';
import '../beta-theme.css';
import { BetaHeader } from './BetaHeader';
import { BetaFooter } from './BetaFooter';
import { useBetaI18n } from '../hooks/useBetaI18n';

interface BetaLayoutProps {
  children: React.ReactNode;
  showBanner?: boolean;
}

export const BetaLayout: React.FC<BetaLayoutProps> = ({ children, showBanner = true }) => {
  const { t, isLoaded } = useBetaI18n();

  if (!isLoaded) {
    return (
      <div className="beta-root min-h-screen flex items-center justify-center text-[var(--beta-text-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="beta-root min-h-screen flex flex-col">
      {showBanner && (
        <div className="bg-[var(--beta-surface-muted)] border-b border-[var(--beta-border)] text-center py-1.5 text-xs text-[var(--beta-text-muted)]">
          {t('beta_banner')}
        </div>
      )}
      <BetaHeader />
      <main className="flex-1">{children}</main>
      <BetaFooter />
    </div>
  );
};
