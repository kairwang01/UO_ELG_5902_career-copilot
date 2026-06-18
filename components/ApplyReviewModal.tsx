import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, FileText, GraduationCap, CheckCircle2, AlertCircle, Loader2, X, ShieldCheck } from 'lucide-react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { loadTalentProfile } from '../services/talentProfile';
import { isTalentProfileReady, hasMeaningfulEntry, type TalentProfile } from '../lib/talentProfile';
import { data } from '../lib/data';

export interface ApplyReviewJob {
  id: string;
  title: string;
  company?: string;
}

interface ApplyReviewModalProps {
  open: boolean;
  job: ApplyReviewJob | null;
  uid: string;
  t: (key: string) => string;
  /** Performs the real submission (createJobApplication). Resolves when done. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
  /** Optional: jump to the Talent Profile editor (used when info is incomplete). */
  onEditProfile?: () => void;
}

const countMeaningful = (list: Record<string, string | string[]>[] | undefined): number =>
  Array.isArray(list) ? list.filter(hasMeaningfulEntry).length : 0;

const countSkills = (profile: TalentProfile | null): number =>
  profile ? Object.values(profile.skills ?? {}).reduce((sum, group) => sum + (group?.length ?? 0), 0) : 0;

/**
 * Pre-submit confirmation: before a candidate's application is actually created,
 * they re-review exactly what the employer will receive (name, resume, structured
 * Talent Profile) and explicitly confirm. Used by every apply entry point so the
 * "review then submit" step is consistent across the product.
 */
const ApplyReviewModal: React.FC<ApplyReviewModalProps> = ({ open, job, uid, t, onConfirm, onClose, onEditProfile }) => {
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [hasResumeText, setHasResumeText] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Keep the body-scroll lock for the whole time the modal is open (not just
  // while idle); only suppress Esc-to-close mid-submit via the guard.
  const handleModalClose = useCallback(() => { if (!submitting) onClose(); }, [submitting, onClose]);
  useModalBehavior(handleModalClose, open);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    setProfile(null);
    setResumeFileName(null);
    setHasResumeText(false);
    Promise.all([loadTalentProfile(uid), data.profiles.get(uid)])
      .then(([tp, profileRes]) => {
        if (!active) return;
        // data.profiles.get resolves with { error } instead of throwing — treat a
        // real read error as a load failure rather than silently showing "no resume".
        if (profileRes.error) { setLoadError(true); setLoading(false); return; }
        setProfile(tp);
        const user = profileRes.data;
        setResumeFileName(user?.resume_file_name ?? null);
        setHasResumeText(Boolean(user?.resume_text && user.resume_text.trim().length > 0));
        setLoading(false);
      })
      .catch(() => {
        if (active) { setLoadError(true); setLoading(false); }
      });
    return () => { active = false; };
  }, [open, uid]);

  const ready = useMemo(() => isTalentProfileReady(profile), [profile]);
  const name = profile?.basic?.name?.trim() || '';
  const targetRole = typeof profile?.intention?.targetRole === 'string' ? profile.intention.targetRole.trim() : '';
  const eduCount = countMeaningful(profile?.education);
  const expCount = countMeaningful(profile?.experience);
  const projCount = countMeaningful(profile?.projects);
  const skillCount = countSkills(profile);

  if (!open || !job) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !submitting) onClose();
  };

  const handleConfirm = async () => {
    if (submitting || !ready) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      // The parent closes the modal on success; reset so a re-open is clean.
      setSubmitting(false);
    }
  };

  const handleEdit = () => {
    onClose();
    onEditProfile?.();
  };

  const resumeStatus = resumeFileName
    ? resumeFileName
    : hasResumeText
      ? t('apply_review_resume_text_only')
      : t('apply_review_resume_none');

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[95] p-4 animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-review-title"
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] overflow-y-auto animate-fade-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="min-w-0">
            <h2 id="apply-review-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('apply_review_title')}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('apply_review_subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={t('apply_review_cancel')}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Job */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
            <Briefcase className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{job.title}</p>
              {job.company && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{job.company}</p>}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('apply_review_loading')}
            </div>
          ) : loadError ? (
            <div className="py-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-amber-500" />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('apply_review_load_error')}</p>
            </div>
          ) : (
            <>
              {/* What the employer will receive */}
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {t('apply_review_section_profile')}
              </p>
              <dl className="space-y-2.5 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
                <Row label={t('apply_review_name')} value={name || '—'} />
                <Row label={t('apply_review_target_role')} value={targetRole || '—'} />
                <Row
                  label={t('apply_review_resume')}
                  value={resumeStatus}
                  icon={<FileText className="h-3.5 w-3.5 text-slate-400" />}
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Stat icon={<GraduationCap className="h-3.5 w-3.5" />} label={t('apply_review_education')} count={eduCount} />
                  <Stat icon={<Briefcase className="h-3.5 w-3.5" />} label={t('apply_review_experience')} count={expCount} />
                  <Stat label={t('apply_review_projects')} count={projCount} />
                  <Stat label={t('apply_review_skills')} count={skillCount} />
                </div>
              </dl>

              {!ready && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4" />
                    {t('apply_review_incomplete_title')}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-amber-800/90 dark:text-amber-200/90">
                    {!name && <li>• {t('apply_review_need_name')}</li>}
                    {!targetRole && <li>• {t('apply_review_need_target')}</li>}
                    {eduCount === 0 && expCount === 0 && <li>• {t('apply_review_need_history')}</li>}
                  </ul>
                  {!onEditProfile && (
                    <p className="mt-2 text-xs font-medium text-amber-800/90 dark:text-amber-200/90">{t('apply_review_sidebar_hint')}</p>
                  )}
                </div>
              )}

              <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                {t('apply_review_employer_note')}
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-700">
          {!loading && !loadError && !ready && onEditProfile && (
            <button
              type="button"
              onClick={handleEdit}
              className="mr-auto text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {t('apply_review_edit_profile')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t('apply_review_cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || loading || loadError || !ready}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('apply_review_submitting')}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {t('apply_review_confirm')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">{label}</dt>
    <dd className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
      {icon}
      <span className="truncate">{value}</span>
    </dd>
  </div>
);

const Stat: React.FC<{ label: string; count: number; icon?: React.ReactNode }> = ({ label, count, icon }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
      count > 0
        ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
        : 'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
    }`}
  >
    {icon}
    {label}: {count}
  </span>
);

export default ApplyReviewModal;
