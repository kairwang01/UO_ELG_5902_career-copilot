import { describe, expect, it } from 'vitest';
import {
  candidatesForPoolTier,
  routingPoolForRoute,
  routingPoolTiers,
  selectWeightedCandidate,
} from '../functions/src/llm/routingPools';
import { keyHash } from '../functions/src/llm/keyHash';
import { _testRoutingValidation } from '../functions/src/handlers/adminModels';
import { defaultRoutingPoolsForRegistry } from '../functions/src/admin/platformConfig';
import type { ModelEntry, RoutingPool } from '../functions/src/admin/schema';

const model = (id: string, minTier: ModelEntry['minTier'] = 'free'): ModelEntry => ({
  id,
  label: id,
  provider: 'openai-compatible',
  providerModel: 'auto',
  minTier,
  enabled: true,
});

describe('LLM routing pools', () => {
  it('selects weighted members inside the same tier', () => {
    const pool: RoutingPool = {
      id: 'speed',
      label: 'Speed',
      enabled: true,
      members: [
        { modelId: 'key-a', tier: 1, weight: 80, enabled: true },
        { modelId: 'key-b', tier: 1, weight: 20, enabled: true },
      ],
    };
    const candidates = candidatesForPoolTier(
      pool,
      [model('key-a'), model('key-b')],
      new Set(['key-a', 'key-b']),
      1,
    );

    expect(selectWeightedCandidate(candidates, () => 0.79)?.member.modelId).toBe('key-a');
    expect(selectWeightedCandidate(candidates, () => 0.8)?.member.modelId).toBe('key-b');
  });

  it('orders tiers ascending for fallback', () => {
    const pool: RoutingPool = {
      id: 'quality',
      label: 'Quality',
      enabled: true,
      members: [
        { modelId: 'backup', tier: 2, weight: 100, enabled: true },
        { modelId: 'primary', tier: 1, weight: 100, enabled: true },
      ],
    };

    expect(routingPoolTiers(pool)).toEqual([1, 2]);
  });

  it('filters out models the user tier cannot access', () => {
    const pool: RoutingPool = {
      id: 'quality',
      label: 'Quality',
      enabled: true,
      members: [
        { modelId: 'free-model', tier: 1, weight: 50, enabled: true },
        { modelId: 'paid-model', tier: 1, weight: 50, enabled: true },
      ],
    };

    const candidates = candidatesForPoolTier(
      pool,
      [model('free-model'), model('paid-model', 'paid')],
      new Set(['free-model']),
      1,
    );

    expect(candidates.map((candidate) => candidate.member.modelId)).toEqual(['free-model']);
  });

  it('returns no pool for unconfigured route keys', () => {
    const pools: RoutingPool[] = [{ id: 'speed', label: 'Speed', enabled: true, members: [] }];

    expect(routingPoolForRoute('missingTool', { mockInterview: 'speed' }, pools)).toBeNull();
  });

  it('rejects routing members that reference unknown models or keys', () => {
    const registry: ModelEntry[] = [{ ...model('deep'), api_keys: ['sk-live-a'] }];
    const validHash = keyHash('sk-live-a');

    expect(() => _testRoutingValidation.validateRoutingPools([
      { id: 'quality', label: 'Quality', enabled: true, members: [{ modelId: 'missing', tier: 1, weight: 1, enabled: true }] },
    ], registry)).toThrow(/unknown model/);

    expect(() => _testRoutingValidation.validateRoutingPools([
      { id: 'quality', label: 'Quality', enabled: true, members: [{ modelId: 'deep', keyHash: 'bad-hash', tier: 1, weight: 1, enabled: true }] },
    ], registry)).toThrow(/unknown saved key/);

    expect(_testRoutingValidation.validateRoutingPools([
      { id: 'quality', label: 'Quality', enabled: true, members: [{ modelId: 'deep', keyHash: validHash, tier: 1, weight: 1, enabled: true }] },
    ], registry)[0].members[0].keyHash).toBe(validHash);
  });

  it('rejects non-positive tier and weight values', () => {
    const registry: ModelEntry[] = [model('fast')];

    expect(() => _testRoutingValidation.validateRoutingPools([
      { id: 'speed', label: 'Speed', enabled: true, members: [{ modelId: 'fast', tier: 0, weight: 1, enabled: true }] },
    ], registry)).toThrow(/tier/);

    expect(() => _testRoutingValidation.validateRoutingPools([
      { id: 'speed', label: 'Speed', enabled: true, members: [{ modelId: 'fast', tier: 1, weight: 0, enabled: true }] },
    ], registry)).toThrow(/weight/);
  });

  it('builds demo speed and quality pools from current model labels', () => {
    const registry: ModelEntry[] = [
      { ...model('hunyuan'), label: 'Tencent Hunyuan 3' },
      { ...model('auto'), label: 'Auto · multi-model (legacy)' },
      { ...model('deepseek-flash'), label: 'Deepseek V4 Flash(Limited Testing)' },
      { ...model('deepseek-pro'), label: 'Deepseek-v4-Pro For Demo Only' },
    ];

    const pools = defaultRoutingPoolsForRegistry(registry);

    expect(pools.find((pool) => pool.id === 'speed')?.members).toEqual([
      { modelId: 'hunyuan', tier: 1, weight: 50, enabled: true },
      { modelId: 'auto', tier: 1, weight: 30, enabled: true },
      { modelId: 'deepseek-flash', tier: 1, weight: 20, enabled: true },
    ]);
    expect(pools.find((pool) => pool.id === 'quality')?.members).toEqual([
      { modelId: 'deepseek-pro', tier: 1, weight: 100, enabled: true },
    ]);
  });
});
