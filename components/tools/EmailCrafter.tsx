

import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { generateProfessionalEmail } from '../../services/aiClient';
import type { ProfessionalEmailResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { DownloadButtons } from './ToolUtils';
import { useRecentApplications } from '../../hooks/useRecentApplications';
import type { AppSession as Session } from '../../lib/data';

const EMAIL_SCENARIOS = { 'Thank You': 'Post-Interview Thank You', 'Follow-up': 'Application Follow-up', 'Networking': 'Networking Outreach', 'Application': 'Job Application Submission' };

// Fields that take a date value (matched by exact label):
const DATE_FIELDS = new Set(['Date of Application']);

// Sample data for "Try an example":
const SAMPLE_SCENARIO = 'Post-Interview Thank You';
const SAMPLE_DETAILS: Record<string, string> = {
  'Interviewer Name': 'Sarah Chen',
  'Job Title': 'Frontend Software Engineer',
};

const SCENARIO_DETAILS: { [key: string]: string[] } = {
  'Thank You': ['Interviewer Name', 'Job Title'],
  'Follow-up': ['Company Name', 'Job Title', 'Date of Application'],
  'Networking': ['Recipient Name', 'Recipient Title', 'Recipient Company'],
  'Application': ['Company Name', 'Job Title', 'Contact Person (optional)'],
};

interface EmailCrafterProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
  session: Session | null;
}

const Slider: React.FC<{ label: string; minLabel: string; maxLabel: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ label, minLabel, maxLabel, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={onChange}
            className="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
        </div>
    </div>
);


const EmailCrafter: React.FC<EmailCrafterProps> = ({ resumeText, market, t, session }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProfessionalEmailResult | null>(null);
  const [editableResult, setEditableResult] = useState('');

  // State for new features
  const [craftingMode, setCraftingMode] = useState<'draft' | 'reply'>('draft');
  const [receivedEmailText, setReceivedEmailText] = useState('');
  const [tone, setTone] = useState(50);
  const [style, setStyle] = useState(50);
  const [confidence, setConfidence] = useState(50);

  // State for draft mode
  const [emailScenario, setEmailScenario] = useState<string>('');
  const [emailDetails, setEmailDetails] = useState<{ [key: string]: string }>({});

  // Recent applications hook for the job-context selector
  const { applications } = useRecentApplications(session);

  const runTool = async () => {
    const alive = begin();
    setError(null);
    try {
      let scenarioForApi = '';
      let detailsForApi: { [key: string]: string } = {};

      if (craftingMode === 'reply') {
        if (!receivedEmailText.trim()) {
          throw new Error(t('tool_email_crafter_error_required_reply'));
        }
        scenarioForApi = 'Reply Assistant';
        detailsForApi = { receivedEmailText };
      } else {
        if (!emailScenario) {
          throw new Error(t('tool_email_crafter_error_required_scenario'));
        }
        scenarioForApi = emailScenario;
        detailsForApi = emailDetails;
      }

      const apiResult = await generateProfessionalEmail(resumeText, scenarioForApi, detailsForApi, market, tone, style, confidence);
      if (!alive()) return;
      setResult(apiResult);
      setEditableResult(apiResult.body);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runTool();
  };

  const handleDetailChange = (key: string, value: string) => {
    setEmailDetails(prev => ({ ...prev, [key]: value }));
  };

  // "Try an example" — only fills tool-specific fields, never overwrites resume
  const handleTryExample = () => {
    setEmailScenario(SAMPLE_SCENARIO);
    setEmailDetails(SAMPLE_DETAILS);
    setCraftingMode('draft');
  };

  // Fill job title from a recent application
  const handleSelectRecentApp = (appId: string) => {
    if (!appId) return;
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    // For Thank You / Follow-up scenarios, fill Job Title
    if (emailScenario === 'Post-Interview Thank You') {
      setEmailDetails(prev => ({ ...prev, 'Job Title': app.job_title }));
    } else if (emailScenario === 'Application Follow-up') {
      setEmailDetails(prev => ({ ...prev, 'Job Title': app.job_title }));
    } else {
      // Generic: if the current details have a 'Job Title' key, fill it
      setEmailDetails(prev => ({
        ...prev,
        ...(Object.prototype.hasOwnProperty.call(prev, 'Job Title') ? { 'Job Title': app.job_title } : {}),
      }));
    }
  };

  if (loading) {
    return (
      <StagedLoader
        title={t('tool_email_crafter_drafting_button')}
        steps={[
          t('tool_email_crafter_loader_step1'),
          t('tool_email_crafter_loader_step2'),
          t('tool_email_crafter_loader_step3'),
        ]}
        onCancel={cancel}
        icon={<Mail />}
        accent="rose"
      />
    );
  }

  const renderInput = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* (a) Intro card */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 space-y-1">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{t('tool_email_crafter_intro_title')}</p>
        <p>{t('tool_email_crafter_intro_desc')}</p>
      </div>

       <div className="p-1 bg-gray-200 dark:bg-slate-700 rounded-lg flex">
            <button type="button" onClick={() => setCraftingMode('draft')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${craftingMode === 'draft' ? 'bg-white dark:bg-slate-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
                {t('tool_email_crafter_mode_draft')}
            </button>
            <button type="button" onClick={() => setCraftingMode('reply')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${craftingMode === 'reply' ? 'bg-white dark:bg-slate-600 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
                {t('tool_email_crafter_mode_reply')}
            </button>
        </div>

      {craftingMode === 'draft' ? (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('tool_email_crafter_draft_desc')}</p>
            {/* (b) Sample fill */}
            <button
              type="button"
              onClick={handleTryExample}
              className="shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:underline ml-4"
            >
              {t('tool_email_crafter_try_example')}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tool_email_crafter_scenario_label')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(EMAIL_SCENARIOS).map(([key, value]) => (
                <button type="button" key={key} onClick={() => setEmailScenario(value)} className={`p-3 border-2 rounded-lg text-left transition-all text-sm ${emailScenario === value ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-gray-300'}`}>
                  {t(`tool_email_crafter_scenario_${key.toLowerCase().replace(' ', '_')}`)}
                </button>
              ))}
            </div>
          </div>
          {emailScenario && (
            <div className="space-y-3 pt-2 animate-fade-in">
              {/* Recent applications selector — hidden when no apps */}
              {applications.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('tool_email_crafter_recent_apps_label')}
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => handleSelectRecentApp(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="" disabled>{t('tool_email_crafter_recent_apps_placeholder')}</option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.job_title}{app.status ? ` — ${app.status}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(SCENARIO_DETAILS[Object.keys(EMAIL_SCENARIOS).find(key => EMAIL_SCENARIOS[key as keyof typeof EMAIL_SCENARIOS] === emailScenario) || ''] || []).map(detail => (
                <div key={detail}>
                  <label htmlFor={detail} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{detail}</label>
                  {/* (date) "Date of Application" → real date picker */}
                  {DATE_FIELDS.has(detail) ? (
                    <input
                      type="date"
                      id={detail}
                      value={emailDetails[detail] || ''}
                      onChange={(e) => handleDetailChange(detail, e.target.value)}
                      className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required={!detail.includes('optional')}
                    />
                  ) : (
                    <input
                      type="text"
                      id={detail}
                      value={emailDetails[detail] || ''}
                      onChange={(e) => handleDetailChange(detail, e.target.value)}
                      className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required={!detail.includes('optional')}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
         <div className="animate-fade-in">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tool_email_crafter_reply_label')}</label>
            <textarea
                value={receivedEmailText}
                onChange={(e) => setReceivedEmailText(e.target.value)}
                rows={8}
                className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
                placeholder={t('tool_email_crafter_reply_placeholder')}
            />
        </div>
      )}

      <div className="p-4 bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg space-y-4">
            <h4 className="font-semibold text-center text-gray-700 dark:text-gray-200">{t('tool_email_crafter_style_title')}</h4>
            <Slider label={t('tool_email_crafter_tone_label')} minLabel={t('tool_email_crafter_tone_min')} maxLabel={t('tool_email_crafter_tone_max')} value={tone} onChange={e => setTone(parseInt(e.target.value))} />
            <Slider label={t('tool_email_crafter_style_label')} minLabel={t('tool_email_crafter_style_min')} maxLabel={t('tool_email_crafter_style_max')} value={style} onChange={e => setStyle(parseInt(e.target.value))} />
            <Slider label={t('tool_email_crafter_confidence_label')} minLabel={t('tool_email_crafter_confidence_min')} maxLabel={t('tool_email_crafter_confidence_max')} value={confidence} onChange={e => setConfidence(parseInt(e.target.value))} />
      </div>

      {/* (e) Error box with retry */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
          <svg className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => runTool()}
              className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:underline"
            >
              {t('tool_email_crafter_retry')}
            </button>
          </div>
        </div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {t('tool_email_crafter_generate_button')}
      </button>
    </form>
  );

  const renderResult = () => {
    if (!result) return null;

    const { subject } = result;
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-bold dark:text-gray-100">{t('tool_email_crafter_results_title')}</h4>
          <DownloadButtons textContent={`Subject: ${subject}\n\n${editableResult}`} baseFilename="email_draft" />
        </div>
        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_email_crafter_subject_label')}</h5>
          <p className="mt-1 text-sm p-2 bg-gray-50 dark:bg-slate-700 rounded-md border dark:border-slate-600 dark:text-gray-300">{subject}</p>
        </div>
        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_email_crafter_body_label')}</h5>
          <textarea value={editableResult} onChange={(e) => setEditableResult(e.target.value)} className="w-full h-72 mt-1 text-sm p-2 bg-gray-50 dark:bg-slate-700 rounded-md border dark:border-slate-600 dark:text-gray-100" />
        </div>
        {/* (d) Start over / run again */}
        <button
          type="button"
          onClick={() => { setResult(null); setError(null); }}
          className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 dark:border-slate-600 dark:text-gray-300"
        >
          &larr; {t('tool_email_crafter_back_button')}
        </button>
      </div>
    );
  };

  return result ? renderResult() : renderInput();
};

export default EmailCrafter;
