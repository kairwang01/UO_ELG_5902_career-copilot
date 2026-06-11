/**
 * API Platform service layer — developer preview.
 *
 * Stable client contract for the third-party API platform. The admin UI talks
 * ONLY to this interface, so swapping the mock for Cloud Functions is a
 * one-file change. The full backend contract (callable names, auth, storage,
 * audit requirements) is documented in
 * functions/src/handlers/apiPlatform.contract.md — keep both in sync.
 *
 * Method ↔ planned callable mapping:
 *   listApplications    → apiPlatformListApplications
 *   createApplication   → apiPlatformCreateApplication
 *   listApiKeys         → apiPlatformListKeys
 *   createApiKey        → apiPlatformCreateKey
 *   revokeApiKey        → apiPlatformRevokeKey
 *   updateApiKeyStatus  → apiPlatformUpdateKeyStatus
 *   getUsageSummary     → apiPlatformGetUsage
 *   listUsageLogs       → apiPlatformListUsageLogs
 *
 * Quota rules are per-key fields (rate_limit_per_min, monthly_quota) rather
 * than a separate collection — at this product's scale a dedicated quota-rule
 * engine would be overdesign. Webhooks are intentionally NOT in this contract
 * yet: no consumer exists, and an unreachable settings page would violate the
 * "no orphan surfaces" rule. Add them when a partner integration needs push
 * delivery.
 *
 * SECURITY CONTRACT (must hold when the real backend lands):
 *  - Secrets are generated server-side, returned exactly once on create, and
 *    only a SHA-256 hash is stored (same pattern as functions key_health).
 *  - List responses carry `prefix` + masked tail only — never the secret.
 *  - Scopes and quotas are enforced server-side on every request.
 *  - Every mutation lands in admin_audit_log (no raw secrets in details).
 *
 * ERROR CONTRACT: methods reject with Error whose message is user-safe. The
 * real implementation maps callable HttpsError codes 1:1 — 'permission-denied'
 * (missing admin permission), 'not-found', 'failed-precondition' (e.g. revoked
 * key), 'resource-exhausted' (quota). UI shows the message and never retries
 * mutations automatically.
 *
 * Current implementation is an in-browser mock (localStorage) so the console
 * is fully demonstrable before the callables ship. The UI labels it "preview".
 * The persisted mock shape mirrors the future Firestore docs — no
 * localStorage-only fields.
 */

import type { ApiKeyScope } from '../lib/access/permissions';

export interface ApiApplication {
  id: string;
  name: string;
  description: string;
  environment: 'development' | 'production';
  /** Owning organization (users/{uid} of the org admin). null = platform-owned. */
  owner_org_id: string | null;
  /** uid of the admin who created the application. Mock uses 'admin_preview'. */
  created_by: string;
  created_at: string;
  /** Derived server-side: active+disabled (not revoked) key count. */
  key_count: number;
}

export interface PlatformApiKey {
  id: string;
  app_id: string;
  name: string;
  /** Display prefix, e.g. "cc_dev_a1b2". The secret itself is never stored here. */
  prefix: string;
  environment: 'development' | 'production';
  scopes: ApiKeyScope[];
  status: 'active' | 'disabled' | 'revoked';
  created_by: string;
  created_at: string;
  last_used_at: string | null;
  rate_limit_per_min: number;
  monthly_quota: number;
}

export interface ApiUsageSummary {
  month_requests: number;
  month_quota: number;
  month_errors: number;
  daily: { date: string; requests: number; errors: number }[];
}

export interface ApiRequestLogEntry {
  id: string;
  timestamp: string;
  key_prefix: string;
  endpoint: string;
  status: number;
  latency_ms: number;
}

export interface CreatedKeyResult {
  key: PlatformApiKey;
  /** Full secret — returned exactly once, never persisted client-side. */
  secret: string;
}

// ─── mock backing store ───────────────────────────────────────────────────────

const STORE_KEY = 'api_platform_preview_v1';
const MOCK_ACTOR = 'admin_preview';

interface MockStore {
  apps: ApiApplication[];
  keys: PlatformApiKey[];
}

const SEED: MockStore = {
  apps: [
    {
      id: 'app_demo',
      name: 'Partner integration (sample)',
      description: 'Seeded sample application — replace once the backend callables are live.',
      environment: 'development',
      owner_org_id: null,
      created_by: MOCK_ACTOR,
      created_at: '2026-06-01T10:00:00.000Z',
      key_count: 1,
    },
  ],
  keys: [
    {
      id: 'key_demo',
      app_id: 'app_demo',
      name: 'Local testing',
      prefix: 'cc_dev_4f8a',
      environment: 'development',
      scopes: ['jobs.read', 'usage.read'],
      status: 'active',
      created_by: MOCK_ACTOR,
      created_at: '2026-06-01T10:05:00.000Z',
      last_used_at: '2026-06-10T08:12:00.000Z',
      rate_limit_per_min: 60,
      monthly_quota: 10000,
    },
  ],
};

const loadStore = (): MockStore => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockStore;
      // Schema guard: older preview stores predate owner/created_by — reseed
      // rather than carry localStorage-only shapes forward.
      if (parsed.apps?.every((a) => 'owner_org_id' in a && 'created_by' in a)) return parsed;
    }
  } catch { /* corrupt or unavailable — fall through to seed */ }
  return { apps: [...SEED.apps], keys: [...SEED.keys] };
};

const saveStore = (store: MockStore) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* ignore */ }
};

const randomHex = (bytes: number): string => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
};

/** Small async delay so loading states render the same as a network call. */
const simulateLatency = () => new Promise((r) => setTimeout(r, 250));

// ─── service interface ────────────────────────────────────────────────────────

export const apiPlatform = {
  /**
   * List integration applications.
   * Permission: admin.apiplatform.read. Org admins (future) see only their
   * owner_org_id scope; platform admins see all. Never returns secrets.
   */
  async listApplications(): Promise<ApiApplication[]> {
    await simulateLatency();
    const store = loadStore();
    return store.apps.map((a) => ({
      ...a,
      key_count: store.keys.filter((k) => k.app_id === a.id && k.status !== 'revoked').length,
    }));
  },

  /**
   * Create an application (no keys yet).
   * Permission: admin.apiplatform.manage. environment is fixed at creation —
   * keys inherit it and it cannot be changed later (dev/prod stay separated).
   */
  async createApplication(input: {
    name: string;
    description: string;
    environment: 'development' | 'production';
  }): Promise<ApiApplication> {
    await simulateLatency();
    const store = loadStore();
    const app: ApiApplication = {
      id: `app_${randomHex(4)}`,
      name: input.name,
      description: input.description,
      environment: input.environment,
      owner_org_id: null,
      created_by: MOCK_ACTOR,
      created_at: new Date().toISOString(),
      key_count: 0,
    };
    store.apps.unshift(app);
    saveStore(store);
    return app;
  },

  /**
   * List keys across applications (prefix + metadata only — never secrets).
   * Permission: admin.apiplatform.read.
   */
  async listApiKeys(): Promise<PlatformApiKey[]> {
    await simulateLatency();
    return loadStore().keys;
  },

  /**
   * Issue a key. Permission: admin.apiplatform.manage. scopes must be
   * non-empty (server rejects empty). environment is inherited from the app.
   * The returned secret appears ONLY here; afterwards every surface shows the
   * prefix. Real implementation: secret generated server-side, SHA-256 hash
   * stored, creation audit-logged with prefix only.
   */
  async createApiKey(input: {
    app_id: string;
    name: string;
    environment: 'development' | 'production';
    scopes: ApiKeyScope[];
  }): Promise<CreatedKeyResult> {
    await simulateLatency();
    if (input.scopes.length === 0) throw new Error('At least one scope is required.');
    const store = loadStore();
    const envTag = input.environment === 'production' ? 'live' : 'dev';
    const body = randomHex(24);
    const prefix = `cc_${envTag}_${body.slice(0, 4)}`;
    const key: PlatformApiKey = {
      id: `key_${randomHex(4)}`,
      app_id: input.app_id,
      name: input.name,
      prefix,
      environment: input.environment,
      scopes: input.scopes,
      status: 'active',
      created_by: MOCK_ACTOR,
      created_at: new Date().toISOString(),
      last_used_at: null,
      rate_limit_per_min: 60,
      monthly_quota: 10000,
    };
    store.keys.unshift(key);
    saveStore(store);
    // Mock-only transient secret: composed here, returned once, never stored.
    return { key, secret: `cc_${envTag}_${body}` };
  },

  /**
   * Permanently revoke a key. Permission: admin.apiplatform.manage.
   * Irreversible by contract — re-activation requires issuing a new key.
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await simulateLatency();
    const store = loadStore();
    const key = store.keys.find((k) => k.id === keyId);
    if (!key) throw new Error('Key not found.');
    key.status = 'revoked';
    saveStore(store);
  },

  /**
   * Toggle active/disabled. Permission: admin.apiplatform.manage.
   * Rejects on revoked keys (failed-precondition in the real backend).
   */
  async updateApiKeyStatus(keyId: string, status: 'active' | 'disabled'): Promise<void> {
    await simulateLatency();
    const store = loadStore();
    const key = store.keys.find((k) => k.id === keyId);
    if (!key) throw new Error('Key not found.');
    if (key.status === 'revoked') throw new Error('Revoked keys cannot be re-enabled.');
    key.status = status;
    saveStore(store);
  },

  /**
   * Month-to-date usage rollup. Permission: admin.apiplatform.read.
   * Mock returns a deterministic sample series (labelled in the UI banner).
   */
  async getUsageSummary(): Promise<ApiUsageSummary> {
    await simulateLatency();
    const daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const requests = [112, 167, 98, 203, 154, 189, 76][i];
      return { date: d.toISOString().slice(0, 10), requests, errors: i === 3 ? 4 : 0 };
    });
    return {
      month_requests: daily.reduce((s, d) => s + d.requests, 0),
      month_quota: 10000,
      month_errors: daily.reduce((s, d) => s + d.errors, 0),
      daily,
    };
  },

  /**
   * Recent per-request log entries (paginated server-side in the real
   * implementation). Permission: admin.apiplatform.read. Mock returns a
   * deterministic sample feed (labelled in the UI).
   */
  async listUsageLogs(): Promise<ApiRequestLogEntry[]> {
    await simulateLatency();
    const endpoints = ['/v1/resume/analyze', '/v1/jobs', '/v1/tools/cover-letter', '/v1/usage'];
    const statuses = [200, 200, 200, 200, 200, 429, 200, 401];
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date();
      d.setMinutes(d.getMinutes() - i * 47);
      return {
        id: `req_${i}`,
        timestamp: d.toISOString(),
        key_prefix: 'cc_dev_4f8a',
        endpoint: endpoints[i % endpoints.length],
        status: statuses[i],
        latency_ms: [310, 280, 1240, 190, 460, 95, 350, 88][i],
      };
    });
  },
};
