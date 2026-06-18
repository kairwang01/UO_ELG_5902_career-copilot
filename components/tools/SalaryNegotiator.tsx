import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { generateSalaryNegotiationStrategy } from '../../services/aiClient';
import type { SalaryNegotiationResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { DownloadButtons } from './ToolUtils';

const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'SGD', 'AED'];

// (b) sample constants
const SAMPLE_JOB_TITLE = 'Senior Software Engineer';
const SAMPLE_COMPANY = 'Shopify';
const SAMPLE_OFFER = '110000';
const SAMPLE_CURRENCY = 'CAD';

interface SalaryNegotiatorProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
}

const SalaryNegotiator: React.FC<SalaryNegotiatorProps> = ({ resumeText, market, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(SalaryNegotiationResult & { groundingChunks: any[] | undefined; }) | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [offer, setOffer] = useState('');
  const [currency, setCurrency] = useState(CURRENCIES[1]); // Default to CAD

  const runTool = async (input: { jobTitle: string, company: string, offer: string, currency: string }) => {
    const { jobTitle, company, offer, currency: offerCurrency } = input;
    if (!jobTitle || !company || !offer || !offerCurrency) {
      setError(t('tool_salary_negotiator_error_required'));
      return;
    }
    const alive = begin();
    setError(null);
    setResult(null);
    try {
      const apiResult = await generateSalaryNegotiationStrategy(resumeText, jobTitle, company, market, offer, offerCurrency);
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
    runTool({ jobTitle, company, offer, currency });
  };

  const handleTryExample = () => {
    setJobTitle(SAMPLE_JOB_TITLE);
    setCompany(SAMPLE_COMPANY);
    setOffer(SAMPLE_OFFER);
    setCurrency(SAMPLE_CURRENCY);
  };

  const renderInput = () => (
    <div className="space-y-4">
      {/* (a) INTRO CARD */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{t('tool_salary_negotiator_intro_title')}</p>
        <p>{t('tool_salary_negotiator_intro_desc')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* (b) SAMPLE FILL */}
        <div className="text-right">
          <button
            type="button"
            onClick={handleTryExample}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('tool_try_example')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="job-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_salary_negotiator_job_title_label')}</label>
            <input type="text" id="job-title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} required className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_salary_negotiator_company_label')}</label>
            <input type="text" id="company" value={company} onChange={e => setCompany(e.target.value)} required className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="offer" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_salary_negotiator_offer_label')}</label>
            <input type="number" id="offer" value={offer} onChange={e => setOffer(e.target.value)} required placeholder={t('tool_salary_negotiator_offer_placeholder')} className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_salary_negotiator_currency_label')}</label>
            <select id="currency" value={currency} onChange={e => setCurrency(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
          {loading ? t('tool_salary_negotiator_generating_button') : t('tool_salary_negotiator_generate_button')}
        </button>
      </form>
    </div>
  );

  const renderResult = () => {
    // (c) StagedLoader already has onCancel + icon + accent — preserved as-is
    if (loading) return <StagedLoader title="Building your strategy" steps={["Reading your offer details…","Researching current market rates…","Crafting your negotiation plan…","Polishing talking points…"]} onCancel={cancel} icon={<Wallet />} accent="emerald" />;

    // (e) ERROR RETRY
    if (error) return (
      <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => runTool({ jobTitle, company, offer, currency })}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          {t('tool_try_again')}
        </button>
      </div>
    );

    if (!result) return null;

    const { marketAnalysisSummary, recommendedRange, keyStrengths, negotiationStrategy, counterOfferEmailDraft, objectionHandlers, groundingChunks } = result;

    // Build a downloadable text blob of the key output
    const downloadText = [
      `${t('tool_salary_negotiator_market_analysis')}\n${marketAnalysisSummary}`,
      `\n${t('tool_salary_negotiator_recommended_range')}\n${new Intl.NumberFormat('en-US', { style: 'currency', currency: recommendedRange.currency, minimumFractionDigits: 0 }).format(recommendedRange.baseMin)} - ${new Intl.NumberFormat('en-US', { style: 'currency', currency: recommendedRange.currency, minimumFractionDigits: 0 }).format(recommendedRange.baseMax)}\n${recommendedRange.explanation}`,
      `\n${t('tool_salary_negotiator_key_strengths')}\n${keyStrengths.map(s => `- ${s}`).join('\n')}`,
      `\n${t('tool_salary_negotiator_strategy')}\n${negotiationStrategy.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
      `\n${t('tool_salary_negotiator_email_draft')}\n${counterOfferEmailDraft}`,
    ].join('\n');

    return (
      <div className="space-y-6 animate-fade-in">
        {/* (d) RESULT ACTIONS — download + start-over */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h4 className="text-lg font-bold dark:text-gray-100">{t('tool_salary_negotiator_results_title')}</h4>
          <div className="flex items-center gap-2">
            <DownloadButtons textContent={downloadText} baseFilename="salary_negotiation_strategy" />
            <button
              type="button"
              onClick={() => setResult(null)}
              className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
            >
              {t('tool_start_over')}
            </button>
          </div>
        </div>
        <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
          <h5 className="font-bold text-blue-900 dark:text-blue-300">{t('tool_salary_negotiator_market_analysis')}</h5>
          <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">{marketAnalysisSummary}</p>
        </div>
        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
          <h5 className="font-bold text-green-800 dark:text-green-300">{t('tool_salary_negotiator_recommended_range')}</h5>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: recommendedRange.currency, minimumFractionDigits: 0 }).format(recommendedRange.baseMin)} - {new Intl.NumberFormat('en-US', { style: 'currency', currency: recommendedRange.currency, minimumFractionDigits: 0 }).format(recommendedRange.baseMax)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{recommendedRange.explanation}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_salary_negotiator_key_strengths')}</h5>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm dark:text-gray-300">{keyStrengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
          <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_salary_negotiator_strategy')}</h5>
            <ul className="list-decimal list-inside mt-2 space-y-1 text-sm dark:text-gray-300">{negotiationStrategy.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        </div>
        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_salary_negotiator_email_draft')}</h5>
          <div className="mt-2 text-sm p-3 bg-gray-50 dark:bg-slate-700 rounded-md whitespace-pre-wrap border dark:border-slate-600 dark:text-gray-300">{counterOfferEmailDraft}</div>
        </div>
        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_salary_negotiator_objections')}</h5>
          <div className="space-y-3 mt-2">
            {objectionHandlers.map((o, i) => (
              <details key={i} className="text-sm bg-gray-50 dark:bg-slate-700 p-2 rounded-md border dark:border-slate-600">
                <summary className="font-semibold cursor-pointer dark:text-gray-200">{o.objection}</summary>
                <p className="mt-2 pl-4 border-l-2 ml-2 dark:text-gray-300">{o.response}</p>
              </details>
            ))}
          </div>
        </div>
        {groundingChunks && (
          <div className="pt-2 border-t dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400">
            <p className="font-semibold mb-1">{t('tool_salary_negotiator_sources')}:</p>
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

  return result ? renderResult() : renderInput();
};

export default SalaryNegotiator;
