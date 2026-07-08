// Maps a target market to its single distinct local resume language. Only markets
// whose professional norm differs from English appear here; everything else returns
// null (the UI shows no language toggle and output stays English).
const MARKET_LOCAL_LANGUAGE: Record<string, { name: string; labelKey: string; defaultToEnglish?: boolean }> = {
  // Canada is bilingual: French resumes are the norm for Québec roles, but most
  // Canadian hiring is English-first, so the toggle exists while English stays
  // the default (unlike single-language markets below, which default to local).
  Canada:   { name: 'French',     labelKey: 'resume_lang_french', defaultToEnglish: true },
  Germany:  { name: 'German',     labelKey: 'resume_lang_german' },
  France:   { name: 'French',     labelKey: 'resume_lang_french' },
  Japan:    { name: 'Japanese',   labelKey: 'resume_lang_japanese' },
  China:    { name: 'Simplified Chinese', labelKey: 'resume_lang_chinese' },
  Vietnam:  { name: 'Vietnamese', labelKey: 'resume_lang_vietnamese' },
  'United Arab Emirates': { name: 'Arabic', labelKey: 'resume_lang_arabic' },
};

export type OutputLanguageChoice = 'en' | 'local';

// `name` is the fixed English identifier sent to the model; `labelKey` is the i18n
// key for the UI label. Returns null when the market has no distinct local language.
export const getMarketLocalLanguage = (
  market: string,
): { name: string; labelKey: string; defaultToEnglish?: boolean } | null => MARKET_LOCAL_LANGUAGE[market] ?? null;

// The language choice a market starts on: 'local' for single-language markets
// (a Chinese resume is the norm in China), 'en' when the market has no local
// option or is bilingual-but-English-first (Canada).
export const marketDefaultLanguage = (market: string): OutputLanguageChoice => {
  const local = getMarketLocalLanguage(market);
  return local && !local.defaultToEnglish ? 'local' : 'en';
};

// Resolves the user's choice into the concrete language name handed to the prompt.
export const resolveOutputLanguageName = (
  market: string,
  choice: OutputLanguageChoice,
): string => {
  if (choice === 'local') {
    const local = getMarketLocalLanguage(market);
    if (local) return local.name;
  }
  return 'English';
};
