import React from 'react';
import { Card, SectionHeading, tableCell, tableHead, tableRow } from './adminUi';
import type { ModelEntry } from '../../services/adminClient';

/**
 * Key-pool health overview for the Models & Keys tab.
 *
 * Pure presentation over data the server already returns from adminListModels
 * (masked key pools + best-effort key_health aggregates). Raw keys never reach
 * this component — only masked previews and hashes-derived health counters.
 */
export const KeyPoolHealthSection: React.FC<{ models: ModelEntry[] }> = ({ models }) => {
  const enabled = models.filter((m) => m.enabled);
  if (enabled.length === 0) return null;

  const fmtTime = (iso: string | null | undefined) =>
    iso ? iso.slice(0, 16).replace('T', ' ') : '—';

  const poolSize = (m: ModelEntry) => {
    const pooled = m.api_keys?.length ?? 0;
    if (pooled > 0) return pooled;
    if (m.api_key || m.builtin || m.provider === 'gemini') return 1;
    return 0;
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <SectionHeading>Key pool health</SectionHeading>
        <p className="mt-1 text-xs text-gray-500">
          Live rotation state per model. Failed keys cool down for 10 minutes and are skipped
          automatically; on 401/403/429/timeouts the router rotates to the next key, then walks
          the fallback chain. Every switch is recorded in <code className="font-mono text-[11px]">key_health</code>.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-t border-gray-100">
          <thead>
            <tr className="bg-gray-50/80">
              <th className={tableHead}>Model</th>
              <th className={tableHead}>Keys</th>
              <th className={tableHead}>Status</th>
              <th className={tableHead}>Failures</th>
              <th className={tableHead}>Cooldown until</th>
              <th className={tableHead}>Last error</th>
              <th className={tableHead}>Fallback route</th>
            </tr>
          </thead>
          <tbody>
            {enabled.map((m) => {
              const h = m.keyHealth;
              const cooled = Boolean(h?.anyCooled);
              const hasData = h !== undefined && h !== null;
              return (
                <tr key={m.id} className={tableRow}>
                  <td className={tableCell}>
                    <span className="font-medium text-gray-900">{m.label}</span>
                    <span className="block font-mono text-[10px] text-gray-400">{m.id}</span>
                  </td>
                  <td className={tableCell}>{poolSize(m)}</td>
                  <td className={tableCell}>
                    {!hasData ? (
                      <span className="inline-block text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                        no data
                      </span>
                    ) : cooled ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                        cooling
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        healthy
                      </span>
                    )}
                  </td>
                  <td className={tableCell}>{h?.failureCount ?? '—'}</td>
                  <td className={`${tableCell} font-mono text-xs`}>{fmtTime(h?.cooldownUntil)}</td>
                  <td className={`${tableCell} font-mono text-xs`}>
                    {h?.lastErrorCode ?? '—'}
                    {h?.lastFailureAt && (
                      <span className="block text-[10px] text-gray-400">{fmtTime(h.lastFailureAt)}</span>
                    )}
                  </td>
                  <td className={`${tableCell} font-mono text-[11px]`}>
                    {m.fallbackChain && m.fallbackChain.length > 0
                      ? `${m.id} → ${m.fallbackChain.join(' → ')}`
                      : 'auto (priority order)'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
