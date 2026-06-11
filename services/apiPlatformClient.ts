/**
 * API Platform service layer — developer preview.
 *
 * Typed contract for the third-party API platform (PDF requirement: standard
 * external APIs so partners can call Career CoPilot features). The admin UI
 * talks ONLY to this interface, so swapping the mock for Cloud Functions is a
 * one-file change. Planned callables (server-side, not yet deployed):
 *   apiPlatformListApps / apiPlatformCreateApp / apiPlatformListKeys /
 *   apiPlatformCreateKey / apiPlatformRevokeKey / apiPlatformGetUsage /
 *   apiPlatformListRequests
 *
 * SECURITY CONTRACT (must hold when the real backend lands):
 *  - The raw secret is generated server-side, returned exactly once on create,
 *    and only a SHA-256 hash is stored (same pattern as functions/src key_health).
 *  - List responses carry `prefix` + masked tail only — never the secret.
 *  - Scopes are enforced server-side per request.
 *
 * Current implementation is an in-browser mock (localStorage) so the console
 * is fully demonstrable before the callables ship. The UI labels it "preview".
 */

import type { ApiKeyScope } from '../lib/access/permissions';

export interface ApiApplication {
  id: string;
  name: string;
  description: string;
  environment: 'development' | 'production';
  created_at: string;
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
  /** Full secret — shown exactly once, never persisted client-side. */
  secret: string;
}

// ─── mock backing store ───────────────────────────────────────────────────────

const STORE_KEY = 'api_platform_preview_v1';

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
    if (raw) return JSON.parse(raw) as MockStore;
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
  async listApps(): Promise<ApiApplication[]> {
    await simulateLatency();
    const store = loadStore();
    return store.apps.map((a) => ({
      ...a,
      key_count: store.keys.filter((k) => k.app_id === a.id && k.status !== 'revoked').length,
    }));
  },

  async createApp(input: { name: string; description: string; environment: 'development' | 'production' }): Promise<ApiApplication> {
    await simulateLatency();
    const store = loadStore();
    const app: ApiApplication = {
      id: `app_${randomHex(4)}`,
      name: input.name,
      description: input.description,
      environment: input.environment,
      created_at: new Date().toISOString(),
      key_count: 0,
    };
    store.apps.unshift(app);
    saveStore(store);
    return app;
  },

  async listKeys(): Promise<PlatformApiKey[]> {
    await simulateLatency();
    return loadStore().keys;
  },

  async createKey(input: {
    app_id: string;
    name: string;
    environment: 'development' | 'production';
    scopes: ApiKeyScope[];
  }): Promise<CreatedKeyResult> {
    await simulateLatency();
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
      created_at: new Date().toISOString(),
      last_used_at: null,
      rate_limit_per_min: 60,
      monthly_quota: 10000,
    };
    store.keys.unshift(key);
    saveStore(store);
    // Mock-only: real implementation generates this server-side and stores a hash.
    return { key, secret: `cc_${envTag}_${body}` };
  },

  async revokeKey(keyId: string): Promise<void> {
    await simulateLatency();
    const store = loadStore();
    const key = store.keys.find((k) => k.id === keyId);
    if (key) key.status = 'revoked';
    saveStore(store);
  },

  async setKeyStatus(keyId: string, status: 'active' | 'disabled'): Promise<void> {
    await simulateLatency();
    const store = loadStore();
    const key = store.keys.find((k) => k.id === keyId);
    if (key && key.status !== 'revoked') key.status = status;
    saveStore(store);
  },

  async getUsage(): Promise<ApiUsageSummary> {
    await simulateLatency();
    // Deterministic sample series — replaced by real aggregation server-side.
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

  async listRecentRequests(): Promise<ApiRequestLogEntry[]> {
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
