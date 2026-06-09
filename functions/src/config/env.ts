/**
 * Typed access to environment variables and Firebase config.
 *
 * Rules:
 * - All secrets come from functions/.env (local dev) or Firebase Secret Manager (production).
 * - Never read process.env directly outside of this file.
 * - If a required variable is missing, throw immediately at startup — fail fast.
 *
 * Secrets / config list (keep this up to date for the Secret Manager migration):
 *   GEMINI_API_KEY      — Gemini API key (Phase A)
 *   GEMINI_MODEL        — Gemini model name; controls free vs paid tier without code changes
 *   DEEPSEEK_API_KEY    — 2nd model provider (Phase B — not yet wired)
 *   DEEPSEEK_MODEL      — DeepSeek model name (Phase B — not yet wired)
 *   STRIPE_SECRET_KEY   — Stripe payments (Phase C — not yet wired)
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook verification (Phase C — not yet wired)
 */

import { defineSecret } from "firebase-functions/params";

/**
 * GEMINI_API_KEY as a Gen-2 secret. Handlers that reach the LLM must declare this
 * in their onCall({ secrets: [GEMINI_API_KEY] }, ...) options so the runtime binds
 * it from Secret Manager. Provision once before deploy:
 *   firebase functions:secrets:set GEMINI_API_KEY
 */
export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

/**
 * Returns the Gemini API key.
 *
 * Order of resolution:
 *   1. process.env.GEMINI_API_KEY — set by the emulator from functions/.env (local dev),
 *      and also populated by the runtime when the secret is bound.
 *   2. GEMINI_API_KEY.value() — the bound Secret Manager value (production).
 *
 * @throws Error if neither source has a value.
 */
export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY || GEMINI_API_KEY.value();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. " +
        "For local dev: add it to functions/.env. " +
        "For production: run `firebase functions:secrets:set GEMINI_API_KEY`."
    );
  }
  return key;
}

/**
 * Returns the Gemini model name from the environment.
 *
 * This lets you switch between free and paid models without touching code:
 *   - Free-tier local dev:  GEMINI_MODEL=gemini-2.0-flash     (default)
 *   - Paid-tier testing:    GEMINI_MODEL=gemini-3-pro-preview
 *   - Production:           set in Firebase Secret Manager
 *
 * To switch: edit functions/.env and restart the emulator. No code change needed.
 */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
}

/**
 * KAIRLLM — an OpenAI-compatible multi-provider gateway (the "auto" model picks
 * the best backing model). Used as a selectable provider for paid+ users; the key
 * stays server-side (functions/.env locally, Secret Manager in prod).
 *   firebase functions:secrets:set KAIRLLM_API_KEY
 */
export const KAIRLLM_API_KEY = defineSecret("KAIRLLM_API_KEY");

/** Base URL for the KAIRLLM OpenAI-compatible API (no trailing slash). */
export function getKairllmBaseUrl(): string {
  return (process.env.KAIRLLM_BASE_URL ?? "https://ai.gogosling.ca/v1").replace(/\/$/, "");
}

/**
 * Returns the KAIRLLM API key (process.env from functions/.env locally, or the
 * bound Secret Manager value in prod). Throws if neither is set.
 */
export function getKairllmApiKey(): string {
  const key = process.env.KAIRLLM_API_KEY || KAIRLLM_API_KEY.value();
  if (!key) {
    throw new Error(
      "KAIRLLM_API_KEY is not set. Local dev: add it to functions/.env. " +
        "Production: run `firebase functions:secrets:set KAIRLLM_API_KEY`."
    );
  }
  return key;
}
