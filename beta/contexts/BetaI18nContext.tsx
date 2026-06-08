import React, { createContext, useContext } from 'react';
import { useLocalization } from '../../hooks/useLocalization';

interface BetaI18nValue {
  t: (key: string) => string;
  isLoaded: boolean;
  currentLang: string;
  changeLanguage: (lang: string) => void;
}

const BetaI18nContext = createContext<BetaI18nValue | null>(null);

// One localization state for all Beta pages, so the header switcher updates
// everything. Reuses the app's useLocalization and the same preferred_language key.
export const BetaI18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stored =
    (typeof localStorage !== 'undefined' && localStorage.getItem('preferred_language')) || undefined;
  const { t, isLoaded, currentLang, changeLanguage } = useLocalization(stored || undefined);

  const setLanguage = (lang: string) => {
    try {
      localStorage.setItem('preferred_language', lang);
    } catch {
      /* ignore storage failures */
    }
    changeLanguage(lang);
  };

  return (
    <BetaI18nContext.Provider value={{ t, isLoaded, currentLang, changeLanguage: setLanguage }}>
      {children}
    </BetaI18nContext.Provider>
  );
};

export const useBetaI18nContext = (): BetaI18nValue => {
  const ctx = useContext(BetaI18nContext);
  if (!ctx) {
    throw new Error('useBetaI18nContext must be used within a BetaI18nProvider');
  }
  return ctx;
};
