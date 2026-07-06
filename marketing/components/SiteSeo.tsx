import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SiteSeo — headless per-route SEO for the public marketing site (SCRUM-83).
 *
 * The site is a single-page app with client-side language switching (one URL per
 * page across all locales), so search engines index one canonical URL per page.
 * This component keeps the document head correct as the SPA navigates: per-route
 * <title> / description / canonical, Open Graph + Twitter cards for link
 * previews, `noindex` on the private app routes, and a dynamic <html lang>.
 *
 * index.html carries sensible static defaults so scrapers that don't run JS still
 * get a title, description, and social card; this component upgrades them at runtime.
 */

const ORIGIN = 'https://copilot.kairwang.cloud';
const SITE_NAME = 'Career CoPilot';
const OG_IMAGE = `${ORIGIN}/og-cover.png`;
const LANGUAGE_STORAGE_KEY = 'preferred_language';
const LANGUAGE_CHANGE_EVENT = 'career-copilot-language-change';

interface PageMeta {
  title: string;
  description: string;
}

const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Career CoPilot — Land the Job You Actually Want',
    description:
      'Your AI career coach: score your resume, practise interviews, map your career path, and negotiate offers — all in one place, backed by data.',
  },
  '/employers': {
    title: 'Hire faster with evidence — Career CoPilot for Employers',
    description:
      'Post a role, reach opted-in candidates, and see why each one matches — structured fit evidence, screener questions, and interview scorecards.',
  },
  '/pricing': {
    title: 'Pricing — Career CoPilot',
    description:
      'Simple credit-based plans for job seekers and hiring teams. Every tool is affordable on a new account, with pay-as-you-go credit packs.',
  },
  '/sample-report': {
    title: 'Sample Resume Report — Career CoPilot',
    description:
      'See a real Career CoPilot resume report: score, matched keywords, gaps, and role fit — the diagnosis, not just a number.',
  },
};

// Private / app surfaces that must never be indexed.
const NOINDEX_PREFIXES = ['/workspace', '/portal', '/admin', '/billing'];

const readLang = (): string => {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
  } catch {
    return 'en';
  }
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export const SiteSeo: React.FC = () => {
  const { pathname } = useLocation();
  const [lang, setLang] = useState<string>(readLang);

  // Keep <html lang> in sync with the user's chosen language (accessibility + SEO).
  useEffect(() => {
    const sync = () => setLang(readLang());
    window.addEventListener(LANGUAGE_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const meta = PAGE_META[pathname];
    const noindex = NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    const title = meta?.title ?? SITE_NAME;
    const description = meta?.description ?? PAGE_META['/'].description;
    const url = `${ORIGIN}${pathname === '/' ? '/' : pathname}`;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    upsertCanonical(url);

    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', OG_IMAGE);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', OG_IMAGE);
  }, [pathname]);

  return null;
};

export default SiteSeo;
