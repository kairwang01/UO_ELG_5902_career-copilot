/**
 * Admin prompt-management callables.
 *
 * These callables let platform admins read, override, and reset AI prompt
 * templates stored in Firestore (platform_config/prompts).
 *
 * Security:
 *   - Every callable calls `requireAdmin(request)` before any other work.
 *   - Audit logs record key + template length only — never the full body.
 *   - Key validation rejects any key not in the built-in registry.
 *
 * Callable names (as exported from index.ts):
 *   adminGetPrompts    → list all keys with defaults + current overrides
 *   adminUpdatePrompt  → write/replace an override for one key
 *   adminResetPrompt   → delete an override for one key (revert to default)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "../middleware/auth";
import {
  PLATFORM_CONFIG_COLLECTION,
  PLATFORM_DOCS,
} from "../admin/schema";
import {
  getAllPromptOverrides,
  refreshPlatformCaches,
} from "../admin/platformConfig";
import { logAdminAction } from "../admin/usageLog";
import {
  listPromptKeys,
  getPromptDefault,
} from "../llm/prompts";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const PROMPT_MAX_LENGTH = 20_000;

// ---------------------------------------------------------------------------
// adminGetPrompts
// ---------------------------------------------------------------------------

/**
 * Returns all registered prompt keys with their built-in default and current
 * Firestore override (null if no override is stored). Sorted alphabetically.
 */
export const adminGetPromptsFunction = onCall({ invoker: "public" }, async (request) => {
  await requireAdmin(request);

  const overrides = getAllPromptOverrides();
  const keys = listPromptKeys().sort();

  const prompts = keys.map((key) => ({
    key,
    default: getPromptDefault(key),
    override: overrides[key] ?? null,
  }));

  return { prompts };
});

// ---------------------------------------------------------------------------
// adminUpdatePrompt
// ---------------------------------------------------------------------------

interface UpdatePromptRequest {
  key: string;
  template: string;
}

/**
 * Write (or replace) a Firestore override for a single prompt key.
 * The key must exist in the built-in registry; the template must be a non-empty
 * string no longer than PROMPT_MAX_LENGTH characters.
 */
export const adminUpdatePromptFunction = onCall({ invoker: "public" }, async (request) => {
  const adminUid = await requireAdmin(request);

  const { key, template } = (request.data ?? {}) as UpdatePromptRequest;

  // Validate key
  if (!key || typeof key !== "string") {
    throw new HttpsError("invalid-argument", "key is required.");
  }
  const knownKeys = new Set(listPromptKeys());
  if (!knownKeys.has(key)) {
    throw new HttpsError("invalid-argument", `Unknown prompt key: "${key}".`);
  }

  // Validate template
  if (!template || typeof template !== "string" || template.trim() === "") {
    throw new HttpsError("invalid-argument", "template must be a non-empty string.");
  }
  if (template.length > PROMPT_MAX_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `template exceeds maximum length of ${PROMPT_MAX_LENGTH} characters.`
    );
  }

  // Write to Firestore (merge so other keys in the doc are untouched)
  const ref = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.prompts);
  await ref.set({ [key]: template }, { merge: true });

  // Refresh in-memory cache so subsequent calls see the new value immediately
  await refreshPlatformCaches();

  // Audit log: key + length only — never the full body
  await logAdminAction({
    admin_uid: adminUid,
    action: "update_prompt",
    details: { key, length: template.length },
  });

  return { key, override: template };
});

// ---------------------------------------------------------------------------
// adminResetPrompt
// ---------------------------------------------------------------------------

interface ResetPromptRequest {
  key: string;
}

/**
 * Delete the Firestore override for a single prompt key, reverting it to the
 * built-in default. If no override existed this is a no-op (still returns success).
 */
export const adminResetPromptFunction = onCall({ invoker: "public" }, async (request) => {
  const adminUid = await requireAdmin(request);

  const { key } = (request.data ?? {}) as ResetPromptRequest;

  // Validate key
  if (!key || typeof key !== "string") {
    throw new HttpsError("invalid-argument", "key is required.");
  }
  const knownKeys = new Set(listPromptKeys());
  if (!knownKeys.has(key)) {
    throw new HttpsError("invalid-argument", `Unknown prompt key: "${key}".`);
  }

  // Delete the field from the prompts doc (FieldValue.delete() on a merge)
  const ref = db.collection(PLATFORM_CONFIG_COLLECTION).doc(PLATFORM_DOCS.prompts);
  await ref.set(
    { [key]: admin.firestore.FieldValue.delete() },
    { merge: true }
  );

  await refreshPlatformCaches();

  await logAdminAction({
    admin_uid: adminUid,
    action: "reset_prompt",
    details: { key },
  });

  return { key, override: null };
});
