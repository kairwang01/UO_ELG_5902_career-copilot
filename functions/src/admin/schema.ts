/** Firestore paths and shapes for the admin portal. */

export const PLATFORM_CONFIG_COLLECTION = "platform_config";

export const PLATFORM_DOCS = {
  llm: "llm",
  quotas: "quotas",
  access: "access",
  models: "models",
  prompts: "prompts",
} as const;

/**
 * A single model entry in the admin-managed model registry.
 * Stored as an array under platform_config/models.models[].
 *
 * "custom" is a sentinel entry: its id must be "custom", provider "openai-compatible",
 * and minTier "business". It is never built from this table; resolveProvider handles
 * it by reading users/{uid}.custom_provider instead.
 */
export interface ModelEntry {
  /** Selection id sent by the client (must be unique across the registry). */
  id: string;
  /** Display name shown in the model picker (admin-editable). */
  label: string;
  /** Backing provider implementation tag. */
  provider: "gemini" | "openai-compatible";
  /**
   * Base URL for openai-compatible providers.
   * Empty / omitted → fall back to the built-in base URL resolved via `builtin`.
   */
  base_url?: string;
  /**
   * Single API key for openai-compatible providers (legacy, single-key).
   * Empty / omitted → fall back to the built-in key resolved via `builtin`.
   * NEVER returned raw to clients — always masked.
   */
  api_key?: string;
  /**
   * Pool of API keys for openai-compatible providers (multi-key rotation).
   * When present and non-empty, takes precedence over `api_key`.
   * Resolution order: api_keys (if non-empty) → api_key → builtin platform key.
   * NEVER returned raw to clients — always masked.
   * Max 10 keys; each must be a non-empty string ≤ 200 chars.
   */
  api_keys?: string[];
  /**
   * When set, inherits key + base_url from the named platform_config/llm entry
   * when `api_key` / `api_keys` / `base_url` on this entry are absent.
   */
  builtin?: "kairllm" | "deepseek";
  /** Model name passed to the provider. "" = provider default. */
  providerModel: string;
  /** Minimum tier required to select this model. */
  minTier: "free" | "paid" | "business";
  /** When false the model is hidden from pickers and cannot be resolved. */
  enabled: boolean;
  /**
   * Sort priority — higher number = sorted earlier in admin/picker lists.
   * Optional; defaults to 0. Integer.
   */
  priority?: number;
  /**
   * Ordered list of model IDs to fall back to when this model's key pool is
   * fully exhausted (availability-class errors only — 401/403/429/timeout/empty).
   * Each entry must be an existing model ID in the registry. The user's tier is
   * respected: chain entries the caller cannot access are skipped silently.
   * At most 5 entries.
   */
  fallbackChain?: string[];
}

/** Firestore shape of platform_config/models. */
export interface ModelsDoc {
  models?: ModelEntry[];
  /** Admin-configured default model id. When set, overrides the hardcoded DEFAULT_MODEL_ID. */
  default_model_id?: string;
}

export const USAGE_EVENTS_COLLECTION = "usage_events";
export const USAGE_COUNTERS_COLLECTION = "usage_counters";
export const CREDIT_LEDGER_COLLECTION = "credit_ledger";

/** Append-only audit trail for every admin mutation (credits, tier, admin grant, config). */
export const ADMIN_AUDIT_LOG_COLLECTION = "admin_audit_log";

export interface AdminAuditDoc {
  admin_uid: string;
  /** e.g. adjust_credits | set_subscription | set_admin | update_llm_config | update_quotas */
  action: string;
  target_uid?: string;
  details?: Record<string, unknown>;
  created_at: unknown;
}

export interface LlmConfigDoc {
  gemini_api_key?: string;
  gemini_model?: string;
  gemini_fallback_model?: string;
  kairllm_api_key?: string;
  kairllm_base_url?: string;
  /** DeepSeek gateway — paid+ tier only. */
  deepseek_api_key?: string;
  deepseek_base_url?: string;
  updated_at?: string;
  updated_by?: string;
}

export type PlanKey =
  | "free"
  | "essentials"
  | "accelerator"
  | "executive"
  | "starter"
  | "growth"
  | "pro"
  | "single_post"
  | "job_pack";

export interface PlanQuota {
  /** Per-plan cap on successful AI/tool runs per UTC day (0 = unlimited). */
  daily_run_limit: number;
  /** Per-plan cap on credits spent per user per UTC day (0 = unlimited). */
  daily_credit_limit: number;
  /** Monthly AI credit grant used by subscription selection/renewal. */
  monthly_credit_grant: number;
  /** Employer active job-post cap for this plan (0 = cannot post). */
  active_job_limit: number;
}

export interface ToolQuota {
  /** When false, server-side execution is blocked for user-visible paid tools. */
  enabled: boolean;
  /** Credit price charged for the tool. */
  credit_cost: number;
  /** Plan keys allowed to run the tool. Empty/missing means no plans allowed. */
  allowed_plans: PlanKey[];
}

export interface QuotasDoc {
  /** Global cap on billable tool runs per UTC day (0 = unlimited). */
  daily_tool_run_limit?: number;
  /** Global cap on credits spent per UTC day (0 = unlimited). */
  daily_credit_spend_limit?: number;
  /** Per-user cap on credits spent per UTC day (0 = unlimited). */
  per_user_daily_credit_limit?: number;
  /**
   * Free-tier output-token ceiling (服务分级). Default 8192 = Gemini Flash's
   * native max, i.e. no artificial truncation — the genuine free/paid quality
   * gap is the model tier. Admins may lower this for a harder boundary.
   */
  free_max_output_tokens?: number;
  /**
   * Mock-interview gate (post-MVP tier decision is a config flip, not a deploy):
   * mi_min_tier: who may RUN the timed simulation ('paid' default).
   * mi_report_unlock_credits: price for a non-included tier to unlock the full
   * report (deliberately expensive — the anchor that makes upgrading look good).
   */
  mi_min_tier?: "free" | "paid";
  mi_report_unlock_credits?: number;
  /** Fixed plan-key quota matrix, merged with defaults when omitted. */
  plan_quotas?: Partial<Record<PlanKey, Partial<PlanQuota>>>;
  /** Fixed user-visible AI tool quota matrix, merged with defaults when omitted. */
  tool_quotas?: Record<string, Partial<ToolQuota>>;
  enabled?: boolean;
  updated_at?: string;
  updated_by?: string;
}

/** Append-only audit trail for per-operator daily credit-adjustment totals (A1 fix). */
export const ADMIN_DAILY_TOTALS_COLLECTION = "admin_daily_totals";

export interface AccessDoc {
  /** LEGACY: portal-granted admin UIDs (resolved as role 'admin'). */
  admin_uids?: string[];
  /** Sprint-3 RBAC: uid → AdminEntry map. */
  admins?: Record<string, import("../admin/roles").AdminEntry>;
}

export interface UsageEventDoc {
  uid: string;
  tool: string;
  credit_cost: number;
  // "free" = a $0 helper run, metered for the daily run cap but never charged.
  status: "deducted" | "refunded" | "free";
  day_key?: string;
  request_id?: string | null;
  balance_after?: number | null;
  created_at: unknown;
}

export interface UsageCounterDoc {
  day_key: string;
  scope: "global" | "user";
  uid?: string;
  runs: number;
  credits: number;
  updated_at: unknown;
}
