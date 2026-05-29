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

/**
 * Returns the Gemini API key from the environment.
 * @throws Error if GEMINI_API_KEY is not set.
 */
export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. " +
        "For local dev: add it to functions/.env. " +
        "For production: store it in Firebase Secret Manager."
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
