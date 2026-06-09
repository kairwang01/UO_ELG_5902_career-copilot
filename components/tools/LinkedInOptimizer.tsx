import React, { useState } from 'react';
import { optimizeLinkedInProfile, optimizeLinkedInProfileFromText } from '../../services/aiClient';
import type { LinkedInOptimization } from '../../types';
import LoadingSpinner from '../LoadingSpinner';

interface LinkedInOptimizerProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
}

const LinkedInOptimizer: React.FC<LinkedInOptimizerProps> = ({ resumeText, market, t }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LinkedInOptimization | null>(null);
  const [linkedinTab, setLinkedinTab] = useState<'resume' | 'profile'>('resume');
  const [linkedinProfileText, setLinkedinProfileText] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [additionalUrl, setAdditionalUrl] = useState('');


  const runTool = async (options: {
    mode?: 'resume' | 'profile';
    profileText?: string;
    customPrompt?: string;
    additionalUrl?: string;
  } = {}) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let apiResult;
      if (options.mode === 'profile') {
        if (!options.profileText) throw new Error(t('tool_linkedin_optimizer_error_required'));
        apiResult = await optimizeLinkedInProfileFromText(
            options.profileText, 
            resumeText, 
            market,
            options.customPrompt,
            options.additionalUrl
        );
      } else {
        apiResult = await optimizeLinkedInProfile(resumeText, market);
      }
      setResult(apiResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runTool({
        profileText: linkedinProfileText,
        customPrompt: customPrompt,
        additionalUrl: additionalUrl,
        mode: 'profile'
    });
  };
  
  const handleResumeSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    runTool({ mode: 'resume' });
  };

  const renderInput = () => (
    <div className="space-y-4">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button onClick={() => setLinkedinTab('resume')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${linkedinTab === 'resume' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            {t('tool_linkedin_optimizer_tab_resume')}
          </button>
          <button onClick={() => setLinkedinTab('profile')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${linkedinTab === 'profile' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            {t('tool_linkedin_optimizer_tab_profile')}
          </button>
        </nav>
      </div>

      {linkedinTab === 'resume' ? (
        <div className="text-center p-4">
          <p className="text-gray-600 mb-4">{t('tool_linkedin_optimizer_resume_desc')}</p>
          <button onClick={handleResumeSubmit} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
            {loading ? t('tool_linkedin_optimizer_optimizing_button') : t('tool_linkedin_optimizer_generate_button')}
          </button>
        </div>
      ) : (
        <div className="p-2">
           <p className="text-gray-600 mb-4 text-center">{t('tool_linkedin_optimizer_profile_desc')}</p>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <textarea
              className="w-full h-40 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
              placeholder={t('tool_linkedin_optimizer_profile_placeholder')}
              value={linkedinProfileText}
              onChange={(e) => setLinkedinProfileText(e.target.value)}
              required
            />
             <div className="text-left text-sm text-gray-600 space-y-1">
                <label htmlFor="custom-prompt" className="font-semibold">{t('tool_linkedin_optimizer_prompt_label')}</label>
                <p className="text-xs mb-1">{t('tool_linkedin_optimizer_prompt_desc')}</p>
                <textarea
                    id="custom-prompt"
                    className="w-full h-20 bg-white border border-gray-300 rounded-lg p-2 text-sm"
                    placeholder={t('tool_linkedin_optimizer_prompt_placeholder')}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                />
            </div>
             <div className="text-left text-sm text-gray-600 space-y-1">
                <label htmlFor="additional-url" className="font-semibold">{t('tool_linkedin_optimizer_url_label')}</label>
                <p className="text-xs mb-1">{t('tool_linkedin_optimizer_url_desc')}</p>
                <input
                    type="url"
                    id="additional-url"
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm"
                    placeholder={t('tool_linkedin_optimizer_url_placeholder')}
                    value={additionalUrl}
                    onChange={(e) => setAdditionalUrl(e.target.value)}
                />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
              {loading ? t('tool_linkedin_optimizer_optimizing_button') : t('tool_linkedin_optimizer_generate_button')}
            </button>
          </form>
        </div>
      )}
    </div>
  );

  const renderResult = () => {
    if (loading) return <LoadingSpinner market={market} />;
    if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;
    if (!result) return null;

    const { headline, summary, experienceSuggestions } = result;
    return (
      <div className="space-y-6">
        <h4 className="text-lg font-bold">{t('tool_linkedin_optimizer_results_title')}</h4>
        <div className="p-4 border rounded-lg bg-white">
          <h5 className="font-bold text-gray-800">{t('tool_linkedin_optimizer_headline_label')}</h5>
          <p className="mt-1 text-sm p-3 bg-gray-50 rounded-md">{headline}</p>
        </div>
        <div className="p-4 border rounded-lg bg-white">
          <h5 className="font-bold text-gray-800">{t('tool_linkedin_optimizer_summary_label')}</h5>
          <p className="mt-1 text-sm p-3 bg-gray-50 rounded-md whitespace-pre-wrap">{summary}</p>
        </div>
        <div className="p-4 border rounded-lg bg-white">
          <h5 className="font-bold text-gray-800">{t('tool_linkedin_optimizer_experience_label')}</h5>
          <ul className="mt-2 space-y-3">
            {experienceSuggestions.map((item, i) => (
              <li key={i} className="text-sm p-3 border-t">
                <strong className="font-semibold block">{item.title}</strong>
                <p className="text-gray-700 mt-1">{item.suggestion}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return result ? renderResult() : renderInput();
};

export default LinkedInOptimizer;