import React, { createContext, useContext, ReactNode } from 'react';

interface SettingsContextType {
  isAIMode: boolean;
  toggleAIMode: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // AI Mode is always on — model routing is controlled by admins server-side.
  // The toggle UI has been removed; this constant keeps existing consumers compiling.
  const isAIMode = true;

  // No-op: kept so any residual call sites (e.g. Header) compile without changes.
  const toggleAIMode = () => {};

  return (
    <SettingsContext.Provider value={{ isAIMode, toggleAIMode }}>
      {children}
    </SettingsContext.Provider>
  );
};
