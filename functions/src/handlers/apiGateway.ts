/**
 * Public API gateway — the *consumption* endpoint for the partner API keys minted
 * by the API Platform admin console (functions/src/handlers/apiPlatform.ts).
 *
 * The admin console could already create applications + scoped, hashed keys, but
 * nothing consumed them: `api_usage_logs` was read-only and `last_used_at` never
 * moved. This closes the loop. An external partner calls:
 *
 *   curl -H "Authorization: Bearer cc_live_xxx" https://<host>/publicApi/v1/jobs
 *
 * Per request the gateway: authenticates the Bearer secret by SHA-256 hash
 * (matching apiPlatform.ts `secretHash`), enforces the key's scope + per-minute
 * rate limit + monthly quota, runs the endpoint, then records usage
 * (`api_usage_logs` entry + `last_used_at`). Partner AI traffic routes through the
 * same `resolveProvider()` as first-party traffic (contract req #6), so tiering
 * and key pooling apply. No raw secret is ever stored or logged — only the prefix.
 *
 * Endpoints:
 *   GET  /v1/jobs            scope `jobs.read`      active job postings (no AI)
 *   POST /v1/resume/analyze  scope `resume.analyze` resume analysis via the LLM router
 */
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHash } from "crypto";
import { resolveProvider } from "../llm/models";
import { buildPrompt } from "../llm/prompts";
import { ANALYSIS_SCHEMA } from "./analyzeResume";
import { ensurePlatformCaches } from "../config/env";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const API_KEYS = "api_keys";
const API_USAGE_LOGS = "api_usage_logs";
const API_KEY_USAGE = "api_key_usage";

/** Mirrors apiPlatform.ts `secretHash` — keys are stored only as this hash. */
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isoOrNull(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === "string" ? value : null;
}

/** HTTP-shaped error so the router can map a thrown failure to a status + code. */
class GatewayError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
const fail = (statusCode: number, code: string, message: string) =>
  new GatewayError(statusCode, code, message);

interface AuthedKey {
  id: string;
  app_id: string;
  prefix: string;
  scopes: string[];
  status: string;
  rate_limit_per_min: number;
  monthly_quota: number;
  created_by: string;
  environment: string;
}

/** Resolve the Bearer secret to an active key, or throw 401/403. */
async function authenticate(authHeader: string): Promise<AuthedKey> {
  const match = /^Bearer\s+(.+)$/i.exec((authHeader || "").trim());
  if (!match) {
    throw fail(401, "missing_authorization", "Provide 'Authorization: Bearer <api_key>'.");
  }
  const secret = match[1].trim();
  const snap = await db.collection(API_KEYS).where("secret_hash", "==", sha256(secret)).limit(1).get();
  if (snap.empty) {
    throw fail(401, "invalid_key", "API key not recognized.");
  }
  const doc = snap.docs[0];
  const d = doc.data();
  if (d.status !== "active") {
    throw fail(403, "key_inactive", `This API key is ${d.status}.`);
  }
  return {
    id: doc.id,
    app_id: String(d.app_id ?? ""),
    prefix: String(d.prefix ?? ""),
    scopes: Array.isArray(d.scopes) ? (d.scopes as string[]) : [],
    status: String(d.status),
    rate_limit_per_min: Number(d.rate_limit_per_min ?? 60),
    monthly_quota: Number(d.monthly_quota ?? 10000),
    created_by: String(d.created_by ?? ""),
    environment: String(d.environment ?? "development"),
  };
}

function requireScope(key: AuthedKey, scope: string): void {
  if (!key.scopes.includes(scope)) {
    throw fail(403, "insufficient_scope", `This key is missing the required '${scope}' scope.`);
  }
}

/**
 * Atomically enforce + increment the per-minute rate limit and monthly quota.
 * Counters live in `api_key_usage/{keyId}` (separate from the key doc so auth
 * reads don't contend with usage writes). Window keys are derived from the clock,
 * so a new minute/month resets the relevant counter without a cleanup job.
 */
async function meterUsage(key: AuthedKey): Promise<void> {
  const now = new Date();
  const minuteKey = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const monthKey = now.toISOString().slice(0, 7); // YYYY-MM
  const ref = db.collection(API_KEY_USAGE).doc(key.id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const u = snap.exists ? snap.data() ?? {} : {};
    const minuteCount = u.minute_key === minuteKey ? Number(u.minute_count ?? 0) : 0;
    const monthCount = u.month_key === monthKey ? Number(u.month_count ?? 0) : 0;
    if (minuteCount >= key.rate_limit_per_min) {
      throw fail(429, "rate_limited", `Rate limit of ${key.rate_limit_per_min} requests/minute exceeded.`);
    }
    if (monthCount >= key.monthly_quota) {
      throw fail(429, "quota_exceeded", `Monthly quota of ${key.monthly_quota} requests exceeded.`);
    }
    tx.set(
      ref,
      {
        minute_key: minuteKey,
        minute_count: minuteCount + 1,
        month_key: monthKey,
        month_count: monthCount + 1,
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

/** Append an immutable usage entry + advance last_used_at. Key prefix only — never the secret. */
async function recordUsage(key: AuthedKey, endpoint: string, status: number, latencyMs: number): Promise<void> {
  const batch = db.batch();
  batch.set(db.collection(API_USAGE_LOGS).doc(), {
    timestamp: FieldValue.serverTimestamp(),
    key_prefix: key.prefix,
    key_id: key.id,
    app_id: key.app_id,
    endpoint,
    status,
    latency_ms: latencyMs,
  });
  batch.update(db.collection(API_KEYS).doc(key.id), { last_used_at: FieldValue.serverTimestamp() });
  await batch.commit();
}

// ── Endpoints ──────────────────────────────────────────────────────────────

/** GET /v1/jobs — active job postings. Public-safe fields only; no AI, no auth user. */
async function handleListJobs(key: AuthedKey): Promise<unknown> {
  requireScope(key, "jobs.read");
  // Equality-only filter (no composite index needed); sort + cap in memory.
  const snap = await db.collection("job_postings").where("is_active", "==", true).limit(100).get();
  const jobs = snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: String(d.title ?? ""),
        company_name: d.company_name ?? null,
        location: d.location ?? null,
        work_mode: d.work_mode ?? null,
        employment_type: d.employment_type ?? null,
        salary_range: d.salary_range ?? null,
        created_at: isoOrNull(d.created_at),
      };
    })
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 50);
  return { jobs, count: jobs.length };
}

/** POST /v1/resume/analyze — structured resume analysis through the LLM router. */
async function handleResumeAnalyze(key: AuthedKey, body: unknown): Promise<unknown> {
  requireScope(key, "resume.analyze");
  const payload = (body ?? {}) as Record<string, unknown>;
  const resumeText = typeof payload.resume_text === "string" ? payload.resume_text.trim() : "";
  const marketName =
    typeof payload.market === "string" && payload.market.trim() ? payload.market.trim() : "Canadian";
  if (!resumeText) {
    throw fail(400, "invalid_request", "Request body must include a non-empty 'resume_text'.");
  }
  if (resumeText.length > 50000) {
    throw fail(400, "invalid_request", "'resume_text' exceeds the 50000 character limit.");
  }
  await ensurePlatformCaches();
  const prompt = `${buildPrompt("handler_resume_analysis", { marketName })}\n\nResume:\n${resumeText}`;
  // Partner traffic routes via the owning admin's tier so pooling/tiering apply
  // (contract req #6); the gateway never reads provider keys directly.
  let provider;
  try {
    provider = await resolveProvider(key.created_by);
    const result = await provider.generate({ prompt, responseSchema: ANALYSIS_SCHEMA });
    return { analysis: result.raw };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/is not set|api_key/i.test(message)) {
      throw fail(503, "ai_unavailable", "AI provider is not configured. Try again later.");
    }
    throw fail(502, "ai_error", "The analysis provider failed. Please retry.");
  }
}

function endpointLabel(method: string, path: string): string {
  return `${method} ${path}`;
}

export const publicApiFunction = onRequest({ invoker: "public", cors: true }, async (req, res) => {
  const startedAt = Date.now();
  // Strip the function mount prefix and trailing slashes so routing is host-agnostic
  // (works behind both /publicApi/... and a rewrite at /api/...).
  const path = req.path.replace(/^\/+/, "/").replace(/\/+$/, "") || "/";
  const label = endpointLabel(req.method, path);
  let key: AuthedKey | null = null;
  try {
    key = await authenticate(req.get("authorization") ?? "");
    await meterUsage(key);

    let result: unknown;
    if (req.method === "GET" && /\/v1\/jobs$/.test(path)) {
      result = await handleListJobs(key);
    } else if (req.method === "POST" && /\/v1\/resume\/analyze$/.test(path)) {
      result = await handleResumeAnalyze(key, req.body);
    } else {
      throw fail(404, "not_found", `No endpoint matches ${req.method} ${path}.`);
    }

    await recordUsage(key, label, 200, Date.now() - startedAt);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    const statusCode = err instanceof GatewayError ? err.statusCode : 500;
    const code = err instanceof GatewayError ? err.code : "internal_error";
    const message = err instanceof GatewayError ? err.message : "An internal error occurred.";
    // Log usage even on failure (only once a key is authenticated) so partners can
    // see their error rate; pre-auth failures aren't attributable to a key.
    if (key) {
      try {
        await recordUsage(key, label, statusCode, Date.now() - startedAt);
      } catch {
        /* logging must never mask the original error */
      }
    }
    res.status(statusCode).json({ ok: false, error: { code, message } });
  }
});
