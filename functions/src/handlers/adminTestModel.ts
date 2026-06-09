/**
 * adminTestModel — admin callable that performs a real minimal LLM round-trip
 * to confirm a model/key is working.
 *
 * Security invariants:
 *   - requireAdmin is called first — unauthenticated or non-admin callers get
 *     unauthenticated / permission-denied before any key is touched.
 *   - The raw api_key is NEVER returned in the response, logged in the audit
 *     trail, or included in error messages (scrubbed via scrubKey()).
 *   - The test prompt is tiny (cost-bounded: ~5 input tokens, ~2 output tokens).
 *   - A 15-second Promise.race timeout prevents hanging on dead endpoints.
 *   - Returns { ok: false, error } on failure — never throws — so the UI always
 *     gets a structured response rather than an opaque Functions error.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAdmin } from "../middleware/auth";
import { ensurePlatformCaches } from "../admin/platformConfig";
import { getModelRegistry } from "../admin/platformConfig";
import { buildProvider } from "../llm/models";
import { logAdminAction } from "../admin/usageLog";
import { ModelEntry } from "../admin/schema";

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

/**
 * Ad-hoc config the admin can pass to test a key they have NOT yet saved.
 * Mirrors the fields of ModelEntry that buildProvider() actually reads.
 */
interface AdHocConfig {
  provider: "gemini" | "openai-compatible";
  /** Required (https) for openai-compatible without a builtin. */
  base_url?: string;
  /** The api_key to test. Treated as write-only — never echoed back. */
  api_key?: string;
  /** Inherit platform-configured key+base for this builtin gateway. */
  builtin?: "kairllm" | "deepseek";
  /** Model name passed to the provider. Defaults to "" (provider default). */
  providerModel?: string;
}

/**
 * Request shape accepted by adminTestModel.
 *
 * Exactly ONE of `id` or `config` must be present:
 *   { id: string }           — test a model already in the registry by id
 *   { config: AdHocConfig }  — test an ad-hoc config (e.g. a key the admin just typed)
 */
interface TestModelRequest {
  id?: string;
  config?: AdHocConfig;
}

/** Success response. */
interface TestModelOk {
  ok: true;
  text: string;      // first 300 chars of the model's reply
  latencyMs: number;
}

/** Failure response (never throws — always returns this shape on error). */
interface TestModelFail {
  ok: false;
  error: string;     // scrubbed — never contains the raw api_key
}

type TestModelResponse = TestModelOk | TestModelFail;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PROVIDERS = new Set<AdHocConfig["provider"]>(["gemini", "openai-compatible"]);
const VALID_BUILTINS = new Set(["kairllm", "deepseek"]);

/**
 * Replaces every occurrence of a non-empty secret string in `message` with
 * "[REDACTED]" so api_keys never leak through error text.
 */
function scrubKey(message: string, apiKey: string | undefined): string {
  if (!apiKey) return message;
  // Escape regex metacharacters in the key before using it as a pattern.
  const escaped = apiKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return message.replace(new RegExp(escaped, "g"), "[REDACTED]");
}

/** 15-second hard timeout so a dead endpoint doesn't hang the function. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM test timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const adminTestModelFunction = onCall({ invoker: "public" }, async (request): Promise<TestModelResponse> => {
  // ── 1. Auth gate ──────────────────────────────────────────────────────────
  const adminUid = await requireAdmin(request);

  // ── 2. Warm platform config caches (needed for builtin key getters) ───────
  await ensurePlatformCaches();

  const data = (request.data ?? {}) as TestModelRequest;

  // ── 3. Resolve the ModelEntry to build a provider from ───────────────────
  let entry: ModelEntry;
  let idOrProvider: string; // for audit log — never the key
  let rawApiKey: string | undefined; // held only for scrubbing errors

  if (typeof data.id === "string" && data.id.trim()) {
    // ── 3a. Registry lookup path ─────────────────────────────────────────
    const id = data.id.trim();
    const registry = getModelRegistry();
    const found = registry.find((m) => m.id === id);
    if (!found) {
      throw new HttpsError("invalid-argument", `Model "${id}" not found in the registry.`);
    }
    if (found.id === "custom") {
      // The "custom" sentinel is a BYOA entry stored per-user — it is not
      // testable from here (no uid context). Reject explicitly.
      throw new HttpsError(
        "invalid-argument",
        'The "custom" model is a per-user BYOA sentinel and cannot be tested via this endpoint.'
      );
    }
    entry = found;
    idOrProvider = id;
    rawApiKey = found.api_key; // may be undefined (builtin resolves it at buildProvider time)
  } else if (data.config && typeof data.config === "object") {
    // ── 3b. Ad-hoc config path ───────────────────────────────────────────
    const cfg = data.config;

    if (!VALID_PROVIDERS.has(cfg.provider)) {
      throw new HttpsError(
        "invalid-argument",
        `config.provider must be "gemini" or "openai-compatible".`
      );
    }

    if (cfg.provider === "openai-compatible") {
      const hasBuiltin = cfg.builtin && VALID_BUILTINS.has(cfg.builtin);
      if (!hasBuiltin) {
        // Without a builtin, an explicit base_url (https) + api_key are required.
        if (!cfg.base_url || !cfg.base_url.startsWith("https://")) {
          throw new HttpsError(
            "invalid-argument",
            "config.base_url (starting with https://) is required for openai-compatible without a builtin."
          );
        }
        if (!cfg.api_key) {
          throw new HttpsError(
            "invalid-argument",
            "config.api_key is required for openai-compatible without a builtin."
          );
        }
      }
    }

    // Coerce into a ModelEntry-shaped object so buildProvider() can consume it.
    entry = {
      id: "test",
      label: "test",
      provider: cfg.provider,
      providerModel: cfg.providerModel ?? "",
      minTier: "free",
      enabled: true,
      ...(cfg.builtin ? { builtin: cfg.builtin as ModelEntry["builtin"] } : {}),
      ...(cfg.base_url ? { base_url: cfg.base_url } : {}),
      ...(cfg.api_key ? { api_key: cfg.api_key } : {}),
    };
    idOrProvider = cfg.provider + (cfg.builtin ? `/${cfg.builtin}` : "");
    rawApiKey = cfg.api_key;
  } else {
    throw new HttpsError(
      "invalid-argument",
      'Provide either { id: string } to test a registry model or { config: {...} } for an ad-hoc test.'
    );
  }

  // ── 4. Build the provider (reuses all key/base resolution from models.ts) ─
  const provider = buildProvider(entry);

  // ── 5. Minimal generation with timeout ───────────────────────────────────
  const startMs = Date.now();
  let ok = false;
  let responseText = "";
  let errorMessage = "";
  let latencyMs = 0;

  try {
    const result = await withTimeout(
      provider.generate({ prompt: "Reply with exactly the word: OK" }),
      15_000
    );
    latencyMs = Date.now() - startMs;
    ok = true;
    // Truncate to 300 chars — never return more than needed.
    responseText = (result.text ?? "").slice(0, 300);
  } catch (err: unknown) {
    latencyMs = Date.now() - startMs;
    const raw = err instanceof Error ? err.message : String(err);
    // SECURITY: scrub any occurrence of the raw api_key from the error message.
    errorMessage = scrubKey(raw, rawApiKey);
  }

  // ── 6. Audit log ──────────────────────────────────────────────────────────
  // NEVER log: api_key, responseText (could contain sensitive echo), raw errors.
  await logAdminAction({
    admin_uid: adminUid,
    action: "test_model",
    details: {
      id_or_provider: idOrProvider,
      ok,
      latencyMs,
      // error_present omitted when ok=true to keep audit rows tidy
      ...(ok ? {} : { error_present: true }),
    },
  });

  // ── 7. Return structured response (never throws past this point) ──────────
  if (ok) {
    return { ok: true, text: responseText, latencyMs };
  }
  return { ok: false, error: errorMessage };
});
