/**
 * Model registry + tier-gated provider resolution.
 *
 * This is the single place that decides WHICH llm a request runs on. Gating is
 * enforced SERVER-SIDE: a free user (or any request for a model above the user's
 * tier) silently falls back to the default — the client cannot override it.
 *
 * To add a provider later (Qwen / DeepSeek / GPT / a user's custom endpoint):
 * add a row to MODEL_OPTIONS and a branch in buildProvider(). Nothing else changes.
 */

import * as admin from "firebase-admin";
import { LLMProvider } from "./LLMProvider";
import { GeminiProvider } from "./providers/geminiProvider";
import { OpenAICompatibleProvider } from "./providers/openAICompatibleProvider";
import { getKairllmApiKey, getKairllmBaseUrl } from "../config/env";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/** Access tiers, derived from the user's subscription_status. */
export type Tier = "free" | "paid" | "premium";

export interface ModelOption {
  /** Selection id the client sends (and the picker shows). */
  id: string;
  /** Human-readable label for the picker. */
  label: string;
  /** Backing provider implementation. */
  provider: "gemini" | "kairllm";
  /** Model name passed to the provider ("" = provider default). */
  providerModel: string;
  /** Minimum tier allowed to select this model. */
  minTier: Tier;
}

/**
 * THE registry. Today only Gemini (free default) + the KAIRLLM "auto" gateway
 * (paid). Add qwen/deepseek/gpt rows here to expose them; set minTier to gate.
 */
export const MODEL_OPTIONS: ModelOption[] = [
  { id: "gemini", label: "Gemini (default)",            provider: "gemini",  providerModel: "",     minTier: "free" },
  { id: "auto",   label: "Auto · multi-model (beta)",   provider: "kairllm", providerModel: "auto", minTier: "paid" },
];

export const DEFAULT_MODEL_ID = "gemini";

const TIER_RANK: Record<Tier, number> = { free: 0, paid: 1, premium: 2 };

/** Maps a subscription_status string to an access tier. */
export function tierFromSubscription(status: string | undefined): Tier {
  switch (status) {
    case "essentials":
    case "accelerator":
      return "paid";
    case "executive":
      return "premium";
    default:
      return "free"; // free, pending_*, business plans, unknown
  }
}

/** The models a given tier is allowed to select (for the frontend picker). */
export function modelsForTier(tier: Tier): ModelOption[] {
  return MODEL_OPTIONS.filter((m) => TIER_RANK[m.minTier] <= TIER_RANK[tier]);
}

function buildProvider(option: ModelOption): LLMProvider {
  if (option.provider === "kairllm") {
    return new OpenAICompatibleProvider({
      name: "kairllm",
      baseUrl: getKairllmBaseUrl(),
      apiKey: getKairllmApiKey(),
      model: option.providerModel || "auto",
    });
  }
  return new GeminiProvider();
}

/**
 * Resolves the provider for a user + requested model, enforcing tier gating.
 * Reads users/{uid}.subscription_status to determine the tier.
 *
 * Reserved for premium: a per-user custom provider (users/{uid}.custom_provider =
 * { baseUrl, apiKey, model }) would be resolved here into an OpenAICompatibleProvider.
 * The interface is intentionally left in place; it is NOT enabled yet.
 */
export async function resolveProvider(uid: string, requestedModelId?: string): Promise<LLMProvider> {
  let tier: Tier = "free";
  try {
    const snap = await db.collection(USERS_COLLECTION).doc(uid).get();
    tier = tierFromSubscription(snap.get(USER_FIELDS.subscriptionStatus) as string | undefined);
  } catch {
    tier = "free"; // fail safe to the free default
  }

  const allowed = modelsForTier(tier);
  const chosen =
    allowed.find((m) => m.id === requestedModelId) ??
    allowed.find((m) => m.id === DEFAULT_MODEL_ID) ??
    MODEL_OPTIONS[0];

  return buildProvider(chosen);
}
