
import React from 'react';
import AccountMenu from '../AccountMenu';
import type { UserProfile } from '../../types';
import { usePortalAccountMenu } from './PortalAccountMenuContext';

interface AccountMenuProps {
  profile: UserProfile | null;
  email: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onAccount: () => void;
  onSignOut: () => void;
  t: (key: string) => string;
}

interface PortalTopBarProps {
  title: string;
  darkMode?: boolean;
  /**
   * Explicit account-menu config. If omitted, PortalTopBar falls back to
   * the nearest PortalAccountMenuContext (provided by EmployerPortal).
   */
  accountMenuProps?: AccountMenuProps;
}

export function PortalTopBar({ title, darkMode = false, accountMenuProps }: PortalTopBarProps) {
  // Fall back to context when no explicit props were passed
  const ctxMenu = usePortalAccountMenu();
  const menuConfig = accountMenuProps ?? ctxMenu ?? null;

  return (
    <div
      className={`h-[63px] border-b flex items-center px-8 flex-shrink-0 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      <h1 className={`text-xl font-semibold flex-1 text-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        {title}
      </h1>
      {menuConfig && (
        <div className="flex-shrink-0">
          <AccountMenu {...menuConfig} />
        </div>
      )}
    </div>
  );
}
