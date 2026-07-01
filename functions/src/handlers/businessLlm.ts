/**
 * businessLlm — User-facing callables for business-tier custom LLM config.
 *
 * Business users (role "employer") may
 * supply their own OpenAI-compatible API endpoint. The config is stored in
 * users/{uid}.custom_provider = { base_url, api_key, model } via the Admin SDK
 * (server-only write — this field is NOT listed in Firestore security rules as
 * client-writable).
 *
 * Security guarantees:
 *   - Only authenticated business users may write their own custom_provider.
 *   - The raw api_key is NEVER returned to the client — only a masked preview.
 *   - base_url is validated to be a valid https URL before persistence.
 *   - Non-business users receive permission-denied; they cannot read or write.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth } from "../middleware/auth";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";
import { isBusinessUser } from "../llm/models";
import { maskSecret } from "../config/env";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/** Maximum allowed lengths to prevent excessively large payloads. */
const MAX_URL_LENGTH = 512;
const MAX_MODEL_LENGTH = 128;
const MAX_API_KEY_LENGTH = 256;

/**
 * Validates that `value` is a non-empty https URL. Returns the trimmed URL or
 * throws HttpsError("invalid-argument") with a human-readable message.
 */
function validateHttpsUrl(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a non-empty string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new HttpsError("invalid-argument", `${fieldName} is too long (max ${MAX_URL_LENGTH} chars).`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpsError("invalid-argument", `${fieldName} is not a valid URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must use HTTPS. Received protocol: ${parsed.protocol}`
    );
  }
  return trimmed;
}

function validateNonEmptyString(value: unknown, fieldName: string, maxLen: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a non-empty string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    throw new HttpsError("invalid-argument", `${fieldName} is too long (max ${maxLen} chars).`);
  }
  return trimmed;
}

/** Asserts the caller is an authenticated business user; returns uid. */
async function requireBusinessUser(request: Parameters<typeof requireAuth>[0]): Promise<string> {
  const uid = requireAuth(request);
  const snap = await db.collection(USERS_COLLECTION).doc(uid).get();
  const subscriptionStatus = snap.get(USER_FIELDS.subscriptionStatus) as string | undefined;
  const role = snap.get(USER_FIELDS.role) as string | undefined;
  if (!isBusinessUser(role, subscriptionStatus)) {
    throw new HttpsError(
      "permission-denied",
      "Custom LLM configuration is available for business accounts only. " +
        "Upgrade to an employer plan to use this feature."
    );
  }
  return uid;
}

/**
 * setBusinessLlmConfig({ base_url, api_key, model })
 *
 * Stores the caller's custom OpenAI-compatible provider config in
 * users/{uid}.custom_provider. Business users only.
 *
 * @throws permission-denied — caller is not a business user.
 * @throws invalid-argument  — base_url is not https, or fields are empty/too long.
 */
export const setBusinessLlmConfigFunction = onCall(
  { invoker: "public" },
  async (request) => {
    const uid = await requireBusinessUser(request);

    const data = request.data as Record<string, unknown>;

    const base_url = validateHttpsUrl(data.base_url, "base_url");
    const api_key = validateNonEmptyString(data.api_key, "api_key", MAX_API_KEY_LENGTH);
    const model = validateNonEmptyString(data.model, "model", MAX_MODEL_LENGTH);

    // Write via Admin SDK — only server-side code can reach this field.
    await db.collection(USERS_COLLECTION).doc(uid).update({
      custom_provider: { base_url, api_key, model },
    });

    return { success: true };
  }
);

/**
 * getBusinessLlmConfig()
 *
 * Returns the caller's stored custom provider config with the api_key masked.
 * NEVER returns the raw api_key. Business users only.
 *
 * Response shape: { base_url, model, api_key_masked } | { configured: false }
 *
 * @throws permission-denied — caller is not a business user.
 */
export const getBusinessLlmConfigFunction = onCall(
  { invoker: "public" },
  async (request) => {
    const uid = await requireBusinessUser(request);

    const snap = await db.collection(USERS_COLLECTION).doc(uid).get();
    const cp = snap.get("custom_provider") as
      | { base_url?: string; api_key?: string; model?: string }
      | undefined;

    if (!cp || !cp.base_url || !cp.model) {
      return { configured: false };
    }

    // SECURITY: api_key is masked — the raw value must NEVER be returned.
    return {
      configured: true,
      base_url: cp.base_url,
      model: cp.model,
      api_key_masked: maskSecret(cp.api_key),
    };
  }
);
