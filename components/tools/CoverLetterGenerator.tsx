
import React, { useState, useEffect } from 'react';
import { PenLine } from 'lucide-react';
import { generateCoverLetter } from '../../services/aiClient';
import type { CoverLetter } from '../../types';
import StagedLoader from '../StagedLoader';
import { DownloadButtons } from './ToolUtils';
import { useApiStatus } from '../../contexts/ApiStatusContext';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { useRecentApplications } from '../../hooks/useRecentApplications';
import type { AppSession as Session } from '../../lib/data';

interface CoverLetterGeneratorProps {
  resumeText: string;
  market: string;
  initialInput: string;
  t: (key: string) => string;
  session: Session | null;
}

const COVER_LETTER_TEMPLATE = `[Your Name]
[Your Address] | [Your Email] | [Your Phone Number]

[Date]

[Hiring Manager Name] (If known, otherwise use title)
[Hiring Manager Title]
[Company Name]
[Company Address]

Dear [Mr./Ms./Mx. Last Name],

I am writing to express my enthusiastic interest in the [Job Title] position at [Company Name], which I discovered through [Platform where you saw the ad, e.g., LinkedIn, company website]. Having followed [Company Name]'s impressive work in [Industry], I am confident that my skills and experience in [mention 1-2 key skills from your resume, e.g., project management and data analysis] align perfectly with the requirements of this role.

In my previous position at [Previous Company], I was responsible for [mention a key responsibility]. I successfully [mention a key achievement that relates to the job description, quantifying it if possible, e.g., increased user engagement by 15% by redesigning the onboarding flow]. This experience has equipped me with a strong foundation in [relevant skill], which I am eager to bring to your team.

I am particularly drawn to [Company Name]'s commitment to [mention a company value, project, or mission statement you admire]. My own professional values are centered on [mention your own values, e.g., collaboration, innovation, and user-centric design], and I believe I would be a great cultural fit.

Thank you for considering my application. I have attached my resume for your review and welcome the opportunity to discuss how my background and passion for [Industry] can contribute to [Company Name].

Sincerely,
[Your Name]`;

// Sample job description for "Try an example"
const SAMPLE_JOB_DESC = `Job Title: Frontend Software Engineer
Company: Shopify
Location: Ottawa, ON (Remote-friendly)

We are looking for a Frontend Software Engineer to join our growing team. You will build and maintain high-quality React/TypeScript components, collaborate with designers and backend engineers, and ship features used by millions of merchants worldwide.

Requirements:
- 2+ years of experience with React and TypeScript
- Strong understanding of web performance and accessibility
- Experience with REST and GraphQL APIs
- Passion for clean, maintainable code`;

const CoverLetterGenerator: React.FC<CoverLetterGeneratorProps> = ({ resumeText, market, initialInput, t, session }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoverLetter | null>(null);
  const [jobDescription, setJobDescription] = useState(initialInput);
  const [editableResult, setEditableResult] = useState('');

  const { apiStatus } = useApiStatus();

  // Recent applications for the job-context selector
  const { applications } = useRecentApplications(session);

  useEffect(() => {
    setJobDescription(initialInput);
    // Only auto-run once the resume is available — otherwise the call fails
    // server-side (no resume) and wastes a credit. Re-runs when resumeText loads.
    if (initialInput && resumeText?.trim()) {
        runTool(initialInput);
    }
  }, [initialInput, resumeText]);

  const runTool = async (input: string) => {
    if (apiStatus !== 'online') {
        setError("The AI is currently unavailable. Please try again later.");
        return;
    }
    if (!resumeText?.trim()) {
        setError('Please upload your resume first.');
        return;
    }
    if (!input) {
        setError(t('tool_cover_letter_error_required'));
        return;
    }
    const alive = begin();
    setError(null);
    setResult(null);
    try {
      const apiResult = await generateCoverLetter(resumeText, input, market);
      if (!alive()) return;
      setResult(apiResult);
      setEditableResult(apiResult.letter);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runTool(jobDescription);
  };

  // Fill job description from a recent application (job_title only — no stored description)
  const handleSelectRecentApp = (appId: string) => {
    if (!appId) return;
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    setJobDescription(prev => {
      // Prepend the job title line if not already present
      const titleLine = `Job Title: ${app.job_title}`;
      if (prev.includes(titleLine)) return prev;
      return titleLine + (prev ? '\n\n' + prev : '');
    });
  };

  const renderFallback = () => (
    <div className="space-y-4">
        <div className="p-4 bg-yellow-50 dark:bg-amber-900/20 border-l-4 border-yellow-400">
            <h4 className="font-bold text-yellow-800 dark:text-amber-300">AI Not Available</h4>
            <p className="text-sm text-yellow-700 dark:text-amber-300 mt-1">The AI service is currently unavailable. You can use this professional template to get started on your cover letter.</p>
        </div>
        <textarea
          value={COVER_LETTER_TEMPLATE}
          onChange={(e) => setEditableResult(e.target.value)}
          className="w-full h-96 p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-serif text-sm dark:text-gray-300"
        />
        <DownloadButtons textContent={editableResult || COVER_LETTER_TEMPLATE} baseFilename="cover_letter_template" />
    </div>
  );

  const renderInput = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* (a) Intro card */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 space-y-1">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{t('tool_cover_letter_intro_title')}</p>
        <p>{t('tool_cover_letter_intro_desc')}</p>
      </div>

      {/* (b) Sample fill + recent apps row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <button
          type="button"
          onClick={() => setJobDescription(SAMPLE_JOB_DESC)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline self-start"
        >
          {t('tool_cover_letter_try_example')}
        </button>
        {/* Recent applications selector */}
        {applications.length > 0 && (
          <div className="flex-1 sm:max-w-xs">
            <select
              defaultValue=""
              onChange={(e) => handleSelectRecentApp(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="" disabled>{t('tool_cover_letter_recent_apps_placeholder')}</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.job_title}{app.status ? ` — ${app.status}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <textarea
        className="w-full h-40 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
        placeholder={t('tool_cover_letter_placeholder')}
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        required
      />

      {/* (e) Error box with retry */}
      {error && apiStatus === 'online' && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
          <svg className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => runTool(jobDescription)}
              className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:underline"
            >
              {t('tool_cover_letter_retry')}
            </button>
          </div>
        </div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {loading ? t('tool_cover_letter_generating_button') : t('tool_cover_letter_generate_button')}
      </button>
    </form>
  );

  const renderResult = () => {
    if (loading) return (
      <StagedLoader
        title="Writing your cover letter"
        steps={[
          'Reading your resume…',
          'Understanding the job description…',
          `Tailoring for the ${market} market…`,
          'Drafting & polishing…',
        ]}
        intervalMs={1800}
        onCancel={cancel}
        icon={<PenLine />}
        accent="lime"
      />
    );
    if (error && apiStatus === 'online') return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
        <svg className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
        <div className="flex-1">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => runTool(jobDescription)}
            className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:underline"
          >
            {t('tool_cover_letter_retry')}
          </button>
        </div>
      </div>
    );
    if (!result) return apiStatus !== 'online' ? renderFallback() : renderInput();

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-bold dark:text-gray-100">{t('tool_cover_letter_results_title')}</h4>
          <DownloadButtons textContent={editableResult} baseFilename="cover_letter" />
        </div>
        <textarea
          value={editableResult}
          onChange={(e) => setEditableResult(e.target.value)}
          className="w-full h-96 p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-serif text-sm dark:text-gray-300"
        />
        {/* (d) Start over / run again */}
        <button
          type="button"
          onClick={() => { setResult(null); setError(null); }}
          className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 dark:border-slate-600 dark:text-gray-300"
        >
          &larr; {t('tool_cover_letter_back_button')}
        </button>
      </div>
    );
  };

  return apiStatus !== 'online' && !result ? renderFallback() : (result ? renderResult() : renderInput());
};

export default CoverLetterGenerator;
