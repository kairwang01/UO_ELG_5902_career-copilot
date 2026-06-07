/**
 * Provisional Firestore schema constants for the credit system.
 *
 * ALL Firestore field names and collection paths live here.
 * When Xiaoyi delivers the real schema, only this file changes —
 * deductCredits.ts and every handler stay untouched.
 *
 * Provisional shape (agreed 2026-05-29, update when Xiaoyi confirms):
 *
 *   users/{uid}
 *     credits:            number   — current balance (the M9 transaction target)
 *     role:               string   — "candidate" | "employer" | "agency"
 *     subscriptionStatus: string   — "free" | "pro" | ...
 */

/** Top-level collection for user documents. */
export const USERS_COLLECTION = "users";

/** Field names on the users/{uid} document. */
export const USER_FIELDS = {
  credits: "credits",
  role: "role",
  subscriptionStatus: "subscriptionStatus",
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
