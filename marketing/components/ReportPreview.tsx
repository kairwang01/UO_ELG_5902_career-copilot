import React, { useState } from 'react';
import { sampleReport } from '../mock/sampleReport';
import { ToolPanelChrome } from './ToolPanelChrome';
import { ScoreBar } from './ScoreBar';

type Tab = 'overview' | 'keywords' | 'issues';

const severityStyles = {
  ready: 'bg-[var(--site-ready-bg)] text-[var(--site-ready)] border-[var(--site-ready)]/20',
  gap: 'bg-[var(--site-gap-bg)] text-[var(--site-gap)] border-[var(--site-gap)]/20',
  risk: 'bg-[var(--site-risk-bg)] text-[var(--site-risk)] border-[var(--site-risk)]/20',
};

interface ReportPreviewProps {
  t: (key: string) => string;
  compact?: boolean;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({ t, compact }) => {
  const r = sampleReport;
  const [tab, setTab] = useState<Tab>('overview');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t('site_report_tab_overview') },
    { id: 'keywords', label: t('site_report_tab_keywords') },
    { id: 'issues', label: t('site_report_tab_issues') },
  ];

  return (
    <ToolPanelChrome
      title={t('site_tool_resume_report')}
      subtitle={`${r.candidateName} · ${r.targetRole}`}
      className={compact ? 'text-sm' : ''}
    >
      <div className="flex gap-1 mb-5 border-b border-[var(--site-border)] overflow-x-auto -mx-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
              tab === id
                ? 'border-[var(--site-action)] text-[var(--site-action)]'
                : 'border-transparent text-[var(--site-text-muted)] hover:text-[var(--site-text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <ScoreBar label={t('site_report_ats_ready')} value={r.atsReadiness} tone="ready" />
            <ScoreBar label={t('site_report_role_fit')} value={r.roleFit} tone="gap" />
          </div>
          {!compact && (
            <div className="rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface-muted)] p-3 mb-4">
              <p className="text-xs font-medium text-[var(--site-action)] mb-1">
                {t('site_report_next_action')}
              </p>
              <p className="text-sm">{r.nextAction}</p>
            </div>
          )}
          <div className="text-xs text-[var(--site-text-muted)]">
            <span className="font-medium text-[var(--site-text)]">{t('site_report_bridge_roles')}: </span>
            {r.bridgeRoles.join(' → ')}
          </div>
        </>
      )}

      {tab === 'keywords' && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-[var(--site-gap)] mb-2">{t('site_report_missing_keywords')}</p>
            <div className="flex flex-wrap gap-1.5">
              {r.missingKeywords.map((k) => (
                <span
                  key={k}
                  className="text-xs px-2 py-1 rounded border bg-[var(--site-gap-bg)] text-[var(--site-gap)] border-[var(--site-gap)]/20"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--site-ready)] mb-2">{t('site_report_matched_keywords')}</p>
            <div className="flex flex-wrap gap-1.5">
              {r.matchedKeywords.map((k) => (
                <span
                  key={k}
                  className="text-xs px-2 py-1 rounded border bg-[var(--site-ready-bg)] text-[var(--site-ready)] border-[var(--site-ready)]/20"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'issues' && (
        <div className="space-y-3">
          {!compact && (
            <div className="hidden sm:grid grid-cols-[1fr_1.2fr_1fr] gap-2 text-[10px] uppercase tracking-wide text-[var(--site-text-muted)] px-1">
              <span>{t('site_report_col_issue')}</span>
              <span>{t('site_report_col_why')}</span>
              <span>{t('site_report_col_fix')}</span>
            </div>
          )}
          {r.issues.slice(0, compact ? 2 : 4).map((item) => (
            <div
              key={item.id}
              className="rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface-muted)] p-3 sm:grid sm:grid-cols-[1fr_1.2fr_1fr] sm:gap-3 sm:items-start"
            >
              <div className="mb-2 sm:mb-0">
                <span
                  className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border font-medium ${severityStyles[item.severity]}`}
                >
                  {item.severity}
                </span>
                <p className="font-medium text-sm mt-2">{item.issue}</p>
              </div>
              <div className="mb-2 sm:mb-0">
                <p className="text-[10px] uppercase text-[var(--site-text-muted)] sm:hidden mb-1">
                  {t('site_report_col_why')}
                </p>
                <p className="text-sm text-[var(--site-text-muted)]">{item.whyItMatters}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--site-text-muted)] sm:hidden mb-1">
                  {t('site_report_col_fix')}
                </p>
                <p className="text-sm text-[var(--site-text)]">{item.fix}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolPanelChrome>
  );
};
