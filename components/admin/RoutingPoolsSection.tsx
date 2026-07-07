import React, { useEffect, useMemo, useState } from 'react';
import type { ModelEntry, ModuleRoutes, RoutingPool } from '../../services/adminClient';
import { Card, EmptyState, FieldLabel, SaveButton, SectionHeading, tableCell, tableHead, tableRow, textInput } from './adminUi';

const MODULE_ROUTE_OPTIONS = [
  { key: 'mockInterview', label: 'Mock interview' },
  { key: 'analyzeResume', label: 'Resume analysis' },
  { key: 'generateCoverLetter', label: 'Cover letter' },
  { key: 'generateCareerPath', label: 'Career path' },
  { key: 'applyResumeImprovements', label: 'Resume deep optimization' },
  { key: 'convertResumeFormat', label: 'Resume formatter' },
];

const clonePools = (pools: RoutingPool[]) => pools.map((pool) => ({
  ...pool,
  members: pool.members.map((member) => ({ ...member })),
}));

const emptyPool = (index: number): RoutingPool => ({
  id: `pool_${index}`,
  label: `Pool ${index}`,
  enabled: true,
  members: [],
});

export const RoutingPoolsSection: React.FC<{
  models: ModelEntry[];
  routingPools: RoutingPool[];
  moduleRoutes: ModuleRoutes;
  canManage: boolean;
  onSave: (routingPools: RoutingPool[], moduleRoutes: ModuleRoutes) => Promise<void>;
}> = ({ models, routingPools, moduleRoutes, canManage, onSave }) => {
  const [pools, setPools] = useState<RoutingPool[]>(() => clonePools(routingPools));
  const [routes, setRoutes] = useState<ModuleRoutes>(() => ({ ...moduleRoutes }));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok?: string; err?: string } | null>(null);

  useEffect(() => {
    setPools(clonePools(routingPools));
    setRoutes({ ...moduleRoutes });
  }, [routingPools, moduleRoutes]);

  const enabledModels = useMemo(() => models.filter((model) => model.enabled), [models]);
  const poolOptions = pools.filter((pool) => pool.id.trim());
  const routeRows = useMemo(() => {
    const known = new Set(MODULE_ROUTE_OPTIONS.map((route) => route.key));
    const custom = Object.keys(routes)
      .filter((key) => !known.has(key))
      .map((key) => ({ key, label: key }));
    return [...MODULE_ROUTE_OPTIONS, ...custom];
  }, [routes]);

  const updatePool = (index: number, patch: Partial<RoutingPool>) => {
    setPools((prev) => prev.map((pool, i) => (i === index ? { ...pool, ...patch } : pool)));
    setFeedback(null);
  };

  const updateMember = (poolIndex: number, memberIndex: number, patch: Partial<RoutingPool['members'][number]>) => {
    setPools((prev) => prev.map((pool, i) => {
      if (i !== poolIndex) return pool;
      return {
        ...pool,
        members: pool.members.map((member, j) => (j === memberIndex ? { ...member, ...patch } : member)),
      };
    }));
    setFeedback(null);
  };

  const addMember = (poolIndex: number) => {
    const firstModel = enabledModels[0];
    if (!firstModel) return;
    setPools((prev) => prev.map((pool, i) => (
      i === poolIndex
        ? { ...pool, members: [...pool.members, { modelId: firstModel.id, tier: 1, weight: 100, enabled: true }] }
        : pool
    )));
    setFeedback(null);
  };

  const removeMember = (poolIndex: number, memberIndex: number) => {
    setPools((prev) => prev.map((pool, i) => (
      i === poolIndex ? { ...pool, members: pool.members.filter((_, j) => j !== memberIndex) } : pool
    )));
    setFeedback(null);
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await onSave(pools, routes);
      setFeedback({ ok: 'Routing pools saved.' });
    } catch (err) {
      setFeedback({ err: err instanceof Error ? err.message : 'Failed to save routing pools.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionHeading>Routing pools</SectionHeading>
          <p className="mt-1 text-xs text-gray-500">
            Modules choose a pool; lower tiers run first, and weights split traffic inside the same tier.
          </p>
        </div>
        {canManage && <SaveButton onClick={save} loading={saving} label="Save routing" />}
      </div>

      <div className="space-y-5 p-5">
        {pools.length === 0 ? (
          <EmptyState message="No routing pools configured." />
        ) : (
          pools.map((pool, poolIndex) => (
            <div key={`${pool.id}-${poolIndex}`} className="rounded-lg border border-gray-200">
              <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <FieldLabel htmlFor={`pool-id-${poolIndex}`}>Pool id</FieldLabel>
                  <input
                    id={`pool-id-${poolIndex}`}
                    value={pool.id}
                    disabled={!canManage}
                    onChange={(e) => updatePool(poolIndex, { id: e.target.value })}
                    className={textInput}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`pool-label-${poolIndex}`}>Display name</FieldLabel>
                  <input
                    id={`pool-label-${poolIndex}`}
                    value={pool.label}
                    disabled={!canManage}
                    onChange={(e) => updatePool(poolIndex, { label: e.target.value })}
                    className={textInput}
                  />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={pool.enabled}
                    disabled={!canManage}
                    onChange={(e) => updatePool(poolIndex, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className={tableHead}>Model</th>
                      <th className={tableHead}>Saved key</th>
                      <th className={tableHead}>Tier</th>
                      <th className={tableHead}>Weight</th>
                      <th className={tableHead}>State</th>
                      <th className={tableHead}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.members.map((member, memberIndex) => {
                      const model = models.find((m) => m.id === member.modelId);
                      const keyOptions = model?.key_previews ?? [];
                      return (
                        <tr key={`${member.modelId}-${member.keyHash ?? 'any'}-${memberIndex}`} className={tableRow}>
                          <td className={tableCell}>
                            <select
                              value={member.modelId}
                              disabled={!canManage}
                              onChange={(e) => updateMember(poolIndex, memberIndex, { modelId: e.target.value, keyHash: undefined })}
                              className={textInput}
                            >
                              {enabledModels.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.id})</option>)}
                            </select>
                          </td>
                          <td className={tableCell}>
                            <select
                              value={member.keyHash ?? ''}
                              disabled={!canManage}
                              onChange={(e) => updateMember(poolIndex, memberIndex, { keyHash: e.target.value || undefined })}
                              className={textInput}
                            >
                              <option value="">Any configured key</option>
                              {keyOptions.map((key) => (
                                <option key={key.hash} value={key.hash}>
                                  {key.masked} ({key.hash})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={tableCell}>
                            <input
                              type="number"
                              min={1}
                              value={member.tier}
                              disabled={!canManage}
                              onChange={(e) => updateMember(poolIndex, memberIndex, { tier: Math.max(1, Number(e.target.value)) })}
                              className={`${textInput} w-24`}
                            />
                          </td>
                          <td className={tableCell}>
                            <input
                              type="number"
                              min={1}
                              value={member.weight}
                              disabled={!canManage}
                              onChange={(e) => updateMember(poolIndex, memberIndex, { weight: Math.max(1, Number(e.target.value)) })}
                              className={`${textInput} w-28`}
                            />
                          </td>
                          <td className={tableCell}>
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={member.enabled}
                                disabled={!canManage}
                                onChange={(e) => updateMember(poolIndex, memberIndex, { enabled: e.target.checked })}
                              />
                              Active
                            </label>
                          </td>
                          <td className={tableCell}>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => removeMember(poolIndex, memberIndex)}
                                className="text-xs font-medium text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {canManage && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => addMember(poolIndex)}
                    disabled={enabledModels.length === 0}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Add member
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {canManage && (
          <button
            type="button"
            onClick={() => setPools((prev) => [...prev, emptyPool(prev.length + 1)])}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Add pool
          </button>
        )}
      </div>

      <div className="border-t border-gray-200 px-5 py-4">
        <SectionHeading>Module routes</SectionHeading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {routeRows.map((route) => (
            <label key={route.key} className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{route.label}</span>
              <select
                value={routes[route.key] ?? ''}
                disabled={!canManage}
                onChange={(e) => {
                  setRoutes((prev) => ({ ...prev, [route.key]: e.target.value }));
                  setFeedback(null);
                }}
                className={textInput}
              >
                {poolOptions.map((pool) => <option key={pool.id} value={pool.id}>{pool.label} ({pool.id})</option>)}
              </select>
            </label>
          ))}
        </div>
        {feedback?.ok && <p className="mt-3 text-xs text-emerald-700">{feedback.ok}</p>}
        {feedback?.err && <p className="mt-3 text-xs text-red-600">{feedback.err}</p>}
      </div>
    </Card>
  );
};
