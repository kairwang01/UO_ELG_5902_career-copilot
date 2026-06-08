import React from 'react';
import { candidateMatches } from '../mock/candidateMatch';
import { BetaCard } from './BetaCard';

export const CandidateMatchPreview: React.FC = () => (
  <div className="space-y-4">
    {candidateMatches.map((c) => (
      <BetaCard key={c.id}>
        <div className="flex flex-wrap justify-between gap-2 mb-3">
          <div>
            <h4 className="font-semibold">{c.name}</h4>
            <p className="text-sm text-[var(--beta-text-muted)]">{c.location} · {c.availability}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">{c.roleFit}%</p>
            <p className="text-xs text-[var(--beta-text-muted)]">role fit</p>
          </div>
        </div>
        <p className="text-sm text-[var(--beta-text-muted)] mb-3">{c.resumeEvidence}</p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <p className="text-xs text-[var(--beta-ready)] mb-1">Matched</p>
            <p>{c.skillsMatched.join(', ')}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--beta-gap)] mb-1">Missing</p>
            <p>{c.missingSkills.join(', ')}</p>
          </div>
        </div>
        <ul className="text-sm space-y-1 mb-4">
          {c.matchReasons.map((reason) => (
            <li key={reason} className="text-[var(--beta-text-muted)]">· {reason}</li>
          ))}
        </ul>
        <span
          className={`text-xs font-medium px-2 py-1 rounded ${
            c.recommendedAction === 'shortlist'
              ? 'bg-[var(--beta-ready-bg)] text-[var(--beta-ready)]'
              : 'bg-[var(--beta-gap-bg)] text-[var(--beta-gap)]'
          }`}
        >
          {c.recommendedAction === 'shortlist' ? 'Recommended: Shortlist' : 'Recommended: Review'}
        </span>
      </BetaCard>
    ))}
  </div>
);
