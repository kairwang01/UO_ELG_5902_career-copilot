import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { generateLearningPlan } from '../../services/aiClient';
import type { LearningPlanResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';

interface SkillLearningPlannerProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
}

const SkillLearningPlanner: React.FC<SkillLearningPlannerProps> = ({ resumeText, market, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LearningPlanResult | null>(null);
  const [skill, setSkill] = useState('');

  const runTool = async () => {
    if (!skill.trim()) {
      setError('Please enter a skill you want to learn.');
      return;
    }
    const alive = begin();
    setError(null);
    try {
      const apiResult = await generateLearningPlan(resumeText, skill, market);
      if (!alive()) return;
      setResult(apiResult);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const renderInput = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">Chart a path to mastering a new skill. Enter a skill, and the AI will generate a structured learning plan based on your professional background.</p>
      <div>
        <label htmlFor="skill-to-learn" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Skill to Learn</label>
        <input type="text" id="skill-to-learn" value={skill} onChange={e => setSkill(e.target.value)} required className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100" placeholder="e.g., Python for Data Analysis, Public Speaking" />
      </div>
      <button onClick={runTool} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {loading ? 'Generating Plan...' : 'Generate Learning Plan'}
      </button>
    </div>
  );

  const renderResult = () => {
    if (loading) return <StagedLoader title="Designing your learning plan" icon={<GraduationCap />} accent="violet" steps={["Reviewing your resume…","Mapping the skill path…","Curating projects & milestones…"]} onCancel={cancel} />;
    if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;
    if (!result) return null;
    return (
      <div className="space-y-6">
        <h4 className="text-lg font-bold dark:text-gray-100">Your Learning Plan for: {result.skill}</h4>
        <p className="text-gray-700 dark:text-gray-300 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg">{result.summary}</p>
        <div className="space-y-4">
            {result.learningPhases.map((phase, i) => (
                <div key={i} className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-center">
                        <h5 className="font-bold text-gray-800 dark:text-gray-100">{phase.phaseTitle}</h5>
                        <span className="text-xs font-semibold bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">{phase.duration}</span>
                    </div>
                    <div className="mt-3">
                        <p className="text-sm font-semibold mb-2 dark:text-gray-200">Key Activities:</p>
                        <ul className="list-disc list-inside text-sm space-y-1 dark:text-gray-300">{phase.keyActivities.map((act, idx) => <li key={idx}>{act}</li>)}</ul>
                    </div>
                     <div className="mt-3 pt-3 border-t dark:border-slate-700">
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">Milestone: <span className="font-normal text-gray-800 dark:text-gray-300">{phase.milestone}</span></p>
                    </div>
                </div>
            ))}
        </div>
        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <h5 className="font-bold text-gray-800 dark:text-gray-100">Suggested Projects</h5>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm dark:text-gray-300">{result.suggestedProjects.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
        <button onClick={() => setResult(null)} className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 dark:border-slate-600 dark:text-gray-300">&larr; Plan Another Skill</button>
      </div>
    );
  };

  return result ? renderResult() : renderInput();
};

export default SkillLearningPlanner;
