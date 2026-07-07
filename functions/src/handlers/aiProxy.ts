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
import {
  candidateAnalysisLanguageProtocol,
  employerAnalysisLanguageProtocol,
} from "../llm/languageProtocol";
import { correctiveInstruction } from "../llm/draftQuality";
import { meterToolRun, recordFreeToolRun, refundCredits } from "../credits/deductCredits";
import { TOOL_CREDIT_COSTS } from "../credits/schema";
import { TOOL_REGISTRY } from "../llm/toolRegistry";

interface AiProxyRequest {
  tool: string;
  payload?: Record<string, unknown>;
  /** Optional model id (tier-gated server-side; ignored for free users). */
  model?: string;
  /** Optional client-generated idempotency key. */
  requestId?: string;
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

function isQuotaError(error: unknown): boolean {
  const err = error as { code?: number | string; message?: string; status?: number };
  const message = (err?.message ?? "").toLowerCase();
  return (
    err?.status === 429 ||
    err?.code === 429 ||
    err?.code === "resource-exhausted" ||
    message.includes("resource_exhausted") ||
    message.includes("quota exceeded") ||
    message.includes("quota")
  );
}

function addNotice(data: unknown, notice: string | undefined): unknown {
  if (!notice || !data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  return { ...(data as Record<string, unknown>), notice };
}

// timeoutSeconds 180: free community routers (KairLLM auto) take 60-90s on the
// heaviest structured tools; the global 60s default 504'd them mid-generation.
// ---------------------------------------------------------------------------
// Central multilingual protocol
//
// Most registry tools have no dedicated language plumbing; the client sends
// its UI language as payload.outputLanguage and we append ONE shared protocol
// block per audience. Tools that already manage language themselves are
// skipped so instructions never conflict.
// ---------------------------------------------------------------------------

const EMPLOYER_TOOLS = new Set([
  "generateJobDescription",
  "analyzeSalary",
  "checkInclusivity",
  "formatJobDescription",
  "analyzeCandidateMatch",
  "anonymizeResume",
  "generateClientPitchEmail",
  "generateCandidatePrepKit",
  "generateOutreachEmail",
]);

const LANGUAGE_SELF_MANAGED_TOOLS = new Set([
  "convertResumeFormat", // outputLanguage is the tool's own core parameter
  "extractTalentProfile", // targetLanguage is the tool's own core parameter
]);

function languageBlockForTool(tool: string, payload: Record<string, unknown> | undefined): string {
  if (LANGUAGE_SELF_MANAGED_TOOLS.has(tool)) return "";
  const outputLanguage = typeof payload?.outputLanguage === "string" ? payload.outputLanguage : undefined;
  const marketName = typeof payload?.marketName === "string" ? payload.marketName : undefined;
  return EMPLOYER_TOOLS.has(tool)
    ? employerAnalysisLanguageProtocol({ outputLanguage })
    : candidateAnalysisLanguageProtocol({ outputLanguage, marketName });
}

export const aiProxyFunction = onCall({ invoker: "public", timeoutSeconds: 180 }, async (request) => {
  const uid = requireAuth(request);

  const { tool, payload, model, requestId } = (request.data ?? {}) as AiProxyRequest;

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

  // Charge BEFORE the model call (atomic, server-side).
  let cost = spec.creditKey ? TOOL_CREDIT_COSTS[spec.creditKey] : 0;
  let charged = false;
  if (spec.creditKey) {
    const deduction = await meterToolRun(uid, spec.creditKey, cost, { requestId });
    if (deduction.duplicate) {
      throw new HttpsError("already-exists", "This AI request was already submitted. Please wait for the current result.");
    }
    cost = deduction.creditCost;
    charged = deduction.charged;
  } else {
    // Free helper: no credit charge, but still enforce the free-tier daily run cap
    // and record the run (credit_cost 0) so every AI call is metered — closes the
    // unbounded free-LLM faucet where creditKey:null tools bypassed all quotas.
    const run = await recordFreeToolRun(uid, tool, { requestId });
    if (run.duplicate) {
      throw new HttpsError("already-exists", "This AI request was already submitted. Please wait for the current result.");
    }
  }

  try {
    // Warm the platform-config cache so admin prompt overrides apply on this call
    // (spec.build reads getPromptOverride, which is otherwise cold on a fresh instance).
    await ensurePlatformCaches();
    const llmRequest = spec.build(payload ?? {});
    const languageBlock = languageBlockForTool(tool, payload ?? {});
    if (languageBlock) llmRequest.prompt = `${llmRequest.prompt}\n\n${languageBlock}`;
    const provider = await resolveProvider(uid, model, tool);
    let notice: string | undefined;
    let result;

    try {
      result = await provider.generate(llmRequest);
    } catch (err) {
      if (!spec.quotaFallback || !isQuotaError(err)) {
        throw err;
      }
      const fallbackRequest = spec.quotaFallback(payload ?? {});
      if (languageBlock) fallbackRequest.prompt = `${fallbackRequest.prompt}\n\n${languageBlock}`;
      result = await provider.generate(fallbackRequest);
      notice = spec.quotaFallbackNotice;
    }

    // Internal second-pass review (ToolSpec.qualityCheck): when the parsed
    // draft would trip the client's export gate, retry ONCE with a corrective
    // instruction inside the same charged call. Users get a finished draft on
    // the first click instead of "Fix this draft before exporting".
    if (spec.qualityCheck) {
      const firstParsed = result.raw !== undefined ? result.raw : tryParseJson(result.text);
      const issues = spec.qualityCheck(firstParsed);
      if (issues.length > 0) {
        console.warn(`[aiProxy] ${tool} draft failed review (${issues.join(",")}) — retrying once`);
        try {
          const retryRequest = {
            ...llmRequest,
            prompt: `${llmRequest.prompt}\n\n${correctiveInstruction(issues)}`,
          };
          const retryResult = await provider.generate(retryRequest);
          const retryParsed = retryResult.raw !== undefined ? retryResult.raw : tryParseJson(retryResult.text);
          if (spec.qualityCheck(retryParsed).length < issues.length) {
            result = retryResult;
          }
        } catch {
          // Retry is best-effort — keep the first draft; the client gate
          // remains the final safety net.
        }
      }
    }

    const data = addNotice(
      result.raw !== undefined ? result.raw : tryParseJson(result.text),
      notice
    );

    return {
      data,
      text: result.text,
      groundingChunks: result.groundingChunks,
    };
  } catch (err) {
    // The model call failed AFTER charging — refund so users aren't billed for nothing.
    if (spec.creditKey && charged) await refundCredits(uid, cost);
    if (err instanceof HttpsError) throw err;
    // A plain Error thrown to the callable layer reaches the client as a blank
    // "INTERNAL" with no message (live audit: every tool failure looked identical
    // and undiagnosable). Surface the provider's message — they are key-free by
    // construction (RotatingKeyProvider/FallbackProvider never include secrets).
    const msg = err instanceof Error && err.message ? err.message : "AI generation failed. Please try again.";
    throw new HttpsError("unavailable", msg);
  }
});
