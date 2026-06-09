import React, { useCallback, useEffect, useState } from 'react';
import { data } from '@/lib/data';
import AdminSignIn from './AdminSignIn';
import { AdminAccessDenied, AdminVerifying } from './AdminAccessGate';
import AdminShell from './AdminShell';
import {
  ActionBadge,
  AuditDetails,
  Card,
  EmptyState,
  FieldLabel,
  PlanBadge,
  SaveButton,
  SectionHeading,
  textInput,
} from './adminUi';
import {
  adminAdjustCredits,
  adminCheckAccess,
  adminDeleteModel,
  adminGetAuditLog,
  adminGetDashboard,
  adminGetLlmConfig,
  adminGetPrompts,
  adminGetQuotas,
  adminGetUserReport,
  adminListAdmins,
  adminListModels,
  adminListUsers,
  adminResetPrompt,
  adminSetAdmin,
  adminSetSubscription,
  adminTestModel,
  adminUpdateLlmConfig,
  adminUpdatePrompt,
  adminUpdateQuotas,
  adminUpsertModel,
  SUBSCRIPTION_PLANS,
  type AdminDashboard,
  type AdminRow,
  type AdminUserRow,
  type AuditLogEntry,
  type ModelEntry,
  type PromptEntry,
  type TestModelResult,
} from '../../services/adminClient';

type Tab = 'dashboard' | 'ai' | 'prompts' | 'quotas' | 'users' | 'admins' | 'audit';

/** Per-key/model test result: key is a provider slug ('gemini'|'kairllm'|'deepseek') or a model id. */
type TestStatus = { state: 'idle' } | { state: 'running' } | ({ state: 'done' } & TestModelResult);

// ─── main component ────────────────────────────────────────────────────────

const AdminPortal: React.FC = () => {
  const [session, setSession] = useState<Awaited<ReturnType<typeof data.auth.getSession>>>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // per-tab data
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [llm, setLlm] = useState<Record<string, string>>({});
  const [quotas, setQuotas] = useState<Record<string, number | boolean>>({});
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userCursor, setUserCursor] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [userReport, setUserReport] = useState<Record<string, unknown> | null>(null);
  const [subStatus, setSubStatus] = useState('');
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [newAdmin, setNewAdmin] = useState('');
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);

  // test-connection status: keyed by 'gemini'|'kairllm'|'deepseek' or model id
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});

  const setTest = (key: string, status: TestStatus) =>
    setTestStatus((prev) => ({ ...prev, [key]: status }));

  // models tab
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  // null = list view; 'new' = blank add form; ModelEntry = edit form
  const [modelForm, setModelForm] = useState<ModelEntry | 'new' | null>(null);
  const [modelSaving, setModelSaving] = useState(false);

  // prompts tab
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [promptsLoaded, setPromptsLoaded] = useState(false);
  const [promptSearch, setPromptSearch] = useState('');
  const [expandedPromptKey, setExpandedPromptKey] = useState<string | null>(null);
  // per-row draft text (only kept for the currently-expanded row)
  const [promptDraft, setPromptDraft] = useState('');
  // per-row inline feedback: key → { ok: string } | { err: string }
  const [promptFeedback, setPromptFeedback] = useState<Record<string, { ok?: string; err?: string }>>({});
  const [promptSaving, setPromptSaving] = useState(false);

  // model form fields (controlled separately so we don't mutate ModelEntry directly)
  const [mfId, setMfId] = useState('');
  const [mfLabel, setMfLabel] = useState('');
  const [mfProvider, setMfProvider] = useState<ModelEntry['provider']>('gemini');
  const [mfBuiltin, setMfBuiltin] = useState<ModelEntry['builtin'] | ''>('');
  const [mfBaseUrl, setMfBaseUrl] = useState('');
  const [mfApiKey, setMfApiKey] = useState('');
  const [mfProviderModel, setMfProviderModel] = useState('');
  const [mfMinTier, setMfMinTier] = useState<ModelEntry['minTier']>('free');
  const [mfEnabled, setMfEnabled] = useState(true);

  // LLM form fields
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [geminiFallbackModel, setGeminiFallbackModel] = useState('');
  const [kairllmKey, setKairllmKey] = useState('');
  const [kairllmUrl, setKairllmUrl] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [deepseekUrl, setDeepseekUrl] = useState('');

  const [creditDelta, setCreditDelta] = useState('100');

  useEffect(() => {
    data.auth.getSession().then(setSession);
    const { unsubscribe } = data.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    adminCheckAccess()
      .then((r) => setIsAdmin(r.admin))
      .catch(() => setIsAdmin(false));
  }, [session]);

  // ── data loaders ──────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await adminGetDashboard());
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLlm = useCallback(async () => {
    setError(null);
    try {
      const cfg = await adminGetLlmConfig();
      setLlm(cfg);
      setGeminiModel(cfg.gemini_model ?? '');
      setGeminiFallbackModel(cfg.gemini_fallback_model ?? '');
      setKairllmUrl(cfg.kairllm_base_url ?? '');
      setDeepseekUrl(cfg.deepseek_base_url ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load LLM config');
    }
  }, []);

  const loadQuotas = useCallback(async () => {
    setError(null);
    try {
      setQuotas(await adminGetQuotas());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quotas');
    }
  }, []);

  // cursor-as-argument (NOT closed over userCursor) keeps this callback []-stable,
  // so the loader effect below doesn't re-fire when userCursor changes (would loop).
  const loadUsers = useCallback(
    async (cursor?: string) => {
      setError(null);
      try {
        const res = await adminListUsers(50, cursor);
        setUsers((prev) => (cursor ? [...prev, ...res.users] : res.users));
        setUserCursor(res.next_cursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load users');
      }
    },
    [],
  );

  const loadAdmins = useCallback(async () => {
    setError(null);
    try {
      const res = await adminListAdmins();
      setAdmins(res.admins);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admins');
    }
  }, []);

  const loadAuditLog = useCallback(async () => {
    setError(null);
    setAuditLoaded(false);
    try {
      const res = await adminGetAuditLog();
      setAuditLog(res.entries);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setAuditLoaded(true);
    }
  }, []);

  const loadModels = useCallback(async () => {
    setError(null);
    setModelsLoaded(false);
    try {
      const res = await adminListModels();
      setModels(res.models);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load models');
    } finally {
      setModelsLoaded(true);
    }
  }, []);

  const loadPrompts = useCallback(async () => {
    setError(null);
    setPromptsLoaded(false);
    try {
      const res = await adminGetPrompts();
      setPrompts(res.prompts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prompts');
    } finally {
      setPromptsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'ai') { loadLlm(); loadModels(); }
    if (tab === 'prompts') loadPrompts();
    if (tab === 'quotas') loadQuotas();
    if (tab === 'users') {
      loadUsers();
      loadAdmins();
    }
    if (tab === 'admins') loadAdmins();
    if (tab === 'audit') loadAuditLog();
  }, [isAdmin, tab, loadDashboard, loadLlm, loadModels, loadPrompts, loadQuotas, loadUsers, loadAdmins, loadAuditLog]);

  // ── mutators ──────────────────────────────────────────────────────────────

  const saveLlm = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await adminUpdateLlmConfig({
        gemini_api_key: geminiKey || undefined,
        gemini_model: geminiModel || undefined,
        gemini_fallback_model: geminiFallbackModel || undefined,
        kairllm_api_key: kairllmKey || undefined,
        kairllm_base_url: kairllmUrl || undefined,
        deepseek_api_key: deepseekKey || undefined,
        deepseek_base_url: deepseekUrl || undefined,
      });
      setLlm(updated);
      setGeminiKey('');
      setKairllmKey('');
      setDeepseekKey('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const saveQuotas = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await adminUpdateQuotas({
        daily_tool_run_limit: Number(quotas.daily_tool_run_limit ?? 0),
        daily_credit_spend_limit: Number(quotas.daily_credit_spend_limit ?? 0),
        per_user_daily_credit_limit: Number(quotas.per_user_daily_credit_limit ?? 0),
        enabled: quotas.enabled !== false,
      });
      setQuotas(updated as Record<string, number | boolean>);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const openUser = async (uid: string) => {
    setError(null);
    setSelectedUid(uid);
    try {
      const report = await adminGetUserReport(uid);
      setUserReport(report);
      const profile = (report as { profile?: { subscription_status?: string } }).profile;
      setSubStatus(profile?.subscription_status ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user report');
    }
  };

  const adjustCredits = async () => {
    if (!selectedUid) return;
    const delta = Number(creditDelta);
    if (!Number.isFinite(delta) || delta === 0) return;
    setError(null);
    try {
      await adminAdjustCredits(selectedUid, delta, 'admin_portal');
      setUserReport(await adminGetUserReport(selectedUid));
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to adjust credits');
    }
  };

  const applySubscription = async () => {
    if (!selectedUid || !subStatus) return;
    setError(null);
    try {
      await adminSetSubscription(selectedUid, subStatus);
      setUserReport(await adminGetUserReport(selectedUid));
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set subscription');
    }
  };

  const selectedIsAdmin = !!selectedUid && admins.some((a) => a.uid === selectedUid);

  const toggleSelectedAdmin = async () => {
    if (!selectedUid) return;
    setError(null);
    try {
      await adminSetAdmin({ uid: selectedUid, makeAdmin: !selectedIsAdmin });
      await loadAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update admin access');
    }
  };

  const addAdmin = async () => {
    const value = newAdmin.trim();
    if (!value) return;
    setError(null);
    try {
      await adminSetAdmin(
        value.includes('@') ? { email: value, makeAdmin: true } : { uid: value, makeAdmin: true },
      );
      setNewAdmin('');
      await loadAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add admin');
    }
  };

  const revokeAdmin = async (uid: string) => {
    setError(null);
    try {
      await adminSetAdmin({ uid, makeAdmin: false });
      await loadAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke admin');
    }
  };

  /** Open the add/edit form, seeding controlled fields from entry (or blank for new). */
  const openModelForm = (entry: ModelEntry | 'new') => {
    if (entry === 'new') {
      setMfId('');
      setMfLabel('');
      setMfProvider('gemini');
      setMfBuiltin('');
      setMfBaseUrl('');
      setMfApiKey('');
      setMfProviderModel('');
      setMfMinTier('free');
      setMfEnabled(true);
    } else {
      setMfId(entry.id);
      setMfLabel(entry.label);
      setMfProvider(entry.provider);
      setMfBuiltin(entry.builtin ?? '');
      setMfBaseUrl(entry.base_url ?? '');
      setMfApiKey(''); // never pre-fill — masked value is display-only
      setMfProviderModel(entry.providerModel);
      setMfMinTier(entry.minTier);
      setMfEnabled(entry.enabled);
    }
    setModelForm(entry);
  };

  const saveModel = async () => {
    const id = mfId.trim();
    const label = mfLabel.trim();
    const baseUrl = mfBaseUrl.trim();

    // client-side validation
    if (!id) { setError('Model id is required.'); return; }
    if (!label) { setError('Display label is required.'); return; }
    if (
      mfProvider === 'openai-compatible' &&
      !mfBuiltin &&
      (!baseUrl || !baseUrl.startsWith('https://'))
    ) {
      setError('Base URL must start with https:// for openai-compatible models without a builtin.');
      return;
    }

    const entry: ModelEntry = {
      id,
      label,
      provider: mfProvider,
      ...(mfBuiltin ? { builtin: mfBuiltin as ModelEntry['builtin'] } : {}),
      ...(baseUrl ? { base_url: baseUrl } : {}),
      // send api_key only if non-empty; empty = keep existing
      ...(mfApiKey ? { api_key: mfApiKey } : {}),
      providerModel: mfProviderModel.trim(),
      minTier: mfMinTier,
      enabled: mfEnabled,
    };

    setModelSaving(true);
    setError(null);
    try {
      const res = await adminUpsertModel(entry);
      setModels(res.models);
      setModelForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save model');
    } finally {
      setModelSaving(false);
    }
  };

  const deleteModel = async (id: string) => {
    if (!window.confirm(`Delete model "${id}"? This cannot be undone.`)) return;
    setError(null);
    try {
      const res = await adminDeleteModel(id);
      setModels(res.models);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete model');
    }
  };

  // ── auth gates ────────────────────────────────────────────────────────────

  if (!session) {
    return <AdminSignIn />;
  }

  if (isAdmin === null) {
    return <AdminVerifying />;
  }

  if (!isAdmin) {
    return <AdminAccessDenied />;
  }

  // ── tab definitions ───────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'ai', label: 'Models & Keys' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'quotas', label: 'Quotas' },
    { id: 'users', label: 'Users' },
    { id: 'admins', label: 'Admins' },
    { id: 'audit', label: 'Audit Log' },
  ];

  const refreshForTab = () => {
    if (tab === 'dashboard') loadDashboard();
    else if (tab === 'ai') { loadLlm(); loadModels(); }
    else if (tab === 'prompts') loadPrompts();
    else if (tab === 'quotas') loadQuotas();
    else if (tab === 'users') loadUsers();
    else if (tab === 'admins') loadAdmins();
    else if (tab === 'audit') loadAuditLog();
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <AdminShell
      activeTab={tab}
      tabs={tabs}
      onTabChange={(id) => setTab(id as Tab)}
      userEmail={session.user.email}
      lastRefreshed={lastRefreshed}
      loading={loading}
      onRefresh={refreshForTab}
      onSignOut={() => data.auth.signOut()}
    >
        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm"
          >
            <span className="mt-0.5 text-red-600 shrink-0">✕</span>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800 transition-colors shrink-0"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <>
            {!dashboard && !loading && (
              <EmptyState message="No dashboard data available yet." />
            )}

            {dashboard && (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total users', value: String(dashboard.user_count) },
                    { label: 'Runs today', value: String(dashboard.today_runs) },
                    { label: 'Credits today', value: String(dashboard.today_credits) },
                    {
                      label: 'Quotas',
                      value: dashboard.quotas?.enabled === false ? 'Off' : 'Enforced',
                      accent: dashboard.quotas?.enabled === false ? 'text-amber-400' : 'text-emerald-700',
                    },
                  ].map((c) => (
                    <Card key={c.label} className="p-5">
                      <p className="text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                        {c.label}
                      </p>
                      <p className={`text-2xl font-bold mt-1.5 tabular-nums ${c.accent ?? ''}`}>
                        {c.value}
                      </p>
                    </Card>
                  ))}
                </div>

                {(dashboard.users_truncated || dashboard.week_usage_truncated) && (
                  <p className="text-xs text-amber-700 flex items-center gap-1.5">
                    <span>⚠</span>
                    Showing partial data
                    {dashboard.users_truncated ? ' · user count capped at 2,000' : ''}
                    {dashboard.week_usage_truncated ? ' · usage aggregates capped at 5,000 events' : ''}
                  </p>
                )}

                {/* 7-day breakdown */}
                <Card>
                  <div className="px-5 py-4 border-b border-gray-200">
                    <SectionHeading>7-day usage by tool</SectionHeading>
                  </div>
                  <div className="overflow-x-auto">
                    {Object.keys(dashboard.week_tool_breakdown).length === 0 ? (
                      <EmptyState message="No tool usage recorded in the past 7 days." />
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b border-gray-200">
                            <th className="px-5 py-3 text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                              Tool
                            </th>
                            <th className="px-5 py-3 text-[11px] font-medium tracking-wide text-gray-500 uppercase text-right">
                              Runs
                            </th>
                            <th className="px-5 py-3 text-[11px] font-medium tracking-wide text-gray-500 uppercase text-right">
                              Credits
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {Object.entries(dashboard.week_tool_breakdown).map(
                            ([tool, stats]: [string, { runs: number; credits: number }]) => (
                              <tr key={tool} className="hover:bg-gray-50 transition-colors">
                                <td className="px-5 py-3 font-mono text-xs text-gray-700">{tool}</td>
                                <td className="px-5 py-3 text-right tabular-nums">{stats.runs}</td>
                                <td className="px-5 py-3 text-right tabular-nums text-gray-600">
                                  {stats.credits}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </Card>

                {/* Recent events */}
                <Card>
                  <div className="px-5 py-4 border-b border-gray-200">
                    <SectionHeading>Recent events</SectionHeading>
                  </div>
                  <div className="p-4">
                    {dashboard.recent_events.length === 0 ? (
                      <EmptyState message="No recent events." />
                    ) : (
                      <ul className="text-[11px] font-mono space-y-1 text-gray-600 max-h-52 overflow-y-auto">
                        {dashboard.recent_events.map((ev) => (
                          <li
                            key={String(ev.id)}
                            className="flex gap-2 py-0.5 border-b border-gray-200/40 last:border-0"
                          >
                            <span className="text-gray-500 shrink-0">
                              {String(ev.created_at).slice(0, 19).replace('T', ' ')}
                            </span>
                            <span className="text-gray-500 shrink-0">
                              {String(ev.uid).slice(0, 8)}…
                            </span>
                            <span className="text-blue-600 shrink-0">{String(ev.tool)}</span>
                            <span className="ml-auto text-gray-500">{String(ev.credit_cost)} cr</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              </>
            )}
          </>
        )}

        {/* ── MODELS & KEYS (merged) ────────────────────────────────── */}
        {tab === 'ai' && (
          <div className="space-y-8">

            {/* ══ SECTION A: PROVIDER CREDENTIALS ══════════════════════════ */}
            <div>
              <div className="mb-4">
                <SectionHeading>Provider credentials</SectionHeading>
                <p className="mt-1 text-xs text-gray-500">
                  Rotate keys, update endpoints, and verify live connectivity before saving.
                  Raw keys are never echoed — only masked previews are shown.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">

                {/* ── Gemini ─────────────────────────────────────────────── */}
                {(() => {
                  const ts = testStatus['gemini'] ?? { state: 'idle' };
                  const runTest = async () => {
                    setTest('gemini', { state: 'running' });
                    try {
                      const res = await adminTestModel({
                        config: {
                          provider: 'gemini',
                          // pass typed key only if the admin has entered one
                          ...(geminiKey ? { api_key: geminiKey } : {}),
                        },
                      });
                      setTest('gemini', { state: 'done', ...res });
                    } catch (e) {
                      setTest('gemini', { state: 'done', ok: false, error: e instanceof Error ? e.message : 'Test failed' });
                    }
                  };
                  return (
                    <Card className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <SectionHeading>Gemini</SectionHeading>
                        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-medium">
                          free tier
                        </span>
                      </div>

                      {/* Masked current key */}
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 shrink-0">
                          Active key
                        </span>
                        <span className="font-mono text-xs text-gray-700 truncate flex-1">
                          {llm.gemini_api_key_masked || <em className="not-italic text-gray-400">not set</em>}
                        </span>
                      </div>

                      {/* Rotate key */}
                      <div>
                        <FieldLabel htmlFor="gemini-key">New API key</FieldLabel>
                        <input
                          id="gemini-key"
                          type="password"
                          value={geminiKey}
                          onChange={(e) => { setGeminiKey(e.target.value); setTest('gemini', { state: 'idle' }); }}
                          placeholder="AIza… (leave blank to keep current)"
                          className={textInput}
                          autoComplete="off"
                        />
                      </div>

                      {/* Model name */}
                      <div>
                        <FieldLabel htmlFor="gemini-model">Model</FieldLabel>
                        <input
                          id="gemini-model"
                          value={geminiModel}
                          onChange={(e) => setGeminiModel(e.target.value)}
                          placeholder="gemini-2.0-flash"
                          className={textInput}
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="gemini-fallback-model">Fallback model</FieldLabel>
                        <input
                          id="gemini-fallback-model"
                          value={geminiFallbackModel}
                          onChange={(e) => setGeminiFallbackModel(e.target.value)}
                          placeholder="gemini-flash-latest"
                          className={textInput}
                        />
                      </div>

                      {/* Test + Save row */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          disabled={ts.state === 'running'}
                          onClick={runTest}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ts.state === 'running' ? (
                            <span className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                          ) : (
                            <span aria-hidden="true">⚡</span>
                          )}
                          Test connection
                        </button>
                        <SaveButton
                          onClick={async () => {
                            setLoading(true); setError(null);
                            try {
                              const updated = await adminUpdateLlmConfig({
                                gemini_api_key: geminiKey || undefined,
                                gemini_model: geminiModel || undefined,
                                gemini_fallback_model: geminiFallbackModel || undefined,
                              });
                              setLlm(updated); setGeminiKey('');
                            } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
                            finally { setLoading(false); }
                          }}
                          loading={loading}
                          label="Save"
                        />
                      </div>

                      {/* Inline test result */}
                      {ts.state === 'done' && (
                        <div className={`rounded-md px-3 py-2 text-xs flex flex-col gap-0.5 ${ts.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                          <span className="font-medium">
                            {ts.ok ? `✓ Connected` : `✗ Failed`}
                            {ts.ok && ts.latencyMs !== undefined ? ` · ${ts.latencyMs}ms` : ''}
                          </span>
                          {ts.ok && ts.text && (
                            <span className="text-emerald-700 font-mono text-[11px] truncate" title={ts.text}>
                              reply: {ts.text}
                            </span>
                          )}
                          {!ts.ok && ts.error && (
                            <span className="text-red-700 font-mono text-[11px] break-all">{ts.error}</span>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })()}

                {/* ── KairLLM ────────────────────────────────────────────── */}
                {(() => {
                  const ts = testStatus['kairllm'] ?? { state: 'idle' };
                  const runTest = async () => {
                    setTest('kairllm', { state: 'running' });
                    try {
                      const res = await adminTestModel({
                        config: {
                          provider: 'openai-compatible',
                          builtin: 'kairllm',
                          ...(kairllmKey ? { api_key: kairllmKey } : {}),
                          ...(kairllmUrl ? { base_url: kairllmUrl } : {}),
                        },
                      });
                      setTest('kairllm', { state: 'done', ...res });
                    } catch (e) {
                      setTest('kairllm', { state: 'done', ok: false, error: e instanceof Error ? e.message : 'Test failed' });
                    }
                  };
                  return (
                    <Card className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <SectionHeading>KairLLM</SectionHeading>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded font-medium">
                          paid tier
                        </span>
                      </div>

                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 shrink-0">
                          Active key
                        </span>
                        <span className="font-mono text-xs text-gray-700 truncate flex-1">
                          {llm.kairllm_api_key_masked || <em className="not-italic text-gray-400">not set</em>}
                        </span>
                      </div>

                      <div>
                        <FieldLabel htmlFor="kairllm-key">New API key</FieldLabel>
                        <input
                          id="kairllm-key"
                          type="password"
                          value={kairllmKey}
                          onChange={(e) => { setKairllmKey(e.target.value); setTest('kairllm', { state: 'idle' }); }}
                          placeholder="leave blank to keep current"
                          className={textInput}
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="kairllm-url">Base URL</FieldLabel>
                        <input
                          id="kairllm-url"
                          value={kairllmUrl}
                          onChange={(e) => setKairllmUrl(e.target.value)}
                          placeholder="https://ai.gogosling.ca/v1"
                          className={textInput}
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          disabled={ts.state === 'running'}
                          onClick={runTest}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ts.state === 'running' ? (
                            <span className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                          ) : (
                            <span aria-hidden="true">⚡</span>
                          )}
                          Test connection
                        </button>
                        <SaveButton
                          onClick={async () => {
                            setLoading(true); setError(null);
                            try {
                              const updated = await adminUpdateLlmConfig({
                                kairllm_api_key: kairllmKey || undefined,
                                kairllm_base_url: kairllmUrl || undefined,
                              });
                              setLlm(updated); setKairllmKey('');
                            } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
                            finally { setLoading(false); }
                          }}
                          loading={loading}
                          label="Save"
                        />
                      </div>

                      {ts.state === 'done' && (
                        <div className={`rounded-md px-3 py-2 text-xs flex flex-col gap-0.5 ${ts.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                          <span className="font-medium">
                            {ts.ok ? `✓ Connected` : `✗ Failed`}
                            {ts.ok && ts.latencyMs !== undefined ? ` · ${ts.latencyMs}ms` : ''}
                          </span>
                          {ts.ok && ts.text && (
                            <span className="text-emerald-700 font-mono text-[11px] truncate" title={ts.text}>
                              reply: {ts.text}
                            </span>
                          )}
                          {!ts.ok && ts.error && (
                            <span className="text-red-700 font-mono text-[11px] break-all">{ts.error}</span>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })()}

                {/* ── DeepSeek ───────────────────────────────────────────── */}
                {(() => {
                  const ts = testStatus['deepseek'] ?? { state: 'idle' };
                  const runTest = async () => {
                    setTest('deepseek', { state: 'running' });
                    try {
                      const res = await adminTestModel({
                        config: {
                          provider: 'openai-compatible',
                          builtin: 'deepseek',
                          ...(deepseekKey ? { api_key: deepseekKey } : {}),
                          ...(deepseekUrl ? { base_url: deepseekUrl } : {}),
                        },
                      });
                      setTest('deepseek', { state: 'done', ...res });
                    } catch (e) {
                      setTest('deepseek', { state: 'done', ok: false, error: e instanceof Error ? e.message : 'Test failed' });
                    }
                  };
                  return (
                    <Card className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <SectionHeading>DeepSeek</SectionHeading>
                        <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded font-medium">
                          business tier
                        </span>
                      </div>

                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 shrink-0">
                          Active key
                        </span>
                        <span className="font-mono text-xs text-gray-700 truncate flex-1">
                          {llm.deepseek_api_key_masked || <em className="not-italic text-gray-400">not set</em>}
                        </span>
                      </div>

                      <div>
                        <FieldLabel htmlFor="deepseek-key">New API key</FieldLabel>
                        <input
                          id="deepseek-key"
                          type="password"
                          value={deepseekKey}
                          onChange={(e) => { setDeepseekKey(e.target.value); setTest('deepseek', { state: 'idle' }); }}
                          placeholder="leave blank to keep current"
                          className={textInput}
                          autoComplete="off"
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="deepseek-url">Base URL</FieldLabel>
                        <input
                          id="deepseek-url"
                          value={deepseekUrl}
                          onChange={(e) => setDeepseekUrl(e.target.value)}
                          placeholder="https://api.deepseek.com/v1"
                          className={textInput}
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          disabled={ts.state === 'running'}
                          onClick={runTest}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ts.state === 'running' ? (
                            <span className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                          ) : (
                            <span aria-hidden="true">⚡</span>
                          )}
                          Test connection
                        </button>
                        <SaveButton
                          onClick={async () => {
                            setLoading(true); setError(null);
                            try {
                              const updated = await adminUpdateLlmConfig({
                                deepseek_api_key: deepseekKey || undefined,
                                deepseek_base_url: deepseekUrl || undefined,
                              });
                              setLlm(updated); setDeepseekKey('');
                            } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
                            finally { setLoading(false); }
                          }}
                          loading={loading}
                          label="Save"
                        />
                      </div>

                      {ts.state === 'done' && (
                        <div className={`rounded-md px-3 py-2 text-xs flex flex-col gap-0.5 ${ts.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                          <span className="font-medium">
                            {ts.ok ? `✓ Connected` : `✗ Failed`}
                            {ts.ok && ts.latencyMs !== undefined ? ` · ${ts.latencyMs}ms` : ''}
                          </span>
                          {ts.ok && ts.text && (
                            <span className="text-emerald-700 font-mono text-[11px] truncate" title={ts.text}>
                              reply: {ts.text}
                            </span>
                          )}
                          {!ts.ok && ts.error && (
                            <span className="text-red-700 font-mono text-[11px] break-all">{ts.error}</span>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })()}

              </div>

              {llm.updated_at && (
                <p className="mt-3 text-xs text-gray-400">
                  Last saved {new Date(llm.updated_at).toLocaleString()} by{' '}
                  <span className="font-mono">{llm.updated_by?.slice(0, 8)}…</span>
                </p>
              )}
            </div>

            {/* ══ SECTION B: MODEL REGISTRY ══════════════════════════════ */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <SectionHeading>Model registry</SectionHeading>
                  <p className="mt-1 text-xs text-gray-500">
                    Changes propagate to every user's model picker within ~60 seconds.
                  </p>
                </div>
                {modelForm === null && (
                  <button
                    type="button"
                    onClick={() => openModelForm('new')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                  >
                    <span className="text-base leading-none">+</span>
                    Add model
                  </button>
                )}
              </div>

              {/* ── ADD / EDIT FORM ──────────────────────────────────────── */}
              {modelForm !== null && (
                <Card className="p-5 space-y-5 mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <SectionHeading>
                      {modelForm === 'new' ? 'Add new model' : `Edit — ${mfId}`}
                    </SectionHeading>
                    <button
                      type="button"
                      onClick={() => { setModelForm(null); setError(null); setTest('__form__', { state: 'idle' }); }}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:underline"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* ID */}
                    <div>
                      <FieldLabel htmlFor="mf-id">
                        Model id{' '}
                        <span className="font-normal text-gray-500 text-xs">
                          (immutable once created)
                        </span>
                      </FieldLabel>
                      <input
                        id="mf-id"
                        value={mfId}
                        onChange={(e) => setMfId(e.target.value)}
                        disabled={modelForm !== 'new'}
                        placeholder="my-model"
                        className={`${textInput} ${modelForm !== 'new' ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    {/* Label */}
                    <div>
                      <FieldLabel htmlFor="mf-label">Display label</FieldLabel>
                      <input
                        id="mf-label"
                        value={mfLabel}
                        onChange={(e) => setMfLabel(e.target.value)}
                        placeholder="KairLLM (Fast)"
                        className={textInput}
                      />
                    </div>

                    {/* Provider */}
                    <div>
                      <FieldLabel htmlFor="mf-provider">Provider</FieldLabel>
                      <select
                        id="mf-provider"
                        value={mfProvider}
                        onChange={(e) => setMfProvider(e.target.value as ModelEntry['provider'])}
                        className={textInput}
                      >
                        <option value="gemini">gemini</option>
                        <option value="openai-compatible">openai-compatible</option>
                      </select>
                    </div>

                    {/* Builtin */}
                    <div>
                      <FieldLabel htmlFor="mf-builtin">
                        Built-in{' '}
                        <span className="font-normal text-gray-500 text-xs">
                          (inherits platform key/url)
                        </span>
                      </FieldLabel>
                      <select
                        id="mf-builtin"
                        value={mfBuiltin}
                        onChange={(e) => setMfBuiltin(e.target.value as ModelEntry['builtin'] | '')}
                        className={textInput}
                      >
                        <option value="">— none —</option>
                        <option value="kairllm">kairllm</option>
                        <option value="deepseek">deepseek</option>
                      </select>
                    </div>

                    {/* Base URL — only relevant for openai-compatible non-builtin */}
                    {mfProvider === 'openai-compatible' && !mfBuiltin && (
                      <div className="sm:col-span-2">
                        <FieldLabel htmlFor="mf-base-url">Base URL</FieldLabel>
                        <input
                          id="mf-base-url"
                          value={mfBaseUrl}
                          onChange={(e) => setMfBaseUrl(e.target.value)}
                          placeholder="https://api.example.com/v1"
                          className={textInput}
                        />
                      </div>
                    )}

                    {/* API Key — only for openai-compatible non-builtin */}
                    {mfProvider === 'openai-compatible' && !mfBuiltin && (
                      <div className="sm:col-span-2">
                        <FieldLabel htmlFor="mf-api-key">API key</FieldLabel>
                        <input
                          id="mf-api-key"
                          type="password"
                          value={mfApiKey}
                          onChange={(e) => setMfApiKey(e.target.value)}
                          placeholder={modelForm !== 'new' ? 'leave blank to keep existing key' : 'sk-…'}
                          className={textInput}
                          autoComplete="off"
                        />
                      </div>
                    )}

                    {/* Provider model */}
                    <div>
                      <FieldLabel htmlFor="mf-pm">
                        Provider model{' '}
                        <span className="font-normal text-gray-500 text-xs">
                          (empty = provider default)
                        </span>
                      </FieldLabel>
                      <input
                        id="mf-pm"
                        value={mfProviderModel}
                        onChange={(e) => setMfProviderModel(e.target.value)}
                        placeholder="gpt-4o-mini"
                        className={textInput}
                      />
                    </div>

                    {/* Min tier */}
                    <div>
                      <FieldLabel htmlFor="mf-tier">Minimum tier</FieldLabel>
                      <select
                        id="mf-tier"
                        value={mfMinTier}
                        onChange={(e) => setMfMinTier(e.target.value as ModelEntry['minTier'])}
                        className={textInput}
                      >
                        <option value="free">free</option>
                        <option value="paid">paid</option>
                        <option value="business">business</option>
                      </select>
                    </div>
                  </div>

                  {/* Enabled toggle */}
                  <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mfEnabled}
                      onChange={(e) => setMfEnabled(e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    Enabled (visible in the user picker)
                  </label>

                  {/* Form Test + Save row */}
                  {(() => {
                    const fts = testStatus['__form__'] ?? { state: 'idle' };
                    const runFormTest = async () => {
                      setTest('__form__', { state: 'running' });
                      try {
                        const input = modelForm !== 'new' && !mfApiKey && !mfBaseUrl
                          // saved model with no changes typed → test by id
                          ? { id: mfId }
                          : {
                              config: {
                                provider: mfProvider,
                                ...(mfBuiltin ? { builtin: mfBuiltin as 'kairllm' | 'deepseek' } : {}),
                                ...(mfBaseUrl ? { base_url: mfBaseUrl } : {}),
                                // only send api_key if the admin has typed a fresh one
                                ...(mfApiKey ? { api_key: mfApiKey } : {}),
                                ...(mfProviderModel ? { providerModel: mfProviderModel } : {}),
                              },
                            };
                        const res = await adminTestModel(input);
                        setTest('__form__', { state: 'done', ...res });
                      } catch (e) {
                        setTest('__form__', { state: 'done', ok: false, error: e instanceof Error ? e.message : 'Test failed' });
                      }
                    };
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            disabled={fts.state === 'running'}
                            onClick={runFormTest}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {fts.state === 'running' ? (
                              <span className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                            ) : (
                              <span aria-hidden="true">⚡</span>
                            )}
                            Test connection
                          </button>
                          <SaveButton onClick={saveModel} loading={modelSaving} label="Save model" />
                        </div>
                        {fts.state === 'done' && (
                          <div className={`rounded-md px-3 py-2 text-xs flex flex-col gap-0.5 ${fts.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                            <span className="font-medium">
                              {fts.ok ? `✓ Connected` : `✗ Failed`}
                              {fts.ok && fts.latencyMs !== undefined ? ` · ${fts.latencyMs}ms` : ''}
                            </span>
                            {fts.ok && fts.text && (
                              <span className="text-emerald-700 font-mono text-[11px] truncate" title={fts.text}>
                                reply: {fts.text}
                              </span>
                            )}
                            {!fts.ok && fts.error && (
                              <span className="text-red-700 font-mono text-[11px] break-all">{fts.error}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </Card>
              )}

              {/* ── MODEL LIST TABLE ──────────────────────────────────────── */}
              <Card>
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
                  <SectionHeading>Configured models</SectionHeading>
                  <button
                    type="button"
                    onClick={loadModels}
                    className="text-xs text-blue-600 hover:text-blue-700 transition-colors focus:outline-none focus:underline"
                  >
                    Refresh
                  </button>
                </div>

                {!modelsLoaded ? (
                  <div className="flex items-center gap-2 px-5 py-8 text-sm text-gray-500">
                    <span className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                    Loading models…
                  </div>
                ) : models.length === 0 ? (
                  <EmptyState message="No models configured yet. Use 'Add model' to create one." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                            Label / id
                          </th>
                          <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                            Provider
                          </th>
                          <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                            Model name
                          </th>
                          <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                            Tier
                          </th>
                          <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                            Key
                          </th>
                          <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                            Status
                          </th>
                          <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                            Connectivity
                          </th>
                          <th className="px-5 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {models.map((m) => {
                          const isStructural = m.id === 'gemini' || m.id === 'custom';
                          const rts = testStatus[m.id] ?? { state: 'idle' };
                          const runRowTest = async () => {
                            setTest(m.id, { state: 'running' });
                            try {
                              const res = await adminTestModel({ id: m.id });
                              setTest(m.id, { state: 'done', ...res });
                            } catch (e) {
                              setTest(m.id, { state: 'done', ok: false, error: e instanceof Error ? e.message : 'Test failed' });
                            }
                          };
                          return (
                            <tr key={m.id} className="hover:bg-gray-50 transition-colors align-middle">
                              {/* Label + id */}
                              <td className="px-5 py-3">
                                <p className="font-medium text-gray-900 leading-snug">{m.label}</p>
                                <p className="font-mono text-[11px] text-gray-500 mt-0.5">{m.id}</p>
                              </td>

                              {/* Provider + builtin tag */}
                              <td className="px-5 py-3 whitespace-nowrap">
                                <span className="text-gray-700">{m.provider}</span>
                                {m.builtin && (
                                  <span className="ml-1.5 text-[10px] uppercase tracking-wide bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                                    {m.builtin}
                                  </span>
                                )}
                              </td>

                              {/* Provider model */}
                              <td className="px-5 py-3 font-mono text-[11px] text-gray-600">
                                {m.providerModel || <span className="text-gray-400">default</span>}
                              </td>

                              {/* Min tier badge */}
                              <td className="px-5 py-3">
                                <span
                                  className={`inline-block text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${
                                    m.minTier === 'free'
                                      ? 'bg-gray-100 text-gray-700'
                                      : m.minTier === 'paid'
                                      ? 'bg-blue-50 text-blue-800'
                                      : 'bg-violet-50 text-violet-800'
                                  }`}
                                >
                                  {m.minTier}
                                </span>
                              </td>

                              {/* Masked key */}
                              <td className="px-5 py-3 font-mono text-[11px] text-gray-500">
                                {m.api_key
                                  ? m.api_key
                                  : m.builtin
                                  ? <span className="text-indigo-500">platform</span>
                                  : m.provider === 'gemini'
                                  ? <span className="text-gray-400">env key</span>
                                  : <span className="text-gray-400">—</span>
                                }
                              </td>

                              {/* Enabled pill */}
                              <td className="px-5 py-3 whitespace-nowrap">
                                <span
                                  className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded ${
                                    m.enabled
                                      ? 'bg-emerald-50 text-emerald-800'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {m.enabled ? 'enabled' : 'disabled'}
                                </span>
                              </td>

                              {/* Connectivity column */}
                              <td className="px-5 py-3 whitespace-nowrap min-w-[180px]">
                                {rts.state === 'idle' && (
                                  <button
                                    type="button"
                                    onClick={runRowTest}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-[11px] font-medium text-gray-600 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    <span aria-hidden="true">⚡</span> Test
                                  </button>
                                )}
                                {rts.state === 'running' && (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                                    <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                                    Testing…
                                  </span>
                                )}
                                {rts.state === 'done' && (
                                  <span
                                    className={`inline-flex flex-col gap-0.5 text-[11px] ${rts.ok ? 'text-emerald-700' : 'text-red-600'}`}
                                  >
                                    <span className="font-medium flex items-center gap-1">
                                      {rts.ok ? '✓' : '✗'}
                                      {rts.ok
                                        ? `ok${rts.latencyMs !== undefined ? ` · ${rts.latencyMs}ms` : ''}`
                                        : 'failed'}
                                      <button
                                        type="button"
                                        onClick={runRowTest}
                                        title="Re-test"
                                        className="ml-1 text-gray-400 hover:text-gray-600 text-[10px] leading-none focus:outline-none"
                                      >
                                        ↺
                                      </button>
                                    </span>
                                    {rts.ok && rts.text && (
                                      <span
                                        className="font-mono text-[10px] text-emerald-600 max-w-[160px] truncate block"
                                        title={rts.text}
                                      >
                                        {rts.text}
                                      </span>
                                    )}
                                    {!rts.ok && rts.error && (
                                      <span
                                        className="font-mono text-[10px] text-red-500 max-w-[160px] truncate block"
                                        title={rts.error}
                                      >
                                        {rts.error}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </td>

                              {/* Edit / Delete actions */}
                              <td className="px-5 py-3 whitespace-nowrap text-right">
                                <button
                                  type="button"
                                  onClick={() => openModelForm(m)}
                                  className="text-xs text-blue-600 hover:text-blue-800 transition-colors focus:outline-none focus:underline mr-3"
                                >
                                  Edit
                                </button>
                                {!isStructural ? (
                                  <button
                                    type="button"
                                    onClick={() => deleteModel(m.id)}
                                    className="text-xs text-red-500 hover:text-red-700 transition-colors focus:outline-none focus:underline"
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <span
                                    title="Structural id — cannot be deleted"
                                    className="text-xs text-gray-300 cursor-not-allowed select-none"
                                  >
                                    Delete
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

          </div>
        )}

        {/* ── PROMPTS ───────────────────────────────────────────────────── */}
        {tab === 'prompts' && (
          <div className="space-y-5">
            {/* Header */}
            <div>
              <SectionHeading>AI Prompts</SectionHeading>
              <p className="mt-1 text-xs text-gray-500">
                Override the default system prompt for any AI function. Edits take effect on
                the next request — no redeploy needed.{' '}
                <span className="font-medium text-amber-700">
                  Preserve all {'{{placeholder}}'} variables or the function will break.
                </span>
              </p>
            </div>

            {/* Search box */}
            <div className="relative max-w-sm">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="search"
                value={promptSearch}
                onChange={(e) => setPromptSearch(e.target.value)}
                placeholder="Filter by key…"
                className={`${textInput} pl-9`}
                aria-label="Filter prompts by key"
              />
            </div>

            {!promptsLoaded ? (
              <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
                <span className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                Loading prompts…
              </div>
            ) : prompts.length === 0 ? (
              <EmptyState message="No prompts found." />
            ) : (() => {
              const q = promptSearch.trim().toLowerCase();
              const filtered = q
                ? prompts.filter((p) => p.key.toLowerCase().includes(q))
                : prompts;

              // Separate tool keys from handler_ keys for grouping
              const handlerPrompts = filtered.filter((p) => p.key.startsWith('handler_'));
              const toolPrompts = filtered.filter((p) => !p.key.startsWith('handler_'));

              const renderGroup = (group: PromptEntry[], groupLabel: string) => {
                if (group.length === 0) return null;
                return (
                  <div key={groupLabel} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 px-1">
                      {groupLabel}
                    </p>
                    <Card>
                      <ul className="divide-y divide-gray-100">
                        {group.map((entry) => {
                          const isExpanded = expandedPromptKey === entry.key;
                          const isOverridden = entry.override !== null;
                          const feedback = promptFeedback[entry.key];

                          return (
                            <li key={entry.key}>
                              {/* Row header — always visible */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (isExpanded) {
                                    setExpandedPromptKey(null);
                                  } else {
                                    setExpandedPromptKey(entry.key);
                                    setPromptDraft(entry.override ?? entry.default);
                                    // clear any lingering feedback when re-opening
                                    setPromptFeedback((prev) => {
                                      const next = { ...prev };
                                      delete next[entry.key];
                                      return next;
                                    });
                                  }
                                }}
                                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50"
                                aria-expanded={isExpanded}
                              >
                                <span className="flex items-center gap-2.5 min-w-0">
                                  <span className="font-mono text-sm text-gray-800 truncate">
                                    {entry.key}
                                  </span>
                                  {isOverridden && (
                                    <span className="shrink-0 inline-block text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                      overridden
                                    </span>
                                  )}
                                </span>
                                <span
                                  className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  aria-hidden="true"
                                >
                                  ▾
                                </span>
                              </button>

                              {/* Expanded editor */}
                              {isExpanded && (
                                <div className="px-5 pb-5 space-y-3 border-t border-gray-100 bg-gray-50/40">
                                  <p className="pt-3 text-[11px] text-gray-500">
                                    Edit the template below. Variables like{' '}
                                    <code className="bg-gray-100 px-1 rounded text-gray-700 font-mono">
                                      {'{{placeholder}}'}
                                    </code>{' '}
                                    are substituted at runtime and must be kept.
                                  </p>

                                  <textarea
                                    value={promptDraft}
                                    onChange={(e) => setPromptDraft(e.target.value)}
                                    rows={10}
                                    className={`${textInput} font-mono text-xs leading-relaxed resize-y`}
                                    aria-label={`Edit prompt for ${entry.key}`}
                                    spellCheck={false}
                                  />

                                  {/* Inline feedback */}
                                  {feedback?.ok && (
                                    <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                                      <span aria-hidden="true">✓</span>
                                      {feedback.ok}
                                    </p>
                                  )}
                                  {feedback?.err && (
                                    <p className="text-xs text-red-600 flex items-center gap-1.5">
                                      <span aria-hidden="true">✕</span>
                                      {feedback.err}
                                    </p>
                                  )}

                                  {/* Action buttons */}
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <SaveButton
                                      onClick={async () => {
                                        setPromptSaving(true);
                                        try {
                                          const res = await adminUpdatePrompt(entry.key, promptDraft);
                                          // Patch just this row without blowing away the list
                                          setPrompts((prev) =>
                                            prev.map((p) =>
                                              p.key === entry.key
                                                ? { ...p, override: res.override }
                                                : p,
                                            ),
                                          );
                                          setPromptFeedback((prev) => ({
                                            ...prev,
                                            [entry.key]: { ok: 'Saved successfully.' },
                                          }));
                                        } catch (e) {
                                          setPromptFeedback((prev) => ({
                                            ...prev,
                                            [entry.key]: {
                                              err: e instanceof Error ? e.message : 'Save failed',
                                            },
                                          }));
                                        } finally {
                                          setPromptSaving(false);
                                        }
                                      }}
                                      loading={promptSaving}
                                      label="Save override"
                                    />

                                    <button
                                      type="button"
                                      disabled={!isOverridden || promptSaving}
                                      onClick={async () => {
                                        setPromptSaving(true);
                                        try {
                                          await adminResetPrompt(entry.key);
                                          // Patch this row: clear override, restore draft to default
                                          setPrompts((prev) =>
                                            prev.map((p) =>
                                              p.key === entry.key
                                                ? { ...p, override: null }
                                                : p,
                                            ),
                                          );
                                          setPromptDraft(entry.default);
                                          setPromptFeedback((prev) => ({
                                            ...prev,
                                            [entry.key]: { ok: 'Reset to default.' },
                                          }));
                                        } catch (e) {
                                          setPromptFeedback((prev) => ({
                                            ...prev,
                                            [entry.key]: {
                                              err: e instanceof Error ? e.message : 'Reset failed',
                                            },
                                          }));
                                        } finally {
                                          setPromptSaving(false);
                                        }
                                      }}
                                      className={`text-sm px-3 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                        isOverridden && !promptSaving
                                          ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 focus:ring-red-500'
                                          : 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
                                      }`}
                                      title={
                                        isOverridden
                                          ? 'Discard override and restore compiled-in default'
                                          : 'No override active — already using default'
                                      }
                                    >
                                      Reset to default
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setExpandedPromptKey(null)}
                                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:underline ml-auto"
                                    >
                                      Close
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  </div>
                );
              };

              return (
                <div className="space-y-6">
                  {filtered.length === 0 ? (
                    <EmptyState message={`No prompts match "${promptSearch}".`} />
                  ) : (
                    <>
                      {renderGroup(toolPrompts, 'Tool prompts')}
                      {renderGroup(handlerPrompts, 'Handler prompts')}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── QUOTAS ────────────────────────────────────────────────────── */}
        {tab === 'quotas' && (
          <div className="max-w-xl space-y-5">
            <Card className="p-5 space-y-5">
              <div>
                <SectionHeading>Platform quotas</SectionHeading>
                <p className="mt-1 text-xs text-gray-500">
                  UTC day rolling window. Set to 0 for no limit on that dimension.
                </p>
              </div>
              <div className="space-y-4">
                {(
                  [
                    ['daily_tool_run_limit', 'Daily tool run limit (platform-wide)'],
                    ['daily_credit_spend_limit', 'Daily credit spend limit (platform-wide)'],
                    ['per_user_daily_credit_limit', 'Per-user daily credit limit'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <FieldLabel htmlFor={key}>{label}</FieldLabel>
                    <input
                      id={key}
                      type="number"
                      min={0}
                      value={Number(quotas[key] ?? 0)}
                      onChange={(e) =>
                        setQuotas((q) => ({ ...q, [key]: Number(e.target.value) }))
                      }
                      className={textInput}
                    />
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={quotas.enabled !== false}
                  onChange={(e) => setQuotas((q) => ({ ...q, enabled: e.target.checked }))}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                Enforce quota limits
              </label>
              <SaveButton onClick={saveQuotas} loading={loading} label="Save quotas" />
            </Card>
          </div>
        )}

        {/* ── USERS ─────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="grid md:grid-cols-[1fr_380px] gap-6 items-start">
            {/* User list */}
            <Card>
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <SectionHeading>Users</SectionHeading>
                <span className="text-xs text-gray-500">{users.length} loaded</span>
              </div>
              <div className="overflow-x-auto">
                {users.length === 0 ? (
                  <EmptyState message="No users found." />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                          Name
                        </th>
                        <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                          Plan
                        </th>
                        <th className="px-5 py-3 text-right text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                          Credits
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map((u) => (
                        <tr
                          key={u.uid}
                          className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                            selectedUid === u.uid ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => openUser(u.uid)}
                        >
                          <td className="px-5 py-3 text-gray-900 font-medium">
                            {u.full_name || (
                              <span className="font-mono text-xs text-gray-500">
                                {u.uid.slice(0, 10)}…
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <PlanBadge plan={u.subscription_status} />
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                            {u.credits}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {userCursor && (
                <div className="px-5 py-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => loadUsers(userCursor ?? undefined)}
                    className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Load more users
                  </button>
                </div>
              )}
            </Card>

            {/* User detail panel */}
            {selectedUid && userReport ? (
              <Card className="p-5 space-y-5 sticky top-20">
                <div>
                  <SectionHeading>User detail</SectionHeading>
                  <p className="mt-1 font-mono text-[11px] text-gray-500 break-all">{selectedUid}</p>
                </div>

                {/* Identity / profile fields (email comes from Firebase Auth) */}
                {(() => {
                  const p = ((userReport as { profile?: Record<string, unknown> }).profile ?? {}) as Record<string, unknown>;
                  const a = (userReport as { auth?: Record<string, unknown> | null }).auth ?? null;
                  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
                  const dateStr = (v: unknown) => {
                    const s = str(v);
                    if (!s) return null;
                    const d = new Date(s);
                    return isNaN(d.getTime()) ? s : d.toLocaleString();
                  };
                  const rows: { label: string; value: React.ReactNode }[] = [
                    { label: 'Email', value: str(p.email) ?? (a ? str(a.email) : null) ?? '—' },
                    { label: 'Name', value: str(p.full_name) ?? str(p.company_name) ?? (a ? str(a.display_name) : null) ?? '—' },
                    { label: 'Role', value: str(p.role) ?? '—' },
                    { label: 'Plan', value: str(p.subscription_status) ?? 'free' },
                    { label: 'Credits', value: typeof p.credits === 'number' ? (p.credits as number).toLocaleString() : '—' },
                    { label: 'Joined', value: dateStr(a?.auth_created_at) ?? dateStr(p.created_at) ?? '—' },
                    { label: 'Last sign-in', value: (a && dateStr(a.last_sign_in)) ?? '—' },
                  ];
                  return (
                    <div className="space-y-1.5 border-t border-gray-200 pt-3">
                      {rows.map((r) => (
                        <div key={r.label} className="flex items-baseline justify-between gap-3">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide flex-shrink-0">{r.label}</span>
                          <span className="text-sm text-gray-800 text-right break-all">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg px-3 py-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Runs (7d)</p>
                    <p className="text-lg font-bold mt-0.5 tabular-nums">
                      {String((userReport as { week_runs?: number }).week_runs ?? 0)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Admin</p>
                    <p className={`text-lg font-bold mt-0.5 ${selectedIsAdmin ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {selectedIsAdmin ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>

                {/* Credit adjustment */}
                <div className="space-y-2">
                  <FieldLabel>Adjust credits (+/-)</FieldLabel>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={creditDelta}
                      onChange={(e) => setCreditDelta(e.target.value)}
                      className={`${textInput} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={adjustCredits}
                      className="bg-blue-700 hover:bg-blue-800 px-3 py-2 rounded-md text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* Subscription override */}
                <div className="space-y-2">
                  <FieldLabel htmlFor="sub-tier">Subscription tier</FieldLabel>
                  <div className="flex gap-2">
                    <select
                      id="sub-tier"
                      value={subStatus}
                      onChange={(e) => setSubStatus(e.target.value)}
                      className={`${textInput} flex-1`}
                    >
                      <option value="" disabled>
                        Select plan…
                      </option>
                      {SUBSCRIPTION_PLANS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={applySubscription}
                      className="bg-blue-700 hover:bg-blue-800 px-3 py-2 rounded-md text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    >
                      Set
                    </button>
                  </div>
                </div>

                {/* Admin toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Admin access</span>
                  <button
                    type="button"
                    onClick={toggleSelectedAdmin}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 ${
                      selectedIsAdmin
                        ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 focus:ring-red-500'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 focus:ring-emerald-500'
                    }`}
                  >
                    {selectedIsAdmin ? 'Revoke admin' : 'Grant admin'}
                  </button>
                </div>

                {/* Week breakdown */}
                <details className="group">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 transition-colors select-none list-none flex items-center gap-1">
                    <span className="group-open:rotate-90 transition-transform">▶</span>
                    Weekly tool breakdown
                  </summary>
                  <pre className="mt-2 text-[11px] bg-gray-50 p-3 rounded-lg overflow-auto max-h-48 text-gray-600 leading-relaxed">
                    {JSON.stringify(
                      (userReport as { week_by_tool?: unknown }).week_by_tool,
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </Card>
            ) : selectedUid ? (
              <Card className="p-5">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                  Loading user report…
                </div>
              </Card>
            ) : (
              <Card className="p-5">
                <p className="text-sm text-gray-500">Select a user to view their report.</p>
              </Card>
            )}
          </div>
        )}

        {/* ── ADMINS ────────────────────────────────────────────────────── */}
        {tab === 'admins' && (
          <div className="max-w-xl space-y-5">
            <Card className="p-5 space-y-4">
              <div>
                <SectionHeading>Admin users</SectionHeading>
                <p className="mt-1 text-xs text-gray-500">
                  Admins can view all users, adjust credits, change tiers, manage API keys and
                  quotas, and grant admin access. Every action is recorded in{' '}
                  <code className="bg-gray-100 px-1 rounded">admin_audit_log</code>.
                </p>
              </div>

              {/* Add admin */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <FieldLabel htmlFor="new-admin">Add admin by email or UID</FieldLabel>
                  <input
                    id="new-admin"
                    value={newAdmin}
                    onChange={(e) => setNewAdmin(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAdmin()}
                    placeholder="person@company.com"
                    className={textInput}
                  />
                </div>
                <button
                  type="button"
                  onClick={addAdmin}
                  className="bg-emerald-700 hover:bg-emerald-800 px-3 py-2 rounded-md text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                >
                  Add
                </button>
              </div>

              {/* Admin list */}
              {admins.length === 0 ? (
                <EmptyState message="No admins listed." />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {admins.map((a) => (
                    <li key={a.uid} className="flex items-center justify-between py-3 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                          <span>{a.email || a.display_name || '(no email)'}</span>
                          {a.source === 'env' && (
                            <span className="text-[10px] uppercase tracking-wider text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                              bootstrap
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] font-mono text-gray-500 truncate">{a.uid}</p>
                      </div>
                      {a.source === 'env' ? (
                        <span className="text-xs text-gray-400 shrink-0">env only</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => revokeAdmin(a.uid)}
                          className="shrink-0 text-xs text-red-600 hover:text-red-800 transition-colors focus:outline-none focus:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {/* ── AUDIT LOG ─────────────────────────────────────────────────── */}
        {tab === 'audit' && (
          <Card>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <SectionHeading>Audit log</SectionHeading>
                <p className="mt-0.5 text-xs text-gray-500">
                  Last 100 admin actions, newest first. Raw keys are never stored — key changes
                  appear as boolean flags only.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAuditLog}
                className="text-xs text-blue-600 hover:text-blue-700 transition-colors focus:outline-none focus:underline"
              >
                Refresh
              </button>
            </div>

            {!auditLoaded ? (
              <div className="flex items-center gap-2 px-5 py-8 text-sm text-gray-500">
                <span className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                Loading audit log…
              </div>
            ) : auditLog.length === 0 ? (
              <EmptyState message="No audit log entries yet. Admin actions will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase whitespace-nowrap">
                        Timestamp
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                        Action
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                        Actor
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                        Target
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors align-top">
                        <td className="px-5 py-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {entry.created_at
                            ? entry.created_at.slice(0, 19).replace('T', ' ')
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <ActionBadge action={entry.action} />
                        </td>
                        <td className="px-5 py-3 font-mono text-[11px] text-gray-600">
                          {entry.admin_uid.slice(0, 10)}…
                        </td>
                        <td className="px-5 py-3 font-mono text-[11px] text-gray-600">
                          {entry.target_uid ? `${entry.target_uid.slice(0, 10)}…` : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[11px] text-gray-500 max-w-[280px]">
                          <AuditDetails details={entry.details} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
    </AdminShell>
  );
};

export default AdminPortal;
