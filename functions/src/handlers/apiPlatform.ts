/**
 * API Platform admin callables.
 *
 * This replaces the previous in-browser mock with a real server-side registry:
 * applications, scoped keys, usage rollups, and immutable admin audit entries.
 * Partner API secrets are generated on the server, returned exactly once, and
 * stored only as SHA-256 hashes.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHash, randomBytes } from "crypto";
import { requireRole } from "../admin/roles";
import { logAdminAction } from "../admin/usageLog";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const API_APPLICATIONS = "api_applications";
const API_KEYS = "api_keys";
const API_USAGE_LOGS = "api_usage_logs";

const ALLOWED_ENVIRONMENTS = new Set(["development", "production"]);
const ALLOWED_STATUSES = new Set(["active", "disabled", "revoked"]);
const ALLOWED_SCOPES = new Set([
  "resume.analyze",
  "tools.generate",
  "jobs.read",
  "usage.read",
]);

type ApiEnvironment = "development" | "production";
type ApiKeyStatus = "active" | "disabled" | "revoked";

function str(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string") {
    if (!required) return "";
    throw new HttpsError("invalid-argument", `${label} must be a string.`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpsError("invalid-argument", `${label} is required.`);
  if (trimmed.length > max) {
    throw new HttpsError("invalid-argument", `${label} must be at most ${max} characters.`);
  }
  return trimmed;
}

function env(value: unknown): ApiEnvironment {
  const v = str(value, "environment", 20);
  if (!ALLOWED_ENVIRONMENTS.has(v)) {
    throw new HttpsError("invalid-argument", "environment must be development or production.");
  }
  return v as ApiEnvironment;
}

function status(value: unknown): ApiKeyStatus {
  const v = str(value, "status", 20);
  if (!ALLOWED_STATUSES.has(v)) {
    throw new HttpsError("invalid-argument", "status must be active, disabled, or revoked.");
  }
  return v as ApiKeyStatus;
}

function scopes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "scopes must be a non-empty array.");
  }
  const cleaned = [...new Set(value.map((v) => (typeof v === "string" ? v.trim() : "")))].filter(Boolean);
  if (cleaned.length === 0) throw new HttpsError("invalid-argument", "At least one scope is required.");
  if (cleaned.length > ALLOWED_SCOPES.size) throw new HttpsError("invalid-argument", "Too many scopes.");
  for (const scope of cleaned) {
    if (!ALLOWED_SCOPES.has(scope)) throw new HttpsError("invalid-argument", `Unsupported scope: ${scope}`);
  }
  return cleaned;
}

function iso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === "string" ? value : null;
}

function secretHash(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function createSecret(environment: ApiEnvironment): { secret: string; prefix: string } {
  const envTag = environment === "production" ? "live" : "dev";
  const body = randomBytes(24).toString("hex");
  return {
    secret: `cc_${envTag}_${body}`,
    prefix: `cc_${envTag}_${body.slice(0, 4)}`,
  };
}

function appView(id: string, data: admin.firestore.DocumentData, keyCount = 0) {
  return {
    id,
    name: data.name ?? "",
    description: data.description ?? "",
    environment: data.environment ?? "development",
    owner_org_id: data.owner_org_id ?? null,
    created_by: data.created_by ?? "",
    created_at: iso(data.created_at) ?? new Date(0).toISOString(),
    key_count: keyCount,
  };
}

function keyView(id: string, data: admin.firestore.DocumentData) {
  return {
    id,
    app_id: data.app_id ?? "",
    name: data.name ?? "",
    prefix: data.prefix ?? "",
    environment: data.environment ?? "development",
    scopes: Array.isArray(data.scopes) ? data.scopes : [],
    status: data.status ?? "disabled",
    created_by: data.created_by ?? "",
    created_at: iso(data.created_at) ?? new Date(0).toISOString(),
    last_used_at: iso(data.last_used_at),
    rate_limit_per_min: Number(data.rate_limit_per_min ?? 60),
    monthly_quota: Number(data.monthly_quota ?? 10000),
  };
}

async function listKeysSnapshot() {
  return db.collection(API_KEYS).orderBy("created_at", "desc").limit(500).get();
}

export async function apiPlatformListApplicationsImpl(uid: string, minRoleRequest: unknown = null) {
  void uid;
  void minRoleRequest;
  const [appsSnap, keysSnap] = await Promise.all([
    db.collection(API_APPLICATIONS).orderBy("created_at", "desc").limit(200).get(),
    listKeysSnapshot(),
  ]);
  const keyCounts = new Map<string, number>();
  keysSnap.forEach((doc) => {
    const data = doc.data();
    if (data.status === "revoked") return;
    const appId = typeof data.app_id === "string" ? data.app_id : "";
    if (!appId) return;
    keyCounts.set(appId, (keyCounts.get(appId) ?? 0) + 1);
  });
  return appsSnap.docs.map((doc) => appView(doc.id, doc.data(), keyCounts.get(doc.id) ?? 0));
}

export async function apiPlatformCreateApplicationImpl(uid: string, data: Record<string, unknown>) {
  const name = str(data.name, "name", 80);
  const description = str(data.description, "description", 240, false);
  const environment = env(data.environment);
  const ref = db.collection(API_APPLICATIONS).doc();
  const createdAt = new Date();
  await ref.set({
    name,
    description,
    environment,
    owner_org_id: null,
    created_by: uid,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });
  await logAdminAction({
    admin_uid: uid,
    action: "api_app_create",
    details: { app_id: ref.id, environment, name },
  });
  return {
    id: ref.id,
    name,
    description,
    environment,
    owner_org_id: null,
    created_by: uid,
    created_at: createdAt.toISOString(),
    key_count: 0,
  };
}

export async function apiPlatformListKeysImpl(uid: string) {
  void uid;
  const snap = await listKeysSnapshot();
  return snap.docs.map((doc) => keyView(doc.id, doc.data()));
}

export async function apiPlatformCreateKeyImpl(uid: string, data: Record<string, unknown>) {
  const appId = str(data.app_id, "app_id", 160);
  const name = str(data.name, "name", 80);
  const selectedScopes = scopes(data.scopes);

  const appSnap = await db.collection(API_APPLICATIONS).doc(appId).get();
  if (!appSnap.exists) throw new HttpsError("not-found", "Application not found.");
  const app = appSnap.data() ?? {};
  const environment = env(app.environment);
  const { secret, prefix } = createSecret(environment);
  const createdAt = new Date();
  const ref = db.collection(API_KEYS).doc();
  const payload = {
    app_id: appId,
    name,
    prefix,
    secret_hash: secretHash(secret),
    environment,
    scopes: selectedScopes,
    status: "active" as ApiKeyStatus,
    created_by: uid,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    last_used_at: null,
    rate_limit_per_min: 60,
    monthly_quota: 10000,
  };
  await ref.set(payload);
  await logAdminAction({
    admin_uid: uid,
    action: "api_key_create",
    details: { key_id: ref.id, app_id: appId, prefix, environment, scopes: selectedScopes },
  });
  return {
    key: {
      ...keyView(ref.id, { ...payload, created_at: Timestamp.fromDate(createdAt) }),
    },
    secret,
  };
}

export async function apiPlatformRevokeKeyImpl(uid: string, data: Record<string, unknown>) {
  const keyId = str(data.keyId, "keyId", 160);
  const ref = db.collection(API_KEYS).doc(keyId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Key not found.");
  const key = snap.data() ?? {};
  if (key.status === "revoked") return { ok: true };
  await ref.update({
    status: "revoked",
    revoked_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });
  await logAdminAction({
    admin_uid: uid,
    action: "api_key_revoke",
    details: { key_id: keyId, app_id: key.app_id ?? null, prefix: key.prefix ?? null },
  });
  return { ok: true };
}

export async function apiPlatformUpdateKeyStatusImpl(uid: string, data: Record<string, unknown>) {
  const keyId = str(data.keyId, "keyId", 160);
  const nextStatus = status(data.status);
  if (nextStatus === "revoked") {
    throw new HttpsError("invalid-argument", "Use revokeApiKey to revoke keys.");
  }
  const ref = db.collection(API_KEYS).doc(keyId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Key not found.");
  const key = snap.data() ?? {};
  if (key.status === "revoked") {
    throw new HttpsError("failed-precondition", "Revoked keys cannot be re-enabled.");
  }
  await ref.update({
    status: nextStatus,
    updated_at: FieldValue.serverTimestamp(),
  });
  await logAdminAction({
    admin_uid: uid,
    action: "api_key_status_change",
    details: { key_id: keyId, app_id: key.app_id ?? null, prefix: key.prefix ?? null, status: nextStatus },
  });
  return { ok: true };
}

export async function apiPlatformGetUsageImpl(uid: string) {
  void uid;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  weekStart.setUTCHours(0, 0, 0, 0);

  const [logsSnap, keysSnap] = await Promise.all([
    db.collection(API_USAGE_LOGS).where("timestamp", ">=", Timestamp.fromDate(monthStart)).limit(5000).get(),
    listKeysSnapshot(),
  ]);

  const daily = new Map<string, { date: string; requests: number; errors: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(weekStart.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    daily.set(key, { date: key, requests: 0, errors: 0 });
  }

  let monthRequests = 0;
  let monthErrors = 0;
  logsSnap.forEach((doc) => {
    const data = doc.data();
    monthRequests += 1;
    const httpStatus = Number(data.status ?? 0);
    if (httpStatus >= 400) monthErrors += 1;
    const ts = data.timestamp;
    const date = iso(ts)?.slice(0, 10);
    if (date && daily.has(date)) {
      const row = daily.get(date)!;
      row.requests += 1;
      if (httpStatus >= 400) row.errors += 1;
    }
  });

  let monthQuota = 0;
  keysSnap.forEach((doc) => {
    const data = doc.data();
    if (data.status === "active") monthQuota += Number(data.monthly_quota ?? 0);
  });

  return {
    month_requests: monthRequests,
    month_quota: monthQuota,
    month_errors: monthErrors,
    daily: Array.from(daily.values()),
  };
}

export async function apiPlatformListUsageLogsImpl(uid: string) {
  void uid;
  const snap = await db.collection(API_USAGE_LOGS).orderBy("timestamp", "desc").limit(50).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      timestamp: iso(data.timestamp) ?? new Date(0).toISOString(),
      key_prefix: data.key_prefix ?? "",
      endpoint: data.endpoint ?? "",
      status: Number(data.status ?? 0),
      latency_ms: Number(data.latency_ms ?? 0),
    };
  });
}

export const apiPlatformListApplicationsFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid } = await requireRole(request, "admin");
  return apiPlatformListApplicationsImpl(uid);
});

export const apiPlatformCreateApplicationFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid } = await requireRole(request, "super");
  return apiPlatformCreateApplicationImpl(uid, request.data ?? {});
});

export const apiPlatformListKeysFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid } = await requireRole(request, "admin");
  return apiPlatformListKeysImpl(uid);
});

export const apiPlatformCreateKeyFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid } = await requireRole(request, "super");
  return apiPlatformCreateKeyImpl(uid, request.data ?? {});
});

export const apiPlatformRevokeKeyFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid } = await requireRole(request, "super");
  return apiPlatformRevokeKeyImpl(uid, request.data ?? {});
});

export const apiPlatformUpdateKeyStatusFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid } = await requireRole(request, "super");
  return apiPlatformUpdateKeyStatusImpl(uid, request.data ?? {});
});

export const apiPlatformGetUsageFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid } = await requireRole(request, "admin");
  return apiPlatformGetUsageImpl(uid);
});

export const apiPlatformListUsageLogsFunction = onCall({ invoker: "public" }, async (request) => {
  const { uid } = await requireRole(request, "admin");
  return apiPlatformListUsageLogsImpl(uid);
});
