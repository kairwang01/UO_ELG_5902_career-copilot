

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Briefcase,
    ChevronDown,
    Clock3,
    Download,
    Eye,
    FileWarning,
    GraduationCap,
    Link as LinkIcon,
    MessageSquare,
    RotateCcw,
    Search,
    SlidersHorizontal,
    Sparkles,
    Star,
    Target,
    Users,
    X,
} from 'lucide-react';
import {
    listJobApplicants,
    getApplicantResumeFile,
    getApplicantResumeText,
    updateApplicationStatus,
    type JobApplicant,
} from '../services/aiClient';
import { saveToShortlist } from '../lib/shortlistData';
import { TALENT_PROFILE_SCHEMA, hasMeaningfulEntry, type Section, type TalentProfile } from '../lib/talentProfile';
import { useToast } from './Toast';
import ResumePreview from './ResumePreview';
import FunnelChart from './FunnelChart';
import { useModalBehavior } from '../hooks/useModalBehavior';
import {
    APPLICATION_PIPELINE_STAGES,
    getApplicationStatusIndex,
    getApplicationStatusLabelKey,
    getNextApplicationPipelineStatus,
    isApplicationRejectedStatus,
    normalizeApplicationStatus,
    type ApplicationPipelineStatus,
} from '../lib/applicationPipeline';
import type { JobPosting } from '../lib/recruitingData';

interface ApplicantFunnelProps {
  job: JobPosting;
  employerUid: string;
  onBack: () => void;
  t: (key: string) => string;
}

// Server-computed safe shape: match analysis is flattened onto each applicant;
// resume_text never reaches the browser (see services/aiClient listJobApplicants).
type Applicant = JobApplicant;

type ScoreThreshold = 'all' | '50' | '70' | '85';
type SortKey = 'score' | 'newest' | 'name';
type RecencyFilter = 'all' | '7' | '30';
type AnalysisFilter = 'all' | 'analyzed' | 'needs_review';
type QuickFilterKey = 'all' | 'high_match' | 'recent' | 'needs_review';
type RecommendationTone = 'strong' | 'screen' | 'review';

const SCORE_OPTIONS: ScoreThreshold[] = ['all', '50', '70', '85'];
const SORT_OPTIONS: SortKey[] = ['score', 'newest', 'name'];
const RECENCY_OPTIONS: RecencyFilter[] = ['all', '7', '30'];
const ANALYSIS_OPTIONS: AnalysisFilter[] = ['all', 'analyzed', 'needs_review'];
const SELECT_CLASS = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
const RECOMMENDATION_TONE_CLASS: Record<RecommendationTone, string> = {
    strong: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100',
    screen: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-100',
    review: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100',
};

function formatTranslation(template: string, values: Record<string, string | number>): string {
    return Object.entries(values).reduce(
        (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
        template,
    );
}

function hasApplicantAnalysis(applicant: Applicant): boolean {
    return Boolean(
        applicant.summary ||
        applicant.strengths.length > 0 ||
        applicant.potentialGaps.length > 0 ||
        applicant.suggestedQuestions.length > 0 ||
        (applicant.compatibility_score ?? 0) > 0,
    );
}

function formatTalentValue(value: unknown): string {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join(', ');
    return typeof value === 'string' ? value.trim() : '';
}

function talentEntries(record: unknown): Array<[string, string]> {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
    return Object.entries(record as Record<string, unknown>)
        .map(([key, value]) => [key, formatTalentValue(value)] as [string, string])
        .filter(([, value]) => value.length > 0);
}

function talentProfileHasData(profile: TalentProfile | null | undefined): boolean {
    if (!profile) return false;
    const data = profile as unknown as Record<string, unknown>;
    return TALENT_PROFILE_SCHEMA.some((section) => {
        const sectionData = data[section.id];
        if (section.kind === 'skills') {
            return Object.values(profile.skills ?? {}).some((values) => values.length > 0);
        }
        if (section.kind === 'list') {
            return Array.isArray(sectionData) && sectionData.some((item) => hasMeaningfulEntry(item as Record<string, string | string[]>));
        }
        return talentEntries(sectionData).length > 0;
    });
}

function talentProfileSearchTokens(profile: TalentProfile | null | undefined): string[] {
    if (!profile) return [];
    const tokens: string[] = [];
    const data = profile as unknown as Record<string, unknown>;
    for (const section of TALENT_PROFILE_SCHEMA) {
        const sectionData = data[section.id];
        if (section.kind === 'skills') {
            Object.values(profile.skills ?? {}).forEach((values) => tokens.push(...values));
        } else if (section.kind === 'list' && Array.isArray(sectionData)) {
            sectionData.forEach((entry) => talentEntries(entry).forEach(([, value]) => tokens.push(value)));
        } else {
            talentEntries(sectionData).forEach(([, value]) => tokens.push(value));
        }
    }
    return tokens;
}

function collectTalentSkills(profile: TalentProfile | null | undefined): string[] {
    if (!profile?.skills) return [];
    return Object.values(profile.skills).flat().filter(Boolean).slice(0, 10);
}

function getTalentCurrentRole(profile: TalentProfile | null | undefined): string | undefined {
    const targetRole = typeof profile?.intention?.targetRole === 'string' ? profile.intention.targetRole.trim() : '';
    // Experience entries are stored in the order the candidate added them (not
    // date-sorted), so experience[0] is NOT necessarily the current role. Prefer
    // an ongoing role (no end date), else the most recent by end/start date.
    const exp = (profile?.experience ?? []).filter((e) => typeof e?.role === 'string' && e.role.trim());
    const dateKey = (e: Record<string, string | string[]>) => String(e?.endDate || e?.startDate || '');
    const ongoing = exp.find((e) => !String(e?.endDate ?? '').trim());
    const byDate = [...exp].sort((a, b) => dateKey(b).localeCompare(dateKey(a)));
    const latestRole = String(ongoing?.role || byDate[0]?.role || '').trim();
    return targetRole || latestRole || undefined;
}

const TALENT_SECTION_ICONS: Record<string, React.ElementType> = {
    basic: Users,
    intention: Target,
    education: GraduationCap,
    experience: Briefcase,
    projects: Sparkles,
    skills: BookOpen,
    awards: Star,
    portfolio: LinkIcon,
    references: MessageSquare,
    additional: FileWarning,
};

const TalentProfileSummary: React.FC<{ profile: TalentProfile | null | undefined; t: (key: string) => string }> = ({ profile, t }) => {
    // Render nothing when there is no structured profile — absence of the section
    // (and of the "Talent Profile" chip) already signals it. Avoids stacking a
    // dashed empty box above the separate "no analysis" placeholder.
    if (!talentProfileHasData(profile)) return null;

    const safeProfile = profile as TalentProfile;
    const data = safeProfile as unknown as Record<string, unknown>;
    const topSignals = [
        { label: t('applicant_funnel_talent_profile_target'), value: formatTalentValue(safeProfile.intention?.targetRole) },
        { label: t('applicant_funnel_talent_profile_location'), value: [safeProfile.basic?.city, safeProfile.basic?.country].map(formatTalentValue).filter(Boolean).join(', ') },
        {
            label: t('applicant_funnel_talent_profile_history'),
            value: String((safeProfile.education?.length ?? 0) + (safeProfile.experience?.length ?? 0)),
        },
        { label: t('applicant_funnel_talent_profile_skills'), value: String(collectTalentSkills(safeProfile).length) },
    ].filter((signal) => signal.value && signal.value !== '0');

    const renderSection = (section: Section) => {
        const Icon = TALENT_SECTION_ICONS[section.id] ?? FileWarning;
        if (section.kind === 'skills') {
            const groups = section.groups
                .map((group) => ({ ...group, values: safeProfile.skills?.[group.key] ?? [] }))
                .filter((group) => group.values.length > 0);
            if (groups.length === 0) return null;
            return (
                <div key={section.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <h5 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        {section.title}
                    </h5>
                    <div className="mt-3 space-y-3">
                        {groups.map((group) => (
                            <div key={group.key}>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.label}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {group.values.map((value) => (
                                        <span key={`${group.key}-${value}`} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                            {value}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (section.kind === 'list') {
            const items = Array.isArray(data[section.id]) ? data[section.id] as Record<string, string | string[]>[] : [];
            const meaningful = items.filter(hasMeaningfulEntry);
            if (meaningful.length === 0) return null;
            return (
                <div key={section.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <h5 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        {section.title}
                    </h5>
                    <div className="mt-3 space-y-3">
                        {meaningful.map((item, index) => {
                            const title = formatTalentValue(item[section.itemTitleKey]) || `${section.itemLabel} ${index + 1}`;
                            const rows = section.fields
                                .map((field) => [field.label, formatTalentValue(item[field.key])] as [string, string])
                                .filter(([, value]) => value.length > 0);
                            return (
                                <div key={`${section.id}-${index}`} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/70">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
                                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                                        {rows.map(([label, value]) => (
                                            <div key={`${label}-${value}`} className="min-w-0">
                                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</dt>
                                                <dd className="break-words text-sm leading-5 text-gray-700 dark:text-gray-300">{value}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        const rows = section.fields
            .map((field) => [field.label, formatTalentValue((data[section.id] as Record<string, unknown> | undefined)?.[field.key])] as [string, string])
            .filter(([, value]) => value.length > 0);
        if (rows.length === 0) return null;
        return (
            <div key={section.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <h5 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <Icon className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                    {section.title}
                </h5>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    {rows.map(([label, value]) => (
                        <div key={`${section.id}-${label}`} className="min-w-0">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</dt>
                            <dd className="break-words text-sm leading-5 text-gray-700 dark:text-gray-300">{value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        );
    };

    return (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">{t('applicant_funnel_talent_profile_title')}</h4>
                    <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">{t('applicant_funnel_talent_profile_desc')}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                    safeProfile.status === 'complete'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}>
                    {safeProfile.status === 'complete' ? t('applicant_funnel_talent_profile_complete') : t('applicant_funnel_talent_profile_draft')}
                </span>
            </div>

            {topSignals.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {topSignals.map((signal) => (
                        <div key={signal.label} className="rounded-lg bg-white px-3 py-2 dark:bg-gray-900/70">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{signal.label}</p>
                            <p className="mt-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{signal.value}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4 grid gap-3">
                {TALENT_PROFILE_SCHEMA.map(renderSection)}
            </div>
        </div>
    );
};

function isWithinDays(dateValue: string | null, days: number): boolean {
    if (!dateValue) return false;
    const timestamp = new Date(dateValue).getTime();
    if (Number.isNaN(timestamp)) return false;
    return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
}

function toApplicationTime(dateValue: string | null): number {
    if (!dateValue) return 0;
    const timestamp = new Date(dateValue).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

interface SelectFieldProps<T extends string> {
    id: string;
    label: string;
    value: T;
    onChange: (value: T) => void;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

function SelectField<T extends string>({
    id,
    label,
    value,
    onChange,
    children,
    className = '',
    disabled = false,
}: SelectFieldProps<T>) {
    return (
        <label className={`space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300 ${className}`}>
            <span>{label}</span>
            <select
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value as T)}
                disabled={disabled}
                className={SELECT_CLASS}
            >
                {children}
            </select>
        </label>
    );
}

interface StageControlProps {
    applicant: Applicant;
    statusOptions: ApplicationPipelineStatus[];
    statusSavingId: string | null;
    getStatusLabel: (status: string) => string;
    onStatusChange: (
        applicant: Applicant,
        nextStatusValue: string,
        meta?: { reason?: string; candidateNote?: string },
    ) => Promise<boolean>;
    t: (key: string) => string;
}

const StageControl: React.FC<StageControlProps> = ({
    applicant,
    statusOptions,
    statusSavingId,
    getStatusLabel,
    onStatusChange,
    t,
}) => {
    const [reason, setReason] = useState('');
    const [candidateNote, setCandidateNote] = useState('');
    const currentStatus = normalizeApplicationStatus(applicant.status);
    const nextStatus = getNextApplicationPipelineStatus(currentStatus);
    const isSaving = statusSavingId === applicant.id;
    const canAdvance = Boolean(nextStatus) && !isSaving && currentStatus !== 'Rejected';

    const submitStatusChange = async (targetStatus: string) => {
        if (targetStatus === currentStatus || isSaving) return;
        const ok = await onStatusChange(applicant, targetStatus, {
            reason,
            candidateNote,
        });
        if (ok) {
            setReason('');
            setCandidateNote('');
        }
    };

    const handleAdvance = () => {
        if (!nextStatus || isSaving) return;
        void submitStatusChange(nextStatus);
    };

    return (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <SelectField<ApplicationPipelineStatus>
                    id={`applicant-stage-${applicant.id}`}
                    label={t('applicant_funnel_stage_control_label')}
                    value={currentStatus}
                    onChange={(value) => void submitStatusChange(value)}
                    disabled={isSaving}
                >
                    {statusOptions.map(status => (
                        <option key={status} value={status}>{getStatusLabel(status)}</option>
                    ))}
                </SelectField>

                <button
                    type="button"
                    onClick={handleAdvance}
                    disabled={!canAdvance}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                >
                    <ArrowRight className="h-4 w-4" />
                    {nextStatus
                        ? formatTranslation(t('applicant_funnel_advance_to'), { status: getStatusLabel(nextStatus) })
                        : t('applicant_funnel_stage_final')}
                </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-blue-900 dark:text-blue-100">
                    <span>{t('applicant_funnel_status_reason_label')}</span>
                    <input
                        type="text"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        disabled={isSaving}
                        maxLength={500}
                        placeholder={t('applicant_funnel_status_reason_placeholder')}
                        className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-blue-900/60 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:disabled:bg-slate-900"
                    />
                </label>
                <label className="space-y-1 text-xs font-medium text-blue-900 dark:text-blue-100">
                    <span>{t('applicant_funnel_candidate_note_label')}</span>
                    <textarea
                        value={candidateNote}
                        onChange={(event) => setCandidateNote(event.target.value)}
                        disabled={isSaving}
                        maxLength={1000}
                        rows={2}
                        placeholder={t('applicant_funnel_candidate_note_placeholder')}
                        className="w-full resize-y rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-blue-900/60 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:disabled:bg-slate-900"
                    />
                </label>
            </div>
            <p className="mt-2 text-xs leading-5 text-blue-800/80 dark:text-blue-200/80">
                {isSaving
                    ? t('applicant_funnel_status_updating')
                    : nextStatus
                        ? t('applicant_funnel_stage_control_helper')
                        : t('applicant_funnel_stage_final_helper')}
            </p>
        </div>
    );
};

const ApplicantFunnel: React.FC<ApplicantFunnelProps> = ({ job, employerUid, onBack, t }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState(t('applicant_funnel_loading_initial'));
    const [error, setError] = useState<string | null>(null);
    const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
    const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null);
    const [viewingApplicant, setViewingApplicant] = useState<Applicant | null>(null);
    const [resumeViewText, setResumeViewText] = useState<string | null>(null);
    const [resumeViewLoading, setResumeViewLoading] = useState(false);
    const [resumeViewError, setResumeViewError] = useState<string | null>(null);
    const detailRef = useRef<HTMLElement | null>(null);

    // View an applicant's resume TEXT inline (server verifies the caller owns the
    // job the candidate applied to — same gate as the file download).
    const handleViewResume = async (applicant: Applicant) => {
        setViewingApplicant(applicant);
        setResumeViewText(null);
        setResumeViewError(null);
        setResumeViewLoading(true);
        try {
            const res = await getApplicantResumeText(applicant.id);
            setResumeViewText(res.resumeText ?? '');
        } catch (err) {
            setResumeViewError(err instanceof Error ? err.message : t('applicant_funnel_resume_view_error'));
        } finally {
            setResumeViewLoading(false);
        }
    };
    const closeResumeView = useCallback(() => {
        setViewingApplicant(null);
        setResumeViewText(null);
        setResumeViewError(null);
    }, []);
    // Match the app's modal standard: Esc-to-close + body scroll lock while open.
    useModalBehavior(closeResumeView, Boolean(viewingApplicant));

    // Download the original resume FILE of an applicant (server verifies the
    // caller owns the job the candidate applied to). Applicants who only pasted
    // text — and pre-feature applicants — return { available:false } gracefully.
    const handleDownloadResume = async (applicant: Applicant) => {
        if (downloadingResumeId) return;
        setDownloadingResumeId(applicant.id);
        try {
            const res = await getApplicantResumeFile(applicant.id);
            if (!res.available) {
                addToast(t('applicant_funnel_no_resume_file'), 'info');
                return;
            }
            // Preferred path: a short-lived signed URL (any file size). The server's
            // Content-Disposition forces the download with the original filename.
            if (res.url) {
                const a = document.createElement('a');
                a.href = res.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                a.remove();
                return;
            }
            // Fallback: inline base64 (small files / no URL signing available).
            if (res.base64) {
                const byteChars = atob(res.base64);
                const bytes = new Uint8Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i += 1) bytes[i] = byteChars.charCodeAt(i);
                const blob = new Blob([bytes], { type: res.contentType || 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = res.fileName || 'resume';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                return;
            }
            addToast(t('applicant_funnel_no_resume_file'), 'info');
        } catch (err) {
            addToast(err instanceof Error ? err.message : t('applicant_funnel_resume_download_error'), 'error');
        } finally {
            setDownloadingResumeId(null);
        }
    };

    // Save an applicant to the recruiter's shortlist (Biz12) — bookmark candidates
    // of interest from the review page so they appear in the Shortlist section.
    const handleSaveCandidate = async (applicant: Applicant) => {
        if (savedIds.has(applicant.id) || savingIds.has(applicant.id)) return;
        setSavingIds((prev) => new Set(prev).add(applicant.id));
        try {
            await saveToShortlist(employerUid, {
                candidate_name: applicant.candidate_name || t('applicant_funnel_unnamed_candidate'),
                candidate_snapshot: {
                    summary: typeof applicant.talent_profile?.additional?.overallStrengths === 'string'
                        ? applicant.talent_profile.additional.overallStrengths
                        : applicant.summary,
                    skills: collectTalentSkills(applicant.talent_profile).length > 0
                        ? collectTalentSkills(applicant.talent_profile)
                        : (applicant.strengths ?? []).slice(0, 10),
                    current_role: getTalentCurrentRole(applicant.talent_profile),
                },
                job_id: job.id,
                job_title: job.title,
                match_score: applicant.compatibility_score ?? 0,
                match_reasons: (applicant.strengths ?? []).slice(0, 10),
                missing_requirements: (applicant.potentialGaps ?? []).slice(0, 10),
                notes: '',
                status: 'saved',
                saved_by: employerUid,
            });
            setSavedIds((prev) => new Set(prev).add(applicant.id));
            addToast(t('shortlist_saved_toast'), 'success');
        } catch (err) {
            addToast(err instanceof Error ? err.message : t('shortlist_save_error'), 'error');
        } finally {
            setSavingIds((prev) => { const n = new Set(prev); n.delete(applicant.id); return n; });
        }
    };

    // ── Filter state ────────────────────────────────────────────────────────────
    const [keyword, setKeyword]         = useState('');
    const [minScore, setMinScore]       = useState<ScoreThreshold>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>('all');
    const [analysisFilter, setAnalysisFilter] = useState<AnalysisFilter>('all');
    // Default to chronological, NOT AI match score: ranking applicants by an AI
    // score by default reads as automated screening (EEOC/FTC/Ontario AI-hiring
    // scrutiny). The score stays available as an opt-in, advisory sort.
    const [sortKey, setSortKey]         = useState<SortKey>('newest');
    // Secondary refinements (status / recency / analysis) live behind a single
    // "Filters" disclosure to keep the rail card-first; tiles + search + sort stay visible.
    const [filtersOpen, setFiltersOpen] = useState(false);

    const fetchApplicants = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setLoadingMessage(t('applicant_funnel_loading_analyzing'));

            // Single server-side call: reads applications + resumes with the Admin
            // SDK, runs the match analysis on the server, and returns safe fields
            // only (already sorted by match score). Resumes never reach the browser.
            const { applicants: result } = await listJobApplicants(job.id);

            setApplicants(result);
            // Don't auto-spotlight the top AI-scored applicant (result is score-sorted) —
            // let the selection effect pick filteredApplicants[0], i.e. the chronologically
            // newest under the default 'newest' sort, consistent with the advisory-not-
            // automated-ranking compliance posture.
            setSelectedApplicant(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('applicant_funnel_load_error'));
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    }, [job.id, t]);

    useEffect(() => {
        fetchApplicants();
    }, [fetchApplicants]);

    // ── Real funnel stages derived from actual data ─────────────────────────────
    const funnelData = useMemo(() => APPLICATION_PIPELINE_STAGES.map((stage, index) => ({
        stage: `${t(stage.labelKey)}${'optional' in stage && stage.optional ? ` (${t('applications_stage_optional')})` : ''}`,
        count: applicants.filter((applicant) => {
            if (isApplicationRejectedStatus(applicant.status)) return false;
            const applicantIndex = getApplicationStatusIndex(applicant.status);
            return applicantIndex >= index;
        }).length,
    })), [applicants, t]);

    const statusOptions = useMemo<ApplicationPipelineStatus[]>(() => {
        return [...APPLICATION_PIPELINE_STAGES.map((stage) => stage.status), 'Rejected'];
    }, []);

    // ── Filtered + sorted list ──────────────────────────────────────────────────
    const filteredApplicants = useMemo(() => {
        let result = [...applicants];

        // Keyword filter across safe fields only. Resume text never reaches this component.
        const kw = keyword.trim().toLowerCase();
        if (kw) {
            result = result.filter((applicant) => {
                const haystack = [
                    applicant.candidate_name,
                    applicant.status,
                    applicant.summary,
                    ...applicant.strengths,
                    ...applicant.potentialGaps,
                    ...applicant.suggestedQuestions,
                    ...talentProfileSearchTokens(applicant.talent_profile),
                ].join(' ').toLowerCase();
                return haystack.includes(kw);
            });
        }

        if (minScore !== 'all') {
            const threshold = parseInt(minScore, 10);
            result = result.filter(a => (a.compatibility_score ?? 0) >= threshold);
        }

        if (statusFilter !== 'all') {
            result = result.filter((applicant) => normalizeApplicationStatus(applicant.status) === statusFilter);
        }

        if (recencyFilter !== 'all') {
            result = result.filter((applicant) => isWithinDays(applicant.application_date, parseInt(recencyFilter, 10)));
        }

        if (analysisFilter === 'analyzed') {
            result = result.filter(hasApplicantAnalysis);
        } else if (analysisFilter === 'needs_review') {
            result = result.filter((applicant) => !hasApplicantAnalysis(applicant));
        }

        if (sortKey === 'score') {
            result.sort((a, b) => (b.compatibility_score ?? 0) - (a.compatibility_score ?? 0));
        } else if (sortKey === 'newest') {
            result.sort((a, b) => toApplicationTime(b.application_date) - toApplicationTime(a.application_date));
        } else {
            result.sort((a, b) => (a.candidate_name ?? '').localeCompare(b.candidate_name ?? ''));
        }

        return result;
    }, [applicants, keyword, minScore, statusFilter, recencyFilter, analysisFilter, sortKey]);

    useEffect(() => {
        if (filteredApplicants.length === 0) {
            setSelectedApplicant(null);
            return;
        }
        if (!selectedApplicant || !filteredApplicants.some((applicant) => applicant.id === selectedApplicant.id)) {
            setSelectedApplicant(filteredApplicants[0]);
        }
    }, [filteredApplicants, selectedApplicant?.id]);

    const highMatchCount = useMemo(
        () => applicants.filter((applicant) => (applicant.compatibility_score ?? 0) >= 85).length,
        [applicants],
    );
    const needsReviewCount = useMemo(
        () => applicants.filter((applicant) => !hasApplicantAnalysis(applicant)).length,
        [applicants],
    );
    const recentCount = useMemo(
        () => applicants.filter((applicant) => isWithinDays(applicant.application_date, 7)).length,
        [applicants],
    );

    // Active filter count (excludes sort as it's always set)
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (keyword.trim()) count++;
        if (minScore !== 'all') count++;
        if (statusFilter !== 'all') count++;
        if (recencyFilter !== 'all') count++;
        if (analysisFilter !== 'all') count++;
        return count;
    }, [keyword, minScore, statusFilter, recencyFilter, analysisFilter]);

    // Count of the refinements tucked behind the "Filters" disclosure, surfaced
    // as a badge so an active hidden filter is still discoverable when collapsed.
    const secondaryFilterCount = useMemo(() => {
        let count = 0;
        if (statusFilter !== 'all') count++;
        if (recencyFilter !== 'all') count++;
        if (analysisFilter !== 'all') count++;
        return count;
    }, [statusFilter, recencyFilter, analysisFilter]);

    const clearFilters = () => {
        setKeyword('');
        setMinScore('all');
        setStatusFilter('all');
        setRecencyFilter('all');
        setAnalysisFilter('all');
        setSortKey('newest');
    };

    const applyQuickFilter = (filter: QuickFilterKey) => {
        setKeyword('');
        setStatusFilter('all');

        if (filter === 'all') {
            clearFilters();
            return;
        }

        if (filter === 'high_match') {
            setMinScore('85');
            setRecencyFilter('all');
            setAnalysisFilter('all');
            setSortKey('newest');
            return;
        }

        if (filter === 'recent') {
            setMinScore('all');
            setRecencyFilter('7');
            setAnalysisFilter('all');
            setSortKey('newest');
            return;
        }

        setMinScore('all');
        setRecencyFilter('all');
        setAnalysisFilter('needs_review');
        setSortKey('newest');
    };

    const quickFilterIsActive = (filter: QuickFilterKey): boolean => {
        if (filter === 'all') return activeFilterCount === 0;
        if (keyword.trim() || statusFilter !== 'all') return false;
        if (filter === 'high_match') return minScore === '85' && recencyFilter === 'all' && analysisFilter === 'all';
        if (filter === 'recent') return minScore === 'all' && recencyFilter === '7' && analysisFilter === 'all';
        return minScore === 'all' && recencyFilter === 'all' && analysisFilter === 'needs_review';
    };

    const getStatusLabel = (status: string): string => t(getApplicationStatusLabelKey(status));

    const formatDate = (value: string | null): string => {
        if (!value) return t('applicant_funnel_date_unknown');
        const timestamp = new Date(value);
        return Number.isNaN(timestamp.getTime()) ? t('applicant_funnel_date_unknown') : timestamp.toLocaleDateString();
    };

    const getScoreTone = (score: number): string => {
        if (score >= 85) return 'text-green-600 dark:text-green-400';
        if (score >= 70) return 'text-blue-600 dark:text-blue-400';
        return 'text-yellow-600 dark:text-yellow-400';
    };

    const scoreOptionLabel = (value: ScoreThreshold): string => t(`applicant_funnel_score_${value}`);
    const sortOptionLabel = (value: SortKey): string => t(`applicant_funnel_sort_${value}`);
    const recencyOptionLabel = (value: RecencyFilter): string => t(`applicant_funnel_recency_${value}`);
    const analysisOptionLabel = (value: AnalysisFilter): string => t(`applicant_funnel_analysis_${value}`);
    const quickFilters: Array<{ key: QuickFilterKey; label: string; count: number; Icon: React.ElementType }> = [
        { key: 'all', label: t('applicant_funnel_analysis_all'), count: applicants.length, Icon: Users },
        { key: 'high_match', label: t('applicant_funnel_stat_high_match'), count: highMatchCount, Icon: Target },
        { key: 'recent', label: t('applicant_funnel_stat_recent'), count: recentCount, Icon: Clock3 },
        { key: 'needs_review', label: t('applicant_funnel_stat_needs_review'), count: needsReviewCount, Icon: FileWarning },
    ];
    const selectedRecommendation = useMemo(() => {
        if (!selectedApplicant) return null;

        if (!hasApplicantAnalysis(selectedApplicant)) {
            return {
                title: t('applicant_funnel_next_manual_title'),
                description: t('applicant_funnel_next_manual_desc'),
                tone: 'review' as RecommendationTone,
                Icon: FileWarning,
            };
        }

        const score = selectedApplicant.compatibility_score ?? 0;
        if (score >= 85) {
            return {
                title: t('applicant_funnel_next_contact_title'),
                description: t('applicant_funnel_next_contact_desc'),
                tone: 'strong' as RecommendationTone,
                Icon: MessageSquare,
            };
        }

        if (score >= 70) {
            return {
                title: t('applicant_funnel_next_screen_title'),
                description: t('applicant_funnel_next_screen_desc'),
                tone: 'screen' as RecommendationTone,
                Icon: Target,
            };
        }

        return {
            title: t('applicant_funnel_next_hold_title'),
            description: t('applicant_funnel_next_hold_desc'),
            tone: 'review' as RecommendationTone,
            Icon: FileWarning,
        };
    }, [selectedApplicant, t]);

    const handleSelectApplicant = useCallback((applicant: Applicant) => {
        setSelectedApplicant(applicant);
        if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
            window.requestAnimationFrame(() => {
                detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }, []);

    const handleStatusChange = useCallback(async (
        applicant: Applicant,
        nextStatusValue: string,
        meta?: { reason?: string; candidateNote?: string },
    ): Promise<boolean> => {
        const nextStatus = normalizeApplicationStatus(nextStatusValue);
        if (normalizeApplicationStatus(applicant.status) === nextStatus) return true;
        const previousApplicants = applicants;
        const previousSelected = selectedApplicant;

        setStatusUpdateError(null);
        setStatusSavingId(applicant.id);
        setApplicants((current) =>
            current.map((entry) => entry.id === applicant.id ? { ...entry, status: nextStatus } : entry),
        );
        setSelectedApplicant((current) =>
            current?.id === applicant.id ? { ...current, status: nextStatus } : current,
        );

        try {
            await updateApplicationStatus(
                applicant.id,
                nextStatus,
                meta?.reason ?? '',
                meta?.candidateNote ?? '',
            );
            return true;
        } catch {
            setApplicants(previousApplicants);
            setSelectedApplicant(previousSelected);
            setStatusUpdateError(t('applicant_funnel_status_update_error'));
            return false;
        } finally {
            setStatusSavingId(null);
        }
    }, [applicants, selectedApplicant, t]);

    const RecommendationIcon = selectedRecommendation?.Icon;

    if (loading) {
        return (
            <div role="status" aria-live="polite" className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-700 animate-spin"></div>
                <p className="mt-4 text-base font-medium text-gray-700 dark:text-gray-300">{loadingMessage}</p>
                {/* Keep an exit available — scoring many applicants can take a minute. */}
                <button
                    type="button"
                    onClick={onBack}
                    className="mt-6 text-sm font-semibold text-gray-600 underline hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
                >
                    {t('action_back')}
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                <p className="font-semibold">{t('applicant_funnel_error_title')}</p>
                <p className="mt-2 text-sm">{error}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                        type="button"
                        onClick={fetchApplicants}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800"
                    >
                        <RotateCcw className="h-4 w-4" />
                        {t('applicant_funnel_retry')}
                    </button>
                    <button
                        type="button"
                        onClick={onBack}
                        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-900/40"
                    >
                        {t('applicant_funnel_back')}
                    </button>
                </div>
            </div>
        );
    }

    if (applicants.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <Users className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                <h3 className="mt-4 text-xl font-semibold text-gray-800 dark:text-gray-100">{t('applicant_funnel_empty_title')}</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">{t('applicant_funnel_empty_desc')}</p>
                <button type="button" onClick={onBack} className="mt-6 rounded-lg border border-gray-300 bg-gray-100 px-6 py-2 font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
                    {t('applicant_funnel_back')}
                </button>
            </div>
        );
    }

    return (
        <div className="animate-view-fade space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 dark:text-blue-400 dark:hover:text-blue-300"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>{t('applicant_funnel_back')}</span>
                </button>
                <button
                    type="button"
                    onClick={fetchApplicants}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                    <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>{t('applicant_funnel_refresh')}</span>
                </button>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
                {statusUpdateError && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                        {statusUpdateError}
                    </div>
                )}
                <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                    <div className="min-w-0">
                        <h3 className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-100">
                            {formatTranslation(t('applicant_funnel_title'), { title: job.title })}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                <Users className="h-3.5 w-3.5" />
                                {formatTranslation(t('applicant_funnel_total_count'), { count: applicants.length })}
                            </span>
                            {highMatchCount > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    <Target className="h-3.5 w-3.5" />
                                    {formatTranslation(t('applicant_funnel_high_match_count'), { count: highMatchCount })}
                                </span>
                            )}
                        </div>
                    </div>
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 lg:justify-self-end">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        {formatTranslation(t('applicant_funnel_filter_result'), {
                            shown: filteredApplicants.length,
                            total: applicants.length,
                        })}
                    </span>
                </div>
                <FunnelChart data={funnelData} t={t} />
            </div>

            {/* AI-hiring disclosure: AI output here is advisory decision-support,
                not automated screening (EEOC/FTC guidance; Ontario ESA disclosure). */}
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-xs leading-5 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-300" />
                <span>{t('applicant_funnel_ai_disclosure')}</span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <aside className="flex h-auto min-h-[520px] flex-col rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-1 lg:h-[72vh]">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('applicant_funnel_list_title')}</h3>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {formatTranslation(t('applicant_funnel_filter_result'), {
                                    shown: filteredApplicants.length,
                                    total: applicants.length,
                                })}
                            </p>
                        </div>
                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900/60 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-950/40"
                            >
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold leading-none text-white dark:bg-blue-500">
                                    {activeFilterCount}
                                </span>
                                {t('applicant_funnel_clear_filters')}
                            </button>
                        )}
                    </div>

                    <div className="mb-4 flex-shrink-0 space-y-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('applicant_funnel_analysis_label')}>
                            {quickFilters.map(({ key, label, count, Icon }) => {
                                const active = quickFilterIsActive(key);
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => applyQuickFilter(key)}
                                        aria-pressed={active}
                                        className={`min-h-[74px] rounded-lg border px-2.5 py-2 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
                                            active
                                                ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200'
                                                : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-blue-200 hover:bg-blue-50/60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/20'
                                        }`}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <Icon className={`h-4 w-4 ${active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400'}`} />
                                            <span className="text-base font-bold tabular-nums">{count}</span>
                                        </span>
                                        <span className="mt-1 block truncate text-[11px] font-semibold leading-4">{label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="relative">
                            <label className="sr-only" htmlFor="applicant-search">
                                {t('applicant_funnel_search_label')}
                            </label>
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                id="applicant-search"
                                type="search"
                                placeholder={t('applicant_funnel_search_placeholder')}
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 transition-colors placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            <SelectField
                                id="applicant-score-filter"
                                label={t('applicant_funnel_score_label')}
                                value={minScore}
                                onChange={(value) => setMinScore(value as ScoreThreshold)}
                            >
                                {SCORE_OPTIONS.map(option => (
                                    <option key={option} value={option}>{scoreOptionLabel(option)}</option>
                                ))}
                            </SelectField>

                            <SelectField
                                id="applicant-sort"
                                label={t('applicant_funnel_sort_label')}
                                value={sortKey}
                                onChange={(value) => setSortKey(value as SortKey)}
                            >
                                {SORT_OPTIONS.map(option => (
                                    <option key={option} value={option}>{sortOptionLabel(option)}</option>
                                ))}
                            </SelectField>
                        </div>

                        <div>
                            <button
                                type="button"
                                onClick={() => setFiltersOpen((open) => !open)}
                                aria-expanded={filtersOpen}
                                aria-controls="applicant-secondary-filters"
                                className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <SlidersHorizontal className="h-4 w-4 text-gray-400" />
                                    {t('applicant_funnel_filters_disclosure')}
                                    {secondaryFilterCount > 0 && (
                                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white dark:bg-blue-500">
                                            {secondaryFilterCount}
                                        </span>
                                    )}
                                </span>
                                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {filtersOpen && (
                                <div id="applicant-secondary-filters" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                    <SelectField
                                        id="applicant-status-filter"
                                        label={t('applicant_funnel_status_label')}
                                        value={statusFilter}
                                        onChange={setStatusFilter}
                                    >
                                        <option value="all">{t('applicant_funnel_status_all')}</option>
                                        {statusOptions.map(status => (
                                            <option key={status} value={status}>{getStatusLabel(status)}</option>
                                        ))}
                                    </SelectField>

                                    <SelectField
                                        id="applicant-recency-filter"
                                        label={t('applicant_funnel_recency_label')}
                                        value={recencyFilter}
                                        onChange={(value) => setRecencyFilter(value as RecencyFilter)}
                                    >
                                        {RECENCY_OPTIONS.map(option => (
                                            <option key={option} value={option}>{recencyOptionLabel(option)}</option>
                                        ))}
                                    </SelectField>

                                    <SelectField
                                        id="applicant-analysis-filter"
                                        label={t('applicant_funnel_analysis_label')}
                                        value={analysisFilter}
                                        onChange={(value) => setAnalysisFilter(value as AnalysisFilter)}
                                        className="sm:col-span-2 lg:col-span-1 xl:col-span-2"
                                    >
                                        {ANALYSIS_OPTIONS.map(option => (
                                            <option key={option} value={option}>{analysisOptionLabel(option)}</option>
                                        ))}
                                    </SelectField>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {filteredApplicants.length === 0 ? (
                            <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center dark:border-gray-700 dark:bg-gray-800">
                                <Users className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('applicant_funnel_no_filter_title')}</p>
                                <p className="mt-2 max-w-xs text-xs leading-5 text-gray-500 dark:text-gray-400">{t('applicant_funnel_no_filter_desc')}</p>
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="mt-4 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-300 dark:hover:bg-blue-950/40"
                                >
                                    {t('applicant_funnel_clear_all_filters')}
                                </button>
                            </div>
                        ) : (
                            filteredApplicants.map(applicant => {
                                const score = applicant.compatibility_score ?? 0;
                                const analyzed = hasApplicantAnalysis(applicant);
                                const candidateName = applicant.candidate_name || t('applicant_funnel_unnamed_candidate');
                                return (
                                    <button
                                        key={applicant.id}
                                        type="button"
                                        onClick={() => handleSelectApplicant(applicant)}
                                        aria-current={selectedApplicant?.id === applicant.id ? 'true' : undefined}
                                        className={`w-full rounded-xl border p-3 text-left transition-all duration-200 ${
                                            selectedApplicant?.id === applicant.id
                                                ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-500/10 dark:border-blue-400 dark:bg-blue-950/30'
                                                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-gray-800/80'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{candidateName}</p>
                                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                    {formatTranslation(t('applicant_funnel_applied_on'), { date: formatDate(applicant.application_date) })}
                                                </p>
                                            </div>
                                            <div className={`shrink-0 text-lg font-bold tabular-nums ${getScoreTone(score)}`}>{score}%</div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                {getStatusLabel(applicant.status)}
                                            </span>
                                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                                {t('applicant_funnel_match_score')}: {score}%
                                            </span>
                                            {!analyzed && (
                                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                                    {t('applicant_funnel_needs_review_chip')}
                                                </span>
                                            )}
                                            {talentProfileHasData(applicant.talent_profile) && (
                                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                    {t('applicant_funnel_talent_profile_chip')}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </aside>

                <section
                    ref={detailRef}
                    className="min-h-[520px] scroll-mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2 lg:h-[72vh] lg:overflow-y-auto"
                    aria-live="polite"
                >
                    {!selectedApplicant ? (
                        <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-dashed border-gray-300 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            {t('applicant_funnel_select_prompt')}
                        </div>
                    ) : hasApplicantAnalysis(selectedApplicant) ? (
                        <div key={selectedApplicant.id} className="animate-panel-expand space-y-5">
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <h2 className="text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100">
                                            {selectedApplicant.candidate_name || t('applicant_funnel_unnamed_candidate')}
                                        </h2>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700">
                                                {getStatusLabel(selectedApplicant.status)}
                                            </span>
                                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                                                {formatTranslation(t('applicant_funnel_applied_on'), { date: formatDate(selectedApplicant.application_date) })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                                        <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-left shadow-sm dark:border-blue-900/60 dark:bg-gray-800 sm:text-right">
                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t('applicant_funnel_match_score')}</p>
                                            <p className={`mt-1 text-3xl font-bold tabular-nums ${getScoreTone(selectedApplicant.compatibility_score ?? 0)}`}>
                                                {selectedApplicant.compatibility_score ?? 0}%
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleSaveCandidate(selectedApplicant)}
                                            disabled={savedIds.has(selectedApplicant.id) || savingIds.has(selectedApplicant.id)}
                                            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                                                savedIds.has(selectedApplicant.id)
                                                    ? 'cursor-default bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60'
                                            }`}
                                        >
                                            <Star className={`h-4 w-4 ${savedIds.has(selectedApplicant.id) ? 'fill-current' : ''}`} />
                                            {savingIds.has(selectedApplicant.id)
                                                ? t('applicant_funnel_saving')
                                                : savedIds.has(selectedApplicant.id)
                                                    ? t('applicant_funnel_saved')
                                                    : t('applicant_funnel_save_candidate')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleViewResume(selectedApplicant)}
                                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                        >
                                            <Eye className="h-4 w-4" />
                                            {t('applicant_funnel_view_resume')}
                                        </button>
                                    </div>
                                </div>
                                <StageControl
                                    applicant={selectedApplicant}
                                    statusOptions={statusOptions}
                                    statusSavingId={statusSavingId}
                                    getStatusLabel={getStatusLabel}
                                    onStatusChange={handleStatusChange}
                                    t={t}
                                />
                                {selectedApplicant.summary && (
                                    <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">{selectedApplicant.summary}</p>
                                )}
                            </div>

                            <TalentProfileSummary profile={selectedApplicant.talent_profile} t={t} />

                            {selectedRecommendation && RecommendationIcon && (
                                <div className={`rounded-xl border p-4 ${RECOMMENDATION_TONE_CLASS[selectedRecommendation.tone]}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70 text-current shadow-sm dark:bg-gray-950/30">
                                            <RecommendationIcon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-semibold leading-5">{selectedRecommendation.title}</h4>
                                            <p className="mt-1 text-sm leading-6 opacity-90">{selectedRecommendation.description}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(selectedApplicant.strengths.length > 0 || selectedApplicant.potentialGaps.length > 0) && (
                                <div className="grid gap-4 xl:grid-cols-2">
                                    {selectedApplicant.strengths.length > 0 && (
                                        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/60 dark:bg-green-950/20">
                                            <h4 className="font-semibold text-green-800 dark:text-green-200">{t('applicant_funnel_strengths')}</h4>
                                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-green-900 dark:text-green-100">
                                                {selectedApplicant.strengths.map((strength, index) => <li key={`${strength}-${index}`}>{strength}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                    {selectedApplicant.potentialGaps.length > 0 && (
                                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/60 dark:bg-yellow-950/20">
                                            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">{t('applicant_funnel_potential_gaps')}</h4>
                                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-yellow-900 dark:text-yellow-100">
                                                {selectedApplicant.potentialGaps.map((gap, index) => <li key={`${gap}-${index}`}>{gap}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedApplicant.suggestedQuestions.length > 0 && (
                                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                                    <h4 className="font-semibold text-indigo-800 dark:text-indigo-200">{t('applicant_funnel_questions')}</h4>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-indigo-900 dark:text-indigo-100">
                                        {selectedApplicant.suggestedQuestions.map((question, index) => <li key={`${question}-${index}`}>{question}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div key={selectedApplicant.id} className="animate-panel-expand space-y-5">
                            <TalentProfileSummary profile={selectedApplicant.talent_profile} t={t} />
                            <div className="mx-auto max-w-sm rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                <FileWarning className="mx-auto h-10 w-10 text-amber-500" />
                                <p className="mt-3 font-semibold text-gray-700 dark:text-gray-200">
                                    {formatTranslation(t('applicant_funnel_no_analysis_title'), {
                                        name: selectedApplicant.candidate_name || t('applicant_funnel_unnamed_candidate'),
                                    })}
                                </p>
                                <p className="mx-auto mt-2 text-sm leading-6">{t('applicant_funnel_no_analysis_desc')}</p>
                                <button
                                    type="button"
                                    onClick={() => handleViewResume(selectedApplicant)}
                                    className="mx-auto mt-4 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    <Eye className="h-4 w-4" />
                                    {t('applicant_funnel_view_resume')}
                                </button>
                                {selectedRecommendation && RecommendationIcon && (
                                    <div className={`mt-4 rounded-lg border p-3 text-left ${RECOMMENDATION_TONE_CLASS[selectedRecommendation.tone]}`}>
                                        <div className="flex items-start gap-2.5">
                                            <RecommendationIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold">{selectedRecommendation.title}</p>
                                                <p className="mt-1 text-xs leading-5 opacity-90">{selectedRecommendation.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="text-left">
                                    <StageControl
                                        applicant={selectedApplicant}
                                        statusOptions={statusOptions}
                                        statusSavingId={statusSavingId}
                                        getStatusLabel={getStatusLabel}
                                        onStatusChange={handleStatusChange}
                                        t={t}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {viewingApplicant && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    onClick={closeResumeView}
                >
                    <div
                        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
                            <h3 className="min-w-0 truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                                {formatTranslation(t('applicant_funnel_resume_modal_title'), {
                                    name: viewingApplicant.candidate_name || t('applicant_funnel_unnamed_candidate'),
                                })}
                            </h3>
                            <button
                                type="button"
                                onClick={closeResumeView}
                                aria-label={t('applicant_funnel_resume_close')}
                                className="shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-4">
                            {resumeViewLoading ? (
                                <div className="flex h-[320px] items-center justify-center">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
                                </div>
                            ) : resumeViewError ? (
                                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                                    {resumeViewError}
                                </div>
                            ) : resumeViewText && resumeViewText.trim() ? (
                                <ResumePreview resumeText={resumeViewText} market="" t={t} />
                            ) : (
                                <div className="flex h-[320px] items-center justify-center px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                    {t('applicant_funnel_resume_empty')}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => handleDownloadResume(viewingApplicant)}
                                disabled={downloadingResumeId === viewingApplicant.id}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                <Download className="h-4 w-4" />
                                {downloadingResumeId === viewingApplicant.id
                                    ? t('applicant_funnel_downloading')
                                    : t('applicant_funnel_download_resume')}
                            </button>
                            <button
                                type="button"
                                onClick={closeResumeView}
                                className="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                            >
                                {t('applicant_funnel_resume_close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApplicantFunnel;
