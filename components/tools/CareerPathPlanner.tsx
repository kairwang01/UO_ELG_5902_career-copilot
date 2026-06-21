import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Compass } from 'lucide-react';
import { generateCareerPath, generateSkillBridgeProject } from '../../services/aiClient';
import type { CareerPathResult, SkillBridgeProject } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { DownloadButtons, SavedResultBar } from './ToolUtils';
import { useToolResults } from '../../contexts/ToolResultsContext';
import type { AppSession as Session } from '../../lib/data';
import { deriveSmartSuggestions, SmartSuggestChips } from '../SmartSuggest';

interface CareerPathPlannerProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
  openTool: (tool: string, input?: string) => void;
  session: Session | null;
}

const SAMPLE_ROLE = 'Senior Product Manager';

const actionIcons: { [key: string]: React.ReactNode } = {
  course: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  certification: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  project: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  networking: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0A5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  'self-study': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
};


const CareerPathPlanner: React.FC<CareerPathPlannerProps> = ({ resumeText, market, t, openTool, session }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CareerPathResult | null>(null);
  const { canSave, saved, persist } = useToolResults<CareerPathResult>();
  const [fromSaved, setFromSaved] = useState(false);
  const [desiredRole, setDesiredRole] = useState('');

  const [generatingProjectForSkill, setGeneratingProjectForSkill] = useState<string | null>(null);
  const [generatedProject, setGeneratedProject] = useState<SkillBridgeProject | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [lastProjectSkill, setLastProjectSkill] = useState<string | null>(null);
  const projectRunRef = useRef(0);

  useEffect(() => () => {
    projectRunRef.current += 1;
  }, []);

  // SmartSuggest: derive role chips from resume (pure, no AI)
  const suggestions = useMemo(() => deriveSmartSuggestions(resumeText), [resumeText]);

  // Hydrate from a previously-saved result (paid users) for free on reopen.
  useEffect(() => { if (saved && !result) { setResult(saved.result); setFromSaved(true); } }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateProject = async (skill: string) => {
    const runId = projectRunRef.current + 1;
    projectRunRef.current = runId;
    setLastProjectSkill(skill);
    setGeneratingProjectForSkill(skill);
    setGeneratedProject(null);
    setProjectError(null);
    try {
        const project = await generateSkillBridgeProject(resumeText, desiredRole, skill);
        if (projectRunRef.current !== runId) return;
        setGeneratedProject(project);
    } catch (err) {
        if (projectRunRef.current === runId) {
          setProjectError(err instanceof Error ? err.message : t('tool_career_path_project_failed'));
        }
    } finally {
        if (projectRunRef.current === runId) setGeneratingProjectForSkill(null);
    }
  };

  const runTool = async (input: string) => {
    if (!input) {
      setError(t('tool_career_path_error_required'));
      return;
    }
    if (!session) {
        setError(t('error_login_required'));
        return;
    }
    const alive = begin();
    setError(null);
    setResult(null);
    try {
      const apiResult = await generateCareerPath(resumeText, input, market, session);
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
    runTool(desiredRole);
  };

  const renderInput = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* (a) INTRO CARD */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
        <p className="font-medium text-slate-700 dark:text-slate-300">{t('tool_career_path_intro_line1')}</p>
        <p className="mt-0.5">{t('tool_career_path_intro_line2')}</p>
      </div>

      {/* (b) SAMPLE-FILL */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDesiredRole(SAMPLE_ROLE)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('try_example')}
        </button>
      </div>

      {/* SmartSuggestChips for target role */}
      {resumeText && (
        <SmartSuggestChips
          items={suggestions.roles}
          onPick={(v) => setDesiredRole(v)}
          label={t('smart_suggest_target_roles')}
        />
      )}

      <input
        type="text"
        className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
        placeholder={t('tool_career_path_placeholder')}
        value={desiredRole}
        onChange={(e) => setDesiredRole(e.target.value)}
        required
      />

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
        {loading ? t('tool_career_path_analyzing_button') : t('tool_career_path_generate_button')}
      </button>
    </form>
  );

  const formatForDownload = (res: CareerPathResult): string => {
    let content = `# Your Career Path to: ${desiredRole}\n\n`;
    content += `## Summary\n${res.summary}\n\n`;
    content += `## Overall Skill Gaps\n`;
    res.overallSkillGaps.forEach(gap => {
        content += `* **${gap.skill}:** ${gap.reason}\n`;
    });
    content += `\n## Your Roadmap\n`;
    res.roadmap.forEach(phase => {
        content += `### ${phase.phaseTitle} (${phase.estimatedDuration})\n`;
        content += `**Goal:** ${phase.goal}\n\n`;
        content += `**Actionable Steps:**\n`;
        phase.actionableSteps.forEach(step => {
            content += `* **${step.type.charAt(0).toUpperCase() + step.type.slice(1)}:** ${step.description}\n`;
            if (step.resources && step.resources.length > 0) {
                 content += `  * Resources: ${step.resources.join(', ')}\n`;
            }
        });
        content += `\n**Milestones:**\n`;
        phase.milestones.forEach(milestone => {
             content += `* ${milestone}\n`;
        });
        content += `\n`;
    });
     content += `## Potential Bridge Roles\n`;
    res.bridgeRoles.forEach(role => {
        content += `* **${role.title}:** ${role.reason}\n`;
    });
    return content;
  };

  const renderResult = () => {
    if (loading) return (
      <StagedLoader
        icon={<Compass />}
        accent="teal"
        title={t('tool_career_path_loader_title')}
        steps={[
          t('tool_career_path_loader_step1'),
          t('tool_career_path_loader_step2'),
          t('tool_career_path_loader_step3'),
        ]}
        onCancel={cancel}
        cancelLabel={t('tool_loader_hide_button')}
        cancelHint={t('tool_loader_hide_hint')}
      />
    );

    if (!result) return null;

    // Defensive defaults: even with the output-cap fix, a malformed/partial AI
    // response must degrade to "shows what it has" rather than crashing the tool
    // (a missing array would throw on .map and white-screen the panel).
    const {
      summary = '',
      overallSkillGaps = [],
      roadmap = [],
      bridgeRoles = [],
    } = result;

    return (
      <div className="space-y-8 animate-fade-in">
        <SavedResultBar
          t={t}
          canSave={canSave}
          isSaved={fromSaved}
          savedAt={saved?.savedAt ?? null}
          onTryNext={() => { setResult(null); setFromSaved(false); setError(null); }}
        />
        <div className="flex justify-between items-center">
          <h4 className="text-xl font-bold">{t('tool_career_path_results_title')}</h4>
          {/* (d) RESULT ACTIONS: Download + start-over */}
          <div className="flex items-center gap-2">
            <DownloadButtons textContent={formatForDownload(result)} baseFilename={`career_roadmap_for_${desiredRole.replace(/\s/g, '_')}`} />
            <button
              type="button"
              onClick={() => { setResult(null); setError(null); }}
              className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              {t('tool_start_over')}
            </button>
          </div>
        </div>

        <p className="text-gray-700 dark:text-gray-300 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg">{summary}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
              <h5 className="font-bold text-yellow-800 dark:text-amber-300">{t('tool_career_path_skill_gaps')}</h5>
              <ul className="mt-2 space-y-3 text-gray-800 dark:text-gray-300 text-sm">
                {overallSkillGaps.map(gap => (
                    <li key={gap.skill}>
                        <div className="flex justify-between items-start">
                           <span><strong>{gap.skill}:</strong> {gap.reason}</span>
                           <button onClick={() => handleGenerateProject(gap.skill)} disabled={generatingProjectForSkill === gap.skill} className="ml-2 flex-shrink-0 text-xs bg-yellow-100 dark:bg-amber-900/20 text-yellow-800 dark:text-amber-300 font-semibold px-2 py-1 rounded-full hover:bg-yellow-200 dark:hover:bg-amber-900/30 disabled:opacity-50">
                               {generatingProjectForSkill === gap.skill ? '...' : t('tool_career_path_project_button')}
                           </button>
                        </div>
                    </li>
                ))}
              </ul>
            </div>
             <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
              <h5 className="font-bold text-indigo-800 dark:text-indigo-300">{t('tool_career_path_bridge_roles')}</h5>
              <ul className="list-disc list-inside mt-2 space-y-2 text-gray-800 dark:text-gray-300 text-sm">
                {bridgeRoles.map(role => <li key={role.title}><strong>{role.title}:</strong> {role.reason}</li>)}
              </ul>
            </div>
        </div>

        {(generatedProject || projectError) && (
            <div className="p-4 border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg animate-fade-in">
                 <h3 className="font-bold text-lg text-blue-800 dark:text-blue-300 mb-3">{t('tool_career_path_project_title')}</h3>
                 {projectError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
                      <p className="text-sm">{projectError}</p>
                      {lastProjectSkill && (
                        <button
                          type="button"
                          onClick={() => handleGenerateProject(lastProjectSkill)}
                          className="mt-3 rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                        >
                          {t('try_again')}
                        </button>
                      )}
                    </div>
                 )}
                 {generatedProject && (
                     <div className="space-y-3">
                        <h4 className="font-semibold text-blue-900 dark:text-blue-300">{generatedProject.projectTitle}</h4>
                        <p className="text-sm italic text-gray-600 dark:text-gray-400">{generatedProject.objective}</p>
                        <div>
                            <p className="text-sm font-semibold">{t('tool_career_path_project_features')}</p>
                            <ul className="list-disc list-inside text-sm ml-4">{(generatedProject.keyFeatures ?? []).map((f, i) => <li key={i}>{f}</li>)}</ul>
                        </div>
                         <div>
                            <p className="text-sm font-semibold">{t('tool_career_path_project_tools')}</p>
                            <p className="text-sm">{(generatedProject.suggestedTechStack ?? []).join(', ')}</p>
                        </div>
                        <div>
                            <p className="text-sm font-semibold">{t('tool_career_path_project_showcase')}</p>
                            <p className="text-sm">{generatedProject.showcaseChallenge}</p>
                        </div>
                        <button onClick={() => openTool('website-builder', JSON.stringify(generatedProject))} className="mt-2 text-sm bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700">
                           {t('tool_career_path_add_to_portfolio')} &rarr;
                        </button>
                     </div>
                 )}
            </div>
        )}

        {/* Roadmap Timeline */}
        <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 text-center">{t('tool_career_path_roadmap_title')}</h3>
            <div className="relative border-l-2 border-blue-200 dark:border-blue-800 ml-4 py-4">
            {roadmap.map((phase, index) => (
                <div key={index} className="mb-10 ml-8 relative">
                    <span className="absolute -left-[35px] flex items-center justify-center w-6 h-6 bg-blue-600 rounded-full ring-4 ring-white dark:ring-slate-900">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4zM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10zM5 13h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2z" /></svg>
                    </span>
                    <div className="p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{phase.phaseTitle}</h4>
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded-full">{phase.estimatedDuration}</span>
                        </div>
                        <p className="text-sm italic text-gray-600 dark:text-gray-400 mb-4">{phase.goal}</p>

                        <div className="space-y-4">
                           <h6 className="font-semibold text-gray-700 dark:text-gray-300">{t('tool_career_path_actionable_steps')}</h6>
                            {phase.actionableSteps.map((step, stepIndex) => (
                                <div key={stepIndex} className="text-sm p-3 bg-gray-50 dark:bg-slate-700 rounded-md border dark:border-slate-600">
                                    <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200">
                                        {actionIcons[step.type]}
                                        <span className="capitalize">{step.type}</span>
                                    </div>
                                    <p className="mt-1 pl-7 dark:text-gray-300">{step.description}</p>
                                    {step.resources && step.resources.length > 0 && (
                                        <p className="text-xs mt-2 pl-7 text-gray-500 dark:text-gray-400"><strong>{t('tool_career_path_resources')}:</strong> {step.resources.join(', ')}</p>
                                    )}
                                </div>
                            ))}

                            <h6 className="font-semibold text-gray-700 dark:text-gray-300 pt-2">{t('tool_career_path_milestones')}</h6>
                             <ul className="list-none space-y-2">
                                {phase.milestones.map((milestone, msIndex) => (
                                <li key={msIndex} className="flex items-start text-sm">
                                    <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                    <span>{milestone}</span>
                                </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            ))}
            </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <StagedLoader
      icon={<Compass />}
      accent="teal"
      title={t('tool_career_path_loader_title')}
      steps={[
        t('tool_career_path_loader_step1'),
        t('tool_career_path_loader_step2'),
        t('tool_career_path_loader_step3'),
      ]}
      onCancel={cancel}
      cancelLabel={t('tool_loader_hide_button')}
      cancelHint={t('tool_loader_hide_hint')}
    />
  );

  return result ? renderResult() : renderInput();
};

export default CareerPathPlanner;
