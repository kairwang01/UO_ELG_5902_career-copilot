/**
 * Admin callables for managing the dynamic model registry.
 *
 * These callables let an admin add, edit, disable, or delete model entries in
 * Firestore (platform_config/models).  The change propagates to every user's
 * model picker within one TTL cycle (≤60 s) without any redeploy.
 *
 * Security invariants:
 *   - adminListModels requires 'admin' role — returns masked keys only.
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
} from "../admin/schema";
import {
  ensurePlatformCaches,
  getModelRegistryMasked,
  refreshPlatformCaches,
} from "../admin/platformConfig";
import { logAdminAction } from "../admin/usageLog";
import { DEFAULT_MODEL_ID, DEFAULT_MODELS } from "../llm/models";

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

// ---------------------------------------------------------------------------
// adminListModels  (requires 'admin')
// ---------------------------------------------------------------------------

/**
 * Returns the effective model registry with api_key and api_keys masked.
 * If Firestore has no models doc (or empty array), returns DEFAULT_MODELS.
 * Seeds nothing — read-only.
 *
 * Role requirement: 'admin' (reading masked keys is safe for non-super admins).
 */
export const adminListModelsFunction = onCall({ invoker: "public" }, async (request) => {
  await requireRole(request, "admin");
  await ensurePlatformCaches();
  return { models: getModelRegistryMasked() };
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

  await ref.set({ models: nextRegistry } satisfies ModelsDoc);
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

  return { models: getModelRegistryMasked() };
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
  const fsModels = snap.exists ? (snap.data() as ModelsDoc).models : undefined;
  // First mutation on an unconfigured registry materialises the FULL defaults, so
  // editing/deleting one model never drops the others (getModelRegistry treats a
  // non-empty Firestore array as the complete registry).
  const current: ModelEntry[] = fsModels && fsModels.length > 0 ? fsModels : [...DEFAULT_MODELS];

  const nextRegistry = current.filter((m) => m.id !== id);
  if (nextRegistry.length === current.length) {
    throw new HttpsError("not-found", `Model "${id}" not found in the registry.`);
  }

  await ref.set({ models: nextRegistry } satisfies ModelsDoc);
  await refreshPlatformCaches();

  await logAdminAction({
    admin_uid: adminUid,
    action: "delete_model",
    details: { id },
  });

  return { models: getModelRegistryMasked() };
});
