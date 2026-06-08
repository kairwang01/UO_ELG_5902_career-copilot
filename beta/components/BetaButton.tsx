import React from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost';

const styles: Record<Variant, string> = {
  primary:
    'bg-[var(--beta-action)] text-white hover:bg-[var(--beta-action-hover)] border border-transparent',
  secondary:
    'bg-[var(--beta-surface)] text-[var(--beta-text)] border border-[var(--beta-border)] hover:bg-[var(--beta-surface-muted)]',
  ghost: 'bg-transparent text-[var(--beta-action)] border border-transparent hover:bg-[var(--beta-surface-muted)]',
};

interface BetaButtonProps {
  children: React.ReactNode;
  variant?: Variant;
  href?: string;
  to?: string;
  onClick?: () => void;
  className?: string;
}

export const BetaButton: React.FC<BetaButtonProps> = ({
  children,
  variant = 'primary',
  href,
  to,
  onClick,
  className = '',
}) => {
  const base = `inline-flex items-center justify-center rounded-[var(--beta-radius)] px-6 py-2.5 text-sm font-medium transition-colors ${styles[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={base}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={base} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={base}>
      {children}
    </button>
  );
};
