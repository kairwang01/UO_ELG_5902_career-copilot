import React, { useState } from 'react';
import { generateNetworkingStrategy } from '../../services/aiClient';
import type { NetworkingStrategyResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';

interface NetworkingAssistantProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
}

const NetworkingAssistant: React.FC<NetworkingAssistantProps> = ({ resumeText, market, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NetworkingStrategyResult | null>(null);
  const [targetCompany, setTargetCompany] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [targetLocation, setTargetLocation] = useState('');

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
      <p className="text-sm text-gray-600">{t('tool_networking_assistant_setup_desc')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="target-company" className="block text-sm font-medium text-gray-700">{t('tool_networking_assistant_company_label')}</label>
          <input
            type="text"
            id="target-company"
            className="mt-1 w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
            placeholder={t('tool_networking_assistant_company_placeholder')}
            value={targetCompany}
            onChange={(e) => setTargetCompany(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="target-location" className="block text-sm font-medium text-gray-700">{t('tool_networking_assistant_location_label')}</label>
          <input
            type="text"
            id="target-location"
            className="mt-1 w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
            placeholder={t('tool_networking_assistant_location_placeholder')}
            value={targetLocation}
            onChange={(e) => setTargetLocation(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="target-role" className="block text-sm font-medium text-gray-700">{t('tool_networking_assistant_role_label')}</label>
        <input
          type="text"
          id="target-role"
          className="mt-1 w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
          placeholder={t('tool_networking_assistant_role_placeholder')}
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {loading ? t('tool_networking_assistant_generating_button') : t('tool_networking_assistant_generate_button')}
      </button>
    </form>
  );

  const renderResult = () => {
    if (loading) return <StagedLoader title="Mapping your network" steps={["Analyzing your background…","Identifying the right contacts…","Drafting outreach messages…"]} onCancel={cancel} icon="🤝" accent="sky" />;
    if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;
    if (!result) return null;

    const { strategySummary, contactSuggestions } = result;
    return (
      <div className="space-y-6">
        <h4 className="text-lg font-bold">{t('tool_networking_assistant_results_title').replace('{company}', targetCompany).replace('{location}', targetLocation)}</h4>
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <h5 className="font-semibold text-blue-900">{t('tool_networking_assistant_approach_label')}</h5>
          <p className="text-sm text-blue-800 mt-1">{strategySummary}</p>
        </div>
        
        <div className="space-y-4">
          {contactSuggestions.map((suggestion, index) => (
             <details key={index} className="p-4 border rounded-lg bg-white shadow-sm" open={index === 0}>
                <summary className="font-bold text-gray-800 cursor-pointer flex justify-between items-center">
                    <span>{t('tool_networking_assistant_contact_label')}: {suggestion.contactType}</span>
                    <span className="text-sm text-gray-500 group-hover:text-gray-700">{t('tool_networking_assistant_expand_label')}</span>
                </summary>
                <div className="mt-3 pt-3 border-t">
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-3">
                        <h6 className="font-semibold text-yellow-900 text-sm">{t('tool_networking_assistant_why_contact_label')}:</h6>
                        <p className="text-sm text-yellow-800 mt-1">{suggestion.reason}</p>
                    </div>
                     <div className="p-3 bg-gray-50 border rounded-md">
                        <h6 className="font-semibold text-gray-900 text-sm">{t('tool_networking_assistant_draft_label')}:</h6>
                        <textarea
                            readOnly
                            value={suggestion.outreachMessage}
                            className="w-full h-48 mt-2 text-sm p-2 bg-white rounded-md border-gray-300 font-mono"
                        />
                        <button 
                            onClick={() => navigator.clipboard.writeText(suggestion.outreachMessage)}
                            className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                        >
                            {t('tool_networking_assistant_copy_button')}
                        </button>
                    </div>
                </div>
             </details>
          ))}
        </div>
         <button onClick={() => setResult(null)} className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200">
            &larr; {t('tool_networking_assistant_new_plan_button')}
        </button>
      </div>
    );
  };

  return result ? renderResult() : renderInput();
};

export default NetworkingAssistant;