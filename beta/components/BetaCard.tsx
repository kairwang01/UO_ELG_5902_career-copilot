import React from 'react';

interface BetaCardProps {
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
}

export const BetaCard: React.FC<BetaCardProps> = ({ children, className = '', muted }) => (
  <div
    className={`rounded-[var(--beta-radius)] border border-[var(--beta-border)] p-6 ${
      muted ? 'bg-[var(--beta-surface-muted)]' : 'bg-[var(--beta-surface)]'
    } ${className}`}
  >
    {children}
  </div>
);
