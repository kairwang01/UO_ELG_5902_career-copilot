import React, { useState, useMemo, useEffect } from 'react';
import { BriefcaseBusiness, Building2, MapPin, MessageSquareText, Target, Users } from 'lucide-react';
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

type SavedNetworkingStrategyResult = NetworkingStrategyResult & {
  targetCompany?: string;
  targetRole?: string;
  targetLocation?: string;
};

const SAMPLE_COMPANY = 'Shopify';
const SAMPLE_ROLE = 'Senior Software Engineer';
const SAMPLE_LOCATION = 'Ottawa, ON';

const CardShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
    {children}
  </section>
);

const MetricTile: React.FC<{ label: string; value: string | number; icon: React.ElementType }> = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
    <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
      <Icon className="h-4 w-4 text-sky-700 dark:text-sky-300" />
      {label}
    </div>
    <p className="mt-3 break-words text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{value}</p>
  </div>
);

const NetworkingAssistant: React.FC<NetworkingAssistantProps> = ({ resumeText, market, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SavedNetworkingStrategyResult | null>(null);
  const { canSave, saved, persist } = useToolResults<SavedNetworkingStrategyResult>();
  const [fromSaved, setFromSaved] = useState(false);
  const [targetCompany, setTargetCompany] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [targetLocation, setTargetLocation] = useState('');

  const suggestions = useMemo(() => deriveSmartSuggestions(resumeText), [resumeText]);

  useEffect(() => {
    if (saved && !result) {
      setResult(saved.result);
      setFromSaved(true);
      if (saved.result.targetCompany) setTargetCompany(saved.result.targetCompany);
      if (saved.result.targetRole) setTargetRole(saved.result.targetRole);
      if (saved.result.targetLocation) setTargetLocation(saved.result.targetLocation);
    }
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetResult = () => {
    setResult(null);
    setFromSaved(false);
    setError(null);
  };

  const fillExample = () => {
    setTargetCompany(SAMPLE_COMPANY);
    setTargetRole(SAMPLE_ROLE);
    setTargetLocation(SAMPLE_LOCATION);
  };

  const runTool = async (companyInput: string, roleInput: string, locationInput: string) => {
    const company = companyInput.trim();
    const role = roleInput.trim();
    const location = locationInput.trim();
    if (!company || !role || !location) {
      setError(t('tool_networking_assistant_error_required'));
      return;
    }

    setTargetCompany(company);
    setTargetRole(role);
    setTargetLocation(location);

    const alive = begin();
    setError(null);
    setResult(null);
    try {
      const apiResult = await generateNetworkingStrategy(resumeText, company, role, location, market);
      if (!alive()) return;
      const nextResult: SavedNetworkingStrategyResult = {
        ...apiResult,
        targetCompany: company,
        targetRole: role,
        targetLocation: location,
      };
      setResult(nextResult);
      setFromSaved(false);
      persist(nextResult);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runTool(targetCompany, targetRole, targetLocation);
  };

  const formatForDownload = (res: SavedNetworkingStrategyResult): string => {
    const company = res.targetCompany || targetCompany || t('tool_networking_assistant_company_label');
    const role = res.targetRole || targetRole || t('tool_networking_assistant_role_label');
    const location = res.targetLocation || targetLocation || t('tool_networking_assistant_location_label');
    let content = `# Networking Strategy: ${role} at ${company} (${location})\n\n`;
    content += `## Strategy Summary\n${res.strategySummary}\n\n`;
    content += `## Contact Suggestions\n`;
    (res.contactSuggestions ?? []).forEach((suggestion, index) => {
      content += `### Contact ${index + 1}: ${suggestion.contactType}\n`;
      content += `**Why:** ${suggestion.reason}\n\n`;
      content += `**Outreach Message:**\n${suggestion.outreachMessage}\n\n`;
    });
    return content;
  };

  const renderInput = () => (
    <div className="mx-auto max-w-6xl space-y-5">
      <CardShell className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
          <form onSubmit={handleSubmit} className="min-w-0 p-5 sm:p-6 lg:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
              <Users className="h-4 w-4" />
              {t('tool_networking_assistant_title')}
            </div>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-3xl">
              {t('tool_networking_intro_line1')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t('tool_networking_intro_line2')}
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label htmlFor="networking-target-company" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t('tool_networking_assistant_company_label')}
                </label>
                <div className="relative mt-2">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    id="networking-target-company"
                    className="block min-h-[48px] w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-base text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder={t('tool_networking_assistant_company_placeholder')}
                    value={targetCompany}
                    onChange={(event) => setTargetCompany(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="networking-target-location" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t('tool_networking_assistant_location_label')}
                </label>
                <div className="relative mt-2">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    id="networking-target-location"
                    className="block min-h-[48px] w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-base text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder={t('tool_networking_assistant_location_placeholder')}
                    value={targetLocation}
                    onChange={(event) => setTargetLocation(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="networking-target-role" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t('tool_networking_assistant_role_label')}
                  </label>
                  <button
                    type="button"
                    onClick={fillExample}
                    className="text-sm font-semibold text-sky-700 transition hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
                  >
                    {t('try_example')}
                  </button>
                </div>

                {resumeText && (
                  <div className="mb-3">
                    <SmartSuggestChips
                      items={suggestions.roles}
                      onPick={(value) => setTargetRole(value)}
                      label={t('smart_suggest_target_roles')}
                    />
                  </div>
                )}

                <div className="relative">
                  <BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    id="networking-target-role"
                    className="block min-h-[48px] w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-base text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder={t('tool_networking_assistant_role_placeholder')}
                    value={targetRole}
                    onChange={(event) => setTargetRole(event.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300" role="alert">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="leading-relaxed">{error}</p>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:hover:bg-red-900/30"
                  >
                    {t('try_again')}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
            >
              {loading ? t('tool_networking_assistant_generating_button') : t('tool_networking_assistant_generate_button')}
            </button>
          </form>

          <aside className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40 sm:p-6 lg:border-l lg:border-t-0">
            <div className="rounded-lg border border-sky-100 bg-sky-50 p-4 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
              <div className="flex items-start gap-3">
                <Target className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm font-semibold leading-relaxed">{t('tool_networking_assistant_setup_desc')}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                t('tool_networking_assistant_approach_label'),
                t('tool_networking_assistant_contact_label'),
                t('tool_networking_assistant_why_contact_label'),
                t('tool_networking_assistant_draft_label'),
              ].map((label, index) => (
                <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </CardShell>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;

    const company = result.targetCompany || targetCompany || t('tool_networking_assistant_company_label');
    const role = result.targetRole || targetRole || t('tool_networking_assistant_role_label');
    const location = result.targetLocation || targetLocation || t('tool_networking_assistant_location_label');
    const contacts = result.contactSuggestions ?? [];
    const title = t('tool_networking_assistant_results_title')
      .replace('{company}', company)
      .replace('{location}', location);
    const downloadTitle = company.replace(/\s/g, '_');

    return (
      <div className="mx-auto max-w-7xl space-y-5 animate-fade-in">
        <SavedResultBar t={t} canSave={canSave} isSaved={fromSaved} savedAt={saved?.savedAt ?? null} onTryNext={resetResult} />

        <CardShell className="overflow-hidden">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
                <Users className="h-4 w-4" />
                {t('tool_networking_assistant_title')}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-3xl">
                {role}
              </h2>
              <p className="mt-4 max-w-4xl text-base leading-relaxed text-slate-700 dark:text-slate-300">{result.strategySummary}</p>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40 sm:p-6 xl:border-l xl:border-t-0">
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <MetricTile label={t('tool_networking_assistant_company_label')} value={company} icon={Building2} />
                <MetricTile label={t('tool_networking_assistant_location_label')} value={location} icon={MapPin} />
                <MetricTile label={t('tool_networking_assistant_contact_label')} value={contacts.length} icon={MessageSquareText} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <DownloadButtons textContent={formatForDownload(result)} baseFilename={`networking_strategy_${downloadTitle}`} />
                <button
                  type="button"
                  onClick={resetResult}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t('tool_start_over')}
                </button>
              </div>
            </div>
          </div>
        </CardShell>

        <div className="grid gap-5 lg:grid-cols-2">
          {contacts.map((suggestion, index) => (
            <article key={`${suggestion.contactType}-${index}`} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-700 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('tool_networking_assistant_contact_label')}</p>
                  <h3 className="mt-1 break-words text-lg font-semibold text-slate-950 dark:text-slate-100">{suggestion.contactType}</h3>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <h4 className="text-sm font-semibold text-amber-950 dark:text-amber-200">{t('tool_networking_assistant_why_contact_label')}</h4>
                <p className="mt-2 break-words text-sm leading-relaxed text-amber-900 dark:text-amber-200">{suggestion.reason}</p>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-950 dark:text-slate-100">{t('tool_networking_assistant_draft_label')}</h4>
                  <CopyButton text={suggestion.outreachMessage} label={t('tool_networking_assistant_copy_button')} />
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {suggestion.outreachMessage}
                </p>
              </div>
            </article>
          ))}
        </div>

        <button
          type="button"
          onClick={resetResult}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t('tool_networking_assistant_new_plan_button')}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <StagedLoader
        title={t('tool_networking_loader_title')}
        steps={[t('tool_networking_step1'), t('tool_networking_step2'), t('tool_networking_step3')]}
        onCancel={cancel}
        cancelLabel={t('tool_loader_hide_button')}
        cancelHint={t('tool_loader_hide_hint')}
        icon={<Users />}
        accent="sky"
      />
    );
  }

  return result ? renderResult() : renderInput();
};

export default NetworkingAssistant;
