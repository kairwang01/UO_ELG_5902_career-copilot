import React from 'react';
import { careerPathPlan } from '../mock/careerPath';
import { ToolPanelChrome } from './ToolPanelChrome';
import { ScoreBar } from './ScoreBar';

interface CareerPathPreviewProps {
  t: (key: string) => string;
  compact?: boolean;
}

export const CareerPathPreview: React.FC<CareerPathPreviewProps> = ({ t, compact }) => {
  const plan = careerPathPlan;
  const roles = [plan.currentRole, plan.bridgeRole, plan.targetRole];

  return (
    <ToolPanelChrome
      title={t('beta_tool_career_path')}
      subtitle={`${plan.currentRole} → ${plan.targetRole}`}
    >
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {roles.map((role, i) => (
          <React.Fragment key={role}>
            <div
              className={`shrink-0 px-3 py-2 rounded-[var(--beta-radius)] border text-xs font-medium ${
                i === 1
                  ? 'border-[var(--beta-action)] bg-[var(--beta-surface-muted)] text-[var(--beta-action)]'
                  : 'border-[var(--beta-border)] text-[var(--beta-text)]'
              }`}
            >
              {role}
            </div>
            {i < roles.length - 1 && (
              <span className="text-[var(--beta-text-muted)] text-xs shrink-0">→</span>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        {plan.skillGaps.map((g) => (
          <ScoreBar
            key={g.skill}
            label={g.skill}
            value={g.priority === 'high' ? 35 : 60}
            tone={g.priority === 'high' ? 'gap' : 'neutral'}
          />
        ))}
      </div>

      {!compact && (
        <div className="border-t border-[var(--beta-border)] pt-4">
          <p className="text-xs font-medium text-[var(--beta-text-muted)] mb-3">
            {t('beta_career_four_week_plan')}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {plan.fourWeekPlan.map((w) => (
              <div
                key={w.week}
                className="border border-[var(--beta-border)] rounded-[var(--beta-radius)] p-3 bg-[var(--beta-surface-muted)]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-[var(--beta-action)] text-white text-xs flex items-center justify-center font-medium">
                    {w.week}
                  </span>
                  <span className="text-sm font-medium">{w.focus}</span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-[var(--beta-text-muted)]">
                  {w.tasks.map((task) => (
                    <li key={task}>· {task}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </ToolPanelChrome>
  );
};
