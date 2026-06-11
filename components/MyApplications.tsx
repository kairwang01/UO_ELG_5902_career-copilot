import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebaseClient';
import type { AppSession as Session } from '../lib/data';
import { Bell, Briefcase, CheckCircle2, Circle, Search, Star, X } from 'lucide-react';
import CompanyReviewModal from './CompanyReviewModal';
import {
  subscribeNotifications,
  markNotificationRead,
  unreadCount,
  type AppNotification,
} from '../lib/notificationsData';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppStatus = 'Applied' | 'Interviewing' | 'Rejected' | 'Hired';

interface ApplicationRow {
  id: string;
  job_title: string;
  employer_id?: string;
  status: AppStatus;
  application_date?: { toMillis?: () => number; toDate?: () => Date };
  compatibility_score?: number | null;
}

type FilterStatus = 'All' | AppStatus;

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

/** Map a status to the 3-step stepper's active step index (0-based) */
function stepIndexForStatus(status: AppStatus): number {
  if (status === 'Applied') return 0;
  if (status === 'Interviewing') return 1;
  // Hired or Rejected → step 2
  return 2;
}

const STATUS_LABEL_KEYS: Record<AppStatus, string> = {
  Applied: 'applications_status_applied',
  Interviewing: 'applications_status_interviewing',
  Hired: 'applications_status_hired',
  Rejected: 'applications_status_rejected',
};

const STATUS_CHIP_CLASSES: Record<AppStatus, string> = {
  Applied:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Interviewing:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Hired: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Rejected:
    'bg-gray-100 text-gray-500 dark:bg-slate-700/50 dark:text-slate-400',
};

const FILTER_STATUSES: FilterStatus[] = [
  'All',
  'Applied',
  'Interviewing',
  'Hired',
  'Rejected',
];

// ─── Stepper ──────────────────────────────────────────────────────────────────

interface StepperProps {
  status: AppStatus;
  t: (k: string) => string;
}

const Stepper: React.FC<StepperProps> = ({ status, t }) => {
  const current = stepIndexForStatus(status);
  const isHired = status === 'Hired';
  const isRejected = status === 'Rejected';

  const steps = [
    t('applications_step_applied'),
    t('applications_step_interviewing'),
    isHired
      ? t('applications_status_hired')
      : isRejected
      ? t('applications_status_rejected')
      : t('applications_step_decision'),
  ];

  return (
    <div className="flex items-center gap-0 mt-3">
      {steps.map((label, i) => {
        const isDone = i < current || (i === current && (isHired || isRejected));
        const isCurrent = i === current && !isHired && !isRejected;
        const isPending = i > current;

        // Color logic
        let circleClass = '';
        if (isHired && i === 2) {
          circleClass =
            'bg-green-600 border-green-600 text-white dark:bg-green-500 dark:border-green-500';
        } else if (isRejected && i === 2) {
          circleClass =
            'bg-gray-400 border-gray-400 text-white dark:bg-slate-500 dark:border-slate-500';
        } else if (isDone) {
          circleClass =
            'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500';
        } else if (isCurrent) {
          circleClass =
            'border-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-slate-800';
        } else {
          circleClass =
            'border-2 border-gray-300 text-gray-400 dark:border-slate-600 dark:text-slate-500 bg-white dark:bg-slate-800';
        }

        let labelClass = '';
        if (isHired && i === 2) {
          labelClass = 'text-green-600 dark:text-green-400 font-semibold';
        } else if (isRejected && i === 2) {
          labelClass = 'text-gray-400 dark:text-slate-500';
        } else if (isCurrent) {
          labelClass = 'text-blue-600 dark:text-blue-400 font-semibold';
        } else if (isPending) {
          labelClass = 'text-gray-400 dark:text-slate-500';
        } else {
          labelClass = 'text-gray-600 dark:text-gray-300';
        }

        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1 min-w-0" style={{ flex: '0 0 auto', maxWidth: '6rem' }}>
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors ${circleClass}`}
              >
                {isDone && !isPending ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isCurrent ? (
                  <span>{i + 1}</span>
                ) : (
                  <Circle className="h-3.5 w-3.5 opacity-40" />
                )}
              </div>
              <span className={`text-[9px] text-center leading-tight truncate w-full text-center ${labelClass}`}>
                {label}
              </span>
            </div>

            {/* Connector line between steps */}
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mb-4 mx-1 rounded-full transition-colors ${
                  i < current
                    ? 'bg-blue-400 dark:bg-blue-600'
                    : 'bg-gray-200 dark:bg-slate-700'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
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
  const isRejected = app.status === 'Rejected';
  const isHired = app.status === 'Hired';
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <div
      className={`relative bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm transition-all ${
        isRejected ? 'opacity-[0.57] grayscale' : 'hover:shadow-md hover:border-blue-100 dark:hover:border-blue-800/50'
      }`}
    >
      {/* Top row: title + status chip */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate leading-snug">
            {app.job_title}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
            {formatDate(app)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {/* Status chip */}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CHIP_CLASSES[app.status]}`}
          >
            {t(STATUS_LABEL_KEYS[app.status])}
          </span>

          {/* Match % badge */}
          {app.compatibility_score != null && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {t('applications_match')} {app.compatibility_score}%
            </span>
          )}
        </div>
      </div>

      {/* 3-step stepper */}
      <Stepper status={app.status} t={t} />

      {/* Hired: review company CTA */}
      {isHired && app.employer_id && (
        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={() => setReviewOpen(true)}
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
            onClick={onFindSimilar}
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

  // ── Notifications state ───────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeNotifications(uid, setNotifications);
    return () => unsub();
  }, [uid]);

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
    if (!uid) return;
    const q = query(collection(firestoreDb, 'job_applications'), where('candidate_id', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApplicationRow));
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

  // ── Counts for filter chips ────────────────────────────────────────────────
  const counts: Record<FilterStatus, number> = {
    All: apps.length,
    Applied: apps.filter((a) => a.status === 'Applied').length,
    Interviewing: apps.filter((a) => a.status === 'Interviewing').length,
    Hired: apps.filter((a) => a.status === 'Hired').length,
    Rejected: apps.filter((a) => a.status === 'Rejected').length,
  };

  const visible = filter === 'All' ? apps : apps.filter((a) => a.status === filter);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {t('applications_title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
                          {t('notifications_status_changed').replace('{status}', n.status ?? '')}
                        </p>
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

      {/* ── Filter chips ── */}
      <div className="flex flex-wrap gap-2">
        {FILTER_STATUSES.map((s) => {
          const isActive = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
              }`}
            >
              {s === 'All' ? t('applications_filter_all') : s}
              <span
                className={`text-[10px] rounded-full px-1.5 py-0 font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                }`}
              >
                {counts[s]}
              </span>
            </button>
          );
        })}
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
          <p>{t('applications_filter_empty')}</p>
          <button
            type="button"
            onClick={onFindSimilar}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Search className="h-4 w-4" />
            {t('applications_empty_cta')}
          </button>
        </div>
      ) : (
        /* ── Application cards ── */
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
          {visible.map((app) => (
            <ApplicationCard key={app.id} app={app} t={t} onFindSimilar={onFindSimilar} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyApplications;
