/**
 * Admin callables for managing the dynamic model registry.
 *
 * These callables let an admin add, edit, disable, or delete model entries in
 * Firestore (platform_config/models).  The change propagates to every user's
 * model picker within one TTL cycle (≤60 s) without any redeploy.
 *
 * Security invariants:
 *   - Every endpoint requires admin access (requireAdmin).
 *   - api_key is NEVER returned raw — masked via maskSecret.
 *   - Raw keys are never written to the audit log — only an api_key_changed flag.
 *   - Empty api_key on an update == "keep the existing key".
 *   - The "gemini" default model and the "custom" BYOA sentinel cannot be deleted.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "../middleware/auth";
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
    if (isCreate && !api_key) {
      throw new HttpsError(
        "invalid-argument",
        "model.api_key is required when creating an openai-compatible model without a builtin."
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

  return entry;
}

// ---------------------------------------------------------------------------
// adminListModels
// ---------------------------------------------------------------------------

/**
 * Returns the effective model registry with api_key masked.
 * If Firestore has no models doc (or empty array), returns DEFAULT_MODELS.
 * Seeds nothing — read-only.
 */
export const adminListModelsFunction = onCall({ invoker: "public" }, async (request) => {
  await requireAdmin(request);
  await ensurePlatformCaches();
  return { models: getModelRegistryMasked() };
});

// ---------------------------------------------------------------------------
// adminUpsertModel
// ---------------------------------------------------------------------------

/**
 * Creates or updates a model entry by id.
 *
 * - On update: empty api_key = keep existing api_key.
 * - Always refreshes the in-memory cache after writing.
 * - Never logs raw api_key — only api_key_changed boolean.
 */
export const adminUpsertModelFunction = onCall({ invoker: "public" }, async (request) => {
  const adminUid = await requireAdmin(request);
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

  let nextRegistry: ModelEntry[];
  if (isCreate) {
    nextRegistry = [...current, validated];
  } else {
    const existing = current[existingIndex];
    // Preserve existing api_key when none supplied on update.
    const mergedApiKey = validated.api_key || existing.api_key;
    const merged: ModelEntry = { ...existing, ...validated };
    if (mergedApiKey) {
      merged.api_key = mergedApiKey;
    } else {
      delete merged.api_key;
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
      // NEVER log raw keys — only whether one was supplied.
      api_key_changed: !!validated.api_key,
    },
  });

  return { models: getModelRegistryMasked() };
});

// ---------------------------------------------------------------------------
// adminDeleteModel
// ---------------------------------------------------------------------------

/**
 * Removes a model entry by id.
 *
 * Protected ids ("gemini", "custom") cannot be deleted — they are structurally
 * required by the tier-gating logic and BYOA path respectively.
 */
export const adminDeleteModelFunction = onCall({ invoker: "public" }, async (request) => {
  const adminUid = await requireAdmin(request);
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
