
import React, { useState, useEffect, useCallback } from 'react';
import { Info, Search } from 'lucide-react';
import { findOpportunities } from '../../services/aiClient';
import type { OpportunityResult, Opportunity } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import type { AppSession as Session } from '../../lib/data';
import { useToast } from '../Toast';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { app as firebaseApp } from '../../lib/firebaseClient';
import { renderFormattedText } from './ToolUtils';

interface OpportunityFinderProps {
  resumeText: string;
  market: string;
  openTool: (tool: string, input?: string) => void;
  session: Session | null;
  t: (key: string) => string;
}

const OpportunityFinder: React.FC<OpportunityFinderProps> = ({ resumeText, market, openTool, session, t }) => {
  // Initialise true: this tool auto-fetches on mount, so the loader should show
  // immediately (preserves the pre-refactor useState(true) behaviour).
  const { loading, begin, end, cancel } = useCancellableLoading(true);
  const { addToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  // FIX 1: derive a stable primitive so auth token-refresh (which creates a new
  // session object reference) does not cascade through useCallback deps and
  // refire the expensive AI search.
  const sessionUserId = session?.user?.id ?? null;
  const [result, setResult] = useState<OpportunityResult | null>(null);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [opportunityFilters, setOpportunityFilters] = useState<{ company: string, location: string }>({ company: 'all', location: 'all' });
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());

  const applyToInternalJob = async (jobId: string, compatibilityScore: number | undefined) => {
    if (!session?.user) {
        addToast('You must be signed in to apply.', 'error');
        return;
    }

    try {
        const db = getFirestore(firebaseApp);
        const jobSnap = await getDoc(doc(db, 'job_postings', jobId));
        if (!jobSnap.exists()) {
          throw new Error('Job posting not found.');
        }
        const jobData = jobSnap.data();
        const candidateName = session.user.user_metadata?.full_name || session.user.email || 'Candidate';
        await addDoc(collection(db, 'job_applications'), {
          job_id: jobId,
          candidate_id: session.user.id,
          employer_id: jobData.employer_id,
          job_title: jobData.title,
          candidate_name: candidateName,
          status: 'Applied',
          compatibility_score: compatibilityScore ?? null,
          notes: null,
          application_date: serverTimestamp(),
        });

        setAppliedJobs(prev => new Set(prev).add(jobId));
    } catch (err) {
        console.error('Error applying to job:', err);
        addToast(t('tool_opportunity_finder_apply_error'), 'error');
    }
  };

  const fetchAppliedJobs = useCallback(async () => {
    // FIX 1: depend on the primitive sessionUserId, not the session object.
    // Token refreshes recreate the session object without changing the user id,
    // so using the primitive prevents spurious re-runs.
    if (!sessionUserId) return;
    try {
        const db = getFirestore(firebaseApp);
        const snap = await getDocs(
          query(
            collection(db, 'job_applications'),
            where('candidate_id', '==', sessionUserId),
          ),
        );
        setAppliedJobs(new Set(snap.docs.map((app) => app.data().job_id as string)));
    } catch (err) {
        console.error("Could not fetch applied jobs:", err);
        // Note: this is a non-fatal side-fetch; error is surfaced but does not
        // block the main result (runTool clears it after setResult — see FIX 2).
        setError(t('tool_opportunity_finder_error_fetch_applied'));
    }
  }, [sessionUserId, t]);

  const runTool = useCallback(async () => {
    const alive = begin();
    setError(null);
    try {
      await fetchAppliedJobs();
      // findOpportunities accepts session for legacy signature compatibility;
      // the closure value is fine here — we only fix deps to use the primitive.
      const apiResult = await findOpportunities(resumeText, market, session);
      if (!alive()) return;
      setResult(apiResult);
      // FIX 2: fetchAppliedJobs failure sets an error, but we have a good AI
      // result now — clear the non-fatal side-error so results render correctly.
      setError(null);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
    // FIX 1: use sessionUserId (primitive) instead of session (object) so that
    // token-refresh events that recreate the session object do not refire this
    // callback (and therefore the expensive AI search + double credit spend).
  }, [resumeText, market, sessionUserId, fetchAppliedJobs, begin, end]);
  
  useEffect(() => {
    runTool();
  }, [runTool]);

  if (loading) return <StagedLoader title="Finding opportunities" steps={["Reading your resume…","Searching live job postings…","Matching & ranking roles…","Building search strategies…"]} onCancel={cancel} icon={<Search />} accent="fuchsia" />;
  if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;
  // No result yet (e.g. the user cancelled the auto-fetch) — offer a graceful retry
  // instead of a blank screen, since this tool has no input form to fall back to.
  if (!result) return (
    <div className="flex flex-col items-center justify-center text-center my-24 gap-4 animate-fade-in">
      <p className="text-gray-500 dark:text-gray-400">Your job search was cancelled.</p>
      <button
        type="button"
        onClick={() => runTool()}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 hover:bg-blue-800 px-5 py-2.5 text-white font-semibold transition-colors"
      >
        Search again
      </button>
    </div>
  );

  const { opportunities, jobSearchStrategies, groundingChunks, notice } = result;
  
  const companyOptions = ['all', ...Array.from(new Set(opportunities.map(o => o.company)))];
  const locationOptions = ['all', ...Array.from(new Set(opportunities.map(o => o.location)))];
  
  const filteredOpportunities = opportunities.filter(o => {
      const companyMatch = opportunityFilters.company === 'all' || o.company === opportunityFilters.company;
      const locationMatch = opportunityFilters.location === 'all' || o.location === opportunityFilters.location;
      return companyMatch && locationMatch;
  });
  
  const renderStrategyWithBold = (text: string) => {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('tool_opportunity_finder_results_title')}</h4>

      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{notice}</p>
        </div>
      )}
      
      {jobSearchStrategies && jobSearchStrategies.length > 0 && (
        <div className="p-4 mb-6 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 rounded-r-lg">
            <h5 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm-.707 7.072l.707-.707a1 1 0 111.414 1.414l-.707.707a1 1 0 01-1.414-1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z" />
                </svg>
                AI-Powered Job Search Strategies
            </h5>
            <ul className="list-disc list-inside mt-2 space-y-2 text-sm text-blue-800 dark:text-blue-300">
                {jobSearchStrategies.map((strategy, i) => (
                    <li key={i}>{renderStrategyWithBold(strategy)}</li>
                ))}
            </ul>
        </div>
      )}

      <div className="flex gap-4 items-center text-sm p-2 bg-gray-100 dark:bg-slate-800 rounded-md text-gray-800 dark:text-gray-200">
        <span>{t('tool_opportunity_finder_filter_label')}:</span>
        <select value={opportunityFilters.company} onChange={e => setOpportunityFilters(p => ({...p, company: e.target.value}))} className="border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md text-sm">
          {companyOptions.map(c => <option key={c} value={c}>{c === 'all' ? t('tool_opportunity_finder_filter_all_companies') : c}</option>)}
        </select>
        <select value={opportunityFilters.location} onChange={e => setOpportunityFilters(p => ({...p, location: e.target.value}))} className="border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md text-sm">
          {locationOptions.map(l => <option key={l} value={l}>{l === 'all' ? t('tool_opportunity_finder_filter_all_locations') : l}</option>)}
        </select>
      </div>
      {filteredOpportunities.length === 0 && <p className="text-gray-600 dark:text-gray-400">{t('tool_opportunity_finder_no_results')}</p>}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {filteredOpportunities.map((job, i) => {
            const isExpanded = expandedUrl === job.url;
            const jobId = job.isInternal ? job.url.replace('#internal-job-', '') : '';
            const hasApplied = job.isInternal && appliedJobs.has(jobId);

            return (
                <div key={job.url + i} className="p-3 border rounded-lg bg-white dark:bg-slate-800 shadow-sm transition-all duration-300">
                    <button onClick={() => setExpandedUrl(isExpanded ? null : job.url)} className="w-full text-left flex justify-between items-center" aria-expanded={isExpanded}>
                        <div className="flex-grow">
                             <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-bold text-blue-800 dark:text-blue-300 text-base">{job.jobTitle}</h5>
                                {job.isInternal && (
                                    <span className="text-xs font-bold text-white bg-green-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                        {t('tool_opportunity_finder_internal_badge')}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-400 mt-1">{job.company} - {job.location}</p>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                             {job.isInternal && job.compatibilityScore && (
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('tool_opportunity_finder_match_label')}</p>
                                    <p className="text-lg font-bold text-green-600">{job.compatibilityScore}%</p>
                                </div>
                            )}
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-500 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </button>
                    {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 animate-fade-in">
                        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2 prose prose-sm dark:prose-invert max-w-none">{renderFormattedText(job.summary)}</div>
                        <div className="mt-4 flex flex-wrap gap-2 justify-end">
                             {job.isInternal ? (
                                <button onClick={() => applyToInternalJob(jobId, job.compatibilityScore)} disabled={hasApplied} className={`text-sm text-white px-3 py-1.5 rounded-md transition-colors ${hasApplied ? 'bg-green-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                    {hasApplied ? t('tool_opportunity_finder_applied_button') : t('tool_opportunity_finder_apply_button')}
                                </button>
                             ) : (
                                <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700">{t('tool_opportunity_finder_view_apply_button')}</a>
                             )}
                             <button onClick={() => openTool('cover-letter', `Job Title: ${job.jobTitle}\nCompany: ${job.company}\n\n[Paste full job description here]`)} className="text-sm bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-md">{t('tool_opportunity_finder_generate_cover_letter_button')}</button>
                        </div>
                        </div>
                    )}
                </div>
            )
        })}
      </div>
      {groundingChunks && groundingChunks.length > 0 && (
        <div className="pt-2 border-t dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400">
          <p className="font-semibold mb-1">{t('tool_opportunity_finder_sources_label')}:</p>
          <ul className="list-disc list-inside">
            {groundingChunks.filter((chunk: any) => chunk.web).map((chunk: any, i: number) => (
              <li key={i}><a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 dark:text-blue-400">{chunk.web.title}</a></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OpportunityFinder;
