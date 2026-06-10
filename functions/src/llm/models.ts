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
 *
 * Multi-key pooling + key health:
 *   ModelEntry.api_keys[] (preferred) or api_key (legacy) form the pool.
 *   Keys are tried in order, skipping any whose cooldownUntil is in the future.
 *   An in-process Map tracks the last-successful key index per provider+modelId
 *   so that the next call starts from the known-good key.
 *   Health failures are written best-effort to Firestore collection 'key_health'.
 *
 * Availability-only fallback chains:
 *   ModelEntry.fallbackChain[] lists model IDs to try when the primary's full
 *   key pool is exhausted on an availability-class error.  Quality errors
 *   (4xx from bad prompts, etc.) are NOT caught by the chain — only errors that
 *   indicate the key/endpoint is down/rate-limited.
 */

import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { LLMProvider, LLMRequest, LLMResult } from "./LLMProvider";
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
  getDefaultModelId,
  getFreeMaxOutputTokens,
} from "../config/env";
import { ModelEntry } from "../admin/schema";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Tier types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Default registry
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Key health — Firestore collection "key_health"
// ---------------------------------------------------------------------------

/** Stable 16-hex-char ID derived from a key — never stores the raw key. */
function keyHash(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 16);
}

/**
 * Failure classes that trigger key rotation (availability errors).
 * HTTP 401/403/429, timeout, empty response, provider quota errors.
 */
function isAvailabilityError(err: unknown): boolean {
  const e = err as { message?: string; status?: number; code?: number | string };
  const msg = (e?.message ?? "").toLowerCase();
  // HTTP status codes
  if (e?.status === 401 || e?.status === 403 || e?.status === 429) return true;
  if (e?.code === 401 || e?.code === 403 || e?.code === 429) return true;
  // Detect status codes embedded in message strings (e.g. "LLM provider error 429: ...")
  if (/llm provider error (401|403|429)/.test(msg)) return true;
  // Timeout
  if (msg.includes("timeout") || msg.includes("timed out")) return true;
  // Empty response
  if (msg.includes("empty response")) return true;
  // Quota / rate-limit language from provider responses
  if (
    msg.includes("resource_exhausted") ||
    msg.includes("quota exceeded") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("insufficient_quota") ||
    msg.includes("overloaded")
  )
    return true;
  // Gemini: status 429 embedded in error name
  if (msg.includes("429") || msg.includes("401") || msg.includes("403")) return true;
  // Dead/invalid API keys and exhausted key pools. Gemini reports a bad key as
  // HTTP 400 "API key not valid" (NOT 401!), and RotatingKeyProvider throws
  // "All API keys ... are unavailable" when the pool is empty/cooled — neither
  // matched the patterns above, so the fallback chain silently never engaged
  // (live audit 2026-06-10: a dead default model 500'd every tool instead of
  // hopping to the healthy fallback). All of these mean "this model cannot
  // serve right now", which is exactly what the chain exists for.
  if (
    msg.includes("api key not valid") ||
    msg.includes("api_key_invalid") ||
    msg.includes("invalid api key") ||
    msg.includes("incorrect api key") ||
    msg.includes("api key expired") ||
    msg.includes("all api keys") ||
    msg.includes("unavailable") ||
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed")
  )
    return true;
  return false;
}

const KEY_HEALTH_COLLECTION = "key_health";
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

interface KeyHealthDoc {
  keyHash: string;
  provider: string;
  modelId: string;
  failureCount: number;
  lastFailureAt: admin.firestore.Timestamp | null;
  lastSuccessAt: admin.firestore.Timestamp | null;
  cooldownUntil: admin.firestore.Timestamp | null;
  lastErrorCode: string | null;
}

/**
 * Record a successful key use — clears cooldown best-effort.
 * Never throws; health tracking must not block user requests.
 */
async function recordKeySuccess(
  rawKey: string,
  provider: string,
  modelId: string
): Promise<void> {
  try {
    const hash = keyHash(rawKey);
    const ref = db.collection(KEY_HEALTH_COLLECTION).doc(hash);
    await ref.set(
      {
        keyHash: hash,
        provider,
        modelId,
        lastSuccessAt: admin.firestore.FieldValue.serverTimestamp(),
        cooldownUntil: null,
        lastErrorCode: null,
      } as Partial<KeyHealthDoc>,
      { merge: true }
    );
  } catch {
    // best-effort: swallow
  }
}

/**
 * Record a key failure — increments failureCount and sets cooldownUntil.
 * Never throws.
 */
async function recordKeyFailure(
  rawKey: string,
  provider: string,
  modelId: string,
  err: unknown
): Promise<void> {
  try {
    const hash = keyHash(rawKey);
    const ref = db.collection(KEY_HEALTH_COLLECTION).doc(hash);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data() as KeyHealthDoc) : null;
    const failureCount = (existing?.failureCount ?? 0) + 1;
    const cooldownUntil = admin.firestore.Timestamp.fromMillis(Date.now() + COOLDOWN_MS);
    const lastErrorCode = extractErrorCode(err);
    await ref.set(
      {
        keyHash: hash,
        provider,
        modelId,
        failureCount,
        lastFailureAt: admin.firestore.FieldValue.serverTimestamp(),
        cooldownUntil,
        lastErrorCode,
      } as Partial<KeyHealthDoc>,
      { merge: true }
    );
  } catch {
    // best-effort: swallow
  }
}

function extractErrorCode(err: unknown): string {
  const e = err as { message?: string; status?: number; code?: number | string };
  if (e?.status) return String(e.status);
  if (e?.code) return String(e.code);
  const msg = (e?.message ?? "").toLowerCase();
  const match = msg.match(/\b(401|403|429|500|503)\b/);
  if (match) return match[1];
  if (msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (msg.includes("empty response")) return "empty";
  return "unknown";
}

// ---------------------------------------------------------------------------
// In-process "last successful key index" per provider+modelId
// ---------------------------------------------------------------------------

/**
 * Maps `${provider}:${modelId}` → last successful key index.
 * Used to start rotation from the last-known-working key rather than always
 * index 0. Process-scoped (resets on cold start) — just an optimisation.
 */
const lastSuccessfulKeyIndex = new Map<string, number>();

// ---------------------------------------------------------------------------
// Key pool resolution (api_keys > api_key > builtin)
// ---------------------------------------------------------------------------

/**
 * Resolves the ordered pool of raw API keys for an entry.
 * Returns [] if the entry is gemini (gemini uses its own key internally).
 */
function resolveKeyPool(entry: ModelEntry): string[] {
  if (entry.provider === "gemini") return [];

  // api_keys pool (multi-key, preferred)
  if (entry.api_keys && entry.api_keys.length > 0) {
    return entry.api_keys.filter((k) => k.trim().length > 0);
  }
  // legacy single key
  if (entry.api_key && entry.api_key.trim()) {
    return [entry.api_key];
  }
  // builtin platform keys — single key from platform config
  if (entry.builtin === "kairllm") {
    try { return [getKairllmApiKey()]; } catch { return []; }
  }
  if (entry.builtin === "deepseek") {
    try { return [getDeepseekApiKey()]; } catch { return []; }
  }
  return [];
}

// ---------------------------------------------------------------------------
// buildProvider (single-key, inner factory — no rotation wrapper)
// ---------------------------------------------------------------------------

/**
 * Constructs an LLMProvider from a registry entry, using the given apiKey override.
 * Used internally by the rotation wrapper; external callers should use
 * buildProvider() which handles the full pool automatically.
 *
 * The "custom" sentinel MUST NOT reach this function — resolveProvider handles
 * it separately by reading users/{uid}.custom_provider.
 */
function buildProviderWithKey(entry: ModelEntry, apiKey?: string): LLMProvider {
  if (entry.provider === "gemini") {
    return new GeminiProvider();
  }

  // openai-compatible: resolve base_url
  let baseUrl: string;
  if (entry.base_url) {
    baseUrl = entry.base_url;
  } else if (entry.builtin === "kairllm") {
    baseUrl = getKairllmBaseUrl();
  } else if (entry.builtin === "deepseek") {
    baseUrl = getDeepseekBaseUrl();
  } else {
    baseUrl = entry.base_url ?? "";
  }

  // resolve api_key: prefer caller-supplied override
  let resolvedKey: string;
  if (apiKey) {
    resolvedKey = apiKey;
  } else if (entry.api_key) {
    resolvedKey = entry.api_key;
  } else if (entry.builtin === "kairllm") {
    resolvedKey = getKairllmApiKey();
  } else if (entry.builtin === "deepseek") {
    resolvedKey = getDeepseekApiKey();
  } else {
    resolvedKey = entry.api_key ?? "";
  }

  return new OpenAICompatibleProvider({
    name: entry.id,
    baseUrl,
    apiKey: resolvedKey,
    model: entry.providerModel || "auto",
  });
}

// ---------------------------------------------------------------------------
// RotatingKeyProvider — wraps multi-key pool with health-aware rotation
// ---------------------------------------------------------------------------

/**
 * Wraps an openai-compatible entry's key pool with health-aware rotation.
 *
 * On each generate() call:
 *   1. Starts from lastSuccessfulKeyIndex for the entry (if set) to favour the
 *      last working key.
 *   2. Skips keys whose cooldownUntil is still in the future (async check on
 *      key_health docs — best-effort; if Firestore is unavailable we skip the
 *      health check and try all keys).
 *   3. Attempts the first non-cooled key; on availability-class failure rotates
 *      to the next, recording the failure to key_health (best-effort).
 *   4. On success records the success (best-effort) and saves the index.
 *   5. Throws the last error if all keys are exhausted.
 *
 * For the Gemini provider (no key pool), generate() is a straight pass-through.
 * HANDLER CODE NEVER CHANGES — they just call provider.generate().
 */
class RotatingKeyProvider implements LLMProvider {
  readonly name: string;
  private readonly entry: ModelEntry;
  private readonly keyPool: string[];
  private readonly poolKey: string; // for lastSuccessfulKeyIndex map

  constructor(entry: ModelEntry, keyPool: string[]) {
    this.entry = entry;
    this.name = entry.id;
    this.keyPool = keyPool;
    this.poolKey = `${entry.provider}:${entry.id}`;
  }

  async generate(req: LLMRequest): Promise<LLMResult> {
    // Gemini: no key pool, direct build
    if (this.entry.provider === "gemini" || this.keyPool.length === 0) {
      return buildProviderWithKey(this.entry).generate(req);
    }

    // Build cooldown status for keys (best-effort — don't block on Firestore errors)
    const cooldownSet = await this.getCooledDownKeys();

    // Determine start index (favour last-known-good key)
    const startIdx = lastSuccessfulKeyIndex.get(this.poolKey) ?? 0;
    const n = this.keyPool.length;

    let lastErr: unknown;
    for (let i = 0; i < n; i++) {
      const idx = (startIdx + i) % n;
      const rawKey = this.keyPool[idx];
      const hash = keyHash(rawKey);

      if (cooldownSet.has(hash)) {
        // Skip cooled-down key — keep lastErr as is
        continue;
      }

      const inner = buildProviderWithKey(this.entry, rawKey);
      try {
        const result = await inner.generate(req);
        // Success: update in-process index and record health
        lastSuccessfulKeyIndex.set(this.poolKey, idx);
        recordKeySuccess(rawKey, this.entry.provider, this.entry.id).catch(() => undefined);
        return result;
      } catch (err: unknown) {
        lastErr = err;
        if (isAvailabilityError(err)) {
          // Record failure and try next key
          recordKeyFailure(rawKey, this.entry.provider, this.entry.id, err).catch(
            () => undefined
          );
          console.warn(
            `[key-rotation] Key[${idx}] for model "${this.entry.id}" failed (availability). ` +
              `Trying next key. Error: ${(err as Error)?.message?.slice(0, 120)}`
          );
          continue;
        }
        // Non-availability error (e.g. bad prompt, schema error) — rethrow immediately
        throw err;
      }
    }

    // All keys exhausted (or all cooled down)
    throw lastErr ?? new Error(`All API keys for model "${this.entry.id}" are unavailable.`);
  }

  /** Returns a set of keyHash strings that are currently in cooldown. */
  private async getCooledDownKeys(): Promise<Set<string>> {
    if (this.keyPool.length === 0) return new Set();
    try {
      const hashes = this.keyPool.map(keyHash);
      const refs = hashes.map((h) => db.collection(KEY_HEALTH_COLLECTION).doc(h));
      const snaps = await db.getAll(...refs);
      const cooled = new Set<string>();
      const now = Date.now();
      for (const snap of snaps) {
        if (!snap.exists) continue;
        const doc = snap.data() as KeyHealthDoc;
        if (doc.cooldownUntil && doc.cooldownUntil.toMillis() > now) {
          cooled.add(doc.keyHash);
        }
      }
      return cooled;
    } catch {
      // Best-effort: if Firestore health check fails, treat all keys as available
      return new Set();
    }
  }
}

// ---------------------------------------------------------------------------
// FallbackProvider — wraps primary with availability-only chain fallback
// ---------------------------------------------------------------------------

/**
 * Wraps a primary provider with an ordered list of fallback providers.
 *
 * On generate():
 *   - Calls primary.generate().
 *   - If primary throws an availability-class error (after key rotation is
 *     exhausted), tries each fallback in order.
 *   - Quality / non-availability errors from the primary are rethrown immediately
 *     without trying fallbacks.
 *   - Logs fallbacks via console.warn (model ids only — no keys).
 */
class FallbackProvider implements LLMProvider {
  readonly name: string;
  private readonly primary: LLMProvider;
  private readonly fallbacks: Array<{ modelId: string; provider: LLMProvider }>;

  constructor(
    primary: LLMProvider,
    primaryModelId: string,
    fallbacks: Array<{ modelId: string; provider: LLMProvider }>
  ) {
    this.primary = primary;
    this.name = primaryModelId;
    this.fallbacks = fallbacks;
  }

  async generate(req: LLMRequest): Promise<LLMResult> {
    try {
      return await this.primary.generate(req);
    } catch (primaryErr: unknown) {
      if (!isAvailabilityError(primaryErr)) {
        throw primaryErr;
      }
      console.warn(
        `[fallback-chain] Primary model "${this.name}" unavailable. ` +
          `Trying chain: [${this.fallbacks.map((f) => f.modelId).join(", ")}]`
      );
      let lastErr: unknown = primaryErr;
      for (const fb of this.fallbacks) {
        try {
          const result = await fb.provider.generate(req);
          console.warn(`[fallback-chain] Succeeded on fallback model "${fb.modelId}".`);
          return result;
        } catch (fbErr: unknown) {
          lastErr = fbErr;
          if (!isAvailabilityError(fbErr)) {
            throw fbErr;
          }
          console.warn(
            `[fallback-chain] Fallback model "${fb.modelId}" also unavailable: ` +
              `${(fbErr as Error)?.message?.slice(0, 120)}`
          );
        }
      }
      // Whole chain exhausted — log the technical detail server-side, but throw
      // ONE clear, key-free message users and support can act on (instead of
      // whatever internal error the last provider happened to raise).
      console.error(
        `[fallback-chain] All models exhausted (primary "${this.name}" + ${this.fallbacks.length} fallbacks). ` +
          `Last error: ${(lastErr as Error)?.message?.slice(0, 160)}`
      );
      throw new Error(
        "All configured AI models are currently unavailable. Please try again in a few minutes — if this persists, an administrator needs to check the API keys in the admin console."
      );
    }
  }
}

// ---------------------------------------------------------------------------
// FreeTierOutputCapProvider — injects maxOutputTokens:4096 for free-tier (C)
// ---------------------------------------------------------------------------

/**
 * Service-tiering wrapper (服务分级 — free/paid output-quality boundary).
 *
 * When a free-tier user's request arrives with maxOutputTokens undefined, this
 * wrapper injects maxOutputTokens: 4096 before delegating to the inner provider.
 * (1024 proved too tight: large structured outputs — career roadmaps, formatted
 * resumes, weekly summaries — truncated mid-JSON and failed to parse, bricking
 * those tools for free users. 4096 keeps a real free/paid boundary while fitting
 * every tool's full response; make the value admin-configurable later.)
 * Paid/business callers pass through unmodified (they may supply their own cap
 * or leave it undefined for the provider default).
 *
 * Admins can deepen the gap later via per-tier prompt variants without touching
 * provider code — the token cap is the enforceable output boundary.
 */
class FreeTierOutputCapProvider implements LLMProvider {
  readonly name: string;
  private readonly inner: LLMProvider;
  private readonly cap: number;

  constructor(inner: LLMProvider, cap: number) {
    this.inner = inner;
    this.name = inner.name;
    this.cap = cap;
  }

  async generate(req: LLMRequest): Promise<LLMResult> {
    // Only inject the cap when the caller did not already specify one.
    const cappedReq: LLMRequest =
      req.maxOutputTokens === undefined
        ? { ...req, maxOutputTokens: this.cap }
        : req;
    return this.inner.generate(cappedReq);
  }
}

// ---------------------------------------------------------------------------
// buildProvider — public entry point (with key-pool rotation support)
// ---------------------------------------------------------------------------

/**
 * Constructs an LLMProvider from a registry entry.
 *
 * Key/URL resolution for openai-compatible entries:
 *   api_keys (if non-empty) → api_key → builtin platform key
 *   base_url = entry.base_url (if non-empty) else built-in from entry.builtin
 *
 * For entries with more than one key (after resolveKeyPool), the returned
 * provider is a RotatingKeyProvider that handles health-aware rotation
 * transparently.  For single-key entries a RotatingKeyProvider is still
 * returned (it degrades gracefully to a single attempt with health recording).
 *
 * NOTE: buildProvider does NOT attach the fallbackChain — that is done by
 * resolveProvider() which has access to the full registry and user tier.
 *
 * The "custom" sentinel MUST NOT reach this function — resolveProvider handles
 * it separately by reading users/{uid}.custom_provider.
 *
 * Exported so admin test-connection code can reuse the same key/base resolution
 * without duplicating logic. Does NOT do tier-gating — callers are responsible
 * for any access checks before calling this.
 *
 * @param rawKeyOverride Optional raw key override — bypasses pool resolution.
 *   Used by adminTestModel to test a specific key from the pool without full rotation.
 */
export function buildProvider(entry: ModelEntry, rawKeyOverride?: string): LLMProvider {
  if (entry.provider === "gemini") {
    return new GeminiProvider();
  }

  // If caller supplies a raw key override (e.g. admin testing a specific key),
  // bypass pool rotation and build a single-key provider directly.
  if (rawKeyOverride) {
    return buildProviderWithKey(entry, rawKeyOverride);
  }

  // Resolve key pool and wrap in rotation provider
  const pool = resolveKeyPool(entry);
  return new RotatingKeyProvider(entry, pool);
}

// ---------------------------------------------------------------------------
// Custom provider config shape
// ---------------------------------------------------------------------------

/**
 * Shape of the custom_provider field stored in users/{uid}.
 * Written ONLY server-side via setBusinessLlmConfig callable.
 */
export interface CustomProviderConfig {
  base_url: string;
  api_key: string;
  model: string;
}

// ---------------------------------------------------------------------------
// resolveProvider — main entry point for all feature handlers
// ---------------------------------------------------------------------------

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
 *
 * Multi-key rotation:
 *   The returned provider is a RotatingKeyProvider (transparent to callers).
 *
 * Fallback chain:
 *   If the chosen entry has a non-empty fallbackChain, the returned provider
 *   is wrapped in a FallbackProvider.  Each chain entry must exist in the
 *   registry and be accessible to the user's tier; inaccessible entries are
 *   skipped silently.
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

  // --- Feature A: admin-configured default model ---
  // Prefer the admin-set default when it exists in the registry, is enabled,
  // and the user's tier is allowed to use it.
  const adminDefaultId = getDefaultModelId();
  const adminDefaultEntry =
    adminDefaultId
      ? allowedWithAuto.find((m) => m.id === adminDefaultId && m.enabled)
      : undefined;

  // Absolute fallback: admin default (if valid) > hardcoded DEFAULT_MODEL_ID > first enabled.
  const absoluteFallback =
    adminDefaultEntry ??
    registry.find((m) => m.id === DEFAULT_MODEL_ID && m.enabled) ??
    registry.find((m) => m.enabled) ??
    DEFAULT_MODELS[0]; // always gemini

  const chosen =
    allowedWithAuto.find((m) => m.id === requestedModelId) ??
    adminDefaultEntry ??
    allowed.find((m) => m.id === DEFAULT_MODEL_ID) ??
    absoluteFallback;

  // Build the primary provider (with key-pool rotation)
  const primary = buildProvider(chosen);

  // --- Feature B: implicit availability auto-fallback ---
  // Build a FallbackProvider even when the chosen entry has no explicit
  // fallbackChain, using other enabled+tier-allowed models (excluding the
  // primary) sorted by (priority ?? 999) then registry order, capped at 3.
  const buildFallbackList = (
    explicitChain: string[] | undefined
  ): Array<{ modelId: string; provider: LLMProvider }> => {
    const fallbacks: Array<{ modelId: string; provider: LLMProvider }> = [];

    if (explicitChain && explicitChain.length > 0) {
      // Explicit chain: respect the admin-defined order, apply tier check.
      for (const chainId of explicitChain) {
        const chainEntry = registry.find((m) => m.id === chainId && m.enabled);
        if (!chainEntry) {
          console.warn(
            `[fallback-chain] Chain entry "${chainId}" not found or disabled. Skipping.`
          );
          continue;
        }
        if (!allowedWithAuto.some((m) => m.id === chainId)) {
          console.warn(
            `[fallback-chain] Chain entry "${chainId}" exceeds user tier. Skipping.`
          );
          continue;
        }
        fallbacks.push({ modelId: chainId, provider: buildProvider(chainEntry) });
      }
      return fallbacks;
    }

    // Implicit chain: other enabled models accessible to the user's tier,
    // sorted by (priority ?? 999) ascending then registry order, capped at 3.
    const candidates = allowedWithAuto
      .filter((m) => m.id !== chosen.id && m.enabled)
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
      .slice(0, 3);

    for (const entry of candidates) {
      fallbacks.push({ modelId: entry.id, provider: buildProvider(entry) });
    }
    return fallbacks;
  };

  const fallbacks = buildFallbackList(chosen.fallbackChain);

  // Wrap with FallbackProvider when at least one fallback is available.
  let finalProvider: LLMProvider;
  if (fallbacks.length > 0) {
    finalProvider = new FallbackProvider(primary, chosen.id, fallbacks);
  } else {
    finalProvider = primary;
  }

  // --- Feature C: service tiering — free-tier output cap ---
  // Free-tier requests get an output-token ceiling (服务分级), admin-configurable
  // via platform_config/quotas.free_max_output_tokens. Default 8192 = the model's
  // native max, i.e. NO artificial truncation (a lower value previously cut large
  // structured outputs — career roadmaps, formatted resumes — mid-JSON and broke
  // those tools). The genuine free/paid quality gap is the model tier; admins can
  // lower this knob for a harder boundary. Paid/business pass through uncapped.
  if (tier === "free") {
    return new FreeTierOutputCapProvider(finalProvider, getFreeMaxOutputTokens());
  }

  return finalProvider;
}
