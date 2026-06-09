

import React, { useState } from 'react';
import { generateProfessionalEmail } from '../../services/aiClient';
import type { ProfessionalEmailResult } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import { DownloadButtons } from './ToolUtils';

const EMAIL_SCENARIOS = { 'Thank You': 'Post-Interview Thank You', 'Follow-up': 'Application Follow-up', 'Networking': 'Networking Outreach', 'Application': 'Job Application Submission' };
const SCENARIO_DETAILS: { [key: string]: string[] } = { 'Thank You': ['Interviewer Name', 'Job Title'], 'Follow-up': ['Company Name', 'Job Title', 'Date of Application'], 'Networking': ['Recipient Name', 'Recipient Title', 'Recipient Company'], 'Application': ['Company Name', 'Job Title', 'Contact Person (optional)'] };

interface EmailCrafterProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
}

const Slider: React.FC<{ label: string; minLabel: string; maxLabel: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ label, minLabel, maxLabel, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={onChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-500">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
        </div>
    </div>
);


const EmailCrafter: React.FC<EmailCrafterProps> = ({ resumeText, market, t }) => {
  const [loading, setLoading] = useState(false);
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

  const runTool = async () => {
    setLoading(true);
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
      setResult(apiResult);
      setEditableResult(apiResult.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runTool();
  };

  const handleDetailChange = (key: string, value: string) => {
    setEmailDetails(prev => ({ ...prev, [key]: value }));
  };

  const renderInput = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
       <div className="p-1 bg-gray-200 rounded-lg flex">
            <button type="button" onClick={() => setCraftingMode('draft')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${craftingMode === 'draft' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}>
                {t('tool_email_crafter_mode_draft')}
            </button>
            <button type="button" onClick={() => setCraftingMode('reply')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${craftingMode === 'reply' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}>
                {t('tool_email_crafter_mode_reply')}
            </button>
        </div>

      {craftingMode === 'draft' ? (
        <div className="space-y-4 animate-fade-in">
          <p className="text-sm text-gray-600">{t('tool_email_crafter_draft_desc')}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('tool_email_crafter_scenario_label')}</label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(EMAIL_SCENARIOS).map(([key, value]) => (
                <button type="button" key={key} onClick={() => setEmailScenario(value)} className={`p-3 border-2 rounded-lg text-left transition-all text-sm ${emailScenario === value ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'}`}>
                  {t(`tool_email_crafter_scenario_${key.toLowerCase().replace(' ', '_')}`)}
                </button>
              ))}
            </div>
          </div>
          {emailScenario && (
            <div className="space-y-3 pt-2 animate-fade-in">
              {(SCENARIO_DETAILS[Object.keys(EMAIL_SCENARIOS).find(key => EMAIL_SCENARIOS[key as keyof typeof EMAIL_SCENARIOS] === emailScenario) || ''] || []).map(detail => (
                <div key={detail}>
                  <label htmlFor={detail} className="block text-sm font-medium text-gray-700">{detail}</label>
                  <input type="text" id={detail} onChange={(e) => handleDetailChange(detail, e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" required={!detail.includes('optional')} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
         <div className="animate-fade-in">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('tool_email_crafter_reply_label')}</label>
            <textarea
                value={receivedEmailText}
                onChange={(e) => setReceivedEmailText(e.target.value)}
                rows={8}
                className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
                placeholder={t('tool_email_crafter_reply_placeholder')}
            />
        </div>
      )}

      <div className="p-4 bg-gray-50 border rounded-lg space-y-4">
            <h4 className="font-semibold text-center text-gray-700">{t('tool_email_crafter_style_title')}</h4>
            <Slider label={t('tool_email_crafter_tone_label')} minLabel={t('tool_email_crafter_tone_min')} maxLabel={t('tool_email_crafter_tone_max')} value={tone} onChange={e => setTone(parseInt(e.target.value))} />
            <Slider label={t('tool_email_crafter_style_label')} minLabel={t('tool_email_crafter_style_min')} maxLabel={t('tool_email_crafter_style_max')} value={style} onChange={e => setStyle(parseInt(e.target.value))} />
            <Slider label={t('tool_email_crafter_confidence_label')} minLabel={t('tool_email_crafter_confidence_min')} maxLabel={t('tool_email_crafter_confidence_max')} value={confidence} onChange={e => setConfidence(parseInt(e.target.value))} />
      </div>

      <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {loading ? t('tool_email_crafter_drafting_button') : t('tool_email_crafter_generate_button')}
      </button>
    </form>
  );

  const renderResult = () => {
    if (loading) return <LoadingSpinner />;
    if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;
    if (!result) return null;

    const { subject, body } = result;
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-bold">{t('tool_email_crafter_results_title')}</h4>
          <DownloadButtons textContent={`Subject: ${subject}\n\n${editableResult}`} baseFilename="email_draft" />
        </div>
        <div className="p-4 border rounded-lg bg-white">
          <h5 className="font-bold text-gray-800">{t('tool_email_crafter_subject_label')}</h5>
          <p className="mt-1 text-sm p-2 bg-gray-50 rounded-md border">{subject}</p>
        </div>
        <div className="p-4 border rounded-lg bg-white">
          <h5 className="font-bold text-gray-800">{t('tool_email_crafter_body_label')}</h5>
          <textarea value={editableResult} onChange={(e) => setEditableResult(e.target.value)} className="w-full h-72 mt-1 text-sm p-2 bg-gray-50 rounded-md border" />
        </div>
         <button onClick={() => setResult(null)} className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200">
              &larr; {t('tool_email_crafter_back_button')}
          </button>
      </div>
    );
  };

  return result ? renderResult() : renderInput();
};

export default EmailCrafter;