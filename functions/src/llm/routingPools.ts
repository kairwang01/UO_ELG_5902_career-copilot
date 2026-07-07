import type { ModelEntry, RoutingPool, RoutingPoolMember } from "../admin/schema";

export interface RoutingCandidate {
  member: RoutingPoolMember;
  model: ModelEntry;
}

export function routingPoolTiers(pool: RoutingPool): number[] {
  return [...new Set(pool.members
    .filter((m) => m.enabled && m.tier > 0 && m.weight > 0)
    .map((m) => m.tier))]
    .sort((a, b) => a - b);
}

export function routingPoolForRoute(
  routeKey: string | undefined,
  moduleRoutes: Record<string, string>,
  pools: RoutingPool[]
): RoutingPool | null {
  const poolId = routeKey ? moduleRoutes[routeKey] : undefined;
  return poolId ? pools.find((pool) => pool.id === poolId && pool.enabled) ?? null : null;
}

export function candidatesForPoolTier(
  pool: RoutingPool,
  registry: ModelEntry[],
  allowedModelIds: Set<string>,
  tier: number
): RoutingCandidate[] {
  return pool.members.flatMap((member) => {
    if (!member.enabled || member.tier !== tier || member.weight <= 0) return [];
    const model = registry.find((m) => m.id === member.modelId && m.enabled);
    if (!model || !allowedModelIds.has(model.id)) return [];
    return [{ member, model }];
  });
}

export function selectWeightedCandidate<T extends { member: { weight: number } }>(
  candidates: T[],
  random = Math.random
): T | null {
  const total = candidates.reduce((sum, c) => sum + Math.max(0, c.member.weight), 0);
  if (total <= 0) return null;
  let pick = random() * total;
  for (const candidate of candidates) {
    pick -= Math.max(0, candidate.member.weight);
    if (pick < 0) return candidate;
  }
  return candidates[candidates.length - 1] ?? null;
}

export function implicitFallbackCandidates(
  allowedModels: ModelEntry[],
  chosenId: string,
  limit = 3
): ModelEntry[] {
  return allowedModels
    .filter((m) => m.id !== chosenId && m.id !== "custom" && m.enabled)
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
    .slice(0, limit);
}
