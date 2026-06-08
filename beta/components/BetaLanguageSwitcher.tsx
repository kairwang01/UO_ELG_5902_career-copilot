import React from 'react';
import { useBetaI18n } from '../hooks/useBetaI18n';
import { BETA_SUPPORTED_LANGUAGES } from '../config/locales';

interface BetaLanguageSwitcherProps {
  variant?: 'header' | 'mobile';
}

/**
 * Reuses the same `preferred_language` persistence and localization pipeline
 * as the MVP LanguageSwitcher, but scoped to locales with full beta_* coverage.
 */
export const BetaLanguageSwitcher: React.FC<BetaLanguageSwitcherProps> = ({ variant = 'header' }) => {
  const { currentLang, changeLanguage } = useBetaI18n();
  const value = BETA_SUPPORTED_LANGUAGES.some((l) => l.code === currentLang) ? currentLang : 'en';

  const base =
    'rounded-[var(--beta-radius)] border border-[var(--beta-border)] bg-[var(--beta-surface)] text-[var(--beta-text)] focus:outline-none focus:ring-2 focus:ring-[var(--beta-action)]/40';

  return (
    <select
      aria-label="Language"
      value={value}
      onChange={(e) => changeLanguage(e.target.value)}
      className={
        variant === 'mobile'
          ? `${base} w-full px-3 py-2.5 min-h-[44px] text-sm mt-2`
          : `${base} px-2 py-1.5 text-sm`
      }
    >
      {BETA_SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
};
