import React, { createContext, useContext } from 'react';
import { useLocalization } from '../../hooks/useLocalization';

interface BetaI18nValue {
  t: (key: string) => string;
  isLoaded: boolean;
  currentLang: string;
  changeLanguage: (lang: string) => void;
}

const BetaI18nContext = createContext<BetaI18nValue | null>(null);

/**
 * Single localization state shared across all Beta components.
 *
 * Reuses the main app's `useLocalization` pipeline and the same
 * `preferred_language` localStorage key as `LanguageSwitcher`, so switching
 * language in the Beta header propagates to every Beta page (header, footer,
 * previews) instead of each component holding its own copy.
 */
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
