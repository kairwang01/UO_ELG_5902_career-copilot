
import React, { createContext, useContext } from 'react';
import type { UserProfile } from '../../types';

export interface PortalAccountMenuConfig {
  profile: UserProfile | null;
  email: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onAccount: () => void;
  onSignOut: () => void;
  t: (key: string) => string;
}

const PortalAccountMenuContext = createContext<PortalAccountMenuConfig | null>(null);

export const PortalAccountMenuProvider: React.FC<{
  value: PortalAccountMenuConfig;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <PortalAccountMenuContext.Provider value={value}>
    {children}
  </PortalAccountMenuContext.Provider>
);

export function usePortalAccountMenu(): PortalAccountMenuConfig | null {
  return useContext(PortalAccountMenuContext);
}
