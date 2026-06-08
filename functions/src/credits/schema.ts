/**
 * Firestore schema constants.
 *
 * ALL Firestore field names and collection paths live here.
 * If the schema ever changes, only this file needs updating —
 * deductCredits.ts and every handler stay untouched.
 *
 * users/{uid} shape:
 *   credits:             number   — current balance (M9 transaction target)
 *   role:                string   — "candidate" | "employer" | "agency"
 *   subscription_status: string   — "free" | "pro" | ...
 *   full_name:           string | null
 *   avatar_url:          string | null
 *   created_at:          string   — ISO timestamp
 *   updated_at:          string   — ISO timestamp
 *
 * Field names use snake_case to match the frontend UserProfile type (types.ts).
 */

/** Top-level collection for user documents. */
export const USERS_COLLECTION = "users";

/** Field names on the users/{uid} document. */
export const USER_FIELDS = {
  credits: "credits",
  role: "role",
  subscriptionStatus: "subscription_status",
  fullName: "full_name",
  avatarUrl: "avatar_url",
  createdAt: "created_at",
  updatedAt: "updated_at",
} as const;

/**
 * Per-tool credit costs — ported from the frontend config/credits.ts.
 * Keep in sync with TOOL_CREDIT_COSTS on the frontend until Phase B is wired end-to-end.
 */
export const TOOL_CREDIT_COSTS: Record<string, number> = {
  "resume-analysis": 10,
  "mock-interview": 20,
  "cover-letter": 10,
  "career-path": 15,
  "opportunity-finder": 10,
  "english-pro": 5,
} as const;
