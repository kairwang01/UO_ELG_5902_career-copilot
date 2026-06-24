// Maps a target market to its single distinct local resume language. Only markets
// whose professional norm differs from English appear here; everything else returns
// null (the UI shows no language toggle and output stays English).
const MARKET_LOCAL_LANGUAGE: Record<string, { name: string; labelKey: string }> = {
  Germany:  { name: 'German',     labelKey: 'resume_lang_german' },
  France:   { name: 'French',     labelKey: 'resume_lang_french' },
  Japan:    { name: 'Japanese',   labelKey: 'resume_lang_japanese' },
  Vietnam:  { name: 'Vietnamese', labelKey: 'resume_lang_vietnamese' },
};

export type OutputLanguageChoice = 'en' | 'local';

// `name` is the fixed English identifier sent to the model; `labelKey` is the i18n
// key for the UI label. Returns null when the market has no distinct local language.
export const getMarketLocalLanguage = (
  market: string,
): { name: string; labelKey: string } | null => MARKET_LOCAL_LANGUAGE[market] ?? null;

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
