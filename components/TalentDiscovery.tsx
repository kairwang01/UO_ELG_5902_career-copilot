
import React, { useState, useCallback, useEffect } from 'react';
import { discoverTalent, type DiscoveredCandidate } from '../services/aiClient';
import type { UserProfile } from '../types';
import EngageCandidateModal from './EngageCandidateModal';
import UnlockTalentModal from './UnlockTalentModal';
import { listActiveEmployerJobs, type JobPosting } from '../lib/recruitingData';
import { saveToShortlist } from '../lib/shortlistData';
import { BookmarkCheck, BookmarkPlus, Briefcase, CheckCircle2, Loader2, PlusCircle, Search, XCircle } from 'lucide-react';
import { useToast as useSharedToast } from './Toast';

interface MatchedCandidate extends UserProfile {
    compatibilityScore: number;
    summary: string;
    strengths: string[];
    potentialGaps: string[];
    suggestedQuestions: string[];
}

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

interface TalentDiscoveryProps {
    t: (key: string) => string;
    profile: UserProfile;
    onPostJob?: () => void;
    navigateToBusinessPricing: () => void;
}

const TalentDiscovery: React.FC<TalentDiscoveryProps> = ({ t, profile, onPostJob, navigateToBusinessPricing }) => {
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
    const [postedJobs, setPostedJobs] = useState<JobPosting[]>([]);
    const [jobsLoaded, setJobsLoaded] = useState(false);
    const [jobsError, setJobsError] = useState<string | null>(null);

    // Track which jobs are currently selected in the selector (for snapshot)
    const [selectedJobId, setSelectedJobId] = useState<string>('');

    // Session-level saved set (candidate.id) so we can disable after saving
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

    const { addToast } = useSharedToast();
    const selectedPostedJob = postedJobs.find((job) => job.id === selectedJobId) ?? null;
    const hasJobDescription = jobDescription.trim().length > 0;
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
        if (!profile.id) {
            setPostedJobs([]);
            setJobsLoaded(true);
            return;
        }
        setJobsLoaded(false);
        setJobsError(null);
        try {
            const jobs = await listActiveEmployerJobs(profile.id);
            setPostedJobs(jobs);
        } catch {
            setPostedJobs([]);
            setJobsError(t('talent_posted_jobs_error'));
        } finally {
            setJobsLoaded(true);
        }
    }, [profile.id, t]);

    // Fetch employer's active posted jobs once on mount.
    useEffect(() => {
        fetchPostedJobs();
    }, [fetchPostedJobs]);

    const handleSelectPostedJob = (jobId: string) => {
        setSelectedJobId(jobId);
        if (!jobId) return;
        const job = postedJobs.find((j) => j.id === jobId);
        if (!job) return;
        const parts: string[] = [job.title];
        if (job.location) parts.push(job.location);
        if (job.description) parts.push('', job.description);
        setJobDescription(parts.join('\n'));
    };

    // Pre-fetch verified talent on component mount — server-side read (client
    // reads of other users' profiles are rules-blocked by design).
    useEffect(() => {
        let cancelled = false;
        const fetchVerifiedTalent = async () => {
            setVerifiedLoading(true);
            setVerifiedError(null);
            try {
                const { candidates } = await discoverTalent();
                if (cancelled) return;
                setVerifiedResults(candidates.map((c) => toMatchedCandidate(c, t('discover_verified_summary_default'))));
            } catch (err) {
                if (!cancelled) setVerifiedError(err instanceof Error ? err.message : t('talent_load_error'));
            } finally {
                if (!cancelled) setVerifiedLoading(false);
            }
        };
        fetchVerifiedTalent();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasJobDescription) {
            setSearchError(t('talent_jd_required'));
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
            setRegularResults(allMatched.filter(c => !c.nft_staked && c.compatibilityScore >= 70));
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
        // Fall back to extracting the first line of the description as job title
        const firstLine = jobDescription.split('\n')[0].trim().slice(0, 200);
        return { job_id: 'manual', job_title: firstLine || t('talent_unspecified_role') };
    };

    const handleSaveToShortlist = async (candidate: MatchedCandidate) => {
        if (savedIds.has(candidate.id)) return;
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
        }
    };

    const paidBusinessStatuses = new Set(['single_post', 'job_pack', 'starter', 'growth', 'pro']);
    const canUnlock = paidBusinessStatuses.has(profile.subscription_status ?? '');

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
                 {verifiedError && !verifiedLoading && (
                    <p className="text-sm rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-red-200">{verifiedError}</p>
                 )}
                 {verifiedResults.length === 0 && !verifiedLoading && !verifiedError && (
                    <p className="text-center py-4 text-gray-400">{t('discover_no_verified_talent')}</p>
                 )}
                 <div className="space-y-3">
                    {verifiedResults.map((candidate, index) => (
                        <div key={candidate.id} className="p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white">{t('talent_candidate_label').replace('{n}', String(index + 1))}</p>
                                    <p className="text-sm text-gray-300 mt-1">{candidate.summary}</p>
                                    {/* Strengths chips */}
                                    {candidate.strengths.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {candidate.strengths.slice(0, 6).map((s, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-green-600/40 text-green-200 border border-green-500/40">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {/* Potential gaps */}
                                    {candidate.potentialGaps.length > 0 && (
                                        <ul className="mt-2 space-y-0.5">
                                            {candidate.potentialGaps.slice(0, 3).map((g, i) => (
                                                <li key={i} className="flex items-start gap-1 text-xs text-red-300">
                                                    <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                    {g}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-3 sm:justify-end sm:flex-shrink-0">
                                    {candidate.compatibilityScore > 0 && (
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-green-400">{candidate.compatibilityScore}%</p>
                                            <p className="text-xs text-gray-300">{t('talent_match_label')}</p>
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-2">
                                        {candidate.compatibilityScore > 0 && (
                                            <button
                                                onClick={() => handleSaveToShortlist(candidate)}
                                                disabled={savedIds.has(candidate.id)}
                                                title={savedIds.has(candidate.id) ? t('shortlist_already_saved') : t('shortlist_save_button')}
                                                aria-label={savedIds.has(candidate.id) ? t('shortlist_already_saved') : t('shortlist_save_button')}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    savedIds.has(candidate.id)
                                                        ? 'bg-white/10 text-green-400 cursor-not-allowed'
                                                        : 'bg-white/20 text-white hover:bg-white/30'
                                                }`}
                                            >
                                                {savedIds.has(candidate.id)
                                                    ? <BookmarkCheck className="w-4 h-4" />
                                                    : <BookmarkPlus className="w-4 h-4" />
                                                }
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setCandidateToUnlock({ ...candidate, index })}
                                            className="px-4 py-2 bg-white text-gray-900 font-semibold text-sm rounded-lg hover:bg-gray-200 transition-colors"
                                        >
                                            {t('discover_unlock_engage_button')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>

            <form onSubmit={handleSearch} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('discover_regular_title')}</h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">{t('talent_search_desc')}</p>
                    </div>
                    {jobsLoaded && postedJobs.length > 0 && (
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                            <Briefcase className="h-3.5 w-3.5" />
                            {t('talent_active_jobs_count').replace('{n}', String(postedJobs.length))}
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
                            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm dark:border-blue-900/60 dark:bg-blue-950/30 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-start gap-2 text-blue-900 dark:text-blue-100">
                                    <Briefcase className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                                            {t('talent_selected_job_label')}
                                        </p>
                                        <p className="truncate font-semibold">{selectedPostedJob.title}</p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            {selectedPostedJob.location || t('talent_location_remote')}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                    {t('talent_posted_job_loaded')}
                                </span>
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
                    <span>{selectedPostedJob ? t('talent_search_ready_hint') : t('talent_search_disabled_hint')}</span>
                    <span>{t('talent_jd_length').replace('{n}', String(jobDescription.trim().length))}</span>
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
                        {regularResults.length > 0 ? t('talent_found_matches').replace('{n}', String(regularResults.length)) : t('talent_no_matches')}
                    </h3>
                    {regularResults.length === 0 ? (
                        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-sm text-gray-600 dark:text-gray-400">{t('talent_results_empty_desc')}</p>
                        </div>
                    ) : (
                    <div className="space-y-4">
                        {regularResults.map((candidate, index) => (
                            <div key={candidate.id} className="p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800 dark:text-white">{t('talent_candidate_label').replace('{n}', String(index + 1))}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{candidate.summary}</p>
                                        {/* Strengths chips */}
                                        {candidate.strengths.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {candidate.strengths.slice(0, 6).map((s, i) => (
                                                    <span key={i} className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Potential gaps */}
                                        {candidate.potentialGaps.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('talent_potential_gaps')}</p>
                                                <ul className="space-y-0.5">
                                                    {candidate.potentialGaps.slice(0, 3).map((g, i) => (
                                                        <li key={i} className="flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
                                                            <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                            {g}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between gap-3 sm:items-start sm:justify-end sm:flex-shrink-0">
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{candidate.compatibilityScore}%</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('talent_match_label')}</p>
                                        </div>
                                        <button
                                            onClick={() => handleSaveToShortlist(candidate)}
                                            disabled={savedIds.has(candidate.id)}
                                            title={savedIds.has(candidate.id) ? t('shortlist_already_saved') : t('shortlist_save_button')}
                                            aria-label={savedIds.has(candidate.id) ? t('shortlist_already_saved') : t('shortlist_save_button')}
                                            className={`p-2 rounded-lg transition-colors border ${
                                                savedIds.has(candidate.id)
                                                    ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 cursor-not-allowed bg-green-50 dark:bg-green-900/20'
                                                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
                                            }`}
                                        >
                                            {savedIds.has(candidate.id)
                                                ? <BookmarkCheck className="w-4 h-4" />
                                                : <BookmarkPlus className="w-4 h-4" />
                                            }
                                        </button>
                                    </div>
                                </div>
                            </div>
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
