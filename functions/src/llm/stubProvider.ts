/**
 * Deterministic LLM stub for E2E tests (SCRUM-42).
 *
 * Activated ONLY when E2E_LLM_STUB=true (set by the Playwright/emulator harness),
 * so it can never run in production. resolveProvider() short-circuits to this before
 * any real provider/key work, so a happy-path tool run returns instantly, for free,
 * with schema-valid output instead of calling Gemini/KAIRLLM.
 */
import type { LLMProvider, LLMRequest, LLMResult } from "./LLMProvider";

export function llmStubEnabled(): boolean {
  return process.env.E2E_LLM_STUB === "true";
}

/**
 * Synthesizes a minimal value that satisfies a Gemini responseSchema node, so the
 * stub works for ANY tool's schema (object/array/string/number/boolean), not just one.
 */
function synthFromSchema(schema: unknown, key = "value"): unknown {
  if (!schema || typeof schema !== "object") return `Sample ${key}`;
  const node = schema as { type?: string; properties?: Record<string, unknown>; items?: unknown };
  const type = String(node.type ?? "").toUpperCase();
  if (type === "OBJECT" || node.properties) {
    const out: Record<string, unknown> = {};
    const props = node.properties ?? {};
    for (const k of Object.keys(props)) out[k] = synthFromSchema(props[k], k);
    return out;
  }
  if (type === "ARRAY" || node.items) {
    return [synthFromSchema(node.items, key)];
  }
  if (type === "NUMBER" || type === "INTEGER") return 75;
  if (type === "BOOLEAN") return true;
  return `Sample ${key}`;
}

class StubProvider implements LLMProvider {
  readonly name = "e2e-stub";

  async generate(req: LLMRequest): Promise<LLMResult> {
    const raw = req.responseSchema ? synthFromSchema(req.responseSchema) : undefined;
    const text = raw ? JSON.stringify(raw) : "Sample stubbed response for E2E.";
    return { text, raw: raw ?? text, model: "e2e-stub" };
  }
}

export function makeStubProvider(): LLMProvider {
  return new StubProvider();
}
