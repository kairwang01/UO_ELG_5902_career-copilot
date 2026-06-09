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
   * API key for openai-compatible providers.
   * Empty / omitted → fall back to the built-in key resolved via `builtin`.
   * NEVER returned raw to clients — always masked.
   */
  api_key?: string;
  /**
   * When set, inherits key + base_url from the named platform_config/llm entry
   * when `api_key` / `base_url` on this entry are absent.
   */
  builtin?: "kairllm" | "deepseek";
  /** Model name passed to the provider. "" = provider default. */
  providerModel: string;
  /** Minimum tier required to select this model. */
  minTier: "free" | "paid" | "business";
  /** When false the model is hidden from pickers and cannot be resolved. */
  enabled: boolean;
}

/** Firestore shape of platform_config/models. */
export interface ModelsDoc {
  models?: ModelEntry[];
}

export const USAGE_EVENTS_COLLECTION = "usage_events";
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

export interface QuotasDoc {
  /** Global cap on billable tool runs per UTC day (0 = unlimited). */
  daily_tool_run_limit?: number;
  /** Global cap on credits spent per UTC day (0 = unlimited). */
  daily_credit_spend_limit?: number;
  /** Per-user cap on credits spent per UTC day (0 = unlimited). */
  per_user_daily_credit_limit?: number;
  enabled?: boolean;
  updated_at?: string;
  updated_by?: string;
}

export interface AccessDoc {
  admin_uids?: string[];
}

export interface UsageEventDoc {
  uid: string;
  tool: string;
  credit_cost: number;
  status: "deducted" | "refunded";
  created_at: unknown;
}
