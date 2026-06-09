
import React, { useState } from 'react';
import { Wrench } from 'lucide-react';
import type { AnalysisResult, UserProfile } from '../types';
import ToolRunner from './ToolRunner';
import InterviewSimulator from './InterviewSimulator';
import { TOOL_ACCESS, hasAccess, ALL_PLANS, PLAN_HIERARCHY } from '../config';
import type { AppSession as Session } from '../lib/data';
import { applyResumeImprovements } from '../services/aiClient';
import { renderFormattedText } from './tools/ToolUtils';
import ResumePreview from './ResumePreview';
import { useSettings } from '../contexts/SettingsContext';
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
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Resume Reference</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700"
            aria-label="Close modal"
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


const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ t, result, onReset, resumeText, userPlan, market, navigateToPricing, session, profile, refreshProfile, onApplyImprovements, activeTool, setActiveTool }) => {
  const [toolInput, setToolInput] = useState<string>('');
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const userPlanLevel = PLAN_HIERARCHY[userPlan] ?? 0;
  const isHighestPlan = userPlanLevel === PLAN_HIERARCHY.executive;
  const { isAIMode } = useSettings();

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);

  const openTool = (tool: string, input: string = '') => {
    if (input) setToolInput(input);
    setActiveTool(tool);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleApplySuggestions = async () => {
    if (!result) return;
    if (!window.confirm("Are you sure? This will rewrite your resume text with the AI's suggestions. Your current text will be replaced.")) {
        return;
    }
    setIsOptimizing(true);
    setOptimizationError(null);
    try {
      const { updatedResumeText } = await applyResumeImprovements(resumeText, result.improvements);
      onApplyImprovements(updatedResumeText);
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
      const toolTitle = activeTool ? t(`tool_${activeTool.replace(/-/g, '_')}_title`) : 'AI Career Toolkit';

      return (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 min-h-[75vh] flex flex-col overflow-hidden">
                {activeTool ? (
                    <>
                        {/* Top Bar for Tool */}
                        <div className="h-16 bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6 shrink-0 z-20">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setActiveTool(null)}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-500"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">{toolTitle}</h2>
                            </div>
                            <button 
                                onClick={() => setIsReferenceModalOpen(true)} 
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-300 text-sm font-medium"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                Resume Reference
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gray-50/30 dark:bg-slate-900/10">
                            <div className="max-w-4xl mx-auto">
                                {activeTool === 'mock-interview' ? (
                                        <InterviewSimulator 
                                            resumeText={resumeText} 
                                            market={market} 
                                            onClose={() => setActiveTool(null)} 
                                            session={session}
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
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-br from-gray-50 to-white dark:from-slate-900 dark:to-slate-800">
                        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400">
                            <Wrench className="h-10 w-10" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Professional AI Toolkit</h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed mb-8">
                            Select a professional tool from the sidebar to start optimizing your career path. Each tool is specifically designed to handle different aspects of your job search.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full text-left">
                            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                <h4 className="font-bold text-gray-900 dark:text-white mb-1">Context Aware</h4>
                                <p className="text-xs text-gray-500 dark:text-slate-500">Every tool analyzes your specific resume and experience to provide custom results.</p>
                            </div>
                            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                <h4 className="font-bold text-gray-900 dark:text-white mb-1">Expert Precision</h4>
                                <p className="text-xs text-gray-500 dark:text-slate-500">Powered by advanced career-focused AI models for professional-grade output.</p>
                            </div>
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
                Dashboard
            </button>
            <span>/</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
                Analysis Results
            </span>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('analysis_results_title')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2 text-lg">{result.summary}</p>
        </div>

        <div className="mb-8 p-6 bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl text-white text-center shadow-lg transform hover:scale-[1.02] transition-transform duration-300">
            <h3 className="font-bold text-xl drop-shadow-md">Want to improve faster?</h3>
            <p className="text-sm text-blue-200 mt-1 max-w-lg mx-auto">Let our AI agent rewrite your resume and apply all these suggestions for you with a single click.</p>
            <button 
              onClick={handleApplySuggestions}
              disabled={isOptimizing}
              className="mt-4 px-6 py-2.5 bg-white text-blue-700 font-bold rounded-full shadow-md hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 disabled:opacity-70 disabled:cursor-wait"
            >
              {isOptimizing ? 'Optimizing...' : 'Apply All Suggestions'}
            </button>
            {optimizationError && <p className="text-xs text-red-300 mt-2">{optimizationError}</p>}
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
                        {result.strengths.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                </div>

                {/* Improvements */}
                <div className="bg-white dark:bg-slate-800 border border-yellow-300 dark:border-yellow-600/50 p-6 rounded-xl shadow-sm">
                    <h3 className="font-bold text-lg text-yellow-800 dark:text-yellow-300 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-2.236 9.168-5.514C18.102 8.048 18 8.5 18 9a3 3 0 01-3 3h-1.572L9.5 17.5M5 13l2 6" /></svg>
                        {t('analysis_improvements_title')}
                    </h3>
                    <ul className="space-y-3 text-yellow-900 dark:text-yellow-200">
                        {result.improvements.map((item, i) => (
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
                    {result.keywords.map((item, i) => (
                        <span key={i} className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-sm font-medium px-3 py-1.5 rounded-full">{item}</span>
                    ))}
                </div>
            </div>

        <div className="mt-12 text-center">
            <button onClick={() => openTool(null)} className="font-bold py-3 px-8 rounded-lg shadow-md bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-slate-600 transition-all">
                Continue to AI Toolkit &rarr;
            </button>
        </div>
    </div>
  );
};

export default AnalysisDisplay;
