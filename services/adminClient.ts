/**
 * Admin portal API — all calls go through gated Cloud Functions (requireAdmin).
 */

import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions } from '../lib/firebaseClient';

const call = <Req, Res>(name: string) =>
  httpsCallable<Req, Res>(firebaseFunctions, name);

export interface AdminProviderStatus {
  gemini: boolean;
  kairllm: boolean;
  deepseek: boolean;
  any_configured: boolean;
}

export interface AdminDashboard {
  // Booleans only (no key values) — surfaces whether AI provider keys are set so
  // any admin can spot an "all AI down because keys are missing" outage.
  ai_providers?: AdminProviderStatus;
  user_count: number;
  users_truncated?: boolean;
  today_runs: number;
  today_credits: number;
  week_tool_breakdown: Record<string, { runs: number; credits: number }>;
  week_usage_truncated?: boolean;
  // Uncharged tools (careerCoach/discoverTalent/listJobApplicants/generateHeadshot):
  // call volume only, never billed or capped.
  free_tool_breakdown?: Record<string, { runs: number }>;
  free_usage_truncated?: boolean;
  top_users_week: { uid: string; credits_spent: number }[];
  recent_events: Array<Record<string, unknown>>;
  quotas: Record<string, unknown>;
}

export interface AdminUserRow {
  uid: string;
  email: string | null;
  full_name: string | null;
  avatar_url?: string | null;
  role: string | null;
  subscription_status: string | null;
  credits: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminUserFilters {
  search?: string;
  roles?: string[];
  plans?: string[];
  created_after?: string;
}

export const adminCheckAccess = () =>
  call<Record<string, never>, { admin: boolean; uid?: string }>('adminCheckAccess')({}).then((r) => r.data);

export const adminWhoAmI = () =>
  call<Record<string, never>, { role: 'super' | 'admin' | 'reviewer' }>('adminWhoAmI')({}).then((r) => r.data);

export const adminGetDashboard = () =>
  call<Record<string, never>, AdminDashboard>('adminGetDashboard')({}).then((r) => r.data);

export const adminGetLlmConfig = () =>
  call<Record<string, never>, Record<string, string>>('adminGetLlmConfig')({}).then((r) => r.data);

export const adminUpdateLlmConfig = (payload: {
  gemini_api_key?: string;
  gemini_model?: string;
  gemini_fallback_model?: string;
  kairllm_api_key?: string;
  kairllm_base_url?: string;
  deepseek_api_key?: string;
  deepseek_base_url?: string;
}) => call<typeof payload, Record<string, string>>('adminUpdateLlmConfig')(payload).then((r) => r.data);

export type AdminPlanKey =
  | 'free'
  | 'essentials'
  | 'accelerator'
  | 'executive'
  | 'starter'
  | 'growth'
  | 'pro'
  | 'single_post'
  | 'job_pack';

export interface AdminPlanQuota {
  daily_run_limit: number;
  daily_credit_limit: number;
  monthly_credit_grant: number;
  active_job_limit: number;
}

export interface AdminToolQuota {
  enabled: boolean;
  credit_cost: number;
  allowed_plans: AdminPlanKey[];
}

export interface AdminQuotas {
  daily_tool_run_limit?: number;
  daily_credit_spend_limit?: number;
  per_user_daily_credit_limit?: number;
  enabled?: boolean;
  free_max_output_tokens?: number;
  mi_min_tier?: 'free' | 'paid';
  mi_report_unlock_credits?: number;
  plan_quotas?: Partial<Record<AdminPlanKey, Partial<AdminPlanQuota>>>;
  tool_quotas?: Record<string, Partial<AdminToolQuota>>;
  updated_at?: string;
  updated_by?: string;
}

export const adminGetQuotas = () =>
  call<Record<string, never>, AdminQuotas>('adminGetQuotas')({}).then((r) => r.data);

export const adminUpdateQuotas = (payload: {
  daily_tool_run_limit: number;
  daily_credit_spend_limit: number;
  per_user_daily_credit_limit: number;
  enabled: boolean;
  free_max_output_tokens?: number;
  mi_min_tier?: 'free' | 'paid';
  mi_report_unlock_credits?: number;
  plan_quotas?: Partial<Record<AdminPlanKey, Partial<AdminPlanQuota>>>;
  tool_quotas?: Record<string, Partial<AdminToolQuota>>;
}) => call<typeof payload, AdminQuotas>('adminUpdateQuotas')(payload).then((r) => r.data);

export const adminListUsers = (limit = 50, start_after_uid?: string, filters?: AdminUserFilters) =>
  call<
    { limit?: number; start_after_uid?: string } & AdminUserFilters,
    { users: AdminUserRow[]; next_cursor: string | null }
  >(
    'adminListUsers',
  )({ limit, start_after_uid, ...(filters ?? {}) }).then((r) => r.data);

export const adminGetUserReport = (uid: string) =>
  call<{ uid: string }, Record<string, unknown>>('adminGetUserReport')({ uid }).then((r) => r.data);

export const adminAdjustCredits = (uid: string, delta: number, reason?: string) =>
  call<{ uid: string; delta: number; reason?: string }, { uid: string; credits: number }>(
    'adminAdjustCredits',
  )({ uid, delta, reason }).then((r) => r.data);

/** Candidate + business plan keys an admin may assign. */
export const SUBSCRIPTION_PLANS = [
  'free',
  'essentials',
  'accelerator',
  'executive',
  'starter',
  'growth',
  'pro',
  'single_post',
  'job_pack',
] as const;

export const adminSetSubscription = (uid: string, subscription_status: string) =>
  call<{ uid: string; subscription_status: string }, { uid: string; subscription_status: string }>(
    'adminSetSubscription',
  )({ uid, subscription_status }).then((r) => r.data);

export const adminDeleteUser = (args: { uid?: string; email?: string; reason: string }) =>
  call<typeof args, { uid: string; email: string | null; deleted_auth: boolean; deleted_profile: boolean }>(
    'adminDeleteUser',
  )(args).then((r) => r.data);

export interface AdminSampleAccount {
  kind: 'job_seeker' | 'employer';
  uid: string;
  email: string;
  password: string;
  role: string;
  subscription_status: string;
  credits: number;
  created: boolean;
}

export const adminCreateSampleAccounts = () =>
  call<Record<string, never>, { accounts: AdminSampleAccount[] }>(
    'adminCreateSampleAccounts',
  )({}).then((r) => r.data);

export interface AdminRow {
  uid: string;
  email: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  /** 'rbac' = portal-managed, 'legacy_doc' = old allowlist, 'env' = ADMIN_UIDS bootstrap. */
  source?: 'rbac' | 'legacy_doc' | 'env';
  /** New: role for role-aware admin system */
  role?: 'super' | 'admin' | 'reviewer';
  status?: string;
  invited_at?: string | null;
}

export const adminSetAdmin = (args: { uid?: string; email?: string; makeAdmin: boolean }) =>
  call<typeof args, { uid: string; email: string | null; admin: boolean; admin_uids: string[] }>(
    'adminSetAdmin',
  )(args).then((r) => r.data);

export const adminListAdmins = () =>
  call<Record<string, never>, { admins: AdminRow[] }>('adminListAdmins')({}).then((r) => r.data);

/** Super-only: invite a new admin or reviewer by email. */
export const adminInviteAdmin = (args: { email: string; role: 'admin' | 'reviewer' }) =>
  call<typeof args, { uid: string; email: string; role: string; status: string; invited_at: string }>(
    'adminInviteAdmin',
  )(args).then((r) => r.data);

/** Super-only: change the role of an existing admin. */
export const adminSetAdminRole = (args: { uid: string; role: 'admin' | 'reviewer' }) =>
  call<typeof args, { uid: string; role: string }>('adminSetAdminRole')(args).then((r) => r.data);

/** Super-only: remove an admin/reviewer. */
export const adminRemoveAdmin = (args: { uid: string }) =>
  call<typeof args, { uid: string }>('adminRemoveAdmin')(args).then((r) => r.data);

export interface AuditLogEntry {
  id: string;
  admin_uid: string;
  action: string;
  target_uid: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
}

export const adminGetAuditLog = (limit = 25, start_after_id?: string) =>
  call<
    { limit?: number; start_after_id?: string },
    { entries: AuditLogEntry[]; next_cursor: string | null }
  >('adminGetAuditLog')({ limit, start_after_id }).then((r) => r.data);

// ─── Models ────────────────────────────────────────────────────────────────

export interface ModelEntry {
  /** Unique selection id — immutable once created (drives the user picker). */
  id: string;
  /** Display name shown in the user-facing model picker. */
  label: string;
  provider: 'gemini' | 'openai-compatible';
  /** Required for openai-compatible models without a builtin. Must be https. */
  base_url?: string;
  /**
   * OpenAI-compatible API key (legacy single-key).
   * On a list response this is a masked preview like "ab12••••wxyz".
   * On upsert, sending an empty string keeps the stored key unchanged.
   */
  api_key?: string;
  /**
   * Multi-key pool. Masked from server on list responses.
   * On upsert: existing saved keys are not echoed back; new entries are appended server-side.
   */
  api_keys?: string[];
  api_key_hash?: string;
  api_key_hashes?: string[];
  key_previews?: {
    hash: string;
    masked: string;
    index: number;
    source: 'api_key' | 'api_keys' | 'builtin';
  }[];
  /** Ordered list of model ids to fall back to when this model fails. */
  fallbackChain?: string[];
  /** Numeric routing priority (lower = higher priority). */
  priority?: number;
  /** Platform-managed builtin — inherits key/base from platform_config/llm. */
  builtin?: 'kairllm' | 'deepseek';
  /** Model name forwarded to the provider. Empty string = provider default. */
  providerModel: string;
  minTier: 'free' | 'paid' | 'business';
  enabled: boolean;
  /** Optional per-key health info if server includes it. */
  health?: { keyIndex: number; ok: boolean; latencyMs?: number; checkedAt?: string }[];
  /** Lightweight key-pool health from platform_config/key_health (best-effort, may be absent). */
  keyHealth?: {
    failureCount?: number;
    cooldownUntil?: string | null;
    lastErrorCode?: string | null;
    lastFailureAt?: string | null;
    anyCooled?: boolean;
  };
}

export interface RoutingPoolMember {
  modelId: string;
  keyHash?: string;
  tier: number;
  weight: number;
  enabled: boolean;
}

export interface RoutingPool {
  id: string;
  label: string;
  enabled: boolean;
  members: RoutingPoolMember[];
}

export type ModuleRoutes = Record<string, string>;

export const DEFAULT_MODULE_ROUTES: ModuleRoutes = {
  mockInterview: 'speed',
  analyzeResume: 'quality',
  generateCoverLetter: 'quality',
  generateCareerPath: 'quality',
  applyResumeImprovements: 'quality',
  convertResumeFormat: 'quality',
};

const DEFAULT_SPEED_POOL_MEMBERS = [
  { label: 'Tencent Hunyuan 3', weight: 50 },
  { label: 'Auto · multi-model (legacy)', weight: 30 },
  { label: 'Deepseek V4 Flash(Limited Testing)', weight: 20 },
];

const DEFAULT_QUALITY_POOL_MEMBERS = [
  { label: 'Deepseek-v4-Pro For Demo Only', weight: 100 },
];

const normalizeModelLabel = (label: string) => label.trim().toLowerCase();

const defaultPoolMembersForLabels = (
  models: ModelEntry[],
  specs: Array<{ label: string; weight: number }>,
): RoutingPoolMember[] =>
  specs.flatMap((spec) => {
    const model = models.find((entry) => normalizeModelLabel(entry.label) === normalizeModelLabel(spec.label));
    return model ? [{ modelId: model.id, tier: 1, weight: spec.weight, enabled: true }] : [];
  });

export const defaultRoutingPoolsForModels = (models: ModelEntry[]): RoutingPool[] => [
  {
    id: 'speed',
    label: 'Speed priority',
    enabled: true,
    members: defaultPoolMembersForLabels(models, DEFAULT_SPEED_POOL_MEMBERS),
  },
  {
    id: 'quality',
    label: 'Quality priority',
    enabled: true,
    members: defaultPoolMembersForLabels(models, DEFAULT_QUALITY_POOL_MEMBERS),
  },
];

export const normalizeModelRouting = (
  models: ModelEntry[],
  routingPools?: RoutingPool[],
  moduleRoutes?: ModuleRoutes,
) => ({
  routingPools: routingPools ?? defaultRoutingPoolsForModels(models),
  moduleRoutes: moduleRoutes ?? { ...DEFAULT_MODULE_ROUTES },
});

export const adminListModels = () =>
  call<Record<string, never>, {
    models: ModelEntry[];
    defaultModelId: string | null;
    routingPools?: RoutingPool[];
    moduleRoutes?: ModuleRoutes;
  }>(
    'adminListModels',
  )({}).then((r) => r.data);

/** Super-only: set the platform default model for auto-routing. */
export const adminSetDefaultModel = (id: string) =>
  call<{ id: string }, { ok: true; defaultModelId: string }>(
    'adminSetDefaultModel',
  )({ id }).then((r) => r.data);

export const adminUpsertModel = (model: ModelEntry) =>
  call<{ model: ModelEntry }, { models: ModelEntry[] }>('adminUpsertModel')({ model }).then(
    (r) => r.data,
  );

export const adminDeleteModel = (id: string) =>
  call<{ id: string }, { models: ModelEntry[] }>('adminDeleteModel')({ id }).then((r) => r.data);

export const adminUpdateModelRouting = (input: {
  routingPools: RoutingPool[];
  moduleRoutes: ModuleRoutes;
}) =>
  call<typeof input, { routingPools: RoutingPool[]; moduleRoutes: ModuleRoutes }>(
    'adminUpdateModelRouting',
  )(input).then((r) => r.data);

export interface TestModelResult {
  ok: boolean;
  text?: string;
  latencyMs?: number;
  error?: string;
}

export type TestModelInput =
  | { id: string; keyIndex?: number }
  | {
      config: {
        provider: 'gemini' | 'openai-compatible';
        base_url?: string;
        api_key?: string;
        builtin?: 'kairllm' | 'deepseek';
        providerModel?: string;
      };
    };

export const adminTestModel = (input: TestModelInput): Promise<TestModelResult> =>
  call<TestModelInput, TestModelResult>('adminTestModel')(input).then((r) => r.data);

// ─── Prompts ───────────────────────────────────────────────────────────────

/** A single prompt entry as returned by adminGetPrompts. */
export interface PromptEntry {
  /** Unique key, e.g. "convertResumeFormat" or "handler_career_coach_candidate". */
  key: string;
  /** The compiled-in default template (read-only from the admin's perspective). */
  default: string;
  /** Admin-supplied override, or null when the default is in effect. */
  override: string | null;
}

export const adminGetPrompts = () =>
  call<Record<string, never>, { prompts: PromptEntry[] }>('adminGetPrompts')({}).then(
    (r) => r.data,
  );

export const adminUpdatePrompt = (key: string, template: string) =>
  call<{ key: string; template: string }, { key: string; override: string }>(
    'adminUpdatePrompt',
  )({ key, template }).then((r) => r.data);

export const adminResetPrompt = (key: string) =>
  call<{ key: string }, { key: string; override: null }>(
    'adminResetPrompt',
  )({ key }).then((r) => r.data);

// ─── Prompt lifecycle (versioned) ─────────────────────────────────────────

export interface PromptVersion {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'rolled_back';
  content: string;
  createdBy: string;
  createdAt: string;
  publishedBy?: string | null;
  publishedAt?: string | null;
  changeSummary?: string | null;
}

export const adminSavePromptDraft = (args: {
  promptKey: string;
  content: string;
  changeSummary?: string;
}) =>
  call<typeof args, { versionId: string }>(
    'adminSavePromptDraft',
  )(args).then((r) => r.data);

export const adminPublishPrompt = (args: { versionId: string }) =>
  call<typeof args, { versionId: string; status: string }>(
    'adminPublishPrompt',
  )(args).then((r) => r.data);

export const adminRollbackPrompt = (args: { versionId: string }) =>
  call<typeof args, { versionId: string; status: string }>(
    'adminRollbackPrompt',
  )(args).then((r) => r.data);

export const adminListPromptVersions = (args: { promptKey: string }) =>
  call<typeof args, { versions: PromptVersion[] }>(
    'adminListPromptVersions',
  )(args).then((r) => r.data);
