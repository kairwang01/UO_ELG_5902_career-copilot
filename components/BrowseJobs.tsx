import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  MapPin,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestoreDb, firebaseFunctions } from '../lib/firebaseClient';
import { listAllActiveJobPostings } from '../lib/recruitingData';
import type { JobPosting } from '../lib/recruitingData';
import type { AppSession as Session } from '../lib/data';
import { useToast } from './Toast';

interface BrowseJobsProps {
  session: Session | null;
  t: (key: string) => string;
}

// ── skeleton card ──────────────────────────────────────────────────────────────
const SkeletonCard: React.FC = () => (
  <div className="animate-pulse rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
    <div className="mb-3 h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
    <div className="mb-2 h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
    <div className="mt-4 space-y-2">
      <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-5/6 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-4/6 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  </div>
);

// ── helper: relative posted date ──────────────────────────────────────────────
const postedLabel = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString();
};

// ── main component ─────────────────────────────────────────────────────────────
const BrowseJobs: React.FC<BrowseJobsProps> = ({ session, t }) => {
  const { addToast } = useToast();

  // ── data state ────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [rawKeyword, setRawKeyword] = useState('');
  const [keyword, setKeyword] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [hasSalaryFilter, setHasSalaryFilter] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'title_az'>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── debounce keyword ──────────────────────────────────────────────────────
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleKeywordChange = (value: string) => {
    setRawKeyword(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setKeyword(value.trim()), 250);
  };
  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  // ── fetch jobs on mount ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await listAllActiveJobPostings();
        if (!cancelled) setJobs(data);
      } catch (err) {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : t('browse_jobs_fetch_error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  // ── fetch already-applied jobs for current user ───────────────────────────
  const sessionUserId = session?.user?.id ?? null;
  useEffect(() => {
    if (!sessionUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(firestoreDb, 'job_applications'), where('candidate_id', '==', sessionUserId)),
        );
        if (!cancelled) {
          setAppliedJobs(new Set(snap.docs.map((d) => d.data().job_id as string)));
        }
      } catch {
        // non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, [sessionUserId]);

  // ── distinct locations ────────────────────────────────────────────────────
  const locations = useMemo(() => {
    const seen = new Set<string>();
    jobs.forEach((j) => { if (j.location) seen.add(j.location); });
    return Array.from(seen).sort();
  }, [jobs]);

  // ── filtered + sorted results ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    const kw = keyword.toLowerCase();
    return jobs
      .filter((j) => {
        if (kw && !(j.title.toLowerCase().includes(kw) || (j.description ?? '').toLowerCase().includes(kw))) return false;
        if (locationFilter !== 'all' && j.location !== locationFilter) return false;
        if (hasSalaryFilter && !j.salary_range) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'title_az') return a.title.localeCompare(b.title);
        // newest: already sorted by created_at desc from fetch; resort to be safe
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [jobs, keyword, locationFilter, hasSalaryFilter, sortOrder]);

  // ── apply handler ─────────────────────────────────────────────────────────
  const handleApply = useCallback(async (jobId: string) => {
    if (!session?.user) {
      addToast(t('browse_jobs_sign_in_to_apply'), 'error');
      return;
    }
    if (appliedJobs.has(jobId) || applyingId === jobId) return;
    setApplyingId(jobId);
    try {
      const createJobApplication = httpsCallable(firebaseFunctions, 'createJobApplication');
      await createJobApplication({ jobId, compatibilityScore: null });
      setAppliedJobs((prev) => new Set(prev).add(jobId));
      addToast(t('browse_jobs_apply_success'), 'success');
    } catch (err) {
      console.error('Error applying to job:', err);
      addToast(t('browse_jobs_apply_error'), 'error');
    } finally {
      setApplyingId(null);
    }
  }, [session, appliedJobs, applyingId, addToast, t]);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-5">
      {/* section header */}
      <div className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t('browse_jobs_title')}
        </h2>
      </div>

      {/* search + filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm space-y-3">
        {/* search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={rawKeyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder={t('browse_jobs_search_ph')}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition"
          />
        </div>

        {/* filter row */}
        <div className="flex flex-wrap items-center gap-3">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />

          {/* location */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition"
          >
            <option value="all">{t('browse_jobs_all_locations')}</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          {/* has salary */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={hasSalaryFilter}
              onChange={(e) => setHasSalaryFilter(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            {t('browse_jobs_has_salary')}
          </label>

          {/* sort */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'title_az')}
            className="ml-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition"
          >
            <option value="newest">{t('browse_jobs_sort_newest')}</option>
            <option value="title_az">{t('browse_jobs_sort_az')}</option>
          </select>
        </div>
      </div>

      {/* result count */}
      {!loading && !fetchError && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {filtered.length === 0
            ? t('browse_jobs_no_results')
            : t('browse_jobs_result_count').replace('{n}', String(filtered.length))}
        </p>
      )}

      {/* signed-out hint */}
      {!session && !loading && jobs.length > 0 && (
        <div className="rounded-lg border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          {t('browse_jobs_signin_hint')}
        </div>
      )}

      {/* fetch error */}
      {fetchError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {fetchError}
        </div>
      )}

      {/* loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* empty state (no postings at all) */}
      {!loading && !fetchError && jobs.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-10 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
            {t('browse_jobs_empty_title')}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('browse_jobs_empty_desc')}
          </p>
        </div>
      )}

      {/* empty state (has postings but no matches) */}
      {!loading && !fetchError && jobs.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-10 text-center">
          <Search className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
            {t('browse_jobs_no_match_title')}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('browse_jobs_no_match_desc')}
          </p>
        </div>
      )}

      {/* job cards */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((job) => {
            const isExpanded = expandedId === job.id;
            const isApplied = appliedJobs.has(job.id);
            const isApplying = applyingId === job.id;

            return (
              <article
                key={job.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800/60"
              >
                {/* card header — always visible */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                  className="w-full text-left px-5 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {job.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {job.location && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {job.location}
                          </span>
                        )}
                        {job.salary_range && (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {job.salary_range}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {postedLabel(job.created_at)}
                        </span>
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 mt-1 shrink-0 text-slate-400 dark:text-slate-500" />
                      : <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-slate-400 dark:text-slate-500" />
                    }
                  </div>

                  {/* description preview (3-line clamp) — hidden when expanded */}
                  {!isExpanded && job.description && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3">
                      {job.description}
                    </p>
                  )}
                </button>

                {/* expanded content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 px-5 pb-5 pt-4">
                    {job.description && (
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                        {job.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        disabled={isApplied || isApplying}
                        onClick={() => handleApply(job.id)}
                        className={`inline-flex min-h-[38px] items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${
                          isApplied
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 cursor-default'
                            : isApplying
                              ? 'bg-blue-600 dark:bg-blue-700 text-white opacity-70 cursor-wait'
                              : 'bg-blue-700 dark:bg-blue-600 text-white hover:bg-blue-800 dark:hover:bg-blue-700'
                        }`}
                      >
                        {isApplied
                          ? t('browse_jobs_applied')
                          : isApplying
                            ? t('browse_jobs_applying')
                            : t('browse_jobs_apply')}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default BrowseJobs;
