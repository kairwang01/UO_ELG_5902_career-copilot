

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Clock3,
    FileWarning,
    RotateCcw,
    Search,
    SlidersHorizontal,
    Target,
    Users,
} from 'lucide-react';
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
type SortKey = 'score' | 'newest' | 'name';
type RecencyFilter = 'all' | '7' | '30';
type AnalysisFilter = 'all' | 'analyzed' | 'needs_review';

const SCORE_OPTIONS: ScoreThreshold[] = ['all', '50', '70', '85'];
const SORT_OPTIONS: SortKey[] = ['score', 'newest', 'name'];
const RECENCY_OPTIONS: RecencyFilter[] = ['all', '7', '30'];
const ANALYSIS_OPTIONS: AnalysisFilter[] = ['all', 'analyzed', 'needs_review'];

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

function isWithinDays(dateValue: string | null, days: number): boolean {
    if (!dateValue) return false;
    const timestamp = new Date(dateValue).getTime();
    if (Number.isNaN(timestamp)) return false;
    return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
}

const ApplicantFunnel: React.FC<ApplicantFunnelProps> = ({ job, onBack, t }) => {
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState(t('applicant_funnel_loading_initial'));
    const [error, setError] = useState<string | null>(null);
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);

    // ── Filter state ────────────────────────────────────────────────────────────
    const [keyword, setKeyword]         = useState('');
    const [minScore, setMinScore]       = useState<ScoreThreshold>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>('all');
    const [analysisFilter, setAnalysisFilter] = useState<AnalysisFilter>('all');
    const [sortKey, setSortKey]         = useState<SortKey>('score');

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
            if (result.length > 0) {
                setSelectedApplicant(result[0]);
            }
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
    const funnelData = useMemo(() => [
        { stage: t('applicant_funnel_stage_applied'), count: applicants.length },
        { stage: t('applicant_funnel_stage_screened'), count: applicants.filter(a => (a.compatibility_score ?? 0) >= 70).length },
        { stage: t('applicant_funnel_stage_high_match'), count: applicants.filter(a => (a.compatibility_score ?? 0) >= 85).length },
    ], [applicants, t]);

    const statusOptions = useMemo(() => {
        const values = Array.from(new Set(applicants.map((applicant) => applicant.status).filter(Boolean)));
        return values.sort((a, b) => a.localeCompare(b));
    }, [applicants]);

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
                ].join(' ').toLowerCase();
                return haystack.includes(kw);
            });
        }

        if (minScore !== 'all') {
            const threshold = parseInt(minScore, 10);
            result = result.filter(a => (a.compatibility_score ?? 0) >= threshold);
        }

        if (statusFilter !== 'all') {
            result = result.filter((applicant) => applicant.status === statusFilter);
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
            result.sort((a, b) => new Date(b.application_date).getTime() - new Date(a.application_date).getTime());
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

    const clearFilters = () => {
        setKeyword('');
        setMinScore('all');
        setStatusFilter('all');
        setRecencyFilter('all');
        setAnalysisFilter('all');
        setSortKey('score');
    };

    const getStatusLabel = (status: string): string => {
        const normalized = status.trim().toLowerCase();
        const keyMap: Record<string, string> = {
            applied: 'applications_status_applied',
            interviewing: 'applications_status_interviewing',
            hired: 'applications_status_hired',
            rejected: 'applications_status_rejected',
        };
        return keyMap[normalized] ? t(keyMap[normalized]) : status;
    };

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

    if (loading) {
        return (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-700 animate-spin"></div>
                <p className="mt-4 text-base font-medium text-gray-700 dark:text-gray-300">{loadingMessage}</p>
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
                <button onClick={onBack} className="mt-6 rounded-lg border border-gray-300 bg-gray-100 px-6 py-2 font-semibold text-gray-800 shadow-sm transition-all hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
                    {t('applicant_funnel_back')}
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <button onClick={onBack} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                {t('applicant_funnel_back')}
            </button>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                            {formatTranslation(t('applicant_funnel_title'), { title: job.title })}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {t('applicant_funnel_subtitle')}
                        </p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        {formatTranslation(t('applicant_funnel_filter_result'), {
                            shown: filteredApplicants.length,
                            total: applicants.length,
                        })}
                    </span>
                </div>
                <FunnelChart data={funnelData} t={t} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: t('applicant_funnel_stat_total'), value: applicants.length, Icon: Users },
                    { label: t('applicant_funnel_stat_high_match'), value: highMatchCount, Icon: Target },
                    { label: t('applicant_funnel_stat_recent'), value: recentCount, Icon: Clock3 },
                    { label: t('applicant_funnel_stat_needs_review'), value: needsReviewCount, Icon: FileWarning },
                ].map(({ label, value, Icon }) => (
                    <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
                            <Icon className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                        </div>
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <aside className="flex h-auto min-h-[560px] flex-col rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-1 lg:h-[70vh]">
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

                    <div className="mb-4 flex-shrink-0 space-y-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400" htmlFor="applicant-search">
                            {t('applicant_funnel_search_label')}
                        </label>
                        <div className="relative">
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
                            <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                                <span>{t('applicant_funnel_score_label')}</span>
                                <select
                                    value={minScore}
                                    onChange={e => setMinScore(e.target.value as ScoreThreshold)}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                >
                                    {SCORE_OPTIONS.map(option => (
                                        <option key={option} value={option}>{scoreOptionLabel(option)}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                                <span>{t('applicant_funnel_status_label')}</span>
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                >
                                    <option value="all">{t('applicant_funnel_status_all')}</option>
                                    {statusOptions.map(status => (
                                        <option key={status} value={status}>{getStatusLabel(status)}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                                <span>{t('applicant_funnel_recency_label')}</span>
                                <select
                                    value={recencyFilter}
                                    onChange={e => setRecencyFilter(e.target.value as RecencyFilter)}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                >
                                    {RECENCY_OPTIONS.map(option => (
                                        <option key={option} value={option}>{recencyOptionLabel(option)}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                                <span>{t('applicant_funnel_analysis_label')}</span>
                                <select
                                    value={analysisFilter}
                                    onChange={e => setAnalysisFilter(e.target.value as AnalysisFilter)}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                >
                                    {ANALYSIS_OPTIONS.map(option => (
                                        <option key={option} value={option}>{analysisOptionLabel(option)}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                                <span>{t('applicant_funnel_sort_label')}</span>
                                <select
                                    value={sortKey}
                                    onChange={e => setSortKey(e.target.value as SortKey)}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                >
                                    {SORT_OPTIONS.map(option => (
                                        <option key={option} value={option}>{sortOptionLabel(option)}</option>
                                    ))}
                                </select>
                            </label>
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
                                        onClick={() => setSelectedApplicant(applicant)}
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
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </aside>

                <section className="min-h-[560px] rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2 lg:h-[70vh] lg:overflow-y-auto">
                    {!selectedApplicant ? (
                        <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-dashed border-gray-300 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            {t('applicant_funnel_select_prompt')}
                        </div>
                    ) : hasApplicantAnalysis(selectedApplicant) ? (
                        <div className="space-y-5">
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center dark:border-gray-700 dark:bg-gray-900">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                    {selectedApplicant.candidate_name || t('applicant_funnel_unnamed_candidate')}
                                </h2>
                                <p className={`mt-1 text-lg font-bold ${getScoreTone(selectedApplicant.compatibility_score ?? 0)}`}>
                                    {formatTranslation(t('applicant_funnel_match_score_value'), { score: selectedApplicant.compatibility_score ?? 0 })}
                                </p>
                                {selectedApplicant.summary && (
                                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">{selectedApplicant.summary}</p>
                                )}
                            </div>

                            <div className="grid gap-4 xl:grid-cols-2">
                                <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/60 dark:bg-green-950/20">
                                    <h4 className="font-semibold text-green-800 dark:text-green-200">{t('applicant_funnel_strengths')}</h4>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-green-900 dark:text-green-100">
                                        {selectedApplicant.strengths.map((strength, index) => <li key={`${strength}-${index}`}>{strength}</li>)}
                                    </ul>
                                </div>
                                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/60 dark:bg-yellow-950/20">
                                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">{t('applicant_funnel_potential_gaps')}</h4>
                                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-yellow-900 dark:text-yellow-100">
                                        {selectedApplicant.potentialGaps.map((gap, index) => <li key={`${gap}-${index}`}>{gap}</li>)}
                                    </ul>
                                </div>
                            </div>

                            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                                <h4 className="font-semibold text-indigo-800 dark:text-indigo-200">{t('applicant_funnel_questions')}</h4>
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-indigo-900 dark:text-indigo-100">
                                    {selectedApplicant.suggestedQuestions.map((question, index) => <li key={`${question}-${index}`}>{question}</li>)}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full min-h-[360px] items-center justify-center text-center text-gray-500 dark:text-gray-400">
                            <div className="max-w-sm rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900">
                                <FileWarning className="mx-auto h-10 w-10 text-amber-500" />
                                <p className="mt-3 font-semibold text-gray-700 dark:text-gray-200">
                                    {formatTranslation(t('applicant_funnel_no_analysis_title'), {
                                        name: selectedApplicant.candidate_name || t('applicant_funnel_unnamed_candidate'),
                                    })}
                                </p>
                                <p className="mx-auto mt-2 text-sm leading-6">{t('applicant_funnel_no_analysis_desc')}</p>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default ApplicantFunnel;
