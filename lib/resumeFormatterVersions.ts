import type { FormattedResume } from '../types';

export interface ResumeFormatterVersionLibrary {
  version: 2;
  activeMarket?: string;
  versions: Record<string, FormattedResume>;
}

export type ResumeFormatterSavedResult = FormattedResume | ResumeFormatterVersionLibrary;

const hasFormattedText = (value: unknown): value is FormattedResume => (
  Boolean(value)
  && typeof value === 'object'
  && typeof (value as { formattedText?: unknown }).formattedText === 'string'
);

export const normalizeResumeMarketKey = (market: string | null | undefined): string => (
  (market ?? '').trim() || 'General'
);

export const isResumeFormatterVersionLibrary = (value: unknown): value is ResumeFormatterVersionLibrary => (
  Boolean(value)
  && typeof value === 'object'
  && (value as { version?: unknown }).version === 2
  && Boolean((value as { versions?: unknown }).versions)
  && typeof (value as { versions?: unknown }).versions === 'object'
);

export const getResumeFormatterVersions = (
  savedResult: ResumeFormatterSavedResult | null | undefined,
  fallbackMarket = 'General',
): Record<string, FormattedResume> => {
  if (!savedResult) return {};

  if (isResumeFormatterVersionLibrary(savedResult)) {
    return Object.entries(savedResult.versions ?? {}).reduce<Record<string, FormattedResume>>((acc, [market, version]) => {
      if (!hasFormattedText(version)) return acc;
      const key = normalizeResumeMarketKey(version.targetMarket || market);
      acc[key] = {
        ...version,
        targetMarket: version.targetMarket || key,
      };
      return acc;
    }, {});
  }

  if (!hasFormattedText(savedResult)) return {};
  const key = normalizeResumeMarketKey(savedResult.targetMarket || fallbackMarket);
  return {
    [key]: {
      ...savedResult,
      targetMarket: savedResult.targetMarket || key,
    },
  };
};

export const getSavedResumeFormatterVersion = (
  savedResult: ResumeFormatterSavedResult | null | undefined,
  targetMarket: string,
): FormattedResume | null => {
  const versions = getResumeFormatterVersions(savedResult, targetMarket);
  return versions[normalizeResumeMarketKey(targetMarket)] ?? null;
};

export const getPreferredResumeFormatterVersion = (
  savedResult: ResumeFormatterSavedResult | null | undefined,
  targetMarket: string,
): FormattedResume | null => {
  const versions = getResumeFormatterVersions(savedResult, targetMarket);
  const target = versions[normalizeResumeMarketKey(targetMarket)];
  if (target) return target;

  if (isResumeFormatterVersionLibrary(savedResult) && savedResult.activeMarket) {
    const active = versions[normalizeResumeMarketKey(savedResult.activeMarket)];
    if (active) return active;
  }

  return Object.values(versions)[0] ?? null;
};

export const upsertResumeFormatterVersion = (
  savedResult: ResumeFormatterSavedResult | null | undefined,
  version: FormattedResume,
): ResumeFormatterVersionLibrary => {
  const key = normalizeResumeMarketKey(version.targetMarket);
  return {
    version: 2,
    activeMarket: key,
    versions: {
      ...getResumeFormatterVersions(savedResult, key),
      [key]: {
        ...version,
        targetMarket: key,
      },
    },
  };
};

export const removeResumeFormatterVersion = (
  savedResult: ResumeFormatterSavedResult | null | undefined,
  targetMarket: string,
): ResumeFormatterVersionLibrary | null => {
  const key = normalizeResumeMarketKey(targetMarket);
  const versions = { ...getResumeFormatterVersions(savedResult, key) };
  delete versions[key];
  const activeMarket = Object.keys(versions)[0];
  if (!activeMarket) return null;
  return {
    version: 2,
    activeMarket,
    versions,
  };
};
