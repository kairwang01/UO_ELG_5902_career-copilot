import React from 'react';
import { candidateMatches } from '../mock/candidateMatch';
import { ScoreBar } from './ScoreBar';

interface CandidateMatchPreviewProps {
  t: (key: string) => string;
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

export const CandidateMatchPreview: React.FC<CandidateMatchPreviewProps> = ({ t }) => (
  <div className="rounded-[var(--beta-radius)] border border-[var(--beta-border)] bg-[var(--beta-surface)] overflow-hidden shadow-sm">
    <div className="px-4 py-3 border-b border-[var(--beta-border)] bg-[var(--beta-surface-muted)] flex justify-between items-center">
      <div>
        <p className="text-sm font-medium">{t('beta_talent_pool_title')}</p>
        <p className="text-xs text-[var(--beta-text-muted)]">{t('beta_talent_pool_subtitle')}</p>
      </div>
      <span className="text-xs px-2 py-1 rounded border border-[var(--beta-border)] bg-[var(--beta-surface)]">
        {candidateMatches.length} {t('beta_talent_pool_matches')}
      </span>
    </div>

    <div className="divide-y divide-[var(--beta-border)]">
      {candidateMatches.map((c) => (
        <div key={c.id} className="p-4 sm:p-5 hover:bg-[var(--beta-surface-muted)]/50 transition-colors">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-[var(--beta-surface-muted)] border border-[var(--beta-border)] flex items-center justify-center text-sm font-semibold text-[var(--beta-action)] shrink-0">
              {initials(c.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <div>
                  <h4 className="font-semibold">{c.name}</h4>
                  <p className="text-xs text-[var(--beta-text-muted)]">
                    {c.location} · {c.availability}
                  </p>
                </div>
                <div className="w-28">
                  <ScoreBar label={t('beta_match_role_fit')} value={c.roleFit} tone="ready" />
                </div>
              </div>

              <p className="text-sm text-[var(--beta-text-muted)] mb-3 border-l-2 border-[var(--beta-border)] pl-3">
                {c.resumeEvidence}
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div className="text-xs">
                  <p className="text-[var(--beta-ready)] font-medium mb-1">{t('beta_match_skills_matched')}</p>
                  <div className="flex flex-wrap gap-1">
                    {c.skillsMatched.map((s) => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 rounded bg-[var(--beta-ready-bg)] text-[var(--beta-ready)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-xs">
                  <p className="text-[var(--beta-gap)] font-medium mb-1">{t('beta_match_skills_missing')}</p>
                  <div className="flex flex-wrap gap-1">
                    {c.missingSkills.map((s) => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 rounded bg-[var(--beta-gap-bg)] text-[var(--beta-gap)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <ul className="text-xs space-y-1 mb-4 text-[var(--beta-text-muted)]">
                {c.matchReasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span className="text-[var(--beta-ready)]">✓</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`text-xs font-medium px-3 py-1.5 rounded-[var(--beta-radius)] ${
                    c.recommendedAction === 'shortlist'
                      ? 'bg-[var(--beta-action)] text-white'
                      : 'border border-[var(--beta-border)] text-[var(--beta-text)]'
                  }`}
                >
                  {c.recommendedAction === 'shortlist'
                    ? t('beta_match_action_shortlist')
                    : t('beta_match_action_review')}
                </button>
                <button
                  type="button"
                  className="text-xs font-medium px-3 py-1.5 rounded-[var(--beta-radius)] border border-[var(--beta-border)] text-[var(--beta-text-muted)]"
                >
                  {t('beta_match_action_message')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);
