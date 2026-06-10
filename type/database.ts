/**
 * TypeScript 接口定义 — Firestore 数据结构
 *
 * 我们的数据库已迁移到 Firestore (NoSQL)。以前的 jsonb 字段现在直接存为标准的
 * JS Object / Array。原来独立的 interview_exchanges 问答记录，现在直接作为
 * exchanges 数组内嵌在 session 里（查面试记录一次拉全，省读取费用）。求职申请里
 * 加了几个【冗余字段】（如 job_title / candidate_name），列表渲染直接用，不要二次查询。
 *
 * 来源说明：本文件最初在 firebase-migration 分支整理；合并到 dev 时补齐了之后新增的
 * 字段（email / preferred_language / custom_provider、agency 角色、job_applications
 * 的 compatibility_score）以及「平台 & 后台」集合（platform_config / usage_events /
 * credit_ledger / admin_audit_log），见文件末尾「4. 平台 & 后台集合」。
 *
 * 这些接口与 firestore.rules 里的校验器(validUser / validJobPosting / …)一一对应——
 * 改 schema 时两处一起改。
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 💡 数据结构总览：
 *
 *  [根集合] users  (原 profiles + auth.users)
 *  ├── [子集合] career_paths
 *  ├── [子集合] interview_sessions   (interview_exchanges 已内嵌为 exchanges 数组)
 *  ├── [子集合] job_opportunities
 *  ├── [子集合] resume_analyses
 *  ├── [子集合] tool_events
 *  └── [子集合] weekly_insights
 *  [根集合] job_postings
 *  [根集合] job_applications
 *
 *  [后台 · server-only] platform_config/{llm | quotas | access | models | prompts}
 *  [后台 · server-only] usage_events  /  credit_ledger  /  admin_audit_log
 */

// ==========================================
// 1. 根集合: users (用户主表)   路径: /users/{uid}
// ==========================================

/** 雇主/商家自带 LLM 端点 (BYOA)。仅服务端经 setBusinessLlmConfig 写入；客户端不可改。 */
export interface CustomProviderConfig {
  base_url: string;
  api_key: string;
  model: string;
}

export interface UserDocument {
  role: 'candidate' | 'employer' | 'agency'; // 默认 'candidate'
  full_name?: string;
  email?: string;                 // 以 Firebase Auth 为权威来源；文档内为冗余
  preferred_language?: string;
  avatar_url?: string;
  subscription_status?: string;   // 'free' | 'essentials' | 'accelerator' | 'executive' | 'single_post' | 'job_pack' | 'pending_*'
  resume_text?: string;

  // 雇主专属字段
  // NOTE: these mirror the firestore.rules validUser whitelist — update both together
  company_name?: string;
  company_description?: string;
  company_logo_url?: string;
  company_website?: string;
  company_size?: string;    // '1-10' | '11-50' | '51-200' | '201-500' | '500+'
  industry?: string;        // e.g. "Software / FinTech / Education"
  founded_year?: string;    // 4-digit year string e.g. "2015"

  // 业务状态字段
  english_pro_streak: number;     // 默认 0
  english_pro_last_practice?: Timestamp;
  wallet_address?: string;
  credits: number;                // 默认 100 (初始授予)

  // LLM 自定义端点 (business / BYOA) — 仅服务端写入
  custom_provider?: CustomProviderConfig;

  created_at: Timestamp;
  updated_at?: Timestamp;
}

// ==========================================
// 2. 子集合 (归属于特定 User)
// ==========================================

// 路径: /users/{uid}/career_paths
export interface CareerPathDocument {
  desired_role: string;
  summary?: string;
  // 原 jsonb 字段转换为 TS 的 Record 或数组
  skill_gaps?: Record<string, any>;
  actionable_steps?: any[];
  bridge_roles?: any[];
  created_at: Timestamp;
}

// 路径: /users/{uid}/interview_sessions
// 💡 原 interview_exchanges 表被内嵌到这里作为 exchanges 数组，避免多余的读取费用
export interface InterviewExchange {
  question_text: string;
  user_answer?: string;
  ai_feedback?: string;
  feedback_themes?: string[];
  created_at: Timestamp;
}

export interface InterviewSessionDocument {
  job_description?: string;
  market_name?: string;
  overall_summary?: string;
  started_at: Timestamp;
  exchanges: InterviewExchange[]; // 内嵌问答记录
}

// 路径: /users/{uid}/job_opportunities
export interface JobOpportunityDocument {
  job_title: string;
  company: string;
  location?: string;
  url: string;                    // 原来是 UNIQUE，Firestore 中需在代码层校验
  ai_summary?: string;
  compatibility_score?: number;
  missing_skills?: Record<string, any>; // 原 jsonb
  is_saved: boolean;              // 默认 true
  created_at: Timestamp;
}

// 路径: /users/{uid}/resume_analyses
export interface ResumeAnalysisDocument {
  event_id?: string;              // 关联的 tool_event ID
  score: number;                  // 0 - 100
  market_name: string;
  summary?: string;
  strengths?: any[];              // 原 jsonb
  improvements?: any[];           // 原 jsonb
  keywords?: string[];            // 原 jsonb
  created_at: Timestamp;
}

// 路径: /users/{uid}/tool_events
export interface ToolEventDocument {
  tool_key: string;
  metadata?: Record<string, any>; // 原 jsonb
  created_at: Timestamp;
}

// 路径: /users/{uid}/weekly_insights
export interface WeeklyInsightDocument {
  week_start_date: Timestamp;
  summary_text: string;
  actionable_tip?: string;
  created_at: Timestamp;
}

// ==========================================
// 3. 根集合: 职位与申请
// ==========================================

// 路径: /job_postings/{job_id}
export interface JobPostingDocument {
  employer_id: string;            // 关联 User UID
  title: string;
  description?: string;
  location?: string;
  salary_range?: string;
  is_active: boolean;             // 默认 true
  created_at: Timestamp;
  updated_at: Timestamp;
}

// 路径: /job_applications/{application_id}
export interface JobApplicationDocument {
  job_id: string;                 // 关联 JobPosting ID
  candidate_id: string;           // 关联 User UID (候选人)

  // 💡 重点：以下为 NoSQL 独有的【冗余字段】，避免前端同时查 users 和 job_postings
  employer_id: string;
  job_title: string;
  candidate_name: string;

  status: 'Applied' | 'Interviewing' | 'Rejected' | 'Hired'; // 默认 'Applied'
  compatibility_score?: number;   // dev 新增：申请时记录匹配度
  notes?: string;
  application_date: Timestamp;
}

// ==========================================
// 4. 平台 & 后台集合 (Admin platform — dev 新增, 仅服务端 / Admin SDK 读写)
//    firestore.rules 对客户端一律默认拒绝；只有 admin* Cloud Functions 可读写。
// ==========================================

// 路径: /platform_config/llm  — admin 管理的 LLM 凭证 (api_key 仅服务端可见，前端只拿掩码)
export interface PlatformLlmConfig {
  gemini_api_key?: string;
  gemini_model?: string;
  kairllm_api_key?: string;
  kairllm_base_url?: string;
  deepseek_api_key?: string;
  deepseek_base_url?: string;
  updated_at?: string;            // ISO 字符串
  updated_by?: string;            // admin uid
}

// 路径: /platform_config/quotas  — 全局/单用户每日上限 (0 = 不限)
export interface PlatformQuotas {
  daily_tool_run_limit?: number;
  daily_credit_spend_limit?: number;
  per_user_daily_credit_limit?: number;
  enabled?: boolean;
  updated_at?: string;
  updated_by?: string;
}

// 路径: /platform_config/access  — 管理员白名单
// Sprint-3 新增：admins map 存储 RBAC 角色条目（reviewer / admin / super）。
// 旧字段 admin_uids 作为 LEGACY 兼容字段保留（解析为 'admin' 角色）。
// ADMIN_UIDS 环境变量引导的 UID 不存储于此；服务端解析为 'super'。
export type AdminRole = "super" | "admin" | "reviewer";

export interface AdminEntry {
  role: AdminRole;
  email?: string | null;
  invited_by?: string | null;  // 邀请者 UID
  invited_at?: string | null;  // ISO 字符串
  status: "active" | "disabled";
}

export interface PlatformAccess {
  /** LEGACY: 门户授予的管理员 UID 列表（解析为 'admin' 角色）。新入口请用 admins map。 */
  admin_uids?: string[];
  /** Sprint-3 RBAC: uid → AdminEntry 映射。status=disabled 的条目等同于已撤销。 */
  admins?: Record<string, AdminEntry>;
  updated_at?: string;
  updated_by?: string;
}

// 路径: /admin_daily_totals/{operatorUid}_{YYYYMMDD}
// Sprint-3 A1 修复：追踪管理员每日积分调整总量，防止无上限地授予积分。
// 每条文档对应一个操作员的一天。服务端在事务中读写，避免并发竞争。
export interface AdminDailyTotalDocument {
  operator_uid: string;
  date: string;   // YYYYMMDD UTC
  total: number;  // |delta| 绝对值累计（不区分加/减）
}

// 单条模型注册项 (platform_config/models.models[])
export interface ModelEntry {
  id: string;                     // 选择 id（前端 picker 用）
  label: string;                  // 显示名（可在 admin 改）
  provider: 'gemini' | 'openai-compatible';
  base_url?: string;              // openai-compatible 自定义端点
  api_key?: string;               // 自定义 key；builtin 时可省（继承 platform_config/llm）
  builtin?: 'kairllm' | 'deepseek';
  providerModel: string;          // 传给 provider 的 model（'' = provider 默认）
  minTier: 'free' | 'paid' | 'business';
  enabled: boolean;
}

// 路径: /platform_config/models  — 动态模型注册表（空 = 用代码内置 DEFAULT_MODELS）
export interface PlatformModels {
  models?: ModelEntry[];
}

// 路径: /platform_config/prompts  — { promptKey: 模板字符串 }，覆盖代码内置默认提示词
export type PlatformPrompts = Record<string, string>;

// 路径: /usage_events/{id}  — 每次计费工具运行的事件流
export interface UsageEventDocument {
  uid: string;
  tool: string;
  credit_cost: number;
  status: 'deducted' | 'refunded';
  created_at: Timestamp;
}

// 路径: /credit_ledger/{id}  — 积分流水（扣费 / 退款 / 管理员调整）
export interface CreditLedgerDocument {
  uid: string;
  amount: number;                 // +增 / -扣
  balance_after: number;
  reason: string;                 // e.g. 'admin_adjustment' | tool key
  tool?: string;
  admin_uid?: string;             // 管理员调整时记录
  created_at: Timestamp;
}

// 路径: /admin_audit_log/{id}  — 所有 admin 变更的只读审计流水（绝不记录原始 key）
export interface AdminAuditDocument {
  admin_uid: string;
  action: string;                 // adjust_credits | set_subscription | set_admin | update_llm_config | update_quotas | create_model | update_model | delete_model | test_model | ...
  target_uid?: string | null;
  details?: Record<string, unknown>;
  created_at: Timestamp;
}