

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { listJobApplicants, type JobApplicant } from '../services/aiClient';
import FunnelChart from './FunnelChart';
import type { JobPosting } from '../lib/recruitingData';

interface ApplicantFunnelProps {
  job: JobPosting;
  onBack: () => void;
  t: (key: string) => string;
}

// Server-computed safe shape: match analysis is flattened onto each applicant;
// resume_text never reaches the browser (see services/aiClient listJobApplicants).
type Applicant = JobApplicant;

type ScoreThreshold = 'all' | '50' | '70' | '85';
type SortKey = 'score' | 'name' | 'newest';

const SCORE_OPTIONS: { value: ScoreThreshold; label: string }[] = [
    { value: 'all', label: 'All scores' },
    { value: '50',  label: '50%+' },
    { value: '70',  label: '70%+' },
    { value: '85',  label: '85%+' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'score',  label: 'Match score' },
    { value: 'name',   label: 'Name A–Z' },
    { value: 'newest', label: 'Newest first' },
];

const ApplicantFunnel: React.FC<ApplicantFunnelProps> = ({ job, onBack, t }) => {
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Fetching applicants...');
    const [error, setError] = useState<string | null>(null);
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);

    // ── Filter state ────────────────────────────────────────────────────────────
    const [keyword, setKeyword]         = useState('');
    const [minScore, setMinScore]       = useState<ScoreThreshold>('all');
    const [sortKey, setSortKey]         = useState<SortKey>('score');

    const fetchApplicants = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setLoadingMessage('Fetching and analyzing applicants…');

            // Single server-side call: reads applications + resumes with the Admin
            // SDK, runs the match analysis on the server, and returns safe fields
            // only (already sorted by match score). Resumes never reach the browser.
            const { applicants: result } = await listJobApplicants(job.id);

            setApplicants(result);
            if (result.length > 0) {
                setSelectedApplicant(result[0]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load applicant data.');
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    }, [job.id]);

    useEffect(() => {
        fetchApplicants();
    }, [fetchApplicants]);

    // ── Real funnel stages derived from actual data ─────────────────────────────
    const funnelData = useMemo(() => [
        { stage: 'Applied',            count: applicants.length },
        { stage: 'AI Screened (70%+)', count: applicants.filter(a => (a.compatibility_score ?? 0) >= 70).length },
        { stage: 'High Match (85%+)',  count: applicants.filter(a => (a.compatibility_score ?? 0) >= 85).length },
    ], [applicants]);

    // ── Filtered + sorted list ──────────────────────────────────────────────────
    const filteredApplicants = useMemo(() => {
        let result = [...applicants];

        // Keyword filter — candidate name (case-insensitive)
        const kw = keyword.trim().toLowerCase();
        if (kw) {
            result = result.filter(a =>
                (a.candidate_name ?? '').toLowerCase().includes(kw)
            );
        }

        // Min score filter
        if (minScore !== 'all') {
            const threshold = parseInt(minScore, 10);
            result = result.filter(a => (a.compatibility_score ?? 0) >= threshold);
        }

        // Sort
        if (sortKey === 'score') {
            result.sort((a, b) => (b.compatibility_score ?? 0) - (a.compatibility_score ?? 0));
        } else if (sortKey === 'name') {
            result.sort((a, b) => (a.candidate_name ?? '').localeCompare(b.candidate_name ?? ''));
        } else {
            // newest first
            result.sort((a, b) => new Date(b.application_date).getTime() - new Date(a.application_date).getTime());
        }

        return result;
    }, [applicants, keyword, minScore, sortKey]);

    // Active filter count (excludes sort as it's always set)
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (keyword.trim()) count++;
        if (minScore !== 'all') count++;
        return count;
    }, [keyword, minScore]);

    const clearFilters = () => {
        setKeyword('');
        setMinScore('all');
        setSortKey('score');
    };

    if (loading) {
        return (
            <div className="text-center p-8">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">{loadingMessage}</p>
            </div>
        );
    }

    if (error) return <div className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-4 rounded-lg">{error}</div>;

    if (applicants.length === 0) {
        return (
            <div className="text-center p-8">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">No Applicants Yet</h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Check back later to see candidates who have applied for this role.</p>
                <button onClick={onBack} className="mt-6 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold py-2 px-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
                    &larr; Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <button onClick={onBack} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                &larr; Back to Dashboard
            </button>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Hiring Funnel for "{job.title}"</h3>
                <FunnelChart data={funnelData} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Left pane: filter bar + applicant list ── */}
                <div className="lg:col-span-1 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 h-[70vh] flex flex-col">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-3">Applicant List</h3>

                    {/* ── Filter bar ── */}
                    <div className="space-y-2 mb-3 flex-shrink-0">
                        {/* Keyword */}
                        <input
                            type="text"
                            placeholder="Search by name…"
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            className="w-full text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <div className="flex gap-2">
                            {/* Min score */}
                            <select
                                value={minScore}
                                onChange={e => setMinScore(e.target.value as ScoreThreshold)}
                                className="flex-1 text-sm px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {SCORE_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>

                            {/* Sort */}
                            <select
                                value={sortKey}
                                onChange={e => setSortKey(e.target.value as SortKey)}
                                className="flex-1 text-sm px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {SORT_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Result count + clear */}
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>
                                Showing {filteredApplicants.length} of {applicants.length} applicant{applicants.length !== 1 ? 's' : ''}
                            </span>
                            {activeFilterCount > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                >
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 dark:bg-blue-500 text-white text-[10px] font-bold leading-none">
                                        {activeFilterCount}
                                    </span>
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Scrollable applicant cards ── */}
                    <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                        {filteredApplicants.length === 0 ? (
                            /* Empty state */
                            <div className="flex flex-col items-center justify-center h-full text-center py-8 px-2">
                                <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No applicants match your filters</p>
                                <button
                                    onClick={clearFilters}
                                    className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                                >
                                    Clear all filters
                                </button>
                            </div>
                        ) : (
                            filteredApplicants.map(applicant => (
                                <button
                                    key={applicant.id}
                                    onClick={() => setSelectedApplicant(applicant)}
                                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                                        selectedApplicant?.id === applicant.id
                                            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 dark:border-blue-400'
                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
                                            {applicant.candidate_name || 'Unnamed Candidate'}
                                        </p>
                                        <p className={`font-bold text-lg flex-shrink-0 ${
                                            (applicant.compatibility_score ?? 0) >= 75
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-yellow-600 dark:text-yellow-400'
                                        }`}>
                                            {applicant.compatibility_score}%
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Applied: {new Date(applicant.application_date).toLocaleDateString()}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* ── Right pane: detail (unchanged) ── */}
                <div className="lg:col-span-2 p-4 h-[70vh] overflow-y-auto">
                    {!selectedApplicant ? (
                        <div className="flex items-center justify-center h-full text-gray-500">Select an applicant to view their detailed analysis.</div>
                    ) : selectedApplicant.summary ? (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedApplicant.candidate_name || 'Unnamed Candidate'}</h2>
                                <p className="text-lg font-bold text-blue-700 dark:text-blue-400 mt-1">Match Score: {selectedApplicant.compatibility_score}%</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-xl mx-auto">{selectedApplicant.summary}</p>
                            </div>

                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h4 className="font-semibold text-green-800">Strengths</h4>
                                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-green-900">{selectedApplicant.strengths.map((s,i) => <li key={i}>{s}</li>)}</ul>
                            </div>
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <h4 className="font-semibold text-yellow-800">Potential Gaps</h4>
                                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-yellow-900">{selectedApplicant.potentialGaps.map((g,i) => <li key={i}>{g}</li>)}</ul>
                            </div>
                             <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <h4 className="font-semibold text-indigo-800">Suggested Interview Questions</h4>
                                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-indigo-900">{selectedApplicant.suggestedQuestions.map((q,i) => <li key={i}>{q}</li>)}</ul>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                            <div>
                                <p className="font-semibold text-gray-700 dark:text-gray-300">{selectedApplicant.candidate_name || 'Unnamed Candidate'}</p>
                                <p className="mt-2 text-sm max-w-xs mx-auto">No résumé on file for this applicant, so an AI match analysis isn’t available yet.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApplicantFunnel;
