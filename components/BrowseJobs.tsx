import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ApplyReviewModal, { type ApplyReviewJob } from './ApplyReviewModal';
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  MapPin,
  MessageSquare,
  Search,
  SlidersHorizontal,
  RotateCcw,
  Star,
  Target,
  X,
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestoreDb, firebaseFunctions } from '../lib/firebaseClient';
import { listAllActiveJobPostings } from '../lib/recruitingData';
import type { JobPosting } from '../lib/recruitingData';
import type { AppSession as Session } from '../lib/data';
import { useToast } from './Toast';
import {
  listCompanyReviews,
  aggregateRating,
  type CompanyReview,
} from '../lib/companyReviewsData';
import {
  prefsSummaryLine,
  useJobPreferences,
  type JobPreferences,
} from '../hooks/useJobPreferences';

interface BrowseJobsProps {
  session: Session | null;
  t: (key: string) => string;
  /** Jump to the Talent Profile editor (from the pre-submit review step). */
  onEditProfile?: () => void;
}

const QUICK_SEARCHES = [
  {
    labelKey: 'browse_jobs_quick_software',
    aliases: ['software', 'developer', 'engineer', 'frontend', 'backend', 'full stack'],
  },
  {
    labelKey: 'browse_jobs_quick_product',
    aliases: ['product', 'product manager', 'product owner'],
  },
  {
    labelKey: 'browse_jobs_quick_data',
    aliases: ['data', 'analytics', 'analyst', 'scientist'],
  },
  {
    labelKey: 'browse_jobs_quick_marketing',
    aliases: ['marketing', 'growth', 'content', 'social media'],
  },
  {
    labelKey: 'browse_jobs_quick_remote',
    aliases: ['remote', 'remotely', 'work from home', 'wfh'],
  },
] as const;

type WorkModeFilter = 'all' | 'remote' | 'hybrid' | 'onsite';
type DerivedWorkMode = Exclude<WorkModeFilter, 'all'>;
type ActiveFilterKey = 'keyword' | 'location' | 'workMode' | 'salary' | 'sort';

const WORK_MODE_OPTIONS: Array<{ value: WorkModeFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'browse_jobs_work_mode_all' },
  { value: 'remote', labelKey: 'browse_jobs_work_mode_remote' },
  { value: 'hybrid', labelKey: 'browse_jobs_work_mode_hybrid' },
  { value: 'onsite', labelKey: 'browse_jobs_work_mode_onsite' },
];

const WORK_MODE_TOKENS: Record<DerivedWorkMode, string[]> = {
  remote: ['remote', 'remotely', 'work from home', 'wfh', 'teletravail', '远程', 'リモート', 'tu xa'],
  hybrid: ['hybrid', 'hybride', 'mixed', '混合', 'ハイブリッド', 'ket hop'],
  onsite: ['onsite', 'on-site', 'on site', 'office', 'in office', 'vor ort', 'sur site', '现场', '現場', '办公室', '辦公室', '出社', 'オフィス', 'tai van phong'],
};

const normalizeFilterText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const tokenizeSearch = (value: string) =>
  normalizeFilterText(value)
    .split(/[\s,;/|]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const splitPreferenceList = (value: string) =>
  value
    .split(/[,;/\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const hasFilterablePreferences = (prefs: JobPreferences | null) =>
  !!prefs && [prefs.roles, prefs.locations, prefs.salaryMin].some((value) => value.trim().length > 0);

const buildGoalKeyword = (prefs: JobPreferences | null) => {
  if (!prefs) return '';
  return splitPreferenceList(prefs.roles).join(' ');
};

const findPreferredLocation = (prefs: JobPreferences | null, locations: string[]) => {
  if (!prefs?.locations.trim()) return 'all';
  const desiredLocations = splitPreferenceList(prefs.locations).map(normalizeFilterText);
  if (desiredLocations.length === 0) return 'all';

  return locations.find((location) => {
    const normalizedLocation = normalizeFilterText(location);
    return desiredLocations.some(
      (desired) => normalizedLocation.includes(desired) || desired.includes(normalizedLocation),
    );
  }) ?? 'all';
};

const detectWorkMode = (value: string): WorkModeFilter => {
  const normalized = normalizeFilterText(value);
  if (!normalized) return 'all';
  if (WORK_MODE_TOKENS.remote.some((token) => normalized.includes(token))) return 'remote';
  if (WORK_MODE_TOKENS.hybrid.some((token) => normalized.includes(token))) return 'hybrid';
  if (WORK_MODE_TOKENS.onsite.some((token) => normalized.includes(token))) return 'onsite';
  return 'all';
};

const deriveWorkMode = (job: JobPosting): DerivedWorkMode => {
  const explicitMode = detectWorkMode(`${job.location ?? ''} ${job.description ?? ''}`);
  if (explicitMode !== 'all') return explicitMode;
  return 'onsite';
};

const findPreferredWorkMode = (prefs: JobPreferences | null): WorkModeFilter =>
  prefs ? detectWorkMode(prefs.locations) : 'all';

const isPostedWithinDays = (iso: string, days: number) => {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= days * 86_400_000;
};

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

// ── helper: relative posted date (i18n via t) ─────────────────────────────────
const postedLabel = (iso: string, t: (k: string) => string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return t('browse_jobs_posted_today');
  if (days === 1) return t('browse_jobs_posted_yesterday');
  if (days < 7) return t('browse_jobs_posted_days_ago').replace('{n}', String(days));
  if (days < 30) return t('browse_jobs_posted_weeks_ago').replace('{n}', String(Math.floor(days / 7)));
  return new Date(iso).toLocaleDateString();
};

// ── helper: employer responsiveness badge (anti-ghosting, coarse + honest) ────
// Returns { text, recent } or null when there isn't enough signal to claim anything.
const responsivenessBadge = (
  resp: { avgDays: number | null; lastActionMs: number | null } | null | undefined,
  t: (k: string) => string,
): { text: string; recent: boolean } | null => {
  if (!resp) return null;
  const recent = resp.lastActionMs !== null && Date.now() - resp.lastActionMs < 14 * 86_400_000;
  if (resp.avgDays !== null) {
    return { text: t('browse_jobs_responds_in').replace('{n}', String(Math.max(1, Math.round(resp.avgDays)))), recent };
  }
  if (recent) return { text: t('browse_jobs_active_recently'), recent: true };
  return null;
};

// ── main component ─────────────────────────────────────────────────────────────
const BrowseJobs: React.FC<BrowseJobsProps> = ({ session, t, onEditProfile }) => {
  const { addToast } = useToast();
  const { prefs } = useJobPreferences();

  // ── data state ────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [rawKeyword, setRawKeyword] = useState('');
  const [keyword, setKeyword] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [workModeFilter, setWorkModeFilter] = useState<WorkModeFilter>('all');
  const [hasSalaryFilter, setHasSalaryFilter] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'title_az'>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── employer reviews cache: Record<employerId, {avg, count, reviews}> ─────
  // Keyed by employer_id, not job id. Populated lazily when a card expands.
  type ReviewCache = Record<string, { avg: number; count: number; reviews: CompanyReview[] }>;
  const [reviewCache, setReviewCache] = useState<ReviewCache>({});
  const reviewCacheRef = useRef<ReviewCache>({});
  const [reviewsExpanded, setReviewsExpanded] = useState<Record<string, boolean>>({});
  // Track which employer ids are already being fetched to avoid duplicate requests.
  const fetchingReviews = useRef<Set<string>>(new Set());

  // Employer responsiveness badge (anti-ghosting): coarse, backward-looking
  // aggregate derived server-side. Keyed by employer_id, loaded eagerly for the
  // visible jobs so the badge shows on the collapsed card.
  type RespEntry = { avgDays: number | null; lastActionMs: number | null };
  const [respCache, setRespCache] = useState<Record<string, RespEntry>>({});
  const respCacheRef = useRef<Record<string, RespEntry>>({});
  const fetchingResp = useRef<Set<string>>(new Set());

  // ── debounce keyword ──────────────────────────────────────────────────────
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleKeywordChange = (value: string) => {
    setRawKeyword(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setKeyword(value.trim()), 250);
  };
  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  const commitKeyword = (value: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setRawKeyword(value);
    setKeyword(value.trim());
  };

  const clearFilters = () => {
    commitKeyword('');
    setLocationFilter('all');
    setWorkModeFilter('all');
    setHasSalaryFilter(false);
    setSortOrder('newest');
    setExpandedId(null);
  };

  // ── fetch jobs on mount (ONCE — no reactive deps; a translated generic
  //    message is rendered, so `t` stays out of the deps) ────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(false);
      try {
        const data = await listAllActiveJobPostings();
        if (!cancelled) setJobs(data);
      } catch {
        if (!cancelled) setFetchError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  // ── lazy-load reviews when a card expands ────────────────────────────────
  // `reviewCache` is intentionally read via ref to avoid re-triggering this effect
  // on every cache write (Rule 5 — never add unstable deps that cause re-fires).
  useEffect(() => {
    if (!expandedId) return;
    const job = jobs.find((j) => j.id === expandedId);
    const eid = job?.employer_id;
    if (!eid) return;
    if (reviewCacheRef.current[eid] !== undefined) return;  // already loaded
    if (fetchingReviews.current.has(eid)) return;           // already in-flight
    fetchingReviews.current.add(eid);
    (async () => {
      try {
        const reviews = await listCompanyReviews(eid);
        const agg = aggregateRating(reviews);
        const entry = { ...agg, reviews };
        reviewCacheRef.current = { ...reviewCacheRef.current, [eid]: entry };
        setReviewCache((prev) => ({ ...prev, [eid]: entry }));
      } catch {
        // non-fatal — silently skip; card just won't show a rating chip
        const entry = { avg: 0, count: 0, reviews: [] };
        reviewCacheRef.current = { ...reviewCacheRef.current, [eid]: entry };
        setReviewCache((prev) => ({ ...prev, [eid]: entry }));
      } finally {
        fetchingReviews.current.delete(eid);
      }
    })();
  }, [expandedId, jobs]);

  // ── eager-load employer responsiveness for the visible jobs ─────────────────
  useEffect(() => {
    const eids = Array.from(new Set(jobs.map((j) => j.employer_id).filter((e): e is string => !!e)));
    eids.forEach((eid) => {
      if (respCacheRef.current[eid] !== undefined || fetchingResp.current.has(eid)) return;
      fetchingResp.current.add(eid);
      (async () => {
        try {
          const snap = await getDoc(doc(firestoreDb, 'employer_responsiveness', eid));
          const d = snap.exists() ? snap.data() : undefined;
          const count = typeof d?.count === 'number' ? d.count : 0;
          const sum = typeof d?.sum_days === 'number' ? d.sum_days : 0;
          const lastMs = d?.last_action_at?.toMillis?.() ?? null;
          const entry: RespEntry = { avgDays: count >= 3 ? sum / count : null, lastActionMs: lastMs };
          respCacheRef.current = { ...respCacheRef.current, [eid]: entry };
          setRespCache((prev) => ({ ...prev, [eid]: entry }));
        } catch {
          const entry: RespEntry = { avgDays: null, lastActionMs: null };
          respCacheRef.current = { ...respCacheRef.current, [eid]: entry };
          setRespCache((prev) => ({ ...prev, [eid]: entry }));
        } finally {
          fetchingResp.current.delete(eid);
        }
      })();
    });
  }, [jobs]);

  // ── distinct locations ────────────────────────────────────────────────────
  const locations = useMemo(() => {
    const seen = new Set<string>();
    jobs.forEach((j) => { if (j.location) seen.add(j.location); });
    return Array.from(seen).sort();
  }, [jobs]);

  const quickSearchAliasMap = useMemo(() => {
    const aliases = new Map<string, readonly string[]>();
    QUICK_SEARCHES.forEach((search) => {
      const normalizedAliases = search.aliases.map(normalizeFilterText);
      aliases.set(normalizeFilterText(t(search.labelKey)), normalizedAliases);
      normalizedAliases.forEach((alias) => aliases.set(alias, normalizedAliases));
    });
    return aliases;
  }, [t]);

  // ── filtered + sorted results ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    const normalizedKeyword = normalizeFilterText(keyword);
    const quickSearchAliases = quickSearchAliasMap.get(normalizedKeyword);
    const keywordTokens = quickSearchAliases ? [] : tokenizeSearch(keyword);
    return jobs
      .filter((j) => {
        const searchable = [
          j.title,
          j.company_name,
          j.location,
          j.salary_range,
          j.description,
        ].filter(Boolean).join(' ');
        const normalizedSearchable = normalizeFilterText(searchable);
        if (
          quickSearchAliases &&
          !quickSearchAliases.some((alias) => normalizedSearchable.includes(alias))
        ) {
          return false;
        }
        if (
          keywordTokens.length > 0 &&
          !keywordTokens.every((token) => normalizedSearchable.includes(token))
        ) {
          return false;
        }
        if (locationFilter !== 'all' && j.location !== locationFilter) return false;
        if (workModeFilter !== 'all' && deriveWorkMode(j) !== workModeFilter) return false;
        if (hasSalaryFilter && !j.salary_range) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'title_az') return a.title.localeCompare(b.title);
        // newest: already sorted by created_at desc from fetch; resort to be safe
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [jobs, keyword, quickSearchAliasMap, locationFilter, workModeFilter, hasSalaryFilter, sortOrder]);
  const hasActiveFilters = keyword !== '' || locationFilter !== 'all' || workModeFilter !== 'all' || hasSalaryFilter || sortOrder !== 'newest';
  const summaryMetrics = useMemo(() => {
    const withSalary = filtered.filter((job) => Boolean(job.salary_range)).length;
    const flexible = filtered.filter((job) => {
      const mode = deriveWorkMode(job);
      return mode === 'remote' || mode === 'hybrid';
    }).length;
    const recent = filtered.filter((job) => isPostedWithinDays(job.created_at, 7)).length;
    return [
      {
        label: t('browse_jobs_summary_matching'),
        value: filtered.length,
        detail: hasActiveFilters
          ? t('browse_jobs_summary_filtered')
          : t('browse_jobs_summary_all_open'),
      },
      {
        label: t('browse_jobs_summary_salary'),
        value: withSalary,
        detail: t('browse_jobs_summary_salary_desc'),
      },
      {
        label: t('browse_jobs_summary_flexible'),
        value: flexible,
        detail: t('browse_jobs_summary_flexible_desc'),
      },
      {
        label: t('browse_jobs_summary_recent'),
        value: recent,
        detail: t('browse_jobs_summary_recent_desc'),
      },
    ];
  }, [filtered, hasActiveFilters, t]);
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: ActiveFilterKey; label: string }> = [];
    if (keyword) {
      chips.push({
        key: 'keyword',
        label: t('browse_jobs_filter_keyword').replace('{value}', keyword),
      });
    }
    if (locationFilter !== 'all') {
      chips.push({
        key: 'location',
        label: t('browse_jobs_filter_location').replace('{value}', locationFilter),
      });
    }
    if (workModeFilter !== 'all') {
      chips.push({
        key: 'workMode',
        label: t('browse_jobs_filter_work_mode').replace('{value}', t(`browse_jobs_work_mode_${workModeFilter}`)),
      });
    }
    if (hasSalaryFilter) {
      chips.push({
        key: 'salary',
        label: t('browse_jobs_filter_salary'),
      });
    }
    if (sortOrder !== 'newest') {
      chips.push({
        key: 'sort',
        label: t('browse_jobs_filter_sort').replace('{value}', t('browse_jobs_sort_az')),
      });
    }
    return chips;
  }, [hasSalaryFilter, keyword, locationFilter, sortOrder, t, workModeFilter]);
  const hasSavedGoals = hasFilterablePreferences(prefs);
  const goalKeyword = buildGoalKeyword(prefs);
  const goalLocation = findPreferredLocation(prefs, locations);
  const goalWorkMode = findPreferredWorkMode(prefs);
  const goalSummary = prefs ? prefsSummaryLine(prefs) : '';
  const goalSalaryFilter = !!prefs?.salaryMin.trim();
  const goalsApplied =
    hasSavedGoals &&
    normalizeFilterText(keyword) === normalizeFilterText(goalKeyword) &&
    locationFilter === goalLocation &&
    workModeFilter === goalWorkMode &&
    hasSalaryFilter === goalSalaryFilter;

  const applySavedGoals = () => {
    if (!prefs) return;
    commitKeyword(goalKeyword);
    setLocationFilter(goalLocation);
    setWorkModeFilter(goalWorkMode);
    setHasSalaryFilter(goalSalaryFilter);
    setSortOrder('newest');
    setExpandedId(null);
  };

  const removeFilter = (filter: ActiveFilterKey) => {
    if (filter === 'keyword') commitKeyword('');
    if (filter === 'location') setLocationFilter('all');
    if (filter === 'workMode') setWorkModeFilter('all');
    if (filter === 'salary') setHasSalaryFilter(false);
    if (filter === 'sort') setSortOrder('newest');
    setExpandedId(null);
  };

  // ── apply handler ─────────────────────────────────────────────────────────
  // Ref guard catches double-clicks that land before React re-renders with the
  // disabled state (state updates are async; the ref flips synchronously).
  const applyInFlight = useRef<string | null>(null);
  const [reviewJob, setReviewJob] = useState<ApplyReviewJob | null>(null);

  // Step 1 — open the pre-submit review. The candidate confirms exactly what the
  // employer will receive (name, resume, Talent Profile) before anything is sent.
  const openApplyReview = useCallback((job: JobPosting) => {
    if (!session?.user) {
      addToast(t('browse_jobs_sign_in_to_apply'), 'error');
      return;
    }
    if (appliedJobs.has(job.id)) return;
    setReviewJob({ id: job.id, title: job.title, company: job.company_name ?? undefined });
  }, [session, appliedJobs, addToast, t]);

  // Step 2 — actually submit, only after the candidate confirms in the modal.
  // The server re-enforces the ready-Talent-Profile precondition (bypass-safe).
  const confirmApply = useCallback(async () => {
    if (!session?.user || !reviewJob) return;
    const jobId = reviewJob.id;
    if (appliedJobs.has(jobId) || applyInFlight.current === jobId) return;
    applyInFlight.current = jobId;
    setApplyingId(jobId);
    try {
      const createJobApplication = httpsCallable(firebaseFunctions, 'createJobApplication');
      await createJobApplication({ jobId, compatibilityScore: null });
      setAppliedJobs((prev) => new Set(prev).add(jobId));
      addToast(t('browse_jobs_apply_success'), 'success');
      setReviewJob(null);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'functions/already-exists') {
        setAppliedJobs((prev) => new Set(prev).add(jobId));
        addToast(t('browse_jobs_application_recorded'), 'info');
        setReviewJob(null);
      } else if (code === 'functions/failed-precondition') {
        // The modal pre-gates profile + resume, so the reachable precondition
        // here is the job having closed. Distinguish by the server message.
        const msg = (err as { message?: string })?.message ?? '';
        if (/profile|resume/i.test(msg)) {
          addToast(t('apply_complete_profile_first'), 'info'); // keep modal open to fix
        } else {
          addToast(t('apply_job_closed'), 'info');
          setReviewJob(null); // job closed — nothing to retry
        }
      } else {
        addToast(t('browse_jobs_apply_error'), 'error'); // keep modal open to retry
      }
    } finally {
      applyInFlight.current = null;
      setApplyingId(null);
    }
  }, [session, reviewJob, appliedJobs, addToast, t]);

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
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm space-y-4">
        {/* search bar */}
        <div className="relative">
          <label htmlFor="browse-jobs-search" className="sr-only">
            {t('browse_jobs_search_ph')}
          </label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            id="browse-jobs-search"
            type="text"
            value={rawKeyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder={t('browse_jobs_search_ph')}
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition disabled:opacity-60 disabled:cursor-wait"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 sm:w-auto">
            {t('browse_jobs_popular_searches')}
          </span>
          {QUICK_SEARCHES.map(({ labelKey, aliases }) => {
            const label = t(labelKey);
            const normalizedKeyword = normalizeFilterText(keyword);
            const active =
              normalizedKeyword === normalizeFilterText(label) ||
              aliases.some((alias) => normalizedKeyword === normalizeFilterText(alias));
            return (
              <button
                key={labelKey}
                type="button"
                onClick={() => commitKeyword(label)}
                disabled={loading}
                aria-pressed={active}
                aria-label={t('browse_jobs_quick_search_aria').replace('{label}', label)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {hasSavedGoals && (
          <div className="animate-panel-expand rounded-lg border border-blue-100 bg-blue-50/80 p-3 dark:border-blue-900/50 dark:bg-blue-900/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-200">
                  <Target className="h-4 w-4 shrink-0" />
                  {t('browse_jobs_goal_filter_title')}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-blue-800 dark:text-blue-300">
                  {goalSummary
                    ? t('browse_jobs_goal_filter_summary').replace('{summary}', goalSummary)
                    : t('browse_jobs_goal_filter_desc')}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {goalsApplied && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {t('browse_jobs_goal_filter_active')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={applySavedGoals}
                  disabled={goalsApplied || loading}
                  className="inline-flex min-h-[34px] items-center justify-center rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-default disabled:bg-blue-300 disabled:text-white/90 dark:disabled:bg-blue-900/60"
                >
                  {t('browse_jobs_goal_filter_apply')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* filter row */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
            <div className="hidden items-center gap-2 lg:flex">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('browse_jobs_filters_label')}
              </span>
            </div>

            {/* location */}
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              aria-label={t('browse_jobs_all_locations')}
              disabled={loading}
              className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:focus:border-blue-500 dark:focus:ring-blue-900/40 sm:min-w-[150px] lg:w-auto"
            >
              <option value="all">{t('browse_jobs_all_locations')}</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>

            {/* has salary */}
            <label className="flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <input
                type="checkbox"
                checked={hasSalaryFilter}
                onChange={(e) => setHasSalaryFilter(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-wait"
              />
              {t('browse_jobs_has_salary')}
            </label>

            {/* work mode */}
            <div
              className="sm:col-span-2 flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label={t('browse_jobs_work_mode_label')}
            >
              <span className="w-full text-xs font-semibold text-slate-500 dark:text-slate-400 sm:w-auto">
                {t('browse_jobs_work_mode_label')}
              </span>
              {WORK_MODE_OPTIONS.map((option) => {
                const active = workModeFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setWorkModeFilter(option.value)}
                    disabled={loading}
                    aria-pressed={active}
                    className={`inline-flex min-h-[32px] items-center justify-center rounded-full border px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:cursor-wait disabled:opacity-60 ${
                      active
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-300'
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {/* sort */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'title_az')}
              aria-label={t('browse_jobs_sort_label')}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
            >
              <option value="newest">{t('browse_jobs_sort_newest')}</option>
              <option value="title_az">{t('browse_jobs_sort_az')}</option>
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('browse_jobs_clear_filters')}
              </button>
            )}
          </div>
        </div>

        {activeFilterChips.length > 0 && (
          <div className="animate-panel-expand rounded-lg border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                {t('browse_jobs_active_filters')}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex w-fit items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('browse_jobs_clear_filters')}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => removeFilter(chip.key)}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-blue-100 bg-white px-2.5 py-1 text-xs font-semibold text-blue-900 transition-colors hover:border-blue-200 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-blue-950/50"
                  aria-label={t('browse_jobs_remove_filter').replace('{label}', chip.label)}
                >
                  <span>{chip.label}</span>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* result count */}
      {!loading && !fetchError && (
        <div aria-live="polite" className="animate-panel-expand rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {filtered.length === 0
                  ? t('browse_jobs_no_results')
                  : t('browse_jobs_result_count').replace('{n}', String(filtered.length))}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {hasActiveFilters ? t('browse_jobs_summary_filtered_desc') : t('browse_jobs_summary_all_desc')}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-300 sm:w-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('browse_jobs_clear_filters')}
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {summaryMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60"
              >
                <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {metric.value}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {metric.label}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-500">
                  {metric.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
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
          {t('browse_jobs_fetch_error')}
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
          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            <RotateCcw className="h-4 w-4" />
            {t('browse_jobs_clear_filters')}
          </button>
        </div>
      )}

      {/* job cards */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((job) => {
            const isExpanded = expandedId === job.id;
            const isApplied = appliedJobs.has(job.id);
            const isApplying = applyingId === job.id;
            const detailsId = `job-details-${job.id}`;
            const workMode = deriveWorkMode(job);

            const eid = job.employer_id;
            const reviewsId = eid ? `job-reviews-${job.id}` : undefined;
            const employerReviews = eid ? (reviewCache[eid] ?? null) : null;
            const showRatingChip = employerReviews && employerReviews.count > 0;
            const respBadge = responsivenessBadge(eid ? respCache[eid] : null, t);
            const reviewsOpen = eid ? (reviewsExpanded[eid] ?? false) : false;
            const applicationStages = [
              { label: t('browse_jobs_status_viewed'), active: true, icon: Clock3 },
              { label: t('browse_jobs_status_applied'), active: isApplied, icon: CheckCircle2 },
              { label: t('browse_jobs_status_interview'), active: false, icon: MessageSquare },
            ];

            return (
              <article
                key={job.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition duration-200 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800/60"
              >
                {/* card header — always visible */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                  aria-expanded={isExpanded}
                  aria-controls={detailsId}
                  aria-label={t('browse_jobs_toggle_details_aria').replace('{title}', job.title)}
                  className="w-full text-left px-5 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {job.title}
                        </h3>
                        {/* Company name — muted, shown when snapshotted on the posting */}
                        {job.company_name && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                            {job.company_name}
                          </span>
                        )}
                        {/* Rating chip — shown when employer has reviews */}
                        {showRatingChip && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-full px-2 py-0.5 whitespace-nowrap">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {employerReviews!.avg.toFixed(1)}&nbsp;({employerReviews!.count})
                          </span>
                        )}
                        {/* Responsiveness badge — coarse, honest, anti-ghosting */}
                        {respBadge && (
                          <span
                            title={t('browse_jobs_responsiveness_hint')}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                              respBadge.recent
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300'
                                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            <Clock3 className="h-3 w-3" />
                            {respBadge.text}
                          </span>
                        )}
                        {isApplied && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {t('browse_jobs_applied')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {job.location && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {job.location}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {postedLabel(job.created_at, t)}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          {t(`browse_jobs_work_mode_${workMode}`)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                          <Clock3 className="h-3 w-3" />
                          {t('browse_jobs_status_active')}
                        </span>
                      </div>
                    </div>
                    {/* Salary sits top-right next to the chevron — the first thing a
                        candidate scans for on a job card. */}
                    <div className="flex items-center gap-3 shrink-0">
                      {job.salary_range && (
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {job.salary_range}
                        </span>
                      )}
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                        : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                      }
                    </div>
                  </div>

                  {/* description preview (3-line clamp) — hidden when expanded */}
                  {!isExpanded && job.description && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3">
                      {job.description}
                    </p>
                  )}
                  {!isExpanded && (
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
                      {t('browse_jobs_view_details')}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>

                {/* expanded content */}
                {isExpanded && (
                  <div id={detailsId} className="animate-panel-expand border-t border-slate-100 dark:border-slate-700 px-5 pb-5 pt-4">
                    <div className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50 sm:grid-cols-3">
                      {applicationStages.map((stage, index) => {
                        const Icon = stage.icon;
                        return (
                          <div
                            key={stage.label}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold ${
                              stage.active
                                ? 'text-blue-800 dark:text-blue-200'
                                : 'text-slate-500 dark:text-slate-500'
                            }`}
                          >
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${
                              stage.active
                                ? 'bg-blue-700 text-white dark:bg-blue-500'
                                : 'bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-700'
                            }`}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span>{stage.label}</span>
                            {index < applicationStages.length - 1 && (
                              <ChevronRight className="ml-auto hidden h-3.5 w-3.5 text-slate-300 dark:text-slate-600 sm:block" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {job.description && (
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                        {job.description}
                      </p>
                    )}
                    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {isApplied ? t('browse_jobs_application_recorded') : t('browse_jobs_direct_apply_title')}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {isApplied ? t('browse_jobs_track_in_applications') : t('browse_jobs_direct_apply_hint')}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isApplied || isApplying}
                        onClick={() => openApplyReview(job)}
                        aria-busy={isApplying}
                        aria-label={
                          isApplied
                            ? t('browse_jobs_applied_aria').replace('{title}', job.title)
                            : t('browse_jobs_apply_aria').replace('{title}', job.title)
                        }
                        className={`inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${
                          isApplied
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 cursor-default'
                            : isApplying
                              ? 'bg-blue-600 dark:bg-blue-700 text-white opacity-70 cursor-wait'
                              : 'bg-blue-700 dark:bg-blue-600 text-white hover:bg-blue-800 dark:hover:bg-blue-700'
                        }`}
                      >
                        {isApplying && (
                          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        )}
                        {isApplied
                          ? t('browse_jobs_applied')
                          : isApplying
                            ? t('browse_jobs_applying')
                            : t('browse_jobs_apply')}
                      </button>
                    </div>

                    {/* Reviews still loading for this employer — placeholder keeps the
                        card height stable instead of the section popping in. */}
                    {eid && employerReviews === null && (
                      <div className="mt-5 border-t border-slate-100 dark:border-slate-700 pt-4">
                        <div className="h-4 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
                      </div>
                    )}

                    {/* ── Reviews section ── */}
                    {employerReviews && employerReviews.count > 0 && (
                      <div className="mt-5 border-t border-slate-100 dark:border-slate-700 pt-4">
                        {/* Collapsible header */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!eid) return;
                            setReviewsExpanded((prev) => ({ ...prev, [eid]: !prev[eid] }));
                          }}
                          aria-expanded={reviewsOpen}
                          aria-controls={reviewsId}
                          className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                        >
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          {t('browse_jobs_reviews_section')}
                          <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                            {employerReviews.avg.toFixed(1)} / 5 &middot; {employerReviews.count}
                          </span>
                          {reviewsOpen
                            ? <ChevronUp className="h-3.5 w-3.5 ml-auto text-slate-400" />
                            : <ChevronRight className="h-3.5 w-3.5 ml-auto text-slate-400" />
                          }
                        </button>

                        {reviewsOpen && (
                          <div id={reviewsId} className="mt-3 space-y-3">
                            {employerReviews.reviews.slice(0, 3).map((rv, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-3"
                              >
                                {/* Stars row */}
                                <div className="flex items-center gap-1 mb-1.5">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={`h-3.5 w-3.5 ${
                                        s <= rv.rating
                                          ? 'fill-yellow-400 text-yellow-400'
                                          : 'fill-none text-slate-300 dark:text-slate-600'
                                      }`}
                                    />
                                  ))}
                                  {rv.verified && (
                                    <span className="ml-2 text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50 rounded-full px-2 py-0.5">
                                      {t('review_verified_badge')}
                                    </span>
                                  )}
                                  {rv.created_at && (
                                    <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">
                                      {new Date(rv.created_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                  {rv.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {session?.user && (
        <ApplyReviewModal
          open={Boolean(reviewJob)}
          job={reviewJob}
          uid={session.user.id}
          t={t}
          onConfirm={confirmApply}
          onClose={() => setReviewJob(null)}
          onEditProfile={onEditProfile}
        />
      )}
    </section>
  );
};

export default BrowseJobs;
