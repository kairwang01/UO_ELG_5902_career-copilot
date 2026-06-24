import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, Globe, Plus, Sparkles } from 'lucide-react';
import type { AppSession as Session } from '../lib/data';
import type { UserProfile } from '../types';
import {
  listSavedPortfolios,
  loadPortfolioHtml,
  type SavedPortfolio,
} from '../services/savedPortfolios';
import PortfolioPreviewViewer, { PORTFOLIO_TEMPLATES } from './showcase/PortfolioPreviewViewer';

const PortfolioWebsiteBuilder = React.lazy(() => import('./tools/PortfolioWebsiteBuilder'));

interface ShowcasePageProps {
  resumeText: string;
  session: Session | null;
  profile: UserProfile | null;
  t: (key: string) => string;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
}

type ShowcaseTab = 'mine' | 'build';

const formatDate = (millis: number) => new Date(millis).toLocaleDateString(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const TemplateCover: React.FC<{ theme: string; title: string }> = ({ theme, title }) => {
  const template = PORTFOLIO_TEMPLATES.find((item) => item.key === theme) ?? PORTFOLIO_TEMPLATES[0];
  return (
    <div className="relative h-40 overflow-hidden rounded-t-xl" style={{ background: template.colors[1] }}>
      <div className="absolute inset-x-5 top-5 h-4 rounded-full" style={{ background: template.colors[0] }} />
      <div className="absolute left-5 top-14 h-16 w-16 rounded-full border-4 border-white" style={{ background: template.colors[3] }} />
      <div className="absolute left-28 right-5 top-16 space-y-2">
        <div className="h-3 rounded-full" style={{ background: template.colors[2] }} />
        <div className="h-3 w-2/3 rounded-full bg-white/80" />
      </div>
      <div className="absolute inset-x-5 bottom-5 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-10 rounded-lg bg-white/85" />
        ))}
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
};

const ShowcasePage: React.FC<ShowcasePageProps> = ({ resumeText, session, profile, t, onUnsavedChange }) => {
  const uid = session?.user?.id ?? null;
  const [tab, setTab] = useState<ShowcaseTab | null>(null);
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [selected, setSelected] = useState<SavedPortfolio | null>(null);
  const [selectedHtml, setSelectedHtml] = useState('');
  const [selectedLoading, setSelectedLoading] = useState(false);
  const initialTabRef = useRef<string | null>(null);

  const setUnsaved = useCallback((next: boolean) => {
    setHasUnsaved(next);
    onUnsavedChange?.(next);
  }, [onUnsavedChange]);

  const refreshPortfolios = useCallback(async () => {
    if (!uid) {
      setPortfolios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const items = await listSavedPortfolios(uid);
      setPortfolios(items);
      if (initialTabRef.current !== uid) {
        initialTabRef.current = uid;
        setTab(items.length > 0 ? 'mine' : 'build');
      }
    } catch {
      setLoadError(t('showcase_list_load_failed'));
      if (initialTabRef.current !== uid) {
        initialTabRef.current = uid;
        setTab('build');
      }
    } finally {
      setLoading(false);
    }
  }, [t, uid]);

  useEffect(() => {
    void refreshPortfolios();
  }, [refreshPortfolios]);

  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasUnsaved]);

  const switchTab = (next: ShowcaseTab) => {
    if (tab === next) return;
    if (hasUnsaved && !window.confirm(t('showcase_unsaved_leave_confirm'))) return;
    setUnsaved(false);
    setSelected(null);
    setSelectedHtml('');
    setTab(next);
  };

  const openPortfolio = async (portfolio: SavedPortfolio) => {
    setSelected(portfolio);
    setSelectedHtml('');
    setSelectedLoading(true);
    try {
      setSelectedHtml(await loadPortfolioHtml(portfolio.html_path));
    } catch {
      setLoadError(t('showcase_detail_load_failed'));
    } finally {
      setSelectedLoading(false);
    }
  };

  if (selected) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => { setSelected(null); setSelectedHtml(''); }}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('showcase_back_to_list')}
        </button>
        {selectedLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {t('showcase_loading')}
          </div>
        ) : selectedHtml ? (
          <PortfolioPreviewViewer
            htmlContent={selectedHtml}
            theme={selected.theme}
            title={selected.name}
            hint={t('showcase_saved_hint').replace('{date}', formatDate(selected.created_at))}
            filename={selected.name}
            badges={[formatDate(selected.created_at)]}
            t={t}
          />
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {t('showcase_detail_load_failed')}
          </div>
        )}
      </div>
    );
  }

  const activeTab = tab ?? 'build';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">{t('ws_nav_portfolio')}</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950 dark:text-gray-100">{t('showcase_title')}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{t('showcase_subtitle')}</p>
        </div>
        <div className="grid rounded-2xl border border-gray-200 bg-gray-100 p-1 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => switchTab('mine')}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'mine' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-950 dark:text-blue-300' : 'text-gray-600 hover:text-gray-950 dark:text-slate-400 dark:hover:text-white'}`}
          >
            <Globe className="h-4 w-4" />
            {t('showcase_tab_mine')}
          </button>
          <button
            type="button"
            onClick={() => switchTab('build')}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === 'build' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-950 dark:text-blue-300' : 'text-gray-600 hover:text-gray-950 dark:text-slate-400 dark:hover:text-white'}`}
          >
            <Sparkles className="h-4 w-4" />
            {t('showcase_tab_build')}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {loadError}
        </div>
      )}

      {activeTab === 'mine' ? (
        loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {t('showcase_loading')}
          </div>
        ) : portfolios.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {portfolios.map((portfolio) => (
              <button
                key={portfolio.id}
                type="button"
                onClick={() => void openPortfolio(portfolio)}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800"
              >
                <TemplateCover theme={portfolio.theme} title={portfolio.name} />
                <div className="p-4">
                  <h3 className="truncate text-base font-bold text-gray-950 dark:text-gray-100">{portfolio.name}</h3>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400">
                    <CalendarDays className="h-4 w-4" />
                    {t('showcase_saved_on').replace('{date}', formatDate(portfolio.created_at))}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-gray-950 dark:text-gray-100">{t('showcase_empty_title')}</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600 dark:text-slate-400">{t('showcase_empty_desc')}</p>
            <button
              type="button"
              onClick={() => switchTab('build')}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              {t('showcase_tab_build')}
            </button>
          </div>
        )
      ) : (
        <Suspense fallback={<div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{t('showcase_loading')}</div>}>
          <PortfolioWebsiteBuilder
            resumeText={resumeText}
            profile={profile}
            session={session}
            t={t}
            onUnsavedPortfolioChange={setUnsaved}
            onSavedPortfolio={() => {
              setUnsaved(false);
              void refreshPortfolios().then(() => setTab('mine'));
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ShowcasePage;
