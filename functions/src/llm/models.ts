/**
 * Model registry + tier-gated provider resolution.
 *
 * This is the single place that decides WHICH llm a request runs on. Gating is
 * enforced SERVER-SIDE: a free user (or any request for a model above the user's
 * tier) silently falls back to the default — the client cannot override it.
 *
 * Tier hierarchy:
 *   free     — Gemini + KairLLM (our shared gateway). Daily run cap enforced.
 *   paid     — free + DeepSeek (our API key). Subscriptions: essentials/accelerator/executive.
 *   business — free models + custom bring-your-own API. Roles: employer OR
 *              subscriptions: single_post/job_pack.
 *
 * The "auto" kairllm option (id "auto") is preserved for backward-compat with
 * existing paid-tier clients that may have "auto" stored as their preferred
 * model. It is deliberately NOT shown in modelsForTier() listings, but
 * resolveProvider() will still honour it if a paid user requests it.
 *
 * Empty platform_config/models ⇒ DEFAULT_MODELS is used — byte-identical to the
 * previous hardcoded MODEL_OPTIONS behaviour.
 */

import * as admin from "firebase-admin";
import { LLMProvider } from "./LLMProvider";
import { GeminiProvider } from "./providers/geminiProvider";
import { OpenAICompatibleProvider } from "./providers/openAICompatibleProvider";
import {
  ensurePlatformCaches,
  getKairllmApiKey,
  getKairllmBaseUrl,
  getDeepseekApiKey,
  getDeepseekBaseUrl,
  getModelRegistry,
  registerDefaultModels,
} from "../config/env";
import { ModelEntry } from "../admin/schema";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Access tiers, derived from the user's subscription_status and role.
 *
 * "business" is orthogonal to the paid upgrade path — it unlocks the
 * custom BYOA (bring-your-own-API) feature for employer/recruiter users.
 * Business users can also use free-tier models but NOT paid-tier premium
 * ones unless they also hold a paid subscription.
 */
export type Tier = "free" | "paid" | "business";

/**
 * Legacy interface kept for backward compatibility (listModels response, aiClient.ts).
 * New code should use ModelEntry from admin/schema.ts instead.
 */
export interface ModelOption {
  /** Selection id the client sends (and the picker shows). */
  id: string;
  /** Human-readable label for the picker. */
  label: string;
  /**
   * Backing provider implementation tag.
   * Note: old "kairllm" tag is normalised to "openai-compatible" in DEFAULT_MODELS.
   */
  provider: "gemini" | "kairllm" | "openai-compatible";
  /** Model name passed to the provider ("" = provider default). */
  providerModel: string;
  /** Minimum tier allowed to select this model. */
  minTier: Tier;
}

/**
 * THE hardcoded default registry.
 *
 * Faithfully reproduces the previous MODEL_OPTIONS semantics so that an empty
 * platform_config/models document yields byte-identical runtime behaviour:
 *
 *   free    → gemini (default) + kairllm (our shared gateway)
 *   paid    → free models + deepseek (our DeepSeek API key)
 *   business→ free models + custom (BYOA endpoint stored in users/{uid}.custom_provider)
 *
 * "auto" is kept for backward-compat (paid tier legacy id). New code uses "kairllm".
 * "custom" is a sentinel — it is not buildable from this table alone; resolveProvider
 * reads users/{uid}.custom_provider at runtime to construct the actual provider.
 */
export const DEFAULT_MODELS: ModelEntry[] = [
  {
    id: "gemini",
    label: "Gemini (default)",
    provider: "gemini",
    providerModel: "",
    minTier: "free",
    enabled: true,
  },
  {
    id: "kairllm",
    label: "KairLLM",
    provider: "openai-compatible",
    builtin: "kairllm",
    providerModel: "auto",
    minTier: "free",
    enabled: true,
  },
  {
    // Backward-compat alias for "kairllm". Keep minTier "paid" so it stays
    // invisible on free tier UI, but resolveProvider accepts it for paid users.
    id: "auto",
    label: "Auto · multi-model (legacy)",
    provider: "openai-compatible",
    builtin: "kairllm",
    providerModel: "auto",
    minTier: "paid",
    enabled: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    provider: "openai-compatible",
    builtin: "deepseek",
    providerModel: "deepseek-chat",
    minTier: "paid",
    enabled: true,
  },
  {
    // Sentinel: custom BYOA provider for business users.
    // The actual provider config is stored in users/{uid}.custom_provider.
    // buildProvider() must NOT be called on this entry directly.
    id: "custom",
    label: "Custom · your API",
    provider: "openai-compatible",
    providerModel: "",
    minTier: "business",
    enabled: true,
  },
];

// Register the seed so platformConfig.getModelRegistry() has defaults available
// even before the first Firestore fetch completes.
registerDefaultModels(DEFAULT_MODELS);

export const DEFAULT_MODEL_ID = "gemini";

const TIER_RANK: Record<Tier, number> = { free: 0, paid: 1, business: 0 };
// Note: "business" shares rank 0 with "free" — business users get free-tier
// models but NOT paid-tier premium ones. The business sentinel ("custom")
// lives at minTier "business" which is gated separately in modelsForTier().

/** Maps a subscription_status string to an access tier. */
export function tierFromSubscription(status: string | undefined): Tier {
  switch (status) {
    case "essentials":
    case "accelerator":
    case "executive":
      return "paid";
    // Business subscriptions — tier is "free" for model-rank purposes but
    // isBusinessUser() returns true (which unlocks BYOA "custom").
    case "single_post":
    case "job_pack":
      return "free";
    default:
      return "free"; // free, pending_*, unknown
  }
}

/**
 * Returns true if the user qualifies for business-tier features (BYOA custom
 * provider). Business = role employer OR business subscription plan.
 */
export function isBusinessUser(
  role: string | undefined,
  subscriptionStatus: string | undefined
): boolean {
  if (role === "employer") return true;
  if (subscriptionStatus === "single_post" || subscriptionStatus === "job_pack")
    return true;
  return false;
}

/**
 * The models a given tier is allowed to select (for the frontend picker).
 * Pass `business = true` to include the "custom" sentinel for BYOA users.
 * Reads the dynamic registry (Firestore if configured, else DEFAULT_MODELS).
 * Disabled models (enabled: false) are always excluded.
 */
export function modelsForTier(tier: Tier, business = false): ModelEntry[] {
  const registry = getModelRegistry();
  const tierRank = TIER_RANK[tier];
  return registry.filter((m) => {
    if (!m.enabled) return false;
    if (m.id === "auto") return false; // hidden: legacy alias, not shown in picker
    if (m.minTier === "business") return business; // shown only for business users
    return TIER_RANK[m.minTier] <= tierRank;
  });
}

/**
 * Constructs an LLMProvider from a registry entry.
 *
 * Key/URL resolution for openai-compatible entries:
 *   base_url = entry.base_url (if non-empty) else built-in from entry.builtin
 *   api_key  = entry.api_key  (if non-empty) else built-in from entry.builtin
 *
 * The "custom" sentinel MUST NOT reach this function — resolveProvider handles
 * it separately by reading users/{uid}.custom_provider.
 *
 * Exported so admin test-connection code can reuse the same key/base resolution
 * without duplicating logic. Does NOT do tier-gating — callers are responsible
 * for any access checks before calling this.
 */
export function buildProvider(entry: ModelEntry): LLMProvider {
  if (entry.provider === "gemini") {
    return new GeminiProvider();
  }

  // openai-compatible: resolve base_url and api_key with builtin fallback
  if (entry.provider === "openai-compatible") {
    let baseUrl: string;
    let apiKey: string;

    if (entry.base_url) {
      baseUrl = entry.base_url;
    } else if (entry.builtin === "kairllm") {
      baseUrl = getKairllmBaseUrl();
    } else if (entry.builtin === "deepseek") {
      baseUrl = getDeepseekBaseUrl();
    } else {
      // No builtin and no explicit base_url — must have been validated on write.
      baseUrl = entry.base_url ?? "";
    }

    if (entry.api_key) {
      apiKey = entry.api_key;
    } else if (entry.builtin === "kairllm") {
      apiKey = getKairllmApiKey();
    } else if (entry.builtin === "deepseek") {
      apiKey = getDeepseekApiKey();
    } else {
      apiKey = entry.api_key ?? "";
    }

    return new OpenAICompatibleProvider({
      name: entry.id,
      baseUrl,
      apiKey,
      model: entry.providerModel || "auto",
    });
  }

  // Absolute fallback — should never happen for a well-formed registry entry.
  return new GeminiProvider();
}

/**
 * Shape of the custom_provider field stored in users/{uid}.
 * Written ONLY server-side via setBusinessLlmConfig callable.
 */
export interface CustomProviderConfig {
  base_url: string;
  api_key: string;
  model: string;
}

/**
 * Resolves the provider for a user + requested model, enforcing tier gating.
 * Reads users/{uid} to determine tier, role, and (for business users) the
 * custom_provider field.
 *
 * Gating is fail-safe: any model a user's tier can't access silently falls
 * back to the tier default. No exception is thrown, no higher model leaks.
 * Disabled models are treated as non-existent.
 *
 * Business custom provider flow:
 *   - User must be business (role employer OR biz subscription).
 *   - User must request model id "custom".
 *   - users/{uid}.custom_provider must have { base_url, api_key, model }.
 *   - Falls back to gemini if any of those conditions are unmet.
 */
export async function resolveProvider(
  uid: string,
  requestedModelId?: string
): Promise<LLMProvider> {
  // Warm the platform-config cache FIRST so the (sync) key/model getters used by
  // buildProvider() read admin-configured Firestore values instead of a cold cache.
  await ensurePlatformCaches();

  let tier: Tier = "free";
  let business = false;
  let customProviderConfig: CustomProviderConfig | null = null;

  try {
    const snap = await db.collection(USERS_COLLECTION).doc(uid).get();
    const subscriptionStatus = snap.get(USER_FIELDS.subscriptionStatus) as
      | string
      | undefined;
    const role = snap.get(USER_FIELDS.role) as string | undefined;

    tier = tierFromSubscription(subscriptionStatus);
    business = isBusinessUser(role, subscriptionStatus);

    // Read custom_provider only when needed — business user requesting "custom".
    if (business && requestedModelId === "custom") {
      const cp = snap.get("custom_provider") as CustomProviderConfig | undefined;
      if (
        cp &&
        typeof cp.base_url === "string" &&
        typeof cp.api_key === "string" &&
        typeof cp.model === "string"
      ) {
        customProviderConfig = cp;
      }
    }
  } catch {
    tier = "free"; // fail safe
    business = false;
  }

  // --- Custom BYOA path (business only) ---
  if (business && requestedModelId === "custom" && customProviderConfig) {
    return new OpenAICompatibleProvider({
      name: "custom",
      baseUrl: customProviderConfig.base_url,
      apiKey: customProviderConfig.api_key,
      model: customProviderConfig.model,
    });
  }

  // --- Standard model registry path ---
  // Build the allowed set for this user (respects tier + business flag).
  const registry = getModelRegistry();
  const allowed = modelsForTier(tier, business);

  // Also allow the "auto" alias for paid users who may have it stored.
  // We look it up in the registry directly (it's excluded from modelsForTier).
  const autoOption = registry.find((m) => m.id === "auto" && m.enabled);
  const allowedWithAuto =
    tier === "paid" && autoOption ? [...allowed, autoOption] : allowed;

  // Absolute fallback: first enabled entry in the registry, then hardcoded gemini.
  const absoluteFallback =
    registry.find((m) => m.id === DEFAULT_MODEL_ID && m.enabled) ??
    registry.find((m) => m.enabled) ??
    DEFAULT_MODELS[0]; // always gemini

  const chosen =
    allowedWithAuto.find((m) => m.id === requestedModelId) ??
    allowed.find((m) => m.id === DEFAULT_MODEL_ID) ??
    absoluteFallback;

  return buildProvider(chosen);
}
