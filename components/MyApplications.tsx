import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebaseClient';
import type { AppSession as Session } from '../lib/data';
import { ArrowDownUp, Bell, Briefcase, CheckCircle2, Clock3, MessageSquare, RotateCcw, Search, Star, X } from 'lucide-react';
import CompanyReviewModal from './CompanyReviewModal';
import {
  APPLICATION_FILTER_GROUPS,
  APPLICATION_FILTER_LABEL_KEYS,
  APPLICATION_PIPELINE_STAGES,
  APPLICATION_PROGRESS_GROUPS,
  applicationMatchesFilter,
  getApplicationStatusGroup,
  getApplicationStatusIndex,
  getApplicationStatusLabelKey,
  isApplicationClosedStatus,
  isApplicationHiredStatus,
  isApplicationRejectedStatus,
  normalizeApplicationStatus,
  type ApplicationFilterGroup,
  type ApplicationPipelineStatus,
  type ApplicationStatusGroup,
} from '../lib/applicationPipeline';
import {
  subscribeNotifications,
  markNotificationRead,
  unreadCount,
  type AppNotification,
} from '../lib/notificationsData';

interface ApplicationRow {
  id: string;
  job_title: string;
  employer_id?: string;
  status: ApplicationPipelineStatus;
  application_date?: { toMillis?: () => number; toDate?: () => Date };
  compatibility_score?: number | null;
  // Candidate-facing note the employer attached to the latest status change.
  last_status_note?: string | null;
}

type FilterStatus = ApplicationFilterGroup;
type ApplicationSortKey = 'newest' | 'match' | 'title';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(row: ApplicationRow): string {
  try {
    const d = row.application_date?.toDate?.();
    if (d) return d.toLocaleDateString();
  } catch {
    // ignore
  }
  return '—';
}

function applicationTime(row: ApplicationRow): number {
  try {
    return row.application_date?.toMillis?.() ?? row.application_date?.toDate?.().getTime() ?? 0;
  } catch {
    return 0;
  }
}

const normalizeFilterText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

function formatTranslation(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

const STATUS_CHIP_CLASSES: Record<ApplicationStatusGroup, string> = {
  applied:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  interview:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  offer:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  hired: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected:
    'bg-gray-100 text-gray-500 dark:bg-slate-700/50 dark:text-slate-400',
};

const STATUS_GUIDANCE: Record<
  ApplicationStatusGroup,
  {
    titleKey: string;
    descKey: string;
    icon: React.ElementType;
    className: string;
    iconClassName: string;
  }
> = {
  applied: {
    titleKey: 'applications_next_applied_title',
    descKey: 'applications_next_applied_desc',
    icon: Clock3,
    className:
      'border-blue-100 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200',
    iconClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
  },
  interview: {
    titleKey: 'applications_next_interviewing_title',
    descKey: 'applications_next_interviewing_desc',
    icon: MessageSquare,
    className:
      'border-amber-100 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200',
    iconClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
  },
  offer: {
    titleKey: 'applications_next_offer_title',
    descKey: 'applications_next_offer_desc',
    icon: MessageSquare,
    className:
      'border-indigo-100 bg-indigo-50 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200',
    iconClassName: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
  },
  hired: {
    titleKey: 'applications_next_hired_title',
    descKey: 'applications_next_hired_desc',
    icon: CheckCircle2,
    className:
      'border-emerald-100 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200',
    iconClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
  },
  rejected: {
    titleKey: 'applications_next_rejected_title',
    descKey: 'applications_next_rejected_desc',
    icon: Search,
    className:
      'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300',
    iconClassName: 'bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
  },
};

const FILTER_STATUSES: FilterStatus[] = APPLICATION_FILTER_GROUPS;

const SORT_OPTIONS: ApplicationSortKey[] = ['newest', 'match', 'title'];

function filterLabel(status: FilterStatus, t: (k: string) => string): string {
  return t(APPLICATION_FILTER_LABEL_KEYS[status]);
}

function sortLabel(sort: ApplicationSortKey, t: (k: string) => string): string {
  return t(`applications_sort_${sort}`);
}

// ─── Progress Timeline ────────────────────────────────────────────────────────

interface ProgressTimelineProps {
  status: ApplicationPipelineStatus;
  t: (k: string) => string;
}

type MainStageState = 'done' | 'current' | 'pending' | 'closed';

const MAIN_STAGE_CLASSES: Record<MainStageState, {
  circle: string;
  label: string;
  connector: string;
}> = {
  done: {
    circle: 'bg-emerald-600 text-white ring-4 ring-emerald-100 dark:bg-emerald-500 dark:ring-emerald-950/70',
    label: 'text-emerald-700 dark:text-emerald-300',
    connector: 'bg-emerald-200 dark:bg-emerald-900/70',
  },
  current: {
    circle: 'bg-blue-600 text-white ring-4 ring-blue-100 dark:bg-blue-500 dark:ring-blue-950/70',
    label: 'text-blue-700 dark:text-blue-300',
    connector: 'bg-blue-200 dark:bg-blue-900/70',
  },
  pending: {
    circle: 'bg-blue-100 text-blue-300 ring-4 ring-blue-50 dark:bg-blue-950/60 dark:text-blue-700 dark:ring-blue-950/40',
    label: 'text-slate-500 dark:text-slate-400',
    connector: 'border-t-2 border-dashed border-blue-100 dark:border-blue-950',
  },
  closed: {
    circle: 'bg-slate-200 text-slate-500 ring-4 ring-slate-100 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-800',
    label: 'text-slate-400 line-through decoration-slate-300 dark:text-slate-500 dark:decoration-slate-700',
    connector: 'border-t-2 border-dashed border-slate-200 dark:border-slate-700',
  },
};

const SUB_STAGE_CLASSES: Record<MainStageState, string> = {
  done: 'bg-emerald-500 text-white dark:bg-emerald-400 dark:text-slate-950',
  current: 'bg-blue-600 text-white ring-4 ring-blue-100 dark:bg-blue-500 dark:ring-blue-950/70',
  pending: 'bg-blue-100 text-blue-300 dark:bg-blue-950/70 dark:text-blue-700',
  closed: 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};

const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ status, t }) => {
  const current = getApplicationStatusIndex(status);
  const isComplete = isApplicationHiredStatus(status);
  const isRejected = isApplicationRejectedStatus(status);
  const normalized = normalizeApplicationStatus(status);

  return (
    <div className="mt-5 overflow-x-auto pb-2" aria-label={t('applications_timeline_label')}>
      <div className="min-w-0 rounded-lg bg-slate-50 px-4 py-5 dark:bg-slate-900/70 sm:min-w-[820px]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-0">
          {APPLICATION_PROGRESS_GROUPS.map((group, groupIndex) => {
            const lastIndex = getApplicationStatusIndex(group.statuses[group.statuses.length - 1]);
            const groupContainsCurrent = group.statuses.some((stageStatus) => stageStatus === normalized);
            const groupState: MainStageState = isRejected
              ? 'closed'
              : current > lastIndex || (isComplete && current >= lastIndex)
                ? 'done'
                : groupContainsCurrent
                  ? 'current'
                  : 'pending';
            const hasSubStages = group.statuses.length > 1;
            const groupClasses = MAIN_STAGE_CLASSES[groupState];
            const connectorDone = !isRejected && current > lastIndex;

            return (
              <React.Fragment key={group.id}>
                <div className="w-full shrink-0 sm:w-44">
                  <p className={`text-center text-sm font-semibold leading-5 ${groupClasses.label}`}>
                    {t(group.labelKey)}
                  </p>
                  <div className="mt-2 flex justify-center">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${groupClasses.circle}`}>
                      {groupState === 'done' ? <CheckCircle2 className="h-4 w-4" /> : groupIndex + 1}
                    </span>
                  </div>

                  {hasSubStages && (
                    <div className="mx-auto mt-4 w-full max-w-[220px] sm:max-w-[150px]">
                      <div className="relative space-y-3">
                        <span
                          aria-hidden="true"
                          className={`absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px ${
                            groupState === 'done' || groupState === 'current'
                              ? 'bg-blue-100 dark:bg-blue-950'
                              : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        />
                        {group.statuses.map((stageStatus) => {
                          const stage = APPLICATION_PIPELINE_STAGES.find((item) => item.status === stageStatus);
                          const stageIndex = getApplicationStatusIndex(stageStatus);
                          const stageState: MainStageState = isRejected
                            ? 'closed'
                            : stageIndex < current || (isComplete && stageIndex <= current)
                              ? 'done'
                              : stageIndex === current
                                ? 'current'
                                : 'pending';

                          return (
                            <div key={stageStatus} className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-2">
                              <span className={`mt-1 h-3.5 w-3.5 rounded-full ${SUB_STAGE_CLASSES[stageState]}`}>
                                {stageState === 'done' && <CheckCircle2 className="h-3.5 w-3.5" />}
                              </span>
                              <span
                                className={`text-xs leading-5 ${
                                  stageState === 'current'
                                    ? 'font-semibold text-blue-700 dark:text-blue-300'
                                    : stageState === 'done'
                                      ? 'font-medium text-slate-600 dark:text-slate-300'
                                      : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {stage ? t(stage.labelKey) : stageStatus}
                                {stage && 'optional' in stage && stage.optional && (
                                  <span className="ml-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                    {t('applications_stage_optional')}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {'noteKey' in group && group.noteKey && (
                        <p className="mt-3 rounded-md border border-blue-100 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500 dark:border-blue-950 dark:bg-slate-950 dark:text-slate-400">
                          {t(group.noteKey)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {groupIndex < APPLICATION_PROGRESS_GROUPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className={`mt-[42px] hidden h-0.5 w-12 shrink-0 rounded-full sm:block ${
                      connectorDone
                        ? MAIN_STAGE_CLASSES.done.connector
                        : MAIN_STAGE_CLASSES.pending.connector
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Application Card ─────────────────────────────────────────────────────────

interface CardProps {
  app: ApplicationRow;
  t: (k: string) => string;
  onFindSimilar: () => void;
}

const ApplicationCard: React.FC<CardProps> = ({ app, t, onFindSimilar }) => {
  const statusGroup = getApplicationStatusGroup(app.status);
  const isRejected = isApplicationRejectedStatus(app.status);
  const isHired = isApplicationHiredStatus(app.status);
  const guidance = STATUS_GUIDANCE[statusGroup];
  const GuidanceIcon = guidance.icon;
  const [reviewOpen, setReviewOpen] = useState(false);
  const currentStatusLabel = t(getApplicationStatusLabelKey(app.status));

  return (
    <div
      className={`relative rounded-2xl border p-5 shadow-sm transition-all animate-fade-in sm:p-6 ${
        isRejected
          ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60'
          : 'border-gray-100 bg-white hover:border-blue-100 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-800/50'
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:flex-1">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('applications_meta_applied_on')}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
              {formatDate(app)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('applications_meta_role')}
            </p>
            <p className="mt-1 truncate text-base font-semibold text-slate-900 dark:text-slate-100">
              {app.job_title || t('applications_unknown_role')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CHIP_CLASSES[statusGroup]}`}
          >
            {currentStatusLabel}
          </span>
          {app.compatibility_score != null && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {t('applications_match')} {app.compatibility_score}%
            </span>
          )}
        </div>
      </div>

      <div className={`mt-5 rounded-lg border px-4 py-4 text-sm leading-relaxed ${guidance.className}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-7">
              {formatTranslation(t('applications_current_status'), { status: currentStatusLabel })}
            </p>
            <p className="mt-2 max-w-3xl opacity-90">{t(guidance.descKey)}</p>
          </div>
          <span className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:flex ${guidance.iconClassName}`}>
            <GuidanceIcon className="h-6 w-6" />
          </span>
        </div>
      </div>

      {app.last_status_note && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/20">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-200">
            <MessageSquare className="h-3.5 w-3.5" />
            {t('applications_employer_note_label')}
          </p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-blue-900/90 dark:text-blue-100/90">{app.last_status_note}</p>
        </div>
      )}

      <ProgressTimeline status={app.status} t={t} />

      {isHired && app.employer_id && (
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            aria-label={t('review_company_button')}
            className="flex items-center gap-1 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 rounded-lg px-2 py-1 transition-colors"
          >
            <Star className="h-3 w-3" />
            {t('review_company_button')}
          </button>
        </div>
      )}

      {/* Rejected: process-ended label + find-similar CTA */}
      {isRejected && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-400 dark:text-slate-500 italic">
            {t('applications_process_ended')}
          </span>
          <button
            type="button"
            onClick={onFindSimilar}
            aria-label={t('applications_find_similar')}
            className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg px-2 py-1 transition-colors"
          >
            <Search className="h-3 w-3" />
            {t('applications_find_similar')}
          </button>
        </div>
      )}

      {/* Review modal */}
      {reviewOpen && app.employer_id && (
        <CompanyReviewModal
          employerId={app.employer_id}
          companyLabel={t('review_company_generic')}
          t={t}
          onClose={() => setReviewOpen(false)}
          onSubmitted={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface MyApplicationsProps {
  session: Session | null;
  t: (k: string) => string;
  onFindSimilar: () => void;
}

const MyApplications: React.FC<MyApplicationsProps> = ({ session, t, onFindSimilar }) => {
  const uid = session?.user?.id ?? null;
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('All');
  const [queryText, setQueryText] = useState('');
  const [sortKey, setSortKey] = useState<ApplicationSortKey>('newest');

  // ── Notifications state ───────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeNotifications(uid, setNotifications);
    return () => unsub();
  }, [uid]);

  // ── Counts, search, sort ──────────────────────────────────────────────────
  const counts: Record<FilterStatus, number> = useMemo(() => ({
    All: apps.length,
    applied: apps.filter((a) => getApplicationStatusGroup(a.status) === 'applied').length,
    interview: apps.filter((a) => getApplicationStatusGroup(a.status) === 'interview').length,
    offer: apps.filter((a) => getApplicationStatusGroup(a.status) === 'offer').length,
    hired: apps.filter((a) => getApplicationStatusGroup(a.status) === 'hired').length,
    rejected: apps.filter((a) => getApplicationStatusGroup(a.status) === 'rejected').length,
  }), [apps]);

  const activeCount = apps.filter((app) => !isApplicationClosedStatus(app.status)).length;
  const hasActiveFilters = filter !== 'All' || queryText.trim().length > 0;

  const visible = useMemo(() => {
    const keyword = normalizeFilterText(queryText);
    const rows = apps.filter((app) => {
      if (!applicationMatchesFilter(app.status, filter)) return false;
      if (!keyword) return true;
      return normalizeFilterText([
        app.job_title ?? '',
        t(getApplicationStatusLabelKey(app.status)),
        String(app.compatibility_score ?? ''),
      ].join(' ')).includes(keyword);
    });

    return [...rows].sort((a, b) => {
      if (sortKey === 'match') {
        return (b.compatibility_score ?? -1) - (a.compatibility_score ?? -1);
      }
      if (sortKey === 'title') {
        return (a.job_title ?? '').localeCompare(b.job_title ?? '');
      }
      return applicationTime(b) - applicationTime(a);
    });
  }, [apps, filter, queryText, sortKey]);

  const clearFilters = () => {
    setFilter('All');
    setQueryText('');
    setSortKey('newest');
  };

  const handleMarkRead = (id: string) => {
    if (!uid) return;
    markNotificationRead(uid, id).catch(() => {/* best-effort */});
    // Optimistic update
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => handleMarkRead(n.id));
  };

  const badge = unreadCount(notifications);

  useEffect(() => {
    if (!notifOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [notifOpen]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(firestoreDb, 'job_applications'), where('candidate_id', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            job_title: String(data.job_title ?? ''),
            employer_id: typeof data.employer_id === 'string' ? data.employer_id : undefined,
            status: normalizeApplicationStatus(data.status),
            application_date: data.application_date as ApplicationRow['application_date'],
            compatibility_score: typeof data.compatibility_score === 'number' ? data.compatibility_score : null,
            last_status_note: typeof data.last_status_note === 'string' ? data.last_status_note : null,
          } satisfies ApplicationRow;
        });
        rows.sort(
          (a, b) => (b.application_date?.toMillis?.() ?? 0) - (a.application_date?.toMillis?.() ?? 0),
        );
        setApps(rows);
        setLoading(false);
      },
      () => {
        setLoadError(true);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [uid]);

  // ── Signed-out ────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t('applications_signin_prompt')}
        </p>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6 gap-3">
        <p className="text-red-500 dark:text-red-400 text-sm font-semibold">
          {t('applications_error_title')}
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-xs">
          {t('applications_error_desc')}
        </p>
      </div>
    );
  }

  const summaryCards = [
    { label: t('applications_summary_total'), value: counts.All, helper: t('applications_summary_total_desc') },
    { label: t('applications_summary_active'), value: activeCount, helper: t('applications_summary_active_desc') },
    { label: t('applications_summary_interviews'), value: counts.interview, helper: t('applications_summary_interviews_desc') },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* ── Header ── */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
              {t('applications_title')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t('applications_subtitle')}
            </p>
          </div>

          {/* ── Notifications bell ── */}
          <div ref={notificationMenuRef} className="relative flex-shrink-0 mt-1">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-700 transition-colors shadow-sm"
              aria-label={t('notifications_bell_label')}
              aria-haspopup="menu"
              aria-expanded={notifOpen}
            >
              <Bell className="h-5 w-5" />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>

            {/* Dropdown panel */}
            {notifOpen && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl z-30 animate-fade-scale">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t('notifications_panel_title')}
                </span>
                <div className="flex items-center gap-2">
                  {badge > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t('notifications_mark_all_read')}
                    </button>
                  )}
                  <button
                    onClick={() => setNotifOpen(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-400 dark:text-slate-500"
                    aria-label={t('notifications_close')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700/60">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-gray-400 dark:text-slate-500">
                    {t('notifications_empty')}
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                        n.read
                          ? 'bg-white dark:bg-slate-800'
                          : 'bg-blue-50/50 dark:bg-blue-900/10'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {n.job_title ?? t('notifications_unknown_job')}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                          {t('notifications_status_changed').replace('{status}', t(getApplicationStatusLabelKey(n.status)))}
                        </p>
                        {n.candidate_note && (
                          <p className="mt-1 rounded-md bg-blue-100/60 px-2 py-1 text-[11px] leading-5 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100">
                            “{n.candidate_note}”
                          </p>
                        )}
                      </div>
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="flex-shrink-0 mt-0.5 h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400 hover:bg-blue-400 transition-colors"
                          title={t('notifications_mark_read')}
                          aria-label={t('notifications_mark_read')}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">{card.value}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{card.helper}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Search, sort, filters ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <label htmlFor="applications-search" className="sr-only">
              {t('applications_search_label')}
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="applications-search"
              type="search"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder={t('applications_search_placeholder')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-900 dark:focus:ring-blue-900/40"
            />
          </div>

          <label className="relative block">
            <span className="sr-only">{t('applications_sort_label')}</span>
            <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as ApplicationSortKey)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-blue-500 dark:focus:bg-slate-900 dark:focus:ring-blue-900/40"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>{sortLabel(option, t)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('applications_filter_label')}>
            {FILTER_STATUSES.map((s) => {
              const isActive = filter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    isActive
                      ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:border-blue-700'
                  }`}
                >
                  {filterLabel(s, t)}
                  <span
                    className={`rounded-full px-1.5 py-0 text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {counts[s]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {formatTranslation(t('applications_filter_summary'), {
                shown: visible.length,
                total: apps.length,
              })}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('applications_clear_filters')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Empty state ── */}
      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Briefcase className="h-8 w-8 text-blue-400 dark:text-blue-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-200">
              {t('applications_empty_title')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('applications_empty_desc')}
            </p>
          </div>
          <button
            onClick={onFindSimilar}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 transition-colors shadow-sm"
          >
            <Search className="h-4 w-4" />
            {t('applications_empty_cta')}
          </button>
        </div>
      ) : visible.length === 0 ? (
        /* Filtered-to-zero state */
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <p className="font-semibold text-slate-700 dark:text-slate-200">{t('applications_filter_empty')}</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5">{t('applications_filter_empty_desc')}</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <RotateCcw className="h-4 w-4" />
            {t('applications_clear_filters')}
          </button>
        </div>
      ) : (
        /* ── Application cards ── */
        <div className="grid gap-4">
          {visible.map((app) => (
            <ApplicationCard key={app.id} app={app} t={t} onFindSimilar={onFindSimilar} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyApplications;
