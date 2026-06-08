/**
 * Locales with complete `beta_*` key coverage.
 * Others are intentionally hidden from the Beta switcher until translated,
 * because missing keys render raw key names and damage trust.
 */
export const BETA_SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
] as const;

export type BetaLangCode = (typeof BETA_SUPPORTED_LANGUAGES)[number]['code'];
