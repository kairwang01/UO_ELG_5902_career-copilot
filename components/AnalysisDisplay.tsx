
import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, LockKeyhole, Search, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import type { AnalysisResult, UserProfile } from '../types';
import ToolRunner from './ToolRunner';
import InterviewSimulator from './InterviewSimulator';
import { TOOL_ACCESS, hasAccess, ALL_PLANS, PLAN_HIERARCHY } from '../config';
import type { AppSession as Session } from '../lib/data';
import { applyResumeImprovements } from '../services/aiClient';
import { renderFormattedText } from './tools/ToolUtils';
import ResumePreview from './ResumePreview';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { ALL_TOOLS_CONFIG } from '../constants/tools';

interface AnalysisDisplayProps {
  result: AnalysisResult | null;
  onReset: () => void;
  resumeText: string;
  userPlan: string;
  market: string;
  navigateToPricing: () => void;
  session: Session | null;
  profile: UserProfile | null;
  refreshProfile: () => void;
  t: (key: string) => string;
  onApplyImprovements: (newText: string) => void;
  activeTool: string | null;
  setActiveTool: (tool: string | null) => void;
  /** Leaves the report view and opens the toolkit gallery (result view only). */
  onContinueToToolkit?: () => void;
}

const ScoreCircle: React.FC<{ score: number, t: (key: string) => string }> = ({ score, t }) => {
    const getGradientColors = () => {
        if (score < 50) return ['from-red-500', 'to-orange-500'];
        if (score < 75) return ['from-yellow-500', 'to-amber-500'];
        return ['from-green-500', 'to-emerald-500'];
    };
    const [fromColor, toColor] = getGradientColors();
    const scoreColor = score < 50 ? 'text-red-600 dark:text-red-500' : score < 75 ? 'text-yellow-600 dark:text-yellow-500' : 'text-green-600 dark:text-green-500';

    return (
        <div className="relative w-48 h-48 mx-auto">
            <svg className="w-full h-full" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" className={`stop-color-${fromColor}`} />
                        <stop offset="100%" className={`stop-color-${toColor}`} />
                    </linearGradient>
                     <style>
                        {`.stop-color-from-red-500 { stop-color: #ef4444; }`}
                        {`.stop-color-to-orange-500 { stop-color: #f97316; }`}
                        {`.stop-color-from-yellow-500 { stop-color: #eab308; }`}
                        {`.stop-color-to-amber-500 { stop-color: #f59e0b; }`}
                        {`.stop-color-from-green-500 { stop-color: #22c55e; }`}
                        {`.stop-color-to-emerald-500 { stop-color: #10b981; }`}
                    </style>
                </defs>
                <circle className="text-gray-200 dark:text-slate-700" strokeWidth="10" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50"/>
                <circle
                    stroke="url(#scoreGradient)"
                    strokeWidth="10"
                    strokeDasharray="283"
                    strokeDashoffset={283 - (score / 100) * 283}
                    strokeLinecap="round"
                    fill="transparent"
                    r="45"
                    cx="50"
                    cy="50"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s ease-out' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-bold ${scoreColor}`}>{score}</span>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('analysis_score_subtitle')}</span>
            </div>
        </div>
    );
};

const ResumeReferenceModal: React.FC<{ isOpen: boolean; onClose: () => void; resumeText: string; market: string; t: (key: string) => string; }> = ({ isOpen, onClose, resumeText, market, t }) => {
  useModalBehavior(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('analysis_reference_title')}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700"
            aria-label={t('analysis_reference_close')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="flex-grow overflow-hidden p-2">
           <ResumePreview resumeText={resumeText} market={market} t={t} />
        </div>
      </div>
    </div>
  );
};

type ToolGroupId = 'recommended' | 'resume' | 'jobs' | 'practice' | 'growth';

// label / helper hold i18n KEYS, resolved with t() at render.
const TOOL_GROUPS: { id: ToolGroupId; label: string; helper: string; keys: string[] }[] = [
  {
    id: 'recommended',
    label: 'studio_group_recommended_label',
    helper: 'studio_group_recommended_helper',
    keys: ['resume-formatter', 'opportunity-finder', 'cover-letter', 'mock-interview'],
  },
  {
    id: 'resume',
    label: 'studio_group_resume_label',
    helper: 'studio_group_resume_helper',
    keys: ['resume-formatter', 'linkedin-optimizer'],
  },
  {
    id: 'jobs',
    label: 'studio_group_jobs_label',
    helper: 'studio_group_jobs_helper',
    keys: ['opportunity-finder', 'cover-letter', 'email-crafter', 'networking-assistant', 'industry-event-scout'],
  },
  {
    id: 'practice',
    label: 'studio_group_practice_label',
    helper: 'studio_group_practice_helper',
    keys: ['mock-interview', 'english-pro', 'salary-negotiation'],
  },
  {
    id: 'growth',
    label: 'studio_group_growth_label',
    helper: 'studio_group_growth_helper',
    keys: ['career-path', 'skill-learning-plan', 'performance-review-prep', 'agile-coach'],
  },
];

// Values are i18n keys, resolved with t() at render.
const TOOL_PHASE_LABELS: Record<string, string> = {
  'resume-formatter': 'studio_phase_resume',
  'linkedin-optimizer': 'studio_phase_profile',
  'opportunity-finder': 'studio_phase_matching',
  'cover-letter': 'studio_phase_application',
  'email-crafter': 'studio_phase_outreach',
  'networking-assistant': 'studio_phase_outreach',
  'industry-event-scout': 'studio_phase_networking',
  'mock-interview': 'studio_phase_interview',
  'english-pro': 'studio_phase_interview',
  'salary-negotiation': 'studio_phase_offer',
  'career-path': 'studio_phase_planning',
  'skill-learning-plan': 'studio_phase_learning',
  'performance-review-prep': 'studio_phase_growth',
  'agile-coach': 'studio_phase_growth',
};

const formatPlanLabel = (planKey: string | undefined): string => {
  if (!planKey) return 'Free';
  const plan = ALL_PLANS[planKey];
  if (plan) return plan.name;
  return planKey.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};


const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ t, result, onReset, resumeText, userPlan, market, navigateToPricing, session, profile, refreshProfile, onApplyImprovements, activeTool, setActiveTool, onContinueToToolkit }) => {
  const [toolInput, setToolInput] = useState<string>('');
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const [toolGroup, setToolGroup] = useState<ToolGroupId>('recommended');
  const [toolQuery, setToolQuery] = useState('');
  const userPlanLevel = PLAN_HIERARCHY[userPlan] ?? 0;
  const isHighestPlan = userPlanLevel === PLAN_HIERARCHY.executive;

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [confirmingApply, setConfirmingApply] = useState(false);

  const selectedToolGroup = TOOL_GROUPS.find((group) => group.id === toolGroup) ?? TOOL_GROUPS[0];
  const filteredTools = useMemo(() => {
    const query = toolQuery.trim().toLowerCase();
    return ALL_TOOLS_CONFIG.filter((tool) => {
      const isInGroup = selectedToolGroup.keys.includes(tool.key);
      if (!isInGroup) return false;
      if (!query) return true;

      const titleKey = `tool_${tool.key.replace(/-/g, '_')}_title`;
      const descKey = `tool_${tool.key.replace(/-/g, '_')}_desc`;
      const title = t(titleKey);
      const desc = t(descKey);
      return [tool.key, title, desc].some((value) => value.toLowerCase().includes(query));
    });
  }, [selectedToolGroup, toolQuery, t]);

  const openTool = (tool: string, input: string = '') => {
    if (input) setToolInput(input);
    setActiveTool(tool);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleApplySuggestions = async () => {
    if (!result) return;
    setIsOptimizing(true);
    setOptimizationError(null);
    try {
      const { updatedResumeText } = await applyResumeImprovements(resumeText, result.improvements);
      onApplyImprovements(updatedResumeText);
      setConfirmingApply(false);
    } catch (err) {
      setOptimizationError(err instanceof Error ? err.message : 'Failed to apply improvements.');
    } finally {
      setIsOptimizing(false);
    }
  };
  
  // -----------------------------------------------------------
  // CAREER STUDIO WORKSPACE LAYOUT (NO RESULT)
  // -----------------------------------------------------------
  if (!result) {
      const toolTitle = activeTool ? t(`tool_${activeTool.replace(/-/g, '_')}_title`) : t('studio_toolkit_kicker');

      return (
          <>
            <div className="workspace-card min-h-[75vh] flex flex-col overflow-hidden">
                {activeTool ? (
                    <>
                        {/* Top Bar for Tool */}
                        <div className="min-h-16 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3 px-4 py-3 shrink-0 z-20 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <div className="flex min-w-0 items-center gap-3">
                                <button 
                                    onClick={() => setActiveTool(null)}
                                    className="workspace-button-ghost inline-flex h-9 w-9 shrink-0 items-center justify-center"
                                    aria-label={t('studio_back_to_library')}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
                                    {t('studio_assisted_tool')}
                                  </p>
                                  <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{toolTitle}</h2>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsReferenceModalOpen(true)} 
                                className="workspace-button-secondary inline-flex items-center justify-center gap-2 px-3 py-2"
                            >
                                <FileText className="h-4 w-4" />
                                {t('studio_review_resume')}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 dark:bg-slate-950/40 sm:p-6 md:p-10">
                            <div className="max-w-4xl mx-auto">
                                {activeTool === 'mock-interview' ? (
                                        <InterviewSimulator
                                            resumeText={resumeText}
                                            market={market}
                                            onClose={() => setActiveTool(null)}
                                            session={session}
                                            profile={profile}
                                            navigateToPricing={navigateToPricing}
                                            t={t}
                                        />
                                ) : (
                                        <ToolRunner
                                            tool={activeTool}
                                            resumeText={resumeText}
                                            initialInput={toolInput}
                                            onClose={() => setActiveTool(null)}
                                            openTool={openTool}
                                            market={market}
                                            session={session}
                                            profile={profile}
                                            refreshProfile={refreshProfile}
                                            t={t}
                                        />
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-white p-4 dark:from-slate-950 dark:to-slate-900 sm:p-6 md:p-8">
                        <div className="mx-auto max-w-6xl">
                            <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
                              <div className="workspace-card p-5 sm:p-6">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
                                      <Wrench className="h-4 w-4" />
                                      {t('studio_toolkit_kicker')}
                                    </div>
                                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-3xl">
                                      {t('studio_toolkit_title')}
                                    </h2>
                                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                      {t('studio_toolkit_subtitle')}
                                    </p>
                                  </div>
                                  <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                                    {isHighestPlan ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <LockKeyhole className="h-4 w-4 text-slate-400" />}
                                    {isHighestPlan ? t('studio_all_tools_included') : t('studio_plan_suffix').replace('{plan}', formatPlanLabel(userPlan))}
                                  </div>
                                </div>

                                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                                  {[
                                    [t('studio_phase_resume'), t('studio_stat_resume_helper')],
                                    [t('studio_stat_match_label'), t('studio_stat_match_helper')],
                                    [t('studio_phase_outreach'), t('studio_stat_outreach_helper')],
                                    [t('studio_phase_interview'), t('studio_stat_interview_helper')],
                                  ].map(([label, helper]) => (
                                    <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="workspace-card p-5">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  {t('studio_resume_context')}
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                  {t('studio_resume_context_desc')}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setIsReferenceModalOpen(true)}
                                  className="workspace-button-secondary mt-4 inline-flex w-full items-center justify-center gap-2 px-3 py-2"
                                >
                                  <FileText className="h-4 w-4" />
                                  {t('studio_review_resume')}
                                </button>
                              </div>
                            </div>

                            <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_280px]">
                              <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
                                {TOOL_GROUPS.map((group) => (
                                  <button
                                    key={group.id}
                                    type="button"
                                    aria-pressed={toolGroup === group.id}
                                    onClick={() => setToolGroup(group.id)}
                                    className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                      toolGroup === group.id
                                        ? 'bg-blue-700 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                                    }`}
                                  >
                                    {t(group.label)}
                                  </button>
                                ))}
                              </div>
                              <label className="relative block">
                                <span className="sr-only">{t('studio_search_label')}</span>
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="search"
                                  value={toolQuery}
                                  onChange={(event) => setToolQuery(event.target.value)}
                                  placeholder={t('studio_search_ph')}
                                  className="h-full min-h-[46px] w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-900/40"
                                />
                              </label>
                            </div>

                            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                              <div>
                                <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">{t(selectedToolGroup.label)}</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">{t(selectedToolGroup.helper)}</p>
                              </div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-500">
                                {t('studio_tool_count')
                                  .replace('{shown}', String(filteredTools.length))
                                  .replace('{total}', String(selectedToolGroup.keys.length))}
                              </p>
                            </div>

                            {filteredTools.length === 0 ? (
                              <div className="workspace-card p-8 text-center">
                                <Search className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                                <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">{t('studio_no_match_title')}</h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('studio_no_match_desc')}</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredTools.map((tool) => {
                                    const titleKey = `tool_${tool.key.replace(/-/g, '_')}_title`;
                                    const descKey = `tool_${tool.key.replace(/-/g, '_')}_desc`;
                                    const desc = t(descKey);
                                    const requiredPlan = TOOL_ACCESS[tool.key];
                                    const isIncluded = hasAccess(userPlan, requiredPlan);
                                    const isRecommended = TOOL_GROUPS[0].keys.includes(tool.key);
                                    return (
                                        <button
                                            key={tool.key}
                                            type="button"
                                            onClick={() => openTool(tool.key)}
                                            className="group workspace-card flex min-h-[184px] flex-col p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:border-blue-800"
                                            aria-label={t('studio_open_tool_aria').replace('{tool}', t(titleKey))}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-105">
                                                    {React.cloneElement(tool.icon, { className: 'h-5 w-5' })}
                                                </div>
                                                <div>
                                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                                    {t(TOOL_PHASE_LABELS[tool.key] ?? 'studio_phase_tool')}
                                                  </span>
                                                  <h3 className="mt-0.5 text-sm font-semibold leading-snug text-slate-900 dark:text-white">{t(titleKey)}</h3>
                                                </div>
                                              </div>
                                              {isRecommended && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                  <Sparkles className="h-3 w-3" />
                                                  {t('studio_card_next')}
                                                </span>
                                              )}
                                            </div>
                                            {desc && desc !== descKey && (
                                                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500 line-clamp-3 dark:text-slate-400">{desc}</p>
                                            )}
                                            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                                              <span className={`text-xs font-semibold ${isIncluded ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {isIncluded ? t('studio_card_included') : t('studio_card_plan_prefix').replace('{plan}', formatPlanLabel(requiredPlan))}
                                              </span>
                                              <span className="text-sm font-semibold text-blue-700 transition group-hover:translate-x-0.5 dark:text-blue-400">
                                                {t('studio_card_open')}
                                              </span>
                                            </div>
                                        </button>
                                    );
                                })}
                              </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <ResumeReferenceModal 
                isOpen={isReferenceModalOpen}
                onClose={() => setIsReferenceModalOpen(false)}
                resumeText={resumeText}
                market={market}
                t={t}
            />
          </>
      );
  }

  // -----------------------------------------------------------
  // ANALYSIS RESULTS VIEW (HAS RESULT)
  // -----------------------------------------------------------
  return (
    <div className={`w-full animate-fade-in p-4 sm:p-6 bg-gray-50 dark:bg-slate-900 rounded-lg`}>
        
        {/* Breadcrumb Navigation for Better UX */}
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-500 dark:text-gray-400">
            <button 
                onClick={onReset} 
                className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                {t('analysis_breadcrumb_dashboard')}
            </button>
            <span>/</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
                {t('analysis_breadcrumb_results')}
            </span>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('analysis_results_title')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2 text-lg">{result.summary}</p>
        </div>

        <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-700 p-5 text-white shadow-sm dark:border-blue-800 dark:bg-blue-950 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h3 className="text-xl font-semibold">{t('analysis_apply_title')}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-blue-100">
                  {t('analysis_apply_desc')}
                </p>
              </div>
              {!confirmingApply ? (
                <button
                  type="button"
                  onClick={() => setConfirmingApply(true)}
                  disabled={isOptimizing}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-wait disabled:opacity-70"
                >
                  {t('analysis_apply_review')}
                </button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleApplySuggestions}
                    disabled={isOptimizing}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-wait disabled:opacity-70"
                  >
                    {isOptimizing && (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    )}
                    {isOptimizing ? t('analysis_applying') : t('analysis_apply_edits')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingApply(false)}
                    disabled={isOptimizing}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-70"
                  >
                    {t('action_cancel')}
                  </button>
                </div>
              )}
            </div>
            {confirmingApply && (
              <div className="mt-4 rounded-lg border border-white/20 bg-white/10 p-3 text-sm leading-relaxed text-blue-50 animate-panel-expand">
                {t('analysis_apply_safety_note')}
              </div>
            )}
            {optimizationError && (
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-red-300/40 bg-red-500/15 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-red-100">{optimizationError}</p>
                <button
                  type="button"
                  onClick={handleApplySuggestions}
                  disabled={isOptimizing}
                  className="self-start text-xs font-semibold text-white underline disabled:opacity-60 sm:self-auto"
                >
                  {t('action_retry')}
                </button>
              </div>
            )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 flex flex-col items-center space-y-6 bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-md">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{t('analysis_score_title')}</h3>
            <ScoreCircle score={result.score} t={t} />
            <p className="text-center text-gray-600 dark:text-gray-400">{t('analysis_score_description').replace('{market}', market)}</p>
            </div>
            
            <div className="lg:col-span-8 space-y-6">
            {/* Strengths */}
                <div className="bg-white dark:bg-slate-800 border border-green-200 dark:border-green-700/50 p-6 rounded-xl shadow-sm">
                    <h3 className="font-bold text-lg text-green-800 dark:text-green-300 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.085a2 2 0 00-1.736.93L5.5 8m7 2H5.5" /></svg>
                        {t('analysis_strengths_title')}
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-green-900 dark:text-green-200">
                        {(result.strengths ?? []).map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                </div>

                {/* Improvements */}
                <div className="bg-white dark:bg-slate-800 border border-yellow-300 dark:border-yellow-600/50 p-6 rounded-xl shadow-sm">
                    <h3 className="font-bold text-lg text-yellow-800 dark:text-yellow-300 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-2.236 9.168-5.514C18.102 8.048 18 8.5 18 9a3 3 0 01-3 3h-1.572L9.5 17.5M5 13l2 6" /></svg>
                        {t('analysis_improvements_title')}
                    </h3>
                    <ul className="space-y-3 text-yellow-900 dark:text-yellow-200">
                        {(result.improvements ?? []).map((item, i) => (
                            <li key={i}><strong className="font-semibold">{item.area}:</strong> {item.suggestion}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
      
        {/* Keywords */}
        <div className="mt-8 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-600/50 p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-lg text-blue-800 dark:text-blue-300 mb-3 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
                    {t('analysis_keywords_title')}
                </h3>
                <div className="flex flex-wrap gap-2">
                    {(result.keywords ?? []).map((item, i) => (
                        <span key={i} className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-sm font-medium px-3 py-1.5 rounded-full">{item}</span>
                    ))}
                </div>
            </div>

        <div className="mt-12 text-center">
            <button
              onClick={() => (onContinueToToolkit ? onContinueToToolkit() : onReset())}
              className="font-bold py-3 px-8 rounded-lg shadow-md bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-slate-600 transition-all"
            >
                {t('analysis_continue_toolkit')}
            </button>
        </div>
    </div>
  );
};

export default AnalysisDisplay;
