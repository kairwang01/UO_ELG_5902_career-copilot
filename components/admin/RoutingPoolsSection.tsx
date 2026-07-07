import React, { useEffect, useMemo, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import type { ModelEntry, ModuleRoutes, RoutingPool } from '../../services/adminClient';
import { Card, EmptyState, FieldLabel, SaveButton, SectionHeading, tableCell, tableHead, tableRow, textInput } from './adminUi';
import ConfirmActionDialog from '../ConfirmActionDialog';

const ANY_KEY_VALUE = '__any_configured_key__';

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

const nextPoolIndex = (pools: RoutingPool[]) => {
  const ids = new Set(pools.map((pool) => pool.id));
  let index = pools.length + 1;
  while (ids.has(`pool_${index}`)) index += 1;
  return index;
};

const POOL_CARD_TONES = [
  'border-sky-200 bg-sky-50/70 shadow-sky-100/70',
  'border-orange-200 bg-orange-50/70 shadow-orange-100/70',
  'border-emerald-200 bg-emerald-50/70 shadow-emerald-100/70',
  'border-violet-200 bg-violet-50/70 shadow-violet-100/70',
  'border-rose-200 bg-rose-50/70 shadow-rose-100/70',
  'border-cyan-200 bg-cyan-50/70 shadow-cyan-100/70',
];

type AdminSelectOption = {
  value: string;
  label: string;
};

const AdminSelect: React.FC<{
  value?: string;
  options: AdminSelectOption[];
  disabled?: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}> = ({ value, options, disabled, placeholder, onChange }) => {
  const selectedValue = options.some((option) => option.value === value) ? value : undefined;

  return (
    <Select.Root value={selectedValue} disabled={disabled || options.length === 0} onValueChange={onChange}>
      <Select.Trigger
        className={`${textInput} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
      >
        <Select.Value placeholder={options.length === 0 ? 'No options available' : placeholder} />
        <Select.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
        >
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm text-gray-700 outline-none data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-800"
              >
                <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <Check className="h-4 w-4" />
                </Select.ItemIndicator>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};

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
  const [poolDeleteIndex, setPoolDeleteIndex] = useState<number | null>(null);

  useEffect(() => {
    setPools(clonePools(routingPools));
    setRoutes({ ...moduleRoutes });
  }, [routingPools, moduleRoutes]);

  // Poolable models exclude the "custom" BYOA sentinel: it has no platform
  // key/URL (per-user config only) and the server rejects it as a pool member.
  const enabledModels = useMemo(() => models.filter((model) => model.enabled && model.id !== 'custom'), [models]);
  const modelOptions = useMemo(
    () => enabledModels.map((model) => ({ value: model.id, label: `${model.label} (${model.id})` })),
    [enabledModels],
  );
  const poolOptions = pools.filter((pool) => pool.id.trim());
  const routePoolOptions = poolOptions.map((pool) => ({ value: pool.id, label: `${pool.label} (${pool.id})` }));
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

  const removePool = async (poolIndex: number) => {
    const removedPool = pools[poolIndex];
    if (!removedPool) return;

    const nextPools = pools.filter((_, i) => i !== poolIndex);
    const nextPoolIds = new Set(nextPools.map((pool) => pool.id).filter(Boolean));
    const fallbackPoolId = nextPools.find((pool) => pool.id.trim())?.id;
    const nextRoutes = nextPoolIds.has(removedPool.id)
      ? routes
      : Object.fromEntries(
        Object.entries(routes).flatMap(([routeKey, poolId]) => {
          if (poolId !== removedPool.id) return [[routeKey, poolId]];
          return fallbackPoolId ? [[routeKey, fallbackPoolId]] : [];
        }),
      );

    setPools(nextPools);
    setRoutes(nextRoutes);
    setSaving(true);
    setFeedback(null);
    try {
      await onSave(nextPools, nextRoutes);
      setPoolDeleteIndex(null);
      setFeedback({ ok: 'Routing pool deleted.' });
    } catch (err) {
      setPools(pools);
      setRoutes(routes);
      setFeedback({ err: err instanceof Error ? err.message : 'Failed to delete routing pool.' });
    } finally {
      setSaving(false);
    }
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

  const addPool = async () => {
    const nextPools = [...pools, emptyPool(nextPoolIndex(pools))];
    setPools(nextPools);
    setSaving(true);
    setFeedback(null);
    try {
      await onSave(nextPools, routes);
      setFeedback({ ok: 'Routing pool added.' });
    } catch (err) {
      setPools(pools);
      setFeedback({ err: err instanceof Error ? err.message : 'Failed to add routing pool.' });
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
            <div
              key={`${pool.id}-${poolIndex}`}
              className={`overflow-hidden rounded-xl border shadow-sm ${POOL_CARD_TONES[poolIndex % POOL_CARD_TONES.length]}`}
            >
              <div className="grid gap-3 border-b border-white/70 bg-white/45 p-4 sm:grid-cols-[1fr_1fr_auto_auto]">
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
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setPoolDeleteIndex(poolIndex)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 self-end rounded-lg border border-red-200 bg-white/80 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    aria-label={`Delete routing pool ${pool.label || pool.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </div>

              <div className="overflow-x-auto bg-white/60">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/70">
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
                      const savedKeyOptions = [
                        { value: ANY_KEY_VALUE, label: 'Any configured key' },
                        ...keyOptions.map((key) => ({ value: key.hash, label: `${key.masked} (${key.hash})` })),
                      ];
                      return (
                        <tr key={`${member.modelId}-${member.keyHash ?? 'any'}-${memberIndex}`} className={tableRow}>
                          <td className={tableCell}>
                            <AdminSelect
                              value={member.modelId}
                              disabled={!canManage}
                              options={modelOptions}
                              placeholder="Select model"
                              onChange={(value) => updateMember(poolIndex, memberIndex, { modelId: value, keyHash: undefined })}
                            />
                          </td>
                          <td className={tableCell}>
                            <AdminSelect
                              value={member.keyHash ?? ANY_KEY_VALUE}
                              disabled={!canManage}
                              options={savedKeyOptions}
                              placeholder="Select key"
                              onChange={(value) => updateMember(poolIndex, memberIndex, { keyHash: value === ANY_KEY_VALUE ? undefined : value })}
                            />
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
                <div className="border-t border-white/70 bg-white/45 px-4 py-3">
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
            onClick={addPool}
            disabled={saving}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add pool'}
          </button>
        )}
      </div>

      <div className="border-t border-gray-200 px-5 py-4">
        <SectionHeading>Module routes</SectionHeading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {routeRows.map((route) => (
            <label key={route.key} className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{route.label}</span>
              <AdminSelect
                value={routes[route.key]}
                disabled={!canManage}
                options={routePoolOptions}
                placeholder="Select pool"
                onChange={(value) => {
                  setRoutes((prev) => ({ ...prev, [route.key]: value }));
                  setFeedback(null);
                }}
              />
            </label>
          ))}
        </div>
        {feedback?.ok && <p className="mt-3 text-xs text-emerald-700">{feedback.ok}</p>}
        {feedback?.err && <p className="mt-3 text-xs text-red-600">{feedback.err}</p>}
      </div>
      <ConfirmActionDialog
        open={poolDeleteIndex !== null}
        title="Delete routing pool"
        description="Delete this routing pool? Module routes that use it will be moved to the next available pool."
        detail={poolDeleteIndex !== null ? (pools[poolDeleteIndex]?.label || pools[poolDeleteIndex]?.id) : undefined}
        cancelLabel="Cancel"
        confirmLabel="Delete pool"
        loadingLabel="Deleting..."
        loading={saving}
        tone="danger"
        onOpenChange={(open) => {
          if (!open) setPoolDeleteIndex(null);
        }}
        onCancel={() => setPoolDeleteIndex(null)}
        onConfirm={() => {
          if (poolDeleteIndex !== null) removePool(poolDeleteIndex);
        }}
      />
    </Card>
  );
};
