import React, { useState } from 'react';
import { generateCareerPath, generateSkillBridgeProject } from '../../services/aiClient';
import type { CareerPathResult, SkillBridgeProject } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { DownloadButtons } from './ToolUtils';
import type { AppSession as Session } from '../../lib/data';

interface CareerPathPlannerProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
  openTool: (tool: string, input?: string) => void;
  session: Session | null;
}

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
  const [desiredRole, setDesiredRole] = useState('');

  const [generatingProjectForSkill, setGeneratingProjectForSkill] = useState<string | null>(null);
  const [generatedProject, setGeneratedProject] = useState<SkillBridgeProject | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  const handleGenerateProject = async (skill: string) => {
    setGeneratingProjectForSkill(skill);
    setGeneratedProject(null);
    setProjectError(null);
    try {
        const project = await generateSkillBridgeProject(resumeText, desiredRole, skill);
        setGeneratedProject(project);
    } catch (err) {
        setProjectError(err instanceof Error ? err.message : 'Failed to generate project idea.');
    } finally {
        setGeneratingProjectForSkill(null);
    }
  };

  const runTool = async (input: string) => {
    if (!input) {
      setError(t('tool_career_path_error_required'));
      return;
    }
    if (!session) {
        setError("You must be logged in to use this tool.");
        return;
    }
    const alive = begin();
    setError(null);
    setResult(null);
    try {
      const apiResult = await generateCareerPath(resumeText, input, market, session);
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
    runTool(desiredRole);
  };

  const renderInput = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">{t('tool_career_path_setup_desc')}</p>
      <input
        type="text"
        className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
        placeholder={t('tool_career_path_placeholder')}
        value={desiredRole}
        onChange={(e) => setDesiredRole(e.target.value)}
        required
      />
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
    if (loading) return <StagedLoader title="Mapping your path" steps={["Analyzing your experience…","Exploring career paths…","Building your roadmap…"]} onCancel={cancel} />;
    if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;
    if (!result) return null;

    const { summary, overallSkillGaps, roadmap, bridgeRoles } = result;

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex justify-between items-center">
          <h4 className="text-xl font-bold">{t('tool_career_path_results_title')}</h4>
          <DownloadButtons textContent={formatForDownload(result)} baseFilename={`career_roadmap_for_${desiredRole.replace(/\s/g, '_')}`} />
        </div>
        
        <p className="text-gray-700 p-4 bg-blue-50 border border-blue-200 rounded-lg">{summary}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border rounded-lg bg-white">
              <h5 className="font-bold text-yellow-800">{t('tool_career_path_skill_gaps')}</h5>
              <ul className="mt-2 space-y-3 text-gray-800 text-sm">
                {overallSkillGaps.map(gap => (
                    <li key={gap.skill}>
                        <div className="flex justify-between items-start">
                           <span><strong>{gap.skill}:</strong> {gap.reason}</span>
                           <button onClick={() => handleGenerateProject(gap.skill)} disabled={generatingProjectForSkill === gap.skill} className="ml-2 flex-shrink-0 text-xs bg-yellow-100 text-yellow-800 font-semibold px-2 py-1 rounded-full hover:bg-yellow-200 disabled:opacity-50">
                               {generatingProjectForSkill === gap.skill ? '...' : 'Project'}
                           </button>
                        </div>
                    </li>
                ))}
              </ul>
            </div>
             <div className="p-4 border rounded-lg bg-white">
              <h5 className="font-bold text-indigo-800">{t('tool_career_path_bridge_roles')}</h5>
              <ul className="list-disc list-inside mt-2 space-y-2 text-gray-800 text-sm">
                {bridgeRoles.map(role => <li key={role.title}><strong>{role.title}:</strong> {role.reason}</li>)}
              </ul>
            </div>
        </div>
        
        {(generatedProject || projectError) && (
            <div className="p-4 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg animate-fade-in">
                 <h3 className="font-bold text-lg text-blue-800 mb-3">Skill Bridge Project Idea</h3>
                 {projectError && <div className="text-red-600 bg-red-100 p-4 rounded-lg">{projectError}</div>}
                 {generatedProject && (
                     <div className="space-y-3">
                        <h4 className="font-semibold text-blue-900">{generatedProject.projectTitle}</h4>
                        <p className="text-sm italic text-gray-600">{generatedProject.objective}</p>
                        <div>
                            <p className="text-sm font-semibold">Key Features:</p>
                            <ul className="list-disc list-inside text-sm ml-4">{generatedProject.keyFeatures.map((f, i) => <li key={i}>{f}</li>)}</ul>
                        </div>
                         <div>
                            <p className="text-sm font-semibold">Suggested Tools:</p>
                            <p className="text-sm">{generatedProject.suggestedTechStack.join(', ')}</p>
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Showcase Challenge:</p>
                            <p className="text-sm">{generatedProject.showcaseChallenge}</p>
                        </div>
                        <button onClick={() => openTool('website-builder', JSON.stringify(generatedProject))} className="mt-2 text-sm bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700">
                           Add to My Portfolio &rarr;
                        </button>
                     </div>
                 )}
            </div>
        )}

        {/* Roadmap Timeline */}
        <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">Your Personal Roadmap</h3>
            <div className="relative border-l-2 border-blue-200 ml-4 py-4">
            {roadmap.map((phase, index) => (
                <div key={index} className="mb-10 ml-8 relative">
                    <span className="absolute -left-[35px] flex items-center justify-center w-6 h-6 bg-blue-600 rounded-full ring-4 ring-white">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4zM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10zM5 13h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2z" /></svg>
                    </span>
                    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">{phase.phaseTitle}</h4>
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{phase.estimatedDuration}</span>
                        </div>
                        <p className="text-sm italic text-gray-600 mb-4">{phase.goal}</p>
                        
                        <div className="space-y-4">
                           <h6 className="font-semibold text-gray-700">Actionable Steps:</h6>
                            {phase.actionableSteps.map((step, stepIndex) => (
                                <div key={stepIndex} className="text-sm p-3 bg-gray-50 rounded-md border">
                                    <div className="flex items-center gap-2 font-semibold text-gray-800">
                                        {actionIcons[step.type]}
                                        <span className="capitalize">{step.type}</span>
                                    </div>
                                    <p className="mt-1 pl-7">{step.description}</p>
                                    {step.resources && step.resources.length > 0 && (
                                        <p className="text-xs mt-2 pl-7 text-gray-500"><strong>Resources:</strong> {step.resources.join(', ')}</p>
                                    )}
                                </div>
                            ))}

                            <h6 className="font-semibold text-gray-700 pt-2">Milestones:</h6>
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

  return result ? renderResult() : renderInput();
};

export default CareerPathPlanner;
