import React from 'react';

interface ScoreBarProps {
  label: string;
  value: number;
  tone?: 'ready' | 'gap' | 'neutral';
}

const toneColor = {
  ready: 'bg-[var(--beta-ready)]',
  gap: 'bg-[var(--beta-gap)]',
  neutral: 'bg-[var(--beta-action)]',
};

export const ScoreBar: React.FC<ScoreBarProps> = ({ label, value, tone = 'neutral' }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-[var(--beta-text-muted)]">{label}</span>
      <span className="font-medium tabular-nums">{value}%</span>
    </div>
    <div className="h-2 rounded-full bg-[var(--beta-surface-muted)] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${toneColor[tone]}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  </div>
);
