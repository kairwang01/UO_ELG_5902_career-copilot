import React, { useCallback, useEffect, useState } from 'react';
import { Card, EmptyState, FieldLabel, PrimaryButton, SectionHeading, tableCell, tableHead, tableRow, textInput } from './adminUi';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { API_KEY_SCOPES, type ApiKeyScope } from '../../lib/access/permissions';
import {
  apiPlatform,
  type ApiApplication,
  type ApiRequestLogEntry,
  type ApiUsageSummary,
  type PlatformApiKey,
} from '../../services/apiPlatformClient';

/**
 * API Platform tab — developer preview.
 *
 * Manages third-party applications and their scoped keys against the
 * apiPlatformClient service contract. Currently mock-backed (clearly labelled
 * in the banner); the UI is final so wiring the Cloud Functions later is a
 * service-layer swap only.
 */

const ENV_BADGE: Record<'development' | 'production', string> = {
  development: 'bg-blue-50 text-blue-700 border border-blue-100',
  production: 'bg-violet-50 text-violet-700 border border-violet-100',
};

const STATUS_BADGE: Record<PlatformApiKey['status'], string> = {
  active: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  disabled: 'bg-gray-100 text-gray-600 border border-gray-200',
  revoked: 'bg-red-50 text-red-700 border border-red-200',
};

const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10) : 'Never');

export const ApiPlatformPanel: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const [apps, setApps] = useState<ApiApplication[]>([]);
  const [keys, setKeys] = useState<PlatformApiKey[]>([]);
  const [usage, setUsage] = useState<ApiUsageSummary | null>(null);
  const [requests, setRequests] = useState<ApiRequestLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // create-app form
  const [showAppForm, setShowAppForm] = useState(false);
  const [appName, setAppName] = useState('');
  const [appDesc, setAppDesc] = useState('');
  const [appEnv, setAppEnv] = useState<'development' | 'production'>('development');
  const [creatingApp, setCreatingApp] = useState(false);

  // create-key modal
  const [keyModalApp, setKeyModalApp] = useState<ApiApplication | null>(null);
  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<ApiKeyScope[]>(['jobs.read']);
  const [creatingKey, setCreatingKey] = useState(false);
  // show-once secret modal
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [busyKeyId, setBusyKeyId] = useState<string | null>(null);

  useModalBehavior(() => setKeyModalApp(null), !!keyModalApp && !createdSecret);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [a, k, u, r] = await Promise.all([
        apiPlatform.listApps(),
        apiPlatform.listKeys(),
        apiPlatform.getUsage(),
        apiPlatform.listRecentRequests(),
      ]);
      setApps(a);
      setKeys(k);
      setUsage(u);
      setRequests(r);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createApp = async () => {
    if (!appName.trim()) return;
    setCreatingApp(true);
    try {
      await apiPlatform.createApp({ name: appName.trim(), description: appDesc.trim(), environment: appEnv });
      setAppName('');
      setAppDesc('');
      setShowAppForm(false);
      await load();
    } finally {
      setCreatingApp(false);
    }
  };

  const createKey = async () => {
    if (!keyModalApp || !keyName.trim() || keyScopes.length === 0) return;
    setCreatingKey(true);
    try {
      const result = await apiPlatform.createKey({
        app_id: keyModalApp.id,
        name: keyName.trim(),
        environment: keyModalApp.environment,
        scopes: keyScopes,
      });
      setCreatedSecret(result.secret);
      setSecretCopied(false);
      setKeyName('');
      await load();
    } finally {
      setCreatingKey(false);
    }
  };

  const closeSecretModal = () => {
    setCreatedSecret(null);
    setKeyModalApp(null);
  };

  const toggleScope = (scope: ApiKeyScope) => {
    setKeyScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);
  };

  const revokeKey = async (key: PlatformApiKey) => {
    if (!window.confirm(`Revoke "${key.name}" (${key.prefix}…)? Calls with this key stop working immediately. This cannot be undone.`)) return;
    setBusyKeyId(key.id);
    try { await apiPlatform.revokeKey(key.id); await load(); } finally { setBusyKeyId(null); }
  };

  const toggleKeyStatus = async (key: PlatformApiKey) => {
    setBusyKeyId(key.id);
    try {
      await apiPlatform.setKeyStatus(key.id, key.status === 'active' ? 'disabled' : 'active');
      await load();
    } finally { setBusyKeyId(null); }
  };

  if (loading && apps.length === 0) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label="Loading API platform">
        <span className="w-6 h-6 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-red-700">Could not load the API platform data.</p>
        <button type="button" onClick={load} className="mt-3 text-sm font-semibold text-blue-700 hover:underline">
          Retry
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview banner — honest about the mock backing */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <span className="mt-0.5 shrink-0" aria-hidden="true">ⓘ</span>
        <p>
          <span className="font-semibold">Developer preview.</span>{' '}
          The console below runs against a local sample service while the platform callables are
          finalized — keys created here are not yet honored by production endpoints. Secrets follow
          the final contract: generated once, hashed at rest, never shown again.
        </p>
      </div>

      {/* Usage summary */}
      {usage && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Requests this month', value: `${usage.month_requests.toLocaleString()} / ${usage.month_quota.toLocaleString()}` },
            { label: 'Errors this month', value: String(usage.month_errors) },
            { label: 'Applications', value: String(apps.length) },
            { label: 'Active keys', value: String(keys.filter((k) => k.status === 'active').length) },
          ].map((c) => (
            <Card key={c.label} className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{c.label}</p>
              <p className="mt-1.5 text-2xl font-semibold text-gray-900">{c.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Applications */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <SectionHeading>Applications</SectionHeading>
            <p className="mt-1 text-xs text-gray-500">
              An application groups the keys of one integration partner per environment.
            </p>
          </div>
          {canManage && (
            <PrimaryButton onClick={() => setShowAppForm((v) => !v)}>
              {showAppForm ? 'Cancel' : 'Create application'}
            </PrimaryButton>
          )}
        </div>

        {showAppForm && (
          <div className="mx-5 mb-4 rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3 animate-panel-expand">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="app-name">Name</FieldLabel>
                <input id="app-name" type="text" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="e.g. ITviec integration" className={textInput} />
              </div>
              <div>
                <FieldLabel htmlFor="app-env">Environment</FieldLabel>
                <select id="app-env" value={appEnv} onChange={(e) => setAppEnv(e.target.value as 'development' | 'production')} className={textInput}>
                  <option value="development">Development</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="app-desc">Description</FieldLabel>
              <input id="app-desc" type="text" value={appDesc} onChange={(e) => setAppDesc(e.target.value)} placeholder="What does this integration do?" className={textInput} />
            </div>
            <button
              type="button"
              onClick={createApp}
              disabled={creatingApp || !appName.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {creatingApp && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Create
            </button>
          </div>
        )}

        {apps.length === 0 ? (
          <EmptyState message="No applications yet. Create one to issue API keys." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-t border-gray-100">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className={tableHead}>Application</th>
                  <th className={tableHead}>Environment</th>
                  <th className={tableHead}>Keys</th>
                  <th className={tableHead}>Created</th>
                  {canManage && <th className={tableHead}></th>}
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <tr key={app.id} className={tableRow}>
                    <td className={tableCell}>
                      <span className="font-medium text-gray-900">{app.name}</span>
                      {app.description && <span className="block text-xs text-gray-500">{app.description}</span>}
                    </td>
                    <td className={tableCell}>
                      <span className={`inline-block text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${ENV_BADGE[app.environment]}`}>
                        {app.environment}
                      </span>
                    </td>
                    <td className={tableCell}>{app.key_count}</td>
                    <td className={`${tableCell} font-mono text-xs`}>{fmtDate(app.created_at)}</td>
                    {canManage && (
                      <td className={`${tableCell} text-right`}>
                        <button
                          type="button"
                          onClick={() => { setKeyModalApp(app); setKeyName(''); setKeyScopes(['jobs.read']); }}
                          className="text-sm font-semibold text-blue-700 hover:underline"
                        >
                          Issue key
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Keys */}
      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <SectionHeading>API keys</SectionHeading>
          <p className="mt-1 text-xs text-gray-500">
            Only the prefix is stored for display — full secrets are shown once at creation.
          </p>
        </div>
        {keys.length === 0 ? (
          <EmptyState message="No keys issued yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-t border-gray-100">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className={tableHead}>Name</th>
                  <th className={tableHead}>Key</th>
                  <th className={tableHead}>Scopes</th>
                  <th className={tableHead}>Status</th>
                  <th className={tableHead}>Last used</th>
                  {canManage && <th className={tableHead}></th>}
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} className={tableRow}>
                    <td className={tableCell}>
                      <span className="font-medium text-gray-900">{key.name}</span>
                      <span className="block text-[10px] text-gray-400">
                        {apps.find((a) => a.id === key.app_id)?.name ?? key.app_id}
                      </span>
                    </td>
                    <td className={`${tableCell} font-mono text-xs`}>{key.prefix}••••</td>
                    <td className={tableCell}>
                      <span className="flex flex-wrap gap-1">
                        {key.scopes.map((s) => (
                          <span key={s} className="inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{s}</span>
                        ))}
                      </span>
                    </td>
                    <td className={tableCell}>
                      <span className={`inline-block text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_BADGE[key.status]}`}>
                        {key.status}
                      </span>
                    </td>
                    <td className={`${tableCell} font-mono text-xs`}>{fmtDate(key.last_used_at)}</td>
                    {canManage && (
                      <td className={`${tableCell} text-right whitespace-nowrap`}>
                        {key.status !== 'revoked' && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleKeyStatus(key)}
                              disabled={busyKeyId === key.id}
                              className="text-sm font-semibold text-gray-600 hover:text-gray-900 hover:underline disabled:opacity-50 mr-3"
                            >
                              {key.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => revokeKey(key)}
                              disabled={busyKeyId === key.id}
                              className="text-sm font-semibold text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent requests + docs */}
      <div className="grid lg:grid-cols-[1.4fr_0.6fr] gap-4 items-start">
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <SectionHeading>Recent requests</SectionHeading>
            <p className="mt-1 text-xs text-gray-500">Sample feed — per-request logs land with the backend.</p>
          </div>
          {requests.length === 0 ? (
            <EmptyState message="No requests recorded." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-t border-gray-100">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className={tableHead}>Time</th>
                    <th className={tableHead}>Key</th>
                    <th className={tableHead}>Endpoint</th>
                    <th className={tableHead}>Status</th>
                    <th className={tableHead}>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className={tableRow}>
                      <td className={`${tableCell} font-mono text-xs whitespace-nowrap`}>{r.timestamp.slice(11, 16)}</td>
                      <td className={`${tableCell} font-mono text-xs`}>{r.key_prefix}</td>
                      <td className={`${tableCell} font-mono text-xs`}>{r.endpoint}</td>
                      <td className={tableCell}>
                        <span className={`font-mono text-xs font-semibold ${r.status < 400 ? 'text-emerald-700' : 'text-red-600'}`}>{r.status}</span>
                      </td>
                      <td className={`${tableCell} font-mono text-xs`}>{r.latency_ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading>Documentation</SectionHeading>
          <p className="mt-2 text-xs leading-relaxed text-gray-600">
            Endpoint reference and request examples live with the user-facing API docs.
            End users issue personal keys from Account → API Access; the applications on
            this page are for partner-level integrations.
          </p>
          <a
            href="/docs/api.md"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline"
          >
            Open API reference
          </a>
        </Card>
      </div>

      {/* Issue-key modal */}
      {keyModalApp && !createdSecret && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={() => setKeyModalApp(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <SectionHeading>Issue key — {keyModalApp.name}</SectionHeading>
            <div className="mt-4 space-y-4">
              <div>
                <FieldLabel htmlFor="new-key-name">Key name</FieldLabel>
                <input id="new-key-name" type="text" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Server-to-server" className={textInput} />
              </div>
              <div>
                <FieldLabel>Scopes</FieldLabel>
                <div className="space-y-2">
                  {API_KEY_SCOPES.map((scope) => (
                    <label key={scope.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keyScopes.includes(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <span className="block font-mono text-xs text-gray-800">{scope.id}</span>
                        <span className="block text-[11px] text-gray-500">{scope.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setKeyModalApp(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={createKey}
                disabled={creatingKey || !keyName.trim() || keyScopes.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {creatingKey && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Generate key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show-once secret modal */}
      {createdSecret && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <SectionHeading>Copy your new key</SectionHeading>
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This secret is shown once. After closing, only the prefix remains visible.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input readOnly value={createdSecret} className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800" />
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(createdSecret).then(() => setSecretCopied(true)).catch(() => {}); }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {secretCopied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <button
              type="button"
              onClick={closeSecretModal}
              className="mt-4 w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              I have stored this key
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
