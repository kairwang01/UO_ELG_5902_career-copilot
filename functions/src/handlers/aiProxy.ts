/**
 * aiProxy — generic authenticated AI tool dispatcher (HTTPS Callable).
 *
 * One callable serves every "long-tail" AI tool (the ~30 operations registered in
 * llm/toolRegistry.ts). It consolidates the security-critical wrapper once:
 *   verify auth → resolve tool → deduct credits (server-side, atomic) → run the
 *   server-held-key LLM call → return the parsed result.
 *
 * The Gemini key never reaches the browser. Adding a new tool = one registry entry,
 * no new function and no new deploy target.
 *
 * Frontend integration (see services/aiClient.ts):
 *   const fn = httpsCallable(getFunctions(), "aiProxy");
 *   const { data } = await fn({ tool: "generateLearningPlan", payload: {...} });
 *   // → { data: <parsed result>, text, groundingChunks }
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAuth } from "../middleware/auth";
import { resolveProvider } from "../llm/models";
import { ensurePlatformCaches } from "../config/env";
import { deductCredits, refundCredits } from "../credits/deductCredits";
import { TOOL_CREDIT_COSTS } from "../credits/schema";
import { TOOL_REGISTRY } from "../llm/toolRegistry";

interface AiProxyRequest {
  tool: string;
  payload?: Record<string, unknown>;
  /** Optional model id (tier-gated server-side; ignored for free users). */
  model?: string;
}

// Reject oversized payloads before charging — bounds token cost and abuse.
const MAX_PAYLOAD_CHARS = 100_000;

/** Tolerant JSON extraction for tools that return free-text JSON (no responseSchema). */
function tryParseJson(str: string): unknown {
  const fence = str.match(/```json\s*([\s\S]*?)\s*```/);
  let s = (fence?.[1] ?? str).trim();
  const b = s.indexOf("{");
  const a = s.indexOf("[");
  const start = b === -1 ? a : a === -1 ? b : Math.min(a, b);
  if (start === -1) return undefined;
  s = s.substring(start);
  try {
    return JSON.parse(s);
  } catch {
    try {
      return JSON.parse(s.replace(/,(\s*[\]}])/g, "$1"));
    } catch {
      return undefined;
    }
  }
}

export const aiProxyFunction = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuth(request);

  const { tool, payload, model } = (request.data ?? {}) as AiProxyRequest;

  if (!tool || typeof tool !== "string") {
    throw new HttpsError("invalid-argument", "tool is required.");
  }

  const spec = TOOL_REGISTRY[tool];
  if (!spec) {
    throw new HttpsError("invalid-argument", `Unknown tool: ${tool}`);
  }

  if (JSON.stringify(payload ?? {}).length > MAX_PAYLOAD_CHARS) {
    throw new HttpsError("invalid-argument", "Request payload is too large.");
  }

  // Charge BEFORE the model call (atomic, server-side). Free helpers skip this.
  const cost = spec.creditKey ? TOOL_CREDIT_COSTS[spec.creditKey] : 0;
  if (spec.creditKey) {
    await deductCredits(uid, cost, spec.creditKey);
  }

  try {
    // Warm the platform-config cache so admin prompt overrides apply on this call
    // (spec.build reads getPromptOverride, which is otherwise cold on a fresh instance).
    await ensurePlatformCaches();
    const llmRequest = spec.build(payload ?? {});
    const provider = await resolveProvider(uid, model);
    const result = await provider.generate(llmRequest);

    const data = result.raw !== undefined ? result.raw : tryParseJson(result.text);

    return {
      data,
      text: result.text,
      groundingChunks: result.groundingChunks,
    };
  } catch (err) {
    // The model call failed AFTER charging — refund so users aren't billed for nothing.
    if (spec.creditKey) await refundCredits(uid, cost);
    throw err;
  }
});
