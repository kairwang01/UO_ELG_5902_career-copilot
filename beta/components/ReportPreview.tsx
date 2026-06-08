import React from 'react';
import { sampleReport } from '../mock/sampleReport';
import { BetaCard } from './BetaCard';

const severityStyles = {
  ready: 'bg-[var(--beta-ready-bg)] text-[var(--beta-ready)]',
  gap: 'bg-[var(--beta-gap-bg)] text-[var(--beta-gap)]',
  risk: 'bg-[var(--beta-risk-bg)] text-[var(--beta-risk)]',
};

export const ReportPreview: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const r = sampleReport;
  return (
    <BetaCard className={compact ? 'text-sm' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--beta-text-muted)]">Resume Readiness Report</p>
          <h3 className="text-lg font-semibold mt-1">{r.candidateName}</h3>
          <p className="text-[var(--beta-text-muted)]">Target: {r.targetRole}</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold tabular-nums">{r.atsReadiness}</p>
            <p className="text-xs text-[var(--beta-text-muted)]">ATS ready</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold tabular-nums">{r.roleFit}</p>
            <p className="text-xs text-[var(--beta-text-muted)]">Role fit</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-xs font-medium text-[var(--beta-gap)] mb-2">Missing keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {r.missingKeywords.map((k) => (
              <span key={k} className="text-xs px-2 py-0.5 rounded bg-[var(--beta-gap-bg)] text-[var(--beta-gap)]">
                {k}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--beta-ready)] mb-2">Matched keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {r.matchedKeywords.map((k) => (
              <span key={k} className="text-xs px-2 py-0.5 rounded bg-[var(--beta-ready-bg)] text-[var(--beta-ready)]">
                {k}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {r.gaps.slice(0, compact ? 2 : 4).map((g) => (
          <div key={g.id} className="flex gap-3 items-start">
            <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${severityStyles[g.severity]}`}>
              {g.severity}
            </span>
            <div>
              <p className="font-medium text-sm">{g.label}</p>
              {!compact && <p className="text-sm text-[var(--beta-text-muted)] mt-0.5">{g.detail}</p>}
            </div>
          </div>
        ))}
      </div>

      {!compact && (
        <>
          <div className="border-t border-[var(--beta-border)] pt-4 mb-4">
            <p className="text-xs text-[var(--beta-text-muted)] mb-1">Bridge roles</p>
            <p className="text-sm">{r.bridgeRoles.join(' → ')}</p>
          </div>
          <div className="bg-[var(--beta-surface-muted)] rounded-[var(--beta-radius)] p-4">
            <p className="text-xs font-medium text-[var(--beta-action)] mb-1">Next action</p>
            <p className="text-sm">{r.nextAction}</p>
          </div>
        </>
      )}
    </BetaCard>
  );
};
