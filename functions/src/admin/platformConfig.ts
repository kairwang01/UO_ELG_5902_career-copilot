/**
 * Runtime LLM config — Firestore platform_config/llm with functions/.env fallback.
 * Cached in memory so providers keep sync getters.
 */

import * as admin from "firebase-admin";
import {
  LlmConfigDoc,
  ModelEntry,
  ModelsDoc,
  PLATFORM_CONFIG_COLLECTION,
  PLATFORM_DOCS,
  QuotasDoc,
} from "./schema";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

let llmCache: LlmConfigDoc | null = null;
let quotasCache: QuotasDoc | null = null;
let modelsCache: ModelsDoc | null = null;
let promptsCache: Record<string, string> | null = null;
let cacheAt = 0;
const TTL_MS = 60_000;

export function maskSecret(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export async function refreshPlatformCaches(): Promise<void> {
  const [llmSnap, quotasSnap, modelsSnap, promptsSnap] = await Promise.all([
    db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.llm).get(),
    db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.quotas).get(),
    db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.models).get(),
    db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.prompts).get(),
  ]);
  llmCache = llmSnap.exists ? (llmSnap.data() as LlmConfigDoc) : {};
  quotasCache = quotasSnap.exists ? (quotasSnap.data() as QuotasDoc) : {};
  modelsCache = modelsSnap.exists ? (modelsSnap.data() as ModelsDoc) : {};
  promptsCache = promptsSnap.exists
    ? (promptsSnap.data() as Record<string, string>)
    : {};
  cacheAt = Date.now();
}

export async function ensurePlatformCaches(): Promise<void> {
  if (
    llmCache &&
    quotasCache &&
    modelsCache &&
    promptsCache !== null &&
    Date.now() - cacheAt < TTL_MS
  )
    return;
  await refreshPlatformCaches();
}

export function getGeminiApiKey(): string {
  const key = llmCache?.gemini_api_key || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set. Add it via Admin Portal or functions/.env.");
  }
  return key;
}

export function getGeminiModel(): string {
  return llmCache?.gemini_model || process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

export function getGeminiFallbackModel(): string | undefined {
  const model = llmCache?.gemini_fallback_model || process.env.GEMINI_FALLBACK_MODEL;
  return model?.trim() || undefined;
}

export function getOpportunityUseGoogleSearch(): boolean {
  return process.env.OPPORTUNITY_USE_GOOGLE_SEARCH !== "false";
}

export function getKairllmBaseUrl(): string {
  const url = llmCache?.kairllm_base_url || process.env.KAIRLLM_BASE_URL || "https://ai.gogosling.ca/v1";
  return url.replace(/\/$/, "");
}

export function getKairllmApiKey(): string {
  const key = llmCache?.kairllm_api_key || process.env.KAIRLLM_API_KEY;
  if (!key) {
    throw new Error("KAIRLLM_API_KEY is not set. Add it via Admin Portal or functions/.env.");
  }
  return key;
}

export function getDeepseekBaseUrl(): string {
  const url = llmCache?.deepseek_base_url || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
  return url.replace(/\/$/, "");
}

export function getDeepseekApiKey(): string {
  const key = llmCache?.deepseek_api_key || process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error("DEEPSEEK_API_KEY is not set. Add it via Admin Portal or functions/.env.");
  }
  return key;
}

export function getQuotasConfig(): QuotasDoc {
  return quotasCache ?? {};
}

/**
 * Returns the active model registry.
 *
 * Priority: Firestore platform_config/models.models (non-empty array) → DEFAULT_MODELS.
 *
 * Import is lazy (bottom of file) to avoid a circular dependency:
 *   models.ts → platformConfig.ts → models.ts
 * Instead we accept the DEFAULT_MODELS array as a parameter, injected by models.ts.
 * The admin handlers call getModelRegistry() via the overload that passes no
 * argument; models.ts passes its own DEFAULT_MODELS at boot time.
 */
let _defaultModels: ModelEntry[] | null = null;

/** Called once by models.ts to register the DEFAULT_MODELS seed. */
export function registerDefaultModels(defaults: ModelEntry[]): void {
  _defaultModels = defaults;
}

/**
 * Returns the effective model registry (Firestore if non-empty, else defaults).
 * Requires ensurePlatformCaches() to have been called first (models.ts calls it
 * in resolveProvider; adminModels.ts calls it explicitly).
 */
export function getModelRegistry(): ModelEntry[] {
  const firestoreModels = modelsCache?.models;
  if (Array.isArray(firestoreModels) && firestoreModels.length > 0) {
    return firestoreModels;
  }
  return _defaultModels ?? [];
}

/** Admin-safe view: api_key and api_keys replaced with masked previews. */
export function getModelRegistryMasked(): ModelEntry[] {
  return getModelRegistry().map((m) => ({
    ...m,
    api_key: m.api_key ? maskSecret(m.api_key) : undefined,
    api_keys: m.api_keys?.length
      ? m.api_keys.map((k) => maskSecret(k))
      : undefined,
  }));
}

export interface MaskedLlmConfig {
  gemini_api_key_masked: string;
  kairllm_api_key_masked: string;
  gemini_model: string;
  gemini_fallback_model: string;
  kairllm_base_url: string;
  deepseek_api_key_masked: string;
  deepseek_base_url: string;
  updated_at?: string;
  updated_by?: string;
}

export async function getLlmConfigMasked(): Promise<MaskedLlmConfig> {
  await ensurePlatformCaches();
  const doc = llmCache ?? {};
  // SECURITY: never spread `doc` — it holds the RAW api keys.
  // Return only masked previews + non-secret fields so keys never reach the client.
  return {
    gemini_api_key_masked: maskSecret(doc.gemini_api_key || process.env.GEMINI_API_KEY),
    kairllm_api_key_masked: maskSecret(doc.kairllm_api_key || process.env.KAIRLLM_API_KEY),
    gemini_model: getGeminiModel(),
    gemini_fallback_model: getGeminiFallbackModel() ?? "",
    kairllm_base_url: getKairllmBaseUrl(),
    deepseek_api_key_masked: maskSecret(doc.deepseek_api_key || process.env.DEEPSEEK_API_KEY),
    deepseek_base_url: getDeepseekBaseUrl(),
    updated_at: doc.updated_at,
    updated_by: doc.updated_by,
  };
}

export async function getQuotasConfigForAdmin(): Promise<QuotasDoc> {
  await ensurePlatformCaches();
  return { ...quotasCache, enabled: quotasCache?.enabled !== false };
}

/**
 * Returns the Firestore override template for a prompt key (trimmed, non-empty),
 * or undefined if no override is stored.
 * Requires ensurePlatformCaches() to have run (called on every request by handlers).
 */
export function getPromptOverride(key: string): string | undefined {
  const raw = promptsCache?.[key];
  if (typeof raw === "string" && raw.trim() !== "") return raw;
  return undefined;
}

/**
 * Returns the entire prompts override map currently in cache.
 * Useful for the admin list-prompts callable.
 */
export function getAllPromptOverrides(): Record<string, string> {
  return promptsCache ?? {};
}
