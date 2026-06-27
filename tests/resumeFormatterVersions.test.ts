import { describe, expect, it } from 'vitest';
import {
  getPreferredResumeFormatterVersion,
  getResumeFormatterVersions,
  getSavedResumeFormatterVersion,
  removeResumeFormatterVersion,
  upsertResumeFormatterVersion,
} from '../lib/resumeFormatterVersions';

describe('resumeFormatterVersions', () => {
  it('hydrates a legacy single saved resume as one market version', () => {
    const versions = getResumeFormatterVersions({
      formattedText: 'Canada resume',
      targetMarket: 'Canada',
      outputLanguage: 'en',
    });

    expect(Object.keys(versions)).toEqual(['Canada']);
    expect(versions.Canada.formattedText).toBe('Canada resume');
  });

  it('preserves existing markets when adding a new localized version', () => {
    const canada = upsertResumeFormatterVersion(null, {
      formattedText: 'Canada resume',
      targetMarket: 'Canada',
      outputLanguage: 'en',
    });
    const library = upsertResumeFormatterVersion(canada, {
      formattedText: 'UK resume',
      targetMarket: 'United Kingdom',
      outputLanguage: 'en',
    });

    expect(library.activeMarket).toBe('United Kingdom::en');
    expect(getSavedResumeFormatterVersion(library, 'Canada')?.formattedText).toBe('Canada resume');
    expect(getSavedResumeFormatterVersion(library, 'United Kingdom')?.formattedText).toBe('UK resume');
  });

  it('stores separate language versions for the same market', () => {
    const franceEnglish = upsertResumeFormatterVersion(null, {
      formattedText: 'France English resume',
      targetMarket: 'France',
      outputLanguage: 'en',
    });
    const library = upsertResumeFormatterVersion(franceEnglish, {
      formattedText: 'CV français',
      targetMarket: 'France',
      outputLanguage: 'local',
    });

    expect(getSavedResumeFormatterVersion(library, 'France', 'en')?.formattedText).toBe('France English resume');
    expect(getSavedResumeFormatterVersion(library, 'France', 'local')?.formattedText).toBe('CV français');
    expect(getPreferredResumeFormatterVersion(library, 'France', 'local')?.formattedText).toBe('CV français');
  });

  it('loads the requested market before falling back to the active market', () => {
    const library = upsertResumeFormatterVersion(
      upsertResumeFormatterVersion(null, {
        formattedText: 'Canada resume',
        targetMarket: 'Canada',
        outputLanguage: 'en',
      }),
      {
        formattedText: 'Japan resume',
        targetMarket: 'Japan',
        outputLanguage: 'local',
      },
    );

    expect(getPreferredResumeFormatterVersion(library, 'Canada')?.formattedText).toBe('Canada resume');
    expect(getPreferredResumeFormatterVersion(library, 'Germany')?.formattedText).toBe('Japan resume');
  });

  it('removes one market without deleting the other saved markets', () => {
    const library = upsertResumeFormatterVersion(
      upsertResumeFormatterVersion(null, {
        formattedText: 'Canada resume',
        targetMarket: 'Canada',
        outputLanguage: 'en',
      }),
      {
        formattedText: 'UK resume',
        targetMarket: 'United Kingdom',
        outputLanguage: 'en',
      },
    );

    const remaining = removeResumeFormatterVersion(library, 'United Kingdom', 'en');
    expect(remaining).not.toBeNull();
    expect(getSavedResumeFormatterVersion(remaining, 'United Kingdom')).toBeNull();
    expect(getSavedResumeFormatterVersion(remaining, 'Canada')?.formattedText).toBe('Canada resume');
  });
});
