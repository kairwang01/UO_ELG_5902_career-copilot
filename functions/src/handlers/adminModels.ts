/**
 * Admin callables for managing the dynamic model registry.
 *
 * These callables let an admin add, edit, disable, or delete model entries in
 * Firestore (platform_config/models).  The change propagates to every user's
 * model picker within one TTL cycle (≤60 s) without any redeploy.
 *
 * Security invariants:
 *   - adminListModels requires 'reviewer' role — returns masked keys only.
 *   - adminUpsertModel / adminDeleteModel require 'super' role — they can
 *     create/overwrite api_key / api_keys material.
 *   - api_key and api_keys are NEVER returned raw — masked via maskSecret.
 *   - Raw keys are never written to the audit log — only an api_keys_changed flag.
 *   - Empty api_key on an update == "keep the existing key".
 *   - The "gemini" default model and the "custom" BYOA sentinel cannot be deleted.
 *
 * New fields (multi-key pooling + tier chains):
 *   api_keys   — pool of API keys (≤10, each ≤200 chars). Preferred over api_key.
 *   priority   — integer sort priority (higher = earlier in listings).
 *   fallbackChain — ordered model ids to try on availability failure (≤5 entries).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireRole } from "../admin/roles";
import {
  PLATFORM_CONFIG_COLLECTION,
  PLATFORM_DOCS,
  ModelEntry,
  ModelsDoc,
  ModuleRoutes,
  RoutingPool,
  RoutingPoolMember,
} from "../admin/schema";
import {
  ensurePlatformCaches,
  getDefaultModelId,
  getModelRegistry,
  getModuleRoutes,
  getRoutingPools,
  maskSecret,
  refreshPlatformCaches,
} from "../admin/platformConfig";
import { logAdminAction } from "../admin/usageLog";
import { DEFAULT_MODEL_ID, DEFAULT_MODELS } from "../llm/models";
import { keyHash } from "../llm/keyHash";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/** IDs that are structurally required and must never be deleted via the API. */
const PROTECTED_IDS = new Set([DEFAULT_MODEL_ID, "custom"]);

const VALID_PROVIDERS = new Set<ModelEntry["provider"]>(["gemini", "openai-compatible"]);
const VALID_TIERS = new Set<ModelEntry["minTier"]>(["free", "paid", "business"]);
const VALID_BUILTINS = new Set(["kairllm", "deepseek", undefined]);

const MAX_API_KEYS = 10;
const MAX_API_KEY_LEN = 200;
const MAX_FALLBACK_CHAIN = 5;
const MAX_ROUTING_POOLS = 12;
const MAX_POOL_MEMBERS = 60;
const MAX_MODULE_ROUTES = 80;
const SLUG_RE = /^[a-zA-Z0-9_-]{1,48}$/;
const KEY_HEALTH_COLLECTION = "key_health";

type ModelKeyHealth = {
  failureCount: number;
  cooldownUntil: string | null;
  lastErrorCode: string | null;
  lastFailureAt: string | null;
  anyCooled: boolean;
};

function timestampMs(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function timestampIso(value: unknown): string | null {
  const ms = timestampMs(value);
  return ms === null ? null : new Date(ms).toISOString();
}

function aggregateKeyHealth(
  docs: Array<Record<string, unknown>>,
  nowMs = Date.now()
): Record<string, ModelKeyHealth> {
  const byModel: Record<string, ModelKeyHealth> = {};
  const latestFailureMs: Record<string, number> = {};
  const latestCooldownMs: Record<string, number> = {};

  for (const doc of docs) {
    const modelId = typeof doc.modelId === "string" ? doc.modelId.trim() : "";
    if (!modelId) continue;

    const current = byModel[modelId] ?? {
      failureCount: 0,
      cooldownUntil: null,
      lastErrorCode: null,
      lastFailureAt: null,
      anyCooled: false,
    };

    if (typeof doc.failureCount === "number" && Number.isFinite(doc.failureCount)) {
      current.failureCount += doc.failureCount;
    }

    const cooldownMs = timestampMs(doc.cooldownUntil);
    if (cooldownMs !== null && cooldownMs > nowMs) {
      current.anyCooled = true;
      if (cooldownMs > (latestCooldownMs[modelId] ?? 0)) {
        latestCooldownMs[modelId] = cooldownMs;
        current.cooldownUntil = new Date(cooldownMs).toISOString();
      }
    }

    const failureMs = timestampMs(doc.lastFailureAt);
    if (failureMs !== null && failureMs > (latestFailureMs[modelId] ?? 0)) {
      latestFailureMs[modelId] = failureMs;
      current.lastFailureAt = new Date(failureMs).toISOString();
      current.lastErrorCode = typeof doc.lastErrorCode === "string" ? doc.lastErrorCode : null;
    } else if (!current.lastFailureAt) {
      current.lastFailureAt = timestampIso(doc.lastFailureAt);
      current.lastErrorCode = typeof doc.lastErrorCode === "string" ? doc.lastErrorCode : null;
    }

    byModel[modelId] = current;
  }

  return byModel;
}

function keyHashesForModel(entry: ModelEntry): Set<string> {
  const hashes = new Set<string>();
  if (entry.api_key) hashes.add(keyHash(entry.api_key));
  for (const key of entry.api_keys ?? []) hashes.add(keyHash(key));
  return hashes;
}

function withAdminKeyPreviews(masked: ModelEntry, raw: ModelEntry): ModelEntry {
  const previews = [
    ...(raw.api_key
      ? [{ hash: keyHash(raw.api_key), masked: maskSecret(raw.api_key), index: 0, source: "api_key" as const }]
      : []),
    ...(raw.api_keys ?? []).map((key, index) => ({
      hash: keyHash(key),
      masked: maskSecret(key),
      index,
      source: "api_keys" as const,
    })),
  ];
  return {
    ...masked,
    ...(raw.api_key ? { api_key_hash: keyHash(raw.api_key) } : {}),
    ...(raw.api_keys?.length ? { api_key_hashes: raw.api_keys.map(keyHash) } : {}),
    ...(previews.length > 0 ? { key_previews: previews } : {}),
  };
}

function modelsForAdminResponse(): ModelEntry[] {
  const rawModels = getModelRegistry();
  return rawModels.map((raw) => withAdminKeyPreviews({
    ...raw,
    api_key: raw.api_key ? maskSecret(raw.api_key) : undefined,
    api_keys: raw.api_keys?.length ? raw.api_keys.map(maskSecret) : undefined,
  }, raw));
}

/** Validates and normalises an incoming ModelEntry, throwing HttpsError on bad input. */
function validateEntry(raw: unknown, isCreate: boolean): ModelEntry {
  if (!raw || typeof raw !== "object") {
    throw new HttpsError("invalid-argument", "model must be an object.");
  }
  const m = raw as Record<string, unknown>;

  const id = (typeof m.id === "string" ? m.id.trim() : "") as string;
  if (!id) throw new HttpsError("invalid-argument", "model.id is required.");

  const label = (typeof m.label === "string" ? m.label.trim() : "") as string;
  if (!label) throw new HttpsError("invalid-argument", "model.label is required.");

  const provider = m.provider as ModelEntry["provider"];
  if (!VALID_PROVIDERS.has(provider)) {
    throw new HttpsError("invalid-argument", `model.provider must be "gemini" or "openai-compatible".`);
  }

  const minTier = m.minTier as ModelEntry["minTier"];
  if (!VALID_TIERS.has(minTier)) {
    throw new HttpsError("invalid-argument", `model.minTier must be "free", "paid", or "business".`);
  }

  const builtin = m.builtin as ModelEntry["builtin"] | undefined;
  if (!VALID_BUILTINS.has(builtin)) {
    throw new HttpsError("invalid-argument", `model.builtin must be "kairllm", "deepseek", or omitted.`);
  }

  const base_url = typeof m.base_url === "string" ? m.base_url.trim() : undefined;
  const api_key = typeof m.api_key === "string" ? m.api_key.trim() : undefined;
  const providerModel = typeof m.providerModel === "string" ? m.providerModel : "";
  const enabled = m.enabled !== false; // default true

  // --- api_keys pool validation ---
  let api_keys: string[] | undefined;
  if (Array.isArray(m.api_keys)) {
    const pool = m.api_keys as unknown[];
    if (pool.length > MAX_API_KEYS) {
      throw new HttpsError(
        "invalid-argument",
        `model.api_keys must contain at most ${MAX_API_KEYS} keys.`
      );
    }
    const cleaned: string[] = [];
    for (let i = 0; i < pool.length; i++) {
      if (typeof pool[i] !== "string") {
        throw new HttpsError("invalid-argument", `model.api_keys[${i}] must be a string.`);
      }
      const trimmed = (pool[i] as string).trim();
      if (!trimmed) {
        throw new HttpsError("invalid-argument", `model.api_keys[${i}] must not be empty.`);
      }
      if (trimmed.length > MAX_API_KEY_LEN) {
        throw new HttpsError(
          "invalid-argument",
          `model.api_keys[${i}] exceeds max length of ${MAX_API_KEY_LEN} chars.`
        );
      }
      cleaned.push(trimmed);
    }
    if (cleaned.length > 0) api_keys = cleaned;
  }

  // --- priority validation ---
  let priority: number | undefined;
  if (m.priority !== undefined && m.priority !== null) {
    const p = Number(m.priority);
    if (!Number.isInteger(p)) {
      throw new HttpsError("invalid-argument", "model.priority must be an integer.");
    }
    priority = p;
  }

  // --- fallbackChain validation ---
  let fallbackChain: string[] | undefined;
  if (Array.isArray(m.fallbackChain)) {
    const chain = m.fallbackChain as unknown[];
    if (chain.length > MAX_FALLBACK_CHAIN) {
      throw new HttpsError(
        "invalid-argument",
        `model.fallbackChain must contain at most ${MAX_FALLBACK_CHAIN} entries.`
      );
    }
    const cleanedChain: string[] = [];
    for (let i = 0; i < chain.length; i++) {
      if (typeof chain[i] !== "string" || !(chain[i] as string).trim()) {
        throw new HttpsError("invalid-argument", `model.fallbackChain[${i}] must be a non-empty string.`);
      }
      cleanedChain.push((chain[i] as string).trim());
    }
    if (cleanedChain.length > 0) fallbackChain = cleanedChain;
  }

  // For openai-compatible entries with no builtin, validate base_url on create.
  if (provider === "openai-compatible" && !builtin) {
    if (!base_url) {
      throw new HttpsError(
        "invalid-argument",
        "model.base_url (https URL) is required for openai-compatible models without a builtin."
      );
    }
    if (!base_url.startsWith("https://")) {
      throw new HttpsError("invalid-argument", "model.base_url must start with https://");
    }
    // On create, require at least one key (api_key or api_keys) when no builtin
    if (isCreate && !api_key && (!api_keys || api_keys.length === 0)) {
      throw new HttpsError(
        "invalid-argument",
        "model.api_key or model.api_keys is required when creating an openai-compatible model without a builtin."
      );
    }
  }

  const entry: ModelEntry = {
    id,
    label,
    provider,
    providerModel,
    minTier,
    enabled,
  };
  if (builtin) entry.builtin = builtin;
  if (base_url) entry.base_url = base_url;
  // api_key: include only if non-empty (empty on update = keep existing).
  if (api_key) entry.api_key = api_key;
  // api_keys pool: include only if non-empty
  if (api_keys && api_keys.length > 0) entry.api_keys = api_keys;
  // priority / fallbackChain
  if (priority !== undefined) entry.priority = priority;
  if (fallbackChain && fallbackChain.length > 0) entry.fallbackChain = fallbackChain;

  return entry;
}

// ---------------------------------------------------------------------------
// Validate fallbackChain references exist in the registry (called after write)
// ---------------------------------------------------------------------------

/**
 * Validates that all fallbackChain model IDs in the registry refer to existing
 * IDs.  Throws HttpsError if any reference is broken.
 * Called before writing so we never persist a broken chain.
 */
function validateChainReferences(
  entry: ModelEntry,
  registry: ModelEntry[]
): void {
  if (!entry.fallbackChain || entry.fallbackChain.length === 0) return;
  const ids = new Set(registry.map((m) => m.id));
  // Include the entry itself (self-reference not useful but shouldn't error here —
  // would just be a no-op cycle).  Validate against existing ids + the entry being saved.
  ids.add(entry.id);
  for (const chainId of entry.fallbackChain) {
    if (!ids.has(chainId)) {
      throw new HttpsError(
        "invalid-argument",
        `model.fallbackChain references unknown model id "${chainId}". ` +
          `Add that model to the registry first.`
      );
    }
  }
}

function validateRoutingPools(rawPools: unknown, registry: ModelEntry[]): RoutingPool[] {
  if (!Array.isArray(rawPools)) {
    throw new HttpsError("invalid-argument", "routing_pools must be an array.");
  }
  if (rawPools.length > MAX_ROUTING_POOLS) {
    throw new HttpsError("invalid-argument", `routing_pools must contain at most ${MAX_ROUTING_POOLS} pools.`);
  }

  const modelIds = new Set(registry.map((m) => m.id));
  const keyHashesByModel = new Map(registry.map((m) => [m.id, keyHashesForModel(m)]));
  const seenIds = new Set<string>();

  return rawPools.map((raw, poolIndex) => {
    if (!raw || typeof raw !== "object") {
      throw new HttpsError("invalid-argument", `routing_pools[${poolIndex}] must be an object.`);
    }
    const p = raw as Record<string, unknown>;
    const id = typeof p.id === "string" ? p.id.trim() : "";
    if (!SLUG_RE.test(id)) {
      throw new HttpsError("invalid-argument", `routing_pools[${poolIndex}].id must be a slug up to 48 chars.`);
    }
    if (seenIds.has(id)) {
      throw new HttpsError("invalid-argument", `routing pool "${id}" is duplicated.`);
    }
    seenIds.add(id);

    const label = typeof p.label === "string" && p.label.trim() ? p.label.trim().slice(0, 80) : id;
    const membersRaw = Array.isArray(p.members) ? p.members : [];
    if (membersRaw.length > MAX_POOL_MEMBERS) {
      throw new HttpsError("invalid-argument", `routing pool "${id}" has too many members.`);
    }

    const members: RoutingPoolMember[] = membersRaw.map((rawMember, memberIndex) => {
      if (!rawMember || typeof rawMember !== "object") {
        throw new HttpsError("invalid-argument", `routing pool "${id}" member ${memberIndex} must be an object.`);
      }
      const m = rawMember as Record<string, unknown>;
      const modelId = typeof m.modelId === "string" ? m.modelId.trim() : "";
      if (!modelIds.has(modelId)) {
        throw new HttpsError("invalid-argument", `routing pool "${id}" references unknown model "${modelId}".`);
      }
      // The "custom" BYOA sentinel has no platform key/URL of its own — its real
      // config lives per-user in users/{uid}.custom_provider and is resolved on
      // the dedicated BYOA path. Inside a pool it would build an empty provider.
      if (modelId === "custom") {
        throw new HttpsError("invalid-argument", `routing pool "${id}" cannot include the per-user "custom" BYOA model.`);
      }
      const tier = Number(m.tier);
      const weight = Number(m.weight);
      if (!Number.isInteger(tier) || tier <= 0) {
        throw new HttpsError("invalid-argument", `routing pool "${id}" member tier must be a positive integer.`);
      }
      if (!Number.isInteger(weight) || weight <= 0) {
        throw new HttpsError("invalid-argument", `routing pool "${id}" member weight must be a positive integer.`);
      }
      const keyHashValue = typeof m.keyHash === "string" ? m.keyHash.trim() : "";
      if (keyHashValue && !keyHashesByModel.get(modelId)?.has(keyHashValue)) {
        throw new HttpsError("invalid-argument", `routing pool "${id}" references an unknown saved key for model "${modelId}".`);
      }
      return {
        modelId,
        ...(keyHashValue ? { keyHash: keyHashValue } : {}),
        tier,
        weight,
        enabled: m.enabled !== false,
      };
    });

    return { id, label, enabled: p.enabled !== false, members };
  });
}

function validateModuleRoutes(rawRoutes: unknown, pools: RoutingPool[]): ModuleRoutes {
  if (!rawRoutes || typeof rawRoutes !== "object" || Array.isArray(rawRoutes)) {
    throw new HttpsError("invalid-argument", "module_routes must be an object.");
  }
  const poolIds = new Set(pools.map((p) => p.id));
  const entries = Object.entries(rawRoutes as Record<string, unknown>);
  if (entries.length > MAX_MODULE_ROUTES) {
    throw new HttpsError("invalid-argument", `module_routes must contain at most ${MAX_MODULE_ROUTES} entries.`);
  }
  const routes: ModuleRoutes = {};
  for (const [rawKey, rawPoolId] of entries) {
    const key = rawKey.trim();
    const poolId = typeof rawPoolId === "string" ? rawPoolId.trim() : "";
    if (!SLUG_RE.test(key)) {
      throw new HttpsError("invalid-argument", `module route "${rawKey}" must be a slug up to 48 chars.`);
    }
    if (!poolIds.has(poolId)) {
      throw new HttpsError("invalid-argument", `module route "${key}" references unknown pool "${poolId}".`);
    }
    routes[key] = poolId;
  }
  return routes;
}

// ---------------------------------------------------------------------------
// adminListModels  (requires 'reviewer')
// ---------------------------------------------------------------------------

/**
 * Returns the effective model registry with api_key and api_keys masked.
 * Includes lightweight key health info (failureCount, cooldownUntil, lastErrorCode)
 * sourced from key_health/{keyHash} docs (best-effort; missing docs are skipped).
 * If Firestore has no models doc (or empty array), returns DEFAULT_MODELS.
 * Seeds nothing — read-only.
 *
 * Role requirement: 'reviewer' (reading masked keys is safe for read-only admins).
 */
export const adminListModelsFunction = onCall({ invoker: "public" }, async (request) => {
  await requireRole(request, "reviewer");
  await refreshPlatformCaches();

  // Runtime writes one health doc per key hash; aggregate them per model.
  let healthByModelId: Record<string, ModelKeyHealth> = {};
  try {
    const healthSnap = await db.collection(KEY_HEALTH_COLLECTION).get();
    healthByModelId = aggregateKeyHealth(healthSnap.docs.map((doc) => doc.data()));
  } catch {
    // Health fetch is strictly best-effort; never block the response.
  }

  const maskedModels = modelsForAdminResponse().map((m) => {
    const h = healthByModelId[m.id];
    if (!h) return m;
    return { ...m, keyHealth: h };
  });

  return {
    models: maskedModels,
    // Include the admin-configured default so the UI can render the badge.
    defaultModelId: getDefaultModelId() ?? DEFAULT_MODEL_ID,
    routingPools: getRoutingPools(),
    moduleRoutes: getModuleRoutes(),
  };
});

// ---------------------------------------------------------------------------
// adminUpsertModel  (requires 'super' — touches key material)
// ---------------------------------------------------------------------------

/**
 * Creates or updates a model entry by id.
 *
 * - On update: empty api_key = keep existing api_key; omitted api_keys = keep existing.
 * - Always refreshes the in-memory cache after writing.
 * - Never logs raw api_key / api_keys — only api_keys_changed boolean.
 *
 * Role requirement: 'super' (writes can include raw API key material).
 */
export const adminUpsertModelFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: adminUid } = await requireRole(request, "super");
  const data = (request.data ?? {}) as { model?: unknown };

  // Read current registry to determine create vs. update.
  await ensurePlatformCaches();
  const ref = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.models);
  const snap = await ref.get();
  const fsModels = snap.exists ? (snap.data() as ModelsDoc).models : undefined;
  // First mutation on an unconfigured registry materialises the FULL defaults, so
  // editing/deleting one model never drops the others (getModelRegistry treats a
  // non-empty Firestore array as the complete registry).
  const current: ModelEntry[] = fsModels && fsModels.length > 0 ? fsModels : [...DEFAULT_MODELS];

  const existingIndex = current.findIndex((m) => {
    const incoming = data.model as Record<string, unknown> | undefined;
    return incoming && m.id === (typeof incoming.id === "string" ? incoming.id.trim() : "");
  });
  const isCreate = existingIndex === -1;

  const validated = validateEntry(data.model, isCreate);

  // Validate fallbackChain references against the current registry + the entry itself
  validateChainReferences(validated, current);

  let nextRegistry: ModelEntry[];
  if (isCreate) {
    nextRegistry = [...current, validated];
  } else {
    const existing = current[existingIndex];

    // Preserve existing api_key when none supplied on update.
    const mergedApiKey = validated.api_key || existing.api_key;
    // Preserve existing api_keys pool when none supplied on update.
    const mergedApiKeys =
      validated.api_keys && validated.api_keys.length > 0
        ? validated.api_keys
        : existing.api_keys;

    const merged: ModelEntry = { ...existing, ...validated };
    if (mergedApiKey) {
      merged.api_key = mergedApiKey;
    } else {
      delete merged.api_key;
    }
    if (mergedApiKeys && mergedApiKeys.length > 0) {
      merged.api_keys = mergedApiKeys;
    } else {
      delete merged.api_keys;
    }

    nextRegistry = [...current.slice(0, existingIndex), merged, ...current.slice(existingIndex + 1)];
  }

  await ref.set({ models: nextRegistry } satisfies Partial<ModelsDoc>, { merge: true });
  await refreshPlatformCaches();

  await logAdminAction({
    admin_uid: adminUid,
    action: isCreate ? "create_model" : "update_model",
    details: {
      id: validated.id,
      label: validated.label,
      provider: validated.provider,
      minTier: validated.minTier,
      enabled: validated.enabled,
      builtin: validated.builtin ?? null,
      base_url: validated.base_url ?? null,
      priority: validated.priority ?? null,
      fallbackChain: validated.fallbackChain ?? null,
      // NEVER log raw keys — only whether keys were supplied.
      api_keys_changed: !!(validated.api_key || (validated.api_keys && validated.api_keys.length > 0)),
    },
  });

  return { models: modelsForAdminResponse() };
});

// ---------------------------------------------------------------------------
// adminDeleteModel  (requires 'super' — removes key material from registry)
// ---------------------------------------------------------------------------

/**
 * Removes a model entry by id.
 *
 * Protected ids ("gemini", "custom") cannot be deleted — they are structurally
 * required by the tier-gating logic and BYOA path respectively.
 *
 * Role requirement: 'super' (deleting an entry also removes its stored keys).
 */
export const adminDeleteModelFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: adminUid } = await requireRole(request, "super");
  const data = (request.data ?? {}) as { id?: unknown };

  const id = typeof data.id === "string" ? data.id.trim() : "";
  if (!id) throw new HttpsError("invalid-argument", "id is required.");

  if (PROTECTED_IDS.has(id)) {
    throw new HttpsError(
      "failed-precondition",
      `Model "${id}" is protected and cannot be deleted.`
    );
  }

  await ensurePlatformCaches();
  const ref = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.models);
  const snap = await ref.get();
  const doc = snap.exists ? (snap.data() as ModelsDoc) : {};
  const fsModels = doc.models;
  // First mutation on an unconfigured registry materialises the FULL defaults, so
  // editing/deleting one model never drops the others (getModelRegistry treats a
  // non-empty Firestore array as the complete registry).
  const current: ModelEntry[] = fsModels && fsModels.length > 0 ? fsModels : [...DEFAULT_MODELS];

  const nextRegistry = current.filter((m) => m.id !== id);
  if (nextRegistry.length === current.length) {
    throw new HttpsError("not-found", `Model "${id}" not found in the registry.`);
  }

  const cleanedRoutingPools = doc.routing_pools?.map((pool) => ({
    ...pool,
    members: pool.members.filter((member) => member.modelId !== id),
  }));

  await ref.set({
    models: nextRegistry,
    ...(cleanedRoutingPools ? { routing_pools: cleanedRoutingPools } : {}),
  } satisfies Partial<ModelsDoc>, { merge: true });
  await refreshPlatformCaches();

  await logAdminAction({
    admin_uid: adminUid,
    action: "delete_model",
    details: { id },
  });

  return { models: modelsForAdminResponse() };
});

export const adminUpdateModelRoutingFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: adminUid } = await requireRole(request, "super");
  const data = (request.data ?? {}) as { routingPools?: unknown; moduleRoutes?: unknown };

  await ensurePlatformCaches();
  const registry = getModelRegistry();
  const routingPools = validateRoutingPools(data.routingPools, registry);
  const moduleRoutes = validateModuleRoutes(data.moduleRoutes, routingPools);

  const ref = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.models);
  await ref.set(
    { routing_pools: routingPools, module_routes: moduleRoutes } satisfies Partial<ModelsDoc>,
    { merge: true }
  );
  await refreshPlatformCaches();

  await logAdminAction({
    admin_uid: adminUid,
    action: "update_model_routing",
    details: {
      pool_count: routingPools.length,
      member_count: routingPools.reduce((sum, pool) => sum + pool.members.length, 0),
      module_route_count: Object.keys(moduleRoutes).length,
    },
  });

  return { routingPools: getRoutingPools(), moduleRoutes: getModuleRoutes() };
});

export const _testRoutingValidation = {
  aggregateKeyHealth,
  validateRoutingPools,
  validateModuleRoutes,
};

// ---------------------------------------------------------------------------
// adminSetDefaultModel  (requires 'super' — changes the global default model)
// ---------------------------------------------------------------------------

/**
 * Sets the admin-configured default model for all users.
 *
 * The supplied id must exist in the current registry and be enabled.
 * Writes default_model_id into platform_config/models (merge), busts the cache,
 * and audit-logs the change.
 *
 * resolveProvider() and listModels both read this via getDefaultModelId() on the
 * next request (within one TTL cycle — ≤60 s).
 *
 * Role requirement: 'super'.
 */
export const adminSetDefaultModelFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid: adminUid } = await requireRole(request, "super");
  const data = (request.data ?? {}) as { id?: unknown };

  const id = typeof data.id === "string" ? data.id.trim() : "";
  if (!id) throw new HttpsError("invalid-argument", "id is required.");

  await ensurePlatformCaches();
  const registry = getModelRegistry();

  // Validate: id must exist in the registry and be enabled.
  const entry = registry.find((m) => m.id === id);
  if (!entry) {
    throw new HttpsError("not-found", `Model "${id}" not found in the registry.`);
  }
  if (!entry.enabled) {
    throw new HttpsError(
      "failed-precondition",
      `Model "${id}" is disabled and cannot be set as the default.`
    );
  }

  // Write default_model_id into the models doc (merge — preserves the models array).
  const ref = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.models);
  await ref.set({ default_model_id: id } as Partial<ModelsDoc>, { merge: true });
  await refreshPlatformCaches();

  await logAdminAction({
    admin_uid: adminUid,
    action: "set_default_model",
    details: { id },
  });

  return { ok: true, defaultModelId: id };
});
