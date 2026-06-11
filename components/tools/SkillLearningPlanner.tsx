import React, { useState, useMemo } from 'react';
import { GraduationCap } from 'lucide-react';
import { generateLearningPlan } from '../../services/aiClient';
import type { LearningPlanResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { DownloadButtons } from './ToolUtils';
import { deriveSmartSuggestions, SmartSuggestChips } from '../SmartSuggest';

interface SkillLearningPlannerProps {
  resumeText: string;
  market: string;
  t: (key: string) => string;
}

const SAMPLE_SKILL = 'Python for Data Analysis';

const SkillLearningPlanner: React.FC<SkillLearningPlannerProps> = ({ resumeText, market, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LearningPlanResult | null>(null);
  const [skill, setSkill] = useState('');

  // SmartSuggest: derive skill chips from resume (pure, no AI)
  const suggestions = useMemo(() => deriveSmartSuggestions(resumeText), [resumeText]);

  const runTool = async () => {
    if (!skill.trim()) {
      setError(t('tool_skill_planner_error_required'));
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

  const formatForDownload = (res: LearningPlanResult): string => {
    let content = `# Learning Plan: ${res.skill}\n\n`;
    content += `## Summary\n${res.summary}\n\n`;
    content += `## Learning Phases\n`;
    res.learningPhases.forEach((phase, i) => {
      content += `### Phase ${i + 1}: ${phase.phaseTitle} (${phase.duration})\n`;
      content += `**Key Activities:**\n`;
      phase.keyActivities.forEach(act => { content += `* ${act}\n`; });
      content += `\n**Milestone:** ${phase.milestone}\n\n`;
    });
    content += `## Suggested Projects\n`;
    res.suggestedProjects.forEach(p => { content += `* ${p}\n`; });
    return content;
  };

  const renderInput = () => (
    <div className="space-y-4">
      {/* (a) INTRO CARD */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
        <p className="font-medium text-slate-700 dark:text-slate-300">{t('tool_skill_planner_intro_line1')}</p>
        <p className="mt-0.5">{t('tool_skill_planner_intro_line2')}</p>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">{t('tool_skill_planner_setup_desc')}</p>

      {/* (b) SAMPLE-FILL */}
      <button
        type="button"
        onClick={() => setSkill(SAMPLE_SKILL)}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {t('try_example')}
      </button>

      <div>
        <label htmlFor="skill-to-learn" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_skill_planner_skill_label')}</label>

        {/* SmartSuggestChips for skill */}
        {resumeText && (
          <div className="mt-1 mb-2">
            <SmartSuggestChips
              items={suggestions.skills}
              onPick={(v) => setSkill(v)}
              label={t('smart_suggest_skills')}
            />
          </div>
        )}

        <input
          type="text"
          id="skill-to-learn"
          value={skill}
          onChange={e => setSkill(e.target.value)}
          required
          className="mt-1 block w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 p-2.5"
          placeholder={t('tool_skill_planner_skill_placeholder')}
        />
      </div>

      {/* (e) ERROR RETRY */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-4 flex items-start gap-3 animate-panel-expand">
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button
            type="button"
            onClick={runTool}
            className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            {t('try_again')}
          </button>
        </div>
      )}

      <button
        onClick={runTool}
        disabled={loading}
        className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg"
      >
        {loading ? t('tool_skill_planner_generating_button') : t('tool_skill_planner_generate_button')}
      </button>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;
    return (
      <div className="space-y-6 animate-fade-in">
        {/* (d) RESULT ACTIONS */}
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold dark:text-gray-100">{t('tool_skill_planner_results_title').replace('{skill}', result.skill)}</h4>
          <div className="flex items-center gap-2">
            <DownloadButtons textContent={formatForDownload(result)} baseFilename={`learning_plan_${result.skill.replace(/\s/g, '_')}`} />
            <button
              type="button"
              onClick={() => { setResult(null); setError(null); }}
              className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              {t('tool_start_over')}
            </button>
          </div>
        </div>

        <p className="text-gray-700 dark:text-gray-300 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg">{result.summary}</p>
        <div className="space-y-4">
            {result.learningPhases.map((phase, i) => (
                <div key={i} className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-center">
                        <h5 className="font-bold text-gray-800 dark:text-gray-100">{phase.phaseTitle}</h5>
                        <span className="text-xs font-semibold bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">{phase.duration}</span>
                    </div>
                    <div className="mt-3">
                        <p className="text-sm font-semibold mb-2 dark:text-gray-200">{t('tool_skill_planner_key_activities')}</p>
                        <ul className="list-disc list-inside text-sm space-y-1 dark:text-gray-300">{phase.keyActivities.map((act, idx) => <li key={idx}>{act}</li>)}</ul>
                    </div>
                     <div className="mt-3 pt-3 border-t dark:border-slate-700">
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">{t('tool_skill_planner_milestone')}: <span className="font-normal text-gray-800 dark:text-gray-300">{phase.milestone}</span></p>
                    </div>
                </div>
            ))}
        </div>
        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_skill_planner_suggested_projects')}</h5>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm dark:text-gray-300">{result.suggestedProjects.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
        <button
          onClick={() => { setResult(null); setError(null); }}
          className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 dark:border-slate-600 dark:text-gray-300"
        >
          &larr; {t('tool_skill_planner_plan_another')}
        </button>
      </div>
    );
  };

  if (loading) return <StagedLoader title={t('tool_skill_planner_loader_title')} icon={<GraduationCap />} accent="violet" steps={[t('tool_skill_planner_step1'), t('tool_skill_planner_step2'), t('tool_skill_planner_step3')]} onCancel={cancel} />;

  return result ? renderResult() : renderInput();
};

export default SkillLearningPlanner;
