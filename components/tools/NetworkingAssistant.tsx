import React, { useState, useMemo, useEffect } from 'react';
import { Users } from 'lucide-react';
import { generateNetworkingStrategy } from '../../services/aiClient';
import type { NetworkingStrategyResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { CopyButton, DownloadButtons, SavedResultBar } from './ToolUtils';
import { useToolResults } from '../../contexts/ToolResultsContext';
import { deriveSmartSuggestions, SmartSuggestChips } from '../SmartSuggest';

interface NetworkingAssistantProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
}

const SAMPLE_COMPANY = 'Shopify';
const SAMPLE_ROLE = 'Senior Software Engineer';
const SAMPLE_LOCATION = 'Ottawa, ON';

const NetworkingAssistant: React.FC<NetworkingAssistantProps> = ({ resumeText, market, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NetworkingStrategyResult | null>(null);
  const { canSave, saved, persist } = useToolResults<NetworkingStrategyResult>();
  const [fromSaved, setFromSaved] = useState(false);
  const [targetCompany, setTargetCompany] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [targetLocation, setTargetLocation] = useState('');

  // SmartSuggest: derive role chips from resume (pure, no AI)
  const suggestions = useMemo(() => deriveSmartSuggestions(resumeText), [resumeText]);

  useEffect(() => { if (saved && !result) { setResult(saved.result); setFromSaved(true); } }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const runTool = async (company: string, role: string, location: string) => {
    if (!company || !role || !location) {
      setError(t('tool_networking_assistant_error_required'));
      return;
    }
    const alive = begin();
    setError(null);
    setResult(null);
    try {
      const apiResult = await generateNetworkingStrategy(resumeText, company, role, location, market);
      if (!alive()) return;
      setResult(apiResult);
      setFromSaved(false);
      persist(apiResult);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runTool(targetCompany, targetRole, targetLocation);
  };

  const renderInput = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* (a) INTRO CARD */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
        <p className="font-medium text-slate-700 dark:text-slate-300">{t('tool_networking_intro_line1')}</p>
        <p className="mt-0.5">{t('tool_networking_intro_line2')}</p>
      </div>

      {/* (b) SAMPLE-FILL */}
      <button
        type="button"
        onClick={() => {
          setTargetCompany(SAMPLE_COMPANY);
          setTargetRole(SAMPLE_ROLE);
          setTargetLocation(SAMPLE_LOCATION);
        }}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {t('try_example')}
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="target-company" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_networking_assistant_company_label')}</label>
          <input
            type="text"
            id="target-company"
            className="mt-1 w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
            placeholder={t('tool_networking_assistant_company_placeholder')}
            value={targetCompany}
            onChange={(e) => setTargetCompany(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="target-location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_networking_assistant_location_label')}</label>
          <input
            type="text"
            id="target-location"
            className="mt-1 w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
            placeholder={t('tool_networking_assistant_location_placeholder')}
            value={targetLocation}
            onChange={(e) => setTargetLocation(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="target-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_networking_assistant_role_label')}</label>

        {/* SmartSuggestChips for target role */}
        {resumeText && (
          <div className="mt-1 mb-2">
            <SmartSuggestChips
              items={suggestions.roles}
              onPick={(v) => setTargetRole(v)}
              label={t('smart_suggest_target_roles')}
            />
          </div>
        )}

        <input
          type="text"
          id="target-role"
          className="mt-1 w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
          placeholder={t('tool_networking_assistant_role_placeholder')}
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          required
        />
      </div>

      {/* (e) ERROR RETRY */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-4 flex items-start gap-3 animate-panel-expand">
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button
            type="submit"
            className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            {t('try_again')}
          </button>
        </div>
      )}

      <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {loading ? t('tool_networking_assistant_generating_button') : t('tool_networking_assistant_generate_button')}
      </button>
    </form>
  );

  const formatForDownload = (res: NetworkingStrategyResult): string => {
    let content = `# Networking Strategy: ${targetRole} at ${targetCompany} (${targetLocation})\n\n`;
    content += `## Strategy Summary\n${res.strategySummary}\n\n`;
    content += `## Contact Suggestions\n`;
    res.contactSuggestions.forEach((s, i) => {
      content += `### Contact ${i + 1}: ${s.contactType}\n`;
      content += `**Why:** ${s.reason}\n\n`;
      content += `**Outreach Message:**\n${s.outreachMessage}\n\n`;
    });
    return content;
  };

  const renderResult = () => {
    if (!result) return null;

    const { strategySummary, contactSuggestions } = result;
    return (
      <div className="space-y-6 animate-fade-in">
        <SavedResultBar t={t} canSave={canSave} isSaved={fromSaved} savedAt={saved?.savedAt ?? null} onTryNext={() => { setResult(null); setFromSaved(false); setError(null); }} />
        {/* (d) RESULT ACTIONS */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-lg font-bold dark:text-gray-100">{t('tool_networking_assistant_results_title').replace('{company}', targetCompany).replace('{location}', targetLocation)}</h4>
          <div className="flex items-center gap-2">
            <DownloadButtons textContent={formatForDownload(result)} baseFilename={`networking_strategy_${targetCompany.replace(/\s/g, '_')}`} />
            <button
              type="button"
              onClick={() => { setResult(null); setError(null); }}
              className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              {t('tool_start_over')}
            </button>
          </div>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r-lg">
          <h5 className="font-semibold text-blue-900 dark:text-blue-300">{t('tool_networking_assistant_approach_label')}</h5>
          <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">{strategySummary}</p>
        </div>

        <div className="space-y-4">
          {contactSuggestions.map((suggestion, index) => (
             <details key={index} className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm" open={index === 0}>
                <summary className="font-bold text-gray-800 dark:text-gray-100 cursor-pointer flex justify-between items-center">
                    <span>{t('tool_networking_assistant_contact_label')}: {suggestion.contactType}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-700">{t('tool_networking_assistant_expand_label')}</span>
                </summary>
                <div className="mt-3 pt-3 border-t dark:border-slate-700">
                    <div className="p-3 bg-yellow-50 dark:bg-amber-900/20 border border-yellow-200 dark:border-amber-800/40 rounded-md mb-3">
                        <h6 className="font-semibold text-yellow-900 dark:text-amber-300 text-sm">{t('tool_networking_assistant_why_contact_label')}:</h6>
                        <p className="text-sm text-yellow-800 dark:text-amber-300 mt-1">{suggestion.reason}</p>
                    </div>
                     <div className="p-3 bg-gray-50 dark:bg-slate-700 border dark:border-slate-600 rounded-md">
                        <h6 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{t('tool_networking_assistant_draft_label')}:</h6>
                        <textarea
                            readOnly
                            value={suggestion.outreachMessage}
                            className="w-full h-48 mt-2 text-sm p-2 bg-white dark:bg-slate-800 rounded-md border-gray-300 dark:border-slate-600 dark:text-gray-300 font-mono"
                        />
                        <CopyButton text={suggestion.outreachMessage} label={t('tool_networking_assistant_copy_button')} className="mt-2" />
                    </div>
                </div>
             </details>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setResult(null); setError(null); }}
          className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 dark:border-slate-600 dark:text-gray-300"
        >
            &larr; {t('tool_networking_assistant_new_plan_button')}
        </button>
      </div>
    );
  };

  if (loading) return <StagedLoader title={t('tool_networking_loader_title')} steps={[t('tool_networking_step1'), t('tool_networking_step2'), t('tool_networking_step3')]} onCancel={cancel} icon={<Users />} accent="sky" />;

  return result ? renderResult() : renderInput();
};

export default NetworkingAssistant;
