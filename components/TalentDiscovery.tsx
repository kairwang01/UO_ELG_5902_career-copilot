
import React, { useState, useEffect } from 'react';
import { analyzeCandidateMatch } from '../services/aiClient';
import type { UserProfile } from '../types';
import EngageCandidateModal from './EngageCandidateModal';
import UnlockTalentModal from './UnlockTalentModal';
import { listCandidateProfilesWithResume, listActiveEmployerJobs, type JobPosting } from '../lib/recruitingData';
import { saveToShortlist } from '../lib/shortlistData';
import { BookmarkCheck, BookmarkPlus, CheckCircle2, XCircle } from 'lucide-react';

interface MatchedCandidate extends UserProfile {
    compatibilityScore: number;
    summary: string;
    strengths: string[];
    potentialGaps: string[];
    suggestedQuestions: string[];
}

interface TalentDiscoveryProps {
    t: (key: string) => string;
    profile: UserProfile;
    navigateToBusinessPricing: () => void;
}

// ---- inline toast -----------------------------------------------------------
interface Toast { id: number; message: string; ok: boolean }
function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const show = (message: string, ok = true) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, ok }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    };
    return { toasts, show };
}
function ToastContainer({ toasts }: { toasts: Toast[] }) {
    return (
        <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${t.ok ? 'bg-teal-600 text-white' : 'bg-red-600 text-white'}`}>
                    {t.message}
                </div>
            ))}
        </div>
    );
}

const TalentDiscovery: React.FC<TalentDiscoveryProps> = ({ t, profile, navigateToBusinessPricing }) => {
    const [jobDescription, setJobDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [verifiedResults, setVerifiedResults] = useState<MatchedCandidate[]>([]);
    const [regularResults, setRegularResults] = useState<MatchedCandidate[] | null>(null);

    const [candidateToUnlock, setCandidateToUnlock] = useState<(MatchedCandidate & { index: number }) | null>(null);
    const [candidateToEngage, setCandidateToEngage] = useState<(MatchedCandidate & { index: number }) | null>(null);

    // Posted-job selector state
    const [postedJobs, setPostedJobs] = useState<JobPosting[]>([]);
    const [jobsLoaded, setJobsLoaded] = useState(false);

    // Track which jobs are currently selected in the selector (for snapshot)
    const [selectedJobId, setSelectedJobId] = useState<string>('');

    // Session-level saved set (candidate.id) so we can disable after saving
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

    const { toasts, show: showToast } = useToast();

    // Fetch employer's active posted jobs once on mount
    useEffect(() => {
        if (!profile.id) return;
        listActiveEmployerJobs(profile.id)
            .then((jobs) => setPostedJobs(jobs))
            .catch(() => { /* silent fail — hide selector */ })
            .finally(() => setJobsLoaded(true));
    }, [profile.id]);

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

    // Pre-fetch verified talent on component mount
    useEffect(() => {
        const fetchVerifiedTalent = async () => {
            setLoading(true);
            try {
                const candidates = (await listCandidateProfilesWithResume(50))
                    .filter((candidate) => candidate.nft_staked)
                    .slice(0, 10);

                // Simulate a generic match score for display before a specific search
                const pseudoMatched = candidates.map(c => ({
                    ...c,
                    compatibilityScore: 0,
                    summary: "This candidate's skills are verified and staked in the talent vault.",
                    strengths: [],
                    potentialGaps: [],
                    suggestedQuestions: [],
                }));
                setVerifiedResults(pseudoMatched);

            } catch (err) {
                 setError(err instanceof Error ? err.message : 'Could not load verified talent.');
            } finally {
                setLoading(false);
            }
        };
        fetchVerifiedTalent();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!jobDescription.trim()) {
            setError('Please provide a job description to search for talent.');
            return;
        }
        setLoading(true);
        setError(null);
        setRegularResults(null);
        try {
            const candidates = await listCandidateProfilesWithResume(50);
            if (candidates.length === 0) {
                setRegularResults([]);
                setVerifiedResults([]);
                return;
            }

            const allMatched: MatchedCandidate[] = [];
            for (const candidate of candidates) {
                if (!candidate.resume_text) {
                    continue;
                }
                try {
                    const matchResult = await analyzeCandidateMatch(candidate.resume_text, jobDescription);
                    allMatched.push({
                        ...candidate,
                        compatibilityScore: matchResult.score,
                        summary: matchResult.summary,
                        strengths: matchResult.strengths,
                        potentialGaps: matchResult.potentialGaps,
                        suggestedQuestions: matchResult.suggestedQuestions,
                    });
                } catch (e) {
                    console.error(`Error matching candidate ${candidate.id}:`, e);
                    // Don't add to results if matching fails
                }
            }

            allMatched.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

            setVerifiedResults(allMatched.filter(c => c.nft_staked));
            setRegularResults(allMatched.filter(c => !c.nft_staked && c.compatibilityScore >= 70));

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during the search.');
        } finally {
            setLoading(false);
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
        return { job_id: 'manual', job_title: firstLine || 'Unspecified role' };
    };

    const handleSaveToShortlist = async (candidate: MatchedCandidate) => {
        if (savedIds.has(candidate.id)) return;
        const { job_id, job_title } = getJobInfo();
        try {
            await saveToShortlist(profile.id, {
                candidate_name: candidate.full_name || `Candidate #${candidate.id.slice(0, 6)}`,
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
            showToast(t('shortlist_saved_toast'));
        } catch (err) {
            showToast(err instanceof Error ? err.message : t('shortlist_save_error'), false);
        }
    };

    const canUnlock = profile.subscription_status === 'job_pack';

    return (
        <div className="p-4 animate-fade-in">
            <ToastContainer toasts={toasts} />

            {/* Verified Talent Section */}
            <div className="p-6 bg-gradient-to-br from-gray-700 via-gray-800 to-black rounded-xl text-white shadow-lg mb-8">
                 <h2 className="text-2xl font-bold mb-2">{t('discover_verified_title')}</h2>
                 <p className="text-gray-300 mb-6 max-w-3xl">{t('discover_verified_desc')}</p>
                 {verifiedResults.length === 0 && !loading && (
                    <p className="text-center py-4 text-gray-400">{t('discover_no_verified_talent')}</p>
                 )}
                 <div className="space-y-3">
                    {verifiedResults.map((candidate, index) => (
                        <div key={candidate.id} className="p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white">Candidate #{index + 1}</p>
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
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    {candidate.compatibilityScore > 0 && (
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-green-400">{candidate.compatibilityScore}%</p>
                                            <p className="text-xs text-gray-300">Match</p>
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-2">
                                        {candidate.compatibilityScore > 0 && (
                                            <button
                                                onClick={() => handleSaveToShortlist(candidate)}
                                                disabled={savedIds.has(candidate.id)}
                                                title={savedIds.has(candidate.id) ? t('shortlist_already_saved') : t('shortlist_save_button')}
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
                                            className="px-4 py-2 bg-white text-gray-900 font-semibold text-sm rounded-lg hover:bg-gray-200"
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

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('discover_regular_title')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Paste a job description to proactively find matching candidates from the Career CoPilot talent pool.</p>

            <form onSubmit={handleSearch} className="space-y-4">
                {/* Posted-job selector — only shown when the employer has active postings */}
                {jobsLoaded && postedJobs.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('talent_select_posted_job')}
                        </label>
                        <select
                            defaultValue=""
                            onChange={(e) => handleSelectPostedJob(e.target.value)}
                            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="" disabled>
                                {t('talent_select_posted_job_placeholder')}
                            </option>
                            {postedJobs.map((job) => (
                                <option key={job.id} value={job.id}>
                                    {job.title}{job.location ? ` — ${job.location}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {jobsLoaded && postedJobs.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                        {t('talent_no_posted_jobs')}
                    </p>
                )}
                <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={8}
                    className="w-full bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 border border-gray-300 rounded-lg shadow-sm p-4 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Paste the full job description here..."
                />
                 {error && <div className="text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-md text-sm">{error}</div>}
                 <button type="submit" disabled={loading} className="w-full sm:w-auto px-8 py-3 bg-blue-700 text-white font-bold rounded-lg shadow-md hover:bg-blue-800 disabled:bg-blue-400">
                    {loading ? 'Searching...' : 'Find Matching Candidates'}
                </button>
            </form>

            {loading && (
                <div className="text-center mt-8">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto"></div>
                    <p className="mt-3 text-gray-600 dark:text-gray-400">Analyzing talent pool...</p>
                </div>
            )}

            {regularResults && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
                        {regularResults.length > 0 ? `Found ${regularResults.length} other match(es)` : 'No other strong matches found'}
                    </h3>
                    <div className="space-y-4">
                        {regularResults.map((candidate, index) => (
                            <div key={candidate.id} className="p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800 dark:text-white">Candidate #{index + 1}</p>
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
                                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Potential gaps:</p>
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
                                    <div className="flex items-start gap-3 flex-shrink-0">
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{candidate.compatibilityScore}%</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Match</p>
                                        </div>
                                        <button
                                            onClick={() => handleSaveToShortlist(candidate)}
                                            disabled={savedIds.has(candidate.id)}
                                            title={savedIds.has(candidate.id) ? t('shortlist_already_saved') : t('shortlist_save_button')}
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
                </div>
            )}

            {candidateToUnlock && (
                <UnlockTalentModal
                    candidate={candidateToUnlock}
                    canUnlock={canUnlock}
                    onClose={() => setCandidateToUnlock(null)}
                    onUnlocked={(c) => {
                        setCandidateToUnlock(null);
                        setCandidateToEngage(c);
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
