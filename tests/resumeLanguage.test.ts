import { describe, expect, it } from 'vitest';
import { getMarketLocalLanguage, resolveOutputLanguageName } from '../lib/resumeLanguage';

describe('resumeLanguage', () => {
  it('returns a local language for DE/FR/JP/VN', () => {
    expect(getMarketLocalLanguage('Germany')).toEqual({ name: 'German', labelKey: 'resume_lang_german' });
    expect(getMarketLocalLanguage('France')).toEqual({ name: 'French', labelKey: 'resume_lang_french' });
    expect(getMarketLocalLanguage('Japan')).toEqual({ name: 'Japanese', labelKey: 'resume_lang_japanese' });
    expect(getMarketLocalLanguage('Vietnam')).toEqual({ name: 'Vietnamese', labelKey: 'resume_lang_vietnamese' });
  });

  it('returns null for English-native / multi-language markets', () => {
    for (const m of ['Singapore', 'United States', 'Canada', 'Australia', 'United Kingdom']) {
      expect(getMarketLocalLanguage(m)).toBeNull();
    }
  });

  it('resolves the language name passed to the model', () => {
    expect(resolveOutputLanguageName('Japan', 'local')).toBe('Japanese');
    expect(resolveOutputLanguageName('Japan', 'en')).toBe('English');
    expect(resolveOutputLanguageName('Canada', 'local')).toBe('English'); // no local language → English
  });

  // Regression: China used to be missing here, so localizing to China stayed in
  // English (reported: "company/school always English"). It must map to Chinese.
  it('localizes China to Simplified Chinese', () => {
    expect(getMarketLocalLanguage('China')).toEqual({ name: 'Simplified Chinese', labelKey: 'resume_lang_chinese' });
    expect(resolveOutputLanguageName('China', 'local')).toBe('Simplified Chinese');
    expect(resolveOutputLanguageName('China', 'en')).toBe('English');
  });
});
