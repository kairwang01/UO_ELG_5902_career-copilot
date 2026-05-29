/**
 * LLM Router — free-first cascade (Phase B stub).
 *
 * Phase A: always returns the GeminiProvider directly.
 *
 * Phase B (B4/B5): will implement the free-first cascade strategy:
 *   1. Attempt the cheapest free model (DeepSeek / Gemini Flash).
 *   2. Fall back to Gemini Pro only if the free tier is unavailable or
 *      the task complexity requires it.
 *
 * All handlers call getProvider() instead of instantiating a provider directly,
 * so the routing logic can be upgraded in Phase B without touching any handler.
 */

import { LLMProvider } from "./LLMProvider";
import { GeminiProvider } from "./providers/geminiProvider";

// TODO (Phase B — B4): add DeepSeekProvider and cascade logic here.

/**
 * Returns the appropriate LLM provider for the current request.
 * Currently always returns GeminiProvider (Phase A default).
 */
export function getProvider(): LLMProvider {
  return new GeminiProvider();
}
