import React, { useState } from 'react';
import { sampleReport } from '../mock/sampleReport';
import { ToolPanelChrome } from './ToolPanelChrome';
import { ScoreBar } from './ScoreBar';

type Tab = 'overview' | 'keywords' | 'gaps';

const severityStyles = {
  ready: 'bg-[var(--beta-ready-bg)] text-[var(--beta-ready)] border-[var(--beta-ready)]/20',
  gap: 'bg-[var(--beta-gap-bg)] text-[var(--beta-gap)] border-[var(--beta-gap)]/20',
  risk: 'bg-[var(--beta-risk-bg)] text-[var(--beta-risk)] border-[var(--beta-risk)]/20',
};

interface ReportPreviewProps {
  t: (key: string) => string;
  compact?: boolean;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({ t, compact }) => {
  const r = sampleReport;
  const [tab, setTab] = useState<Tab>('overview');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t('beta_report_tab_overview') },
    { id: 'keywords', label: t('beta_report_tab_keywords') },
    { id: 'gaps', label: t('beta_report_tab_gaps') },
  ];

  return (
    <ToolPanelChrome
      title={t('beta_tool_resume_report')}
      subtitle={`${r.candidateName} · ${r.targetRole}`}
      className={compact ? 'text-sm' : ''}
    >
      <div className="flex gap-1 mb-5 border-b border-[var(--beta-border)] -mx-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-[var(--beta-action)] text-[var(--beta-action)]'
                : 'border-transparent text-[var(--beta-text-muted)] hover:text-[var(--beta-text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <ScoreBar label={t('beta_report_ats_ready')} value={r.atsReadiness} tone="ready" />
            <ScoreBar label={t('beta_report_role_fit')} value={r.roleFit} tone="gap" />
          </div>
          {!compact && (
            <div className="rounded-[var(--beta-radius)] border border-[var(--beta-border)] bg-[var(--beta-surface-muted)] p-3 mb-4">
              <p className="text-xs font-medium text-[var(--beta-action)] mb-1">
                {t('beta_report_next_action')}
              </p>
              <p className="text-sm">{r.nextAction}</p>
            </div>
          )}
          <div className="text-xs text-[var(--beta-text-muted)]">
            <span className="font-medium text-[var(--beta-text)]">{t('beta_report_bridge_roles')}: </span>
            {r.bridgeRoles.join(' → ')}
          </div>
        </>
      )}

      {tab === 'keywords' && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-[var(--beta-gap)] mb-2">{t('beta_report_missing_keywords')}</p>
            <div className="flex flex-wrap gap-1.5">
              {r.missingKeywords.map((k) => (
                <span
                  key={k}
                  className="text-xs px-2 py-1 rounded border bg-[var(--beta-gap-bg)] text-[var(--beta-gap)] border-[var(--beta-gap)]/20"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--beta-ready)] mb-2">{t('beta_report_matched_keywords')}</p>
            <div className="flex flex-wrap gap-1.5">
              {r.matchedKeywords.map((k) => (
                <span
                  key={k}
                  className="text-xs px-2 py-1 rounded border bg-[var(--beta-ready-bg)] text-[var(--beta-ready)] border-[var(--beta-ready)]/20"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'gaps' && (
        <div className="space-y-2">
          {r.gaps.slice(0, compact ? 2 : 4).map((g) => (
            <div
              key={g.id}
              className="flex gap-3 items-start p-3 rounded-[var(--beta-radius)] border border-[var(--beta-border)] bg-[var(--beta-surface-muted)]"
            >
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border shrink-0 font-medium ${severityStyles[g.severity]}`}
              >
                {g.severity}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-sm">{g.label}</p>
                {!compact && (
                  <p className="text-sm text-[var(--beta-text-muted)] mt-0.5">{g.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolPanelChrome>
  );
};
