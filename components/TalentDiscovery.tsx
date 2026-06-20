
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { discoverTalent, type DiscoveredCandidate } from '../services/aiClient';
import type { UserProfile } from '../types';
import EngageCandidateModal from './EngageCandidateModal';
import UnlockTalentModal from './UnlockTalentModal';
import { listActiveEmployerJobs, type JobPosting } from '../lib/recruitingData';
import { saveToShortlist, hideCandidate, listHiddenCandidateIds } from '../lib/shortlistData';
import {
    ArrowRight,
    BookmarkCheck,
    BookmarkPlus,
    Briefcase,
    CheckCircle2,
    Clock3,
    DollarSign,
    FileText,
    Loader2,
    MapPin,
    EyeOff,
    PlusCircle,
    RefreshCw,
    RotateCcw,
    Search,
    Sparkles,
    Users,
    XCircle,
} from 'lucide-react';
import { useToast as useSharedToast } from './Toast';

interface MatchedCandidate extends UserProfile {
    compatibilityScore: number;
    summary: string;
    strengths: string[];
    potentialGaps: string[];
    suggestedQuestions: string[];
}

type TranslationFn = (key: string) => string;

type CandidateCardVariant = 'verified' | 'regular';
type TalentDiscoveryJob = JobPosting & { applicant_count?: number };

/**
 * The server returns only SAFE fields (no resume_text/email — privacy by design;
 * full profiles unlock via the paid flow). Modals expect a UserProfile shape, so
 * we wrap the safe payload in a null stub.
 */
const toMatchedCandidate = (c: DiscoveredCandidate, fallbackSummary?: string): MatchedCandidate => ({
    id: c.id,
    updated_at: '',
    full_name: null,
    avatar_url: null,
    subscription_status: 'free',
    role: 'candidate',
    company_name: null,
    company_website: null,
    company_description: null,
    company_logo_url: null,
    resume_text: null,
    preferred_language: null,
    wallet_address: null,
    nft_minted: null,
    nft_staked: c.nft_staked,
    nft_earnings: null,
    nft_token_id: null,
    english_pro_streak: null,
    english_pro_last_practice: null,
    credits: 0,
    compatibilityScore: c.compatibilityScore,
    summary: c.summary || fallbackSummary || '',
    strengths: c.strengths,
    potentialGaps: c.potentialGaps,
    suggestedQuestions: c.suggestedQuestions,
});

const buildPostedJobBrief = (job: JobPosting, t: TranslationFn): string => {
    const parts = [
        job.title,
        job.company_name ? `${t('agency_job_context_company')}: ${job.company_name}` : null,
        job.location ? `${t('agency_job_context_location')}: ${job.location}` : null,
        job.salary_range ? `${t('agency_job_context_salary')}: ${job.salary_range}` : null,
        job.description?.trim() ? `\n${job.description.trim()}` : null,
    ].filter(Boolean);

    return parts.join('\n');
};

const formatTranslation = (
    template: string,
    values: Record<string, string | number>,
) =>
    Object.entries(values).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
        template,
    );

const formatPostedDate = (value: string | null | undefined): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function VerifiedTalentSkeleton() {
    return (
        <div className="space-y-3" role="status" aria-live="polite">
            {[0, 1, 2].map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/10 p-4">
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 w-28 rounded bg-white/20" />
                        <div className="h-3 w-full max-w-xl rounded bg-white/15" />
                        <div className="flex flex-wrap gap-2">
                            <div className="h-5 w-24 rounded-full bg-white/15" />
                            <div className="h-5 w-28 rounded-full bg-white/15" />
                            <div className="h-5 w-20 rounded-full bg-white/15" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

interface TalentCommandCenterProps {
    t: TranslationFn;
    hasJobDescription: boolean;
    selectedJobTitle?: string;
    postedJobsCount: number;
    verifiedCount: number;
    savedCount: number;
    searchLoading: boolean;
    regularResultsCount: number | null;
    onPrimaryAction: () => void;
    onOpenShortlist?: () => void;
}

function TalentCommandCenter({
    t,
    hasJobDescription,
    selectedJobTitle,
    postedJobsCount,
    verifiedCount,
    savedCount,
    searchLoading,
    regularResultsCount,
    onPrimaryAction,
    onOpenShortlist,
}: TalentCommandCenterProps) {
    const contextLabel =
        selectedJobTitle ||
        (hasJobDescription
            ? t('talent_command_context_manual')
            : t('talent_command_context_missing'));
    const primaryLabel = searchLoading
        ? t('talent_searching')
        : hasJobDescription
            ? t('talent_command_run_search')
            : t('talent_command_add_role');
    const PrimaryIcon = searchLoading ? Loader2 : hasJobDescription ? Search : Briefcase;
    const metrics = [
        {
            label: t('talent_command_metric_roles'),
            value: postedJobsCount,
            tone: 'bg-white text-gray-900 dark:bg-slate-900 dark:text-gray-100',
        },
        {
            label: t('talent_command_metric_verified'),
            value: verifiedCount,
            tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
        },
        {
            label: t('talent_command_metric_matches'),
            value: regularResultsCount ?? '-',
            tone: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
        },
        {
            label: t('talent_command_metric_saved'),
            value: savedCount,
            tone: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200',
        },
    ];

    return (
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {t('talent_command_title')}
                        </p>
                        <span className="max-w-full truncate rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                            {contextLabel}
                        </span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                        {t('talent_command_desc')}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
                    {metrics.map((metric) => (
                        <div
                            key={metric.label}
                            className={`rounded-xl border border-gray-200 px-3 py-2 text-center dark:border-gray-700 ${metric.tone}`}
                        >
                            <p className="text-xl font-bold">{metric.value}</p>
                            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-75">
                                {metric.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {t('talent_command_next_action')}
                    </span>{' '}
                    {primaryLabel}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {savedCount > 0 && onOpenShortlist && (
                        <button
                            type="button"
                            onClick={onOpenShortlist}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40"
                        >
                            {t('talent_open_shortlist')}
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onPrimaryAction}
                        disabled={searchLoading}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-wait disabled:bg-blue-400"
                    >
                        <PrimaryIcon className={`h-4 w-4 ${searchLoading ? 'animate-spin' : ''}`} />
                        {primaryLabel}
                    </button>
                </div>
            </div>
        </section>
    );
}

interface CandidateMatchCardProps {
    candidate: MatchedCandidate;
    index: number;
    variant: CandidateCardVariant;
    t: TranslationFn;
    saved: boolean;
    saving: boolean;
    onSave: (candidate: MatchedCandidate) => void;
    onHide?: (candidate: MatchedCandidate) => void;
    onUnlock?: (candidate: MatchedCandidate, index: number) => void;
}

function CandidateMatchCard({
    candidate,
    index,
    variant,
    t,
    saved,
    saving,
    onSave,
    onHide,
    onUnlock,
}: CandidateMatchCardProps) {
    const verified = variant === 'verified';
    const outerClass = verified
        ? 'rounded-lg border border-white/20 bg-white/10 p-4 text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15'
        : 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800';
    const titleClass = verified ? 'text-white' : 'text-gray-800 dark:text-white';
    const bodyClass = verified ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400';
    const scoreClass = verified ? 'text-green-400' : 'text-green-600 dark:text-green-400';
    const gapClass = verified ? 'text-red-300' : 'text-red-600 dark:text-red-400';

    return (
        <article className={outerClass}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className={`font-bold ${titleClass}`}>
                            {formatTranslation(t('talent_candidate_label'), { n: index + 1 })}
                        </p>
                        {verified && (
                            <span className="rounded-full border border-green-500/40 bg-green-600/30 px-2 py-0.5 text-[11px] font-semibold text-green-100">
                                {t('discover_verified_title')}
                            </span>
                        )}
                    </div>
                    <p className={`mt-3 text-[11px] font-semibold uppercase tracking-wide ${verified ? 'text-blue-100' : 'text-blue-700 dark:text-blue-300'}`}>
                        {t('talent_why_match_title')}
                    </p>
                    <p className={`mt-1 text-sm leading-6 ${bodyClass}`}>{candidate.summary}</p>

                    {candidate.strengths.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {candidate.strengths.slice(0, 6).map((strength, strengthIndex) => (
                                <span
                                    key={`${strength}-${strengthIndex}`}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                                        verified
                                            ? 'border-green-500/40 bg-green-600/40 text-green-100'
                                            : 'border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    }`}
                                >
                                    {!verified && <CheckCircle2 className="h-3 w-3" />}
                                    {strength}
                                </span>
                            ))}
                        </div>
                    )}

                    {candidate.potentialGaps.length > 0 && (
                        <div className="mt-3">
                            {!verified && (
                                <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                                    {t('talent_potential_gaps')}
                                </p>
                            )}
                            <ul className="space-y-1">
                                {candidate.potentialGaps.slice(0, verified ? 2 : 3).map((gap, gapIndex) => (
                                    <li key={`${gap}-${gapIndex}`} className={`flex items-start gap-1 text-xs ${gapClass}`}>
                                        <XCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                        <span>{gap}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 sm:flex-shrink-0 sm:items-start sm:justify-end">
                    {candidate.compatibilityScore > 0 && (
                        <div className="text-right">
                            <p className={`text-2xl font-bold ${scoreClass}`}>{candidate.compatibilityScore}%</p>
                            <p className={`text-xs ${verified ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                {t('talent_match_label')}
                            </p>
                        </div>
                    )}
                    <div className={verified ? 'flex flex-col gap-2' : ''}>
                        {candidate.compatibilityScore > 0 && (
                            <button
                                type="button"
                                onClick={() => onSave(candidate)}
                                disabled={saved || saving}
                                title={saved ? t('shortlist_already_saved') : t('shortlist_save_button')}
                                aria-label={saved ? t('shortlist_already_saved') : t('shortlist_save_button')}
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
                                    verified
                                        ? saved
                                            ? 'cursor-not-allowed bg-white/10 text-green-300'
                                            : saving
                                                ? 'cursor-wait bg-white/10 text-white/70'
                                                : 'bg-white/20 text-white hover:bg-white/30'
                                        : saved
                                            ? 'cursor-not-allowed border border-green-300 bg-green-50 text-green-600 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400'
                                            : saving
                                                ? 'cursor-wait border border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500'
                                                : 'border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-300 dark:hover:text-blue-400'
                                }`}
                            >
                                {saved
                                    ? <BookmarkCheck className="h-4 w-4" />
                                    : saving
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <BookmarkPlus className="h-4 w-4" />}
                            </button>
                        )}
                        {onHide && candidate.compatibilityScore > 0 && (
                            <button
                                type="button"
                                onClick={() => onHide(candidate)}
                                title={t('talent_hide_button')}
                                aria-label={t('talent_hide_button')}
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
                                    verified
                                        ? 'bg-white/20 text-white hover:bg-white/30'
                                        : 'border border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-600 dark:border-gray-600 dark:text-gray-300'
                                }`}
                            >
                                <EyeOff className="h-4 w-4" />
                            </button>
                        )}
                        {verified && onUnlock && (
                            <button
                                type="button"
                                onClick={() => onUnlock(candidate, index)}
                                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white/50"
                            >
                                {t('discover_unlock_engage_button')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}

interface TalentDiscoveryProps {
    t: (key: string) => string;
    profile: UserProfile;
    onPostJob?: () => void;
    onOpenShortlist?: () => void;
    navigateToBusinessPricing: () => void;
    postedJobs?: TalentDiscoveryJob[];
    postedJobsLoading?: boolean;
    postedJobsError?: string | null;
    onRetryPostedJobs?: () => void;
    initialSelectedJobId?: string | null;
}

const TalentDiscovery: React.FC<TalentDiscoveryProps> = ({
    t,
    profile,
    onPostJob,
    onOpenShortlist,
    navigateToBusinessPricing,
    postedJobs: postedJobsProp,
    postedJobsLoading = false,
    postedJobsError = null,
    onRetryPostedJobs,
    initialSelectedJobId = null,
}) => {
    const [jobDescription, setJobDescription] = useState('');
    const [verifiedLoading, setVerifiedLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [verifiedError, setVerifiedError] = useState<string | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [verifiedResults, setVerifiedResults] = useState<MatchedCandidate[]>([]);
    const [regularResults, setRegularResults] = useState<MatchedCandidate[] | null>(null);

    const [candidateToUnlock, setCandidateToUnlock] = useState<(MatchedCandidate & { index: number }) | null>(null);
    const [candidateToEngage, setCandidateToEngage] = useState<(MatchedCandidate & { index: number }) | null>(null);

    // Posted-job selector state
    const [internalPostedJobs, setInternalPostedJobs] = useState<TalentDiscoveryJob[]>([]);
    const [internalJobsLoaded, setInternalJobsLoaded] = useState(false);
    const [internalJobsError, setInternalJobsError] = useState<string | null>(null);

    // Track which jobs are currently selected in the selector (for snapshot)
    const [selectedJobId, setSelectedJobId] = useState<string>('');

    // Session-level saved set (candidate.id) so we can disable after saving
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    // Candidates whose shortlist write is in flight — blocks double-clicks.
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    // Candidates this employer has hidden from Talent Discovery (loaded on mount,
    // persisted in users/{uid}/hidden_candidates so they stay hidden across searches).
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
    const verifiedRequestIdRef = useRef(0);
    const appliedInitialJobIdRef = useRef<string | null>(null);
    const searchFormRef = useRef<HTMLFormElement>(null);
    const roleBriefRef = useRef<HTMLTextAreaElement>(null);

    const { addToast } = useSharedToast();
    const usesExternalJobs = Array.isArray(postedJobsProp);
    const postedJobs = useMemo(
        () => (usesExternalJobs
            ? (postedJobsProp ?? []).filter((job) => job.is_active)
            : internalPostedJobs),
        [internalPostedJobs, postedJobsProp, usesExternalJobs],
    );
    const jobsLoaded = usesExternalJobs ? !postedJobsLoading : internalJobsLoaded;
    const jobsError = usesExternalJobs ? postedJobsError : internalJobsError;
    const selectedPostedJob = postedJobs.find((job) => job.id === selectedJobId) ?? null;
    const selectedPostedJobBrief = selectedPostedJob ? buildPostedJobBrief(selectedPostedJob, t) : '';
    const selectedPostedDate = selectedPostedJob ? formatPostedDate(selectedPostedJob.created_at) : '';
    const selectedBriefEdited = !!selectedPostedJob && jobDescription.trim() !== selectedPostedJobBrief.trim();
    const hasJobDescription = jobDescription.trim().length > 0;
    const regularResultsCount = regularResults ? regularResults.length : null;
    const visiblePostedJobs = postedJobs.slice(0, 4);
    const hiddenPostedJobsCount = Math.max(0, postedJobs.length - visiblePostedJobs.length);
    const flowSteps = [
        {
            title: t('talent_flow_select_job_title'),
            description: t('talent_flow_select_job_desc'),
            Icon: Briefcase,
        },
        {
            title: t('talent_flow_match_title'),
            description: t('talent_flow_match_desc'),
            Icon: Search,
        },
        {
            title: t('talent_flow_shortlist_title'),
            description: t('talent_flow_shortlist_desc'),
            Icon: BookmarkCheck,
        },
    ];

    const fetchPostedJobs = useCallback(async () => {
        if (usesExternalJobs) {
            onRetryPostedJobs?.();
            return;
        }
        if (!profile.id) {
            setInternalPostedJobs([]);
            setInternalJobsLoaded(true);
            return;
        }
        setInternalJobsLoaded(false);
        setInternalJobsError(null);
        try {
            const jobs = await listActiveEmployerJobs(profile.id);
            setInternalPostedJobs(jobs);
        } catch {
            setInternalPostedJobs([]);
            setInternalJobsError(t('talent_posted_jobs_error'));
        } finally {
            setInternalJobsLoaded(true);
        }
    }, [onRetryPostedJobs, profile.id, t, usesExternalJobs]);

    // Fetch employer jobs only when the portal does not provide them.
    useEffect(() => {
        if (usesExternalJobs) return;
        fetchPostedJobs();
    }, [fetchPostedJobs, usesExternalJobs]);

    const handleSelectPostedJob = useCallback((jobId: string) => {
        setSelectedJobId(jobId);
        if (!jobId) {
            setRegularResults(null);
            return;
        }
        const job = postedJobs.find((j) => j.id === jobId);
        if (!job) return;
        setJobDescription(buildPostedJobBrief(job, t));
        setRegularResults(null);
        if (searchError) setSearchError(null);
    }, [postedJobs, searchError, t]);

    useEffect(() => {
        if (!initialSelectedJobId || !jobsLoaded) return;
        if (appliedInitialJobIdRef.current === initialSelectedJobId) return;
        if (selectedJobId === initialSelectedJobId) {
            appliedInitialJobIdRef.current = initialSelectedJobId;
            return;
        }
        if (!postedJobs.some((job) => job.id === initialSelectedJobId)) return;
        appliedInitialJobIdRef.current = initialSelectedJobId;
        handleSelectPostedJob(initialSelectedJobId);
    }, [handleSelectPostedJob, initialSelectedJobId, jobsLoaded, postedJobs, selectedJobId]);

    // Read t via a ref so this metered fetch keeps a stable identity — otherwise a
    // language switch (which gives a new t) would re-fire discoverTalent() each time.
    const tRef = useRef(t);
    tRef.current = t;
    const fetchVerifiedTalent = useCallback(async () => {
        const requestId = verifiedRequestIdRef.current + 1;
        verifiedRequestIdRef.current = requestId;
        setVerifiedLoading(true);
        setVerifiedError(null);
        try {
            const { candidates } = await discoverTalent();
            if (requestId !== verifiedRequestIdRef.current) return;
            setVerifiedResults(candidates.map((c) => toMatchedCandidate(c, tRef.current('discover_verified_summary_default'))));
        } catch (err) {
            if (requestId !== verifiedRequestIdRef.current) return;
            setVerifiedError(err instanceof Error ? err.message : tRef.current('talent_load_error'));
        } finally {
            if (requestId === verifiedRequestIdRef.current) {
                setVerifiedLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchVerifiedTalent();
        return () => {
            verifiedRequestIdRef.current += 1;
        };
    }, [fetchVerifiedTalent]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasJobDescription) {
            setSearchError(t('talent_jd_required'));
            roleBriefRef.current?.focus();
            return;
        }
        setSearchLoading(true);
        setSearchError(null);
        setRegularResults(null);
        try {
            // One server call: candidates are read and matched server-side; only
            // safe, scored fields come back (sorted by score desc).
            const { candidates } = await discoverTalent(jobDescription);
            const allMatched = candidates.map((c) => toMatchedCandidate(c));
            setVerifiedResults(allMatched.filter(c => c.nft_staked));
            setRegularResults(allMatched.filter(c => !c.nft_staked));
        } catch (err) {
            setSearchError(err instanceof Error ? err.message : t('talent_search_error'));
        } finally {
            setSearchLoading(false);
        }
    };

    // ---- save to shortlist --------------------------------------------------
    const getJobInfo = (): { job_id: string; job_title: string } => {
        if (selectedJobId) {
            const job = postedJobs.find(j => j.id === selectedJobId);
            if (job) return { job_id: job.id, job_title: job.title };
        }
        return { job_id: 'manual', job_title: t('talent_manual_role_label') };
    };

    const handleSaveToShortlist = async (candidate: MatchedCandidate) => {
        if (savedIds.has(candidate.id) || savingIds.has(candidate.id)) return;
        setSavingIds(prev => new Set(prev).add(candidate.id));
        const { job_id, job_title } = getJobInfo();
        try {
            await saveToShortlist(profile.id, {
                candidate_name: candidate.full_name || t('talent_candidate_fallback_name').replace('{id}', candidate.id.slice(0, 6)),
                candidate_snapshot: {
                    summary: candidate.summary,
                    // UserProfile has no structured skills array; surface strengths as the closest proxy
                    skills: candidate.strengths.length > 0 ? candidate.strengths.slice(0, 10) : undefined,
                    current_role: undefined,
                },
                job_id,
                job_title,
                match_score: candidate.compatibilityScore,
                match_reasons: candidate.strengths.slice(0, 10),
                missing_requirements: candidate.potentialGaps.slice(0, 10),
                notes: '',
                status: 'saved',
                saved_by: profile.id,
            });
            setSavedIds(prev => new Set(prev).add(candidate.id));
            addToast(t('shortlist_saved_toast'), 'success');
        } catch (err) {
            addToast(err instanceof Error ? err.message : t('shortlist_save_error'), 'error');
        } finally {
            setSavingIds(prev => {
                const next = new Set(prev);
                next.delete(candidate.id);
                return next;
            });
        }
    };

    // Load this employer's hidden-candidate set once so prior hides persist across searches.
    useEffect(() => {
        if (!profile?.id) return;
        listHiddenCandidateIds(profile.id).then(setHiddenIds).catch(() => { /* non-fatal */ });
    }, [profile?.id]);

    const handleHideCandidate = async (candidate: MatchedCandidate) => {
        setHiddenIds(prev => new Set(prev).add(candidate.id));
        try {
            await hideCandidate(profile.id, candidate.id);
            addToast(t('talent_hide_toast'), 'info');
        } catch (err) {
            setHiddenIds(prev => { const next = new Set(prev); next.delete(candidate.id); return next; });
            addToast(err instanceof Error ? err.message : t('talent_hide_error'), 'error');
        }
    };

    const paidBusinessStatuses = new Set(['single_post', 'job_pack', 'starter', 'growth', 'pro']);
    const canUnlock = paidBusinessStatuses.has(profile.subscription_status ?? '');
    const handleCommandPrimaryAction = () => {
        if (searchLoading) return;
        if (!hasJobDescription) {
            roleBriefRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            roleBriefRef.current?.focus();
            return;
        }
        searchFormRef.current?.requestSubmit();
    };

    return (
        <div className="p-0 sm:p-4 animate-fade-in">
            <div className="mb-6 grid gap-3 md:grid-cols-3">
                {flowSteps.map(({ title, description, Icon }) => (
                    <div
                        key={title}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
                            <Icon className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
                        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{description}</p>
                    </div>
                ))}
            </div>

            {/* AI-hiring disclosure: candidate match scores here are advisory
                decision-support, not automated screening (EEOC/FTC/Ontario).
                Mirrors the ApplicantFunnel banner; shared i18n key. */}
            <div className="mb-6 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-xs leading-5 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-300" />
                <span>{t('applicant_funnel_ai_disclosure')}</span>
            </div>

            <TalentCommandCenter
                t={t}
                hasJobDescription={hasJobDescription}
                selectedJobTitle={selectedPostedJob?.title}
                postedJobsCount={postedJobs.length}
                verifiedCount={verifiedResults.length}
                savedCount={savedIds.size}
                searchLoading={searchLoading}
                regularResultsCount={regularResultsCount}
                onPrimaryAction={handleCommandPrimaryAction}
                onOpenShortlist={onOpenShortlist}
            />

            {/* Verified Talent Section */}
            <div className="p-5 sm:p-6 bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-xl text-white shadow-lg mb-8" aria-live="polite">
                 <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold mb-2">{t('discover_verified_title')}</h2>
                        <p className="text-sm sm:text-base text-gray-300 max-w-3xl">{t('discover_verified_desc')}</p>
                    </div>
                    {verifiedLoading && (
                        <div className="inline-flex items-center gap-2 text-sm text-gray-300">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('talent_loading_verified')}
                        </div>
                    )}
                 </div>
                 {verifiedLoading && <VerifiedTalentSkeleton />}
                 {verifiedError && !verifiedLoading && (
                    <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p>{verifiedError}</p>
                            <button
                                type="button"
                                onClick={fetchVerifiedTalent}
                                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-300/40 px-3 py-2 text-sm font-semibold text-red-50 transition-colors hover:bg-red-400/10"
                            >
                                <RefreshCw className="h-4 w-4" />
                                {t('talent_verified_retry')}
                            </button>
                        </div>
                    </div>
                 )}
                 {verifiedResults.length === 0 && !verifiedLoading && !verifiedError && (
                    <p className="text-center py-4 text-gray-400">{t('discover_no_verified_talent')}</p>
                 )}
                 {!verifiedLoading && !verifiedError && (
                 <div className="space-y-3">
                    {verifiedResults.filter((c) => !hiddenIds.has(c.id)).map((candidate, index) => (
                        <CandidateMatchCard
                            key={candidate.id}
                            candidate={candidate}
                            index={index}
                            variant="verified"
                            t={t}
                            saved={savedIds.has(candidate.id)}
                            saving={savingIds.has(candidate.id)}
                            onSave={handleSaveToShortlist}
                            onHide={handleHideCandidate}
                            onUnlock={(nextCandidate, nextIndex) => setCandidateToUnlock({ ...nextCandidate, index: nextIndex })}
                        />
                    ))}
                 </div>
                 )}
            </div>

            {savedIds.size > 0 && onOpenShortlist && (
                <div className="mb-8 animate-panel-expand rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-blue-950 dark:text-blue-100">{t('talent_shortlist_next_title')}</p>
                                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                                    {formatTranslation(t('talent_shortlist_next_desc'), { n: savedIds.size })}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onOpenShortlist}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                        >
                            {t('talent_open_shortlist')}
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            <form ref={searchFormRef} onSubmit={handleSearch} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('discover_regular_title')}</h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">{t('talent_search_desc')}</p>
                    </div>
                    {jobsLoaded && postedJobs.length > 0 && (
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                            <Briefcase className="h-3.5 w-3.5" />
                            {formatTranslation(t('talent_active_jobs_count'), { n: postedJobs.length })}
                        </span>
                    )}
                </div>
                {/* Posted-job selector — only shown when the employer has active postings */}
                {!jobsLoaded && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('talent_loading_posted_jobs')}
                    </div>
                )}
                {jobsLoaded && jobsError && (
                    <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p>{jobsError}</p>
                            <button
                                type="button"
                                onClick={fetchPostedJobs}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/40 sm:w-auto"
                            >
                                {t('talent_retry_posted_jobs')}
                            </button>
                        </div>
                    </div>
                )}
                {jobsLoaded && !jobsError && postedJobs.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('talent_select_posted_job')}
                        </label>
                        <div className="mb-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('talent_select_posted_job')}>
                            {visiblePostedJobs.map((job) => {
                                const selected = selectedJobId === job.id;
                                return (
                                    <button
                                        key={job.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => handleSelectPostedJob(job.id)}
                                        className={`group rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
                                            selected
                                                ? 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/40'
                                                : 'border-gray-200 bg-gray-50 hover:border-blue-200 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-blue-800'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className={`truncate text-sm font-semibold ${selected ? 'text-blue-950 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'}`}>
                                                    {job.title}
                                                </p>
                                                <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                                                    {job.location || t('talent_location_remote')}
                                                </p>
                                            </div>
                                            {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />}
                                        </div>
                                        {typeof job.applicant_count === 'number' && (
                                            <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                                {job.applicant_count} {t('employer_dashboard_applicants_label')}
                                            </p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {hiddenPostedJobsCount > 0 && (
                            <p className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                                {formatTranslation(t('talent_more_jobs_in_select'), { n: hiddenPostedJobsCount })}
                            </p>
                        )}
                        <select
                            value={selectedJobId}
                            onChange={(e) => handleSelectPostedJob(e.target.value)}
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">
                                {t('talent_select_manual_option')}
                            </option>
                            {postedJobs.map((job) => (
                                <option key={job.id} value={job.id}>
                                    {job.title}{job.location ? ` — ${job.location}` : ''}
                                </option>
                            ))}
                        </select>
                        {selectedPostedJob && (
                            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm dark:border-blue-900/60 dark:bg-blue-950/30">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex min-w-0 items-start gap-2 text-blue-900 dark:text-blue-100">
                                        <Briefcase className="mt-0.5 h-4 w-4 shrink-0" />
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                                    {t('talent_selected_job_label')}
                                                </p>
                                                {selectedBriefEdited && (
                                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                                                        {t('talent_selected_job_edited')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="truncate font-semibold">{selectedPostedJob.title}</p>
                                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-blue-700 dark:text-blue-300">
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin className="h-3.5 w-3.5" />
                                                    {selectedPostedJob.location || t('talent_location_remote')}
                                                </span>
                                                {selectedPostedJob.salary_range && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <DollarSign className="h-3.5 w-3.5" />
                                                        {selectedPostedJob.salary_range}
                                                    </span>
                                                )}
                                                {selectedPostedDate && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock3 className="h-3.5 w-3.5" />
                                                        {selectedPostedDate}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start gap-2 sm:items-end">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                                            <FileText className="h-3.5 w-3.5" />
                                            {selectedBriefEdited ? t('talent_posted_job_edited_hint') : t('talent_posted_job_loaded')}
                                        </span>
                                        {selectedBriefEdited && (
                                            <button
                                                type="button"
                                                onClick={() => setJobDescription(selectedPostedJobBrief)}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/40"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                                {t('talent_restore_posted_job')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {jobsLoaded && !jobsError && postedJobs.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {t('talent_no_posted_jobs')}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {t('talent_no_posted_jobs_desc')}
                        </p>
                        {onPostJob && (
                            <button
                                type="button"
                                onClick={onPostJob}
                                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900/60 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
                            >
                                <PlusCircle className="h-4 w-4" />
                                {t('talent_post_job_first_button')}
                            </button>
                        )}
                    </div>
                )}
                <textarea
                    ref={roleBriefRef}
                    value={jobDescription}
                    onChange={(e) => {
                        setJobDescription(e.target.value);
                        if (searchError && e.target.value.trim()) setSearchError(null);
                    }}
                    rows={8}
                    aria-describedby="talent-search-helper"
                    className="w-full bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 border border-gray-300 rounded-lg shadow-sm p-4 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('talent_jd_placeholder')}
                />
                <div id="talent-search-helper" className="flex flex-col gap-2 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                        {selectedPostedJob
                            ? selectedBriefEdited
                                ? t('talent_search_edited_hint')
                                : t('talent_search_ready_hint')
                            : hasJobDescription
                                ? t('talent_search_manual_ready_hint')
                                : t('talent_search_disabled_hint')}
                    </span>
                    <span>{formatTranslation(t('talent_jd_length'), { n: jobDescription.trim().length })}</span>
                </div>
                 {searchError && <div role="alert" className="text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-md text-sm">{searchError}</div>}
                 <button type="submit" disabled={searchLoading || !hasJobDescription} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400 sm:w-auto">
                    {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {searchLoading ? t('talent_searching') : t('talent_search_button')}
                </button>
            </form>

            {searchLoading && (
                <div role="status" aria-live="polite" className="text-center mt-8">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto"></div>
                    <p className="mt-3 text-gray-600 dark:text-gray-400">{t('talent_analyzing_pool')}</p>
                </div>
            )}

            {regularResults && (
                <div className="mt-8 animate-panel-expand" aria-live="polite">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
                        {regularResults.length > 0 ? formatTranslation(t('talent_found_matches'), { n: regularResults.length }) : t('talent_no_matches')}
                    </h3>
                    {regularResults.length === 0 ? (
                        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-sm text-gray-600 dark:text-gray-400">{t('talent_results_empty_desc')}</p>
                            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => {
                                        roleBriefRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        roleBriefRef.current?.focus();
                                    }}
                                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    {t('talent_refine_brief')}
                                </button>
                                {onPostJob && (
                                    <button
                                        type="button"
                                        onClick={onPostJob}
                                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
                                    >
                                        <PlusCircle className="h-4 w-4" />
                                        {t('talent_post_job_first_button')}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {regularResults.filter((c) => !hiddenIds.has(c.id)).map((candidate, index) => (
                                <CandidateMatchCard
                                    key={candidate.id}
                                    candidate={candidate}
                                    index={index}
                                    variant="regular"
                                    t={t}
                                    saved={savedIds.has(candidate.id)}
                                    saving={savingIds.has(candidate.id)}
                                    onSave={handleSaveToShortlist}
                                    onHide={handleHideCandidate}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {candidateToUnlock && (
                <UnlockTalentModal
                    candidate={candidateToUnlock}
                    canUnlock={canUnlock}
                    onClose={() => setCandidateToUnlock(null)}
                    onUnlocked={() => {
                        const unlockedCandidate = candidateToUnlock;
                        setCandidateToUnlock(null);
                        if (unlockedCandidate) setCandidateToEngage(unlockedCandidate);
                    }}
                    navigateToBusinessPricing={navigateToBusinessPricing}
                    t={t}
                />
            )}

            {candidateToEngage && (
                <EngageCandidateModal
                    candidate={candidateToEngage}
                    jobDescription={jobDescription}
                    employerProfile={profile}
                    onClose={() => setCandidateToEngage(null)}
                    t={t}
                />
            )}
        </div>
    );
};

export default TalentDiscovery;
