/**
 * listModels — HTTPS Callable. Returns the AI models the caller is allowed to
 * select (based on their tier) plus the default. The frontend uses this to render
 * the model picker; gating is still re-enforced server-side on every AI call.
 *
 *   const { data } = await httpsCallable(getFunctions(), "listModels")();
 *   // → { tier, defaultModelId, models: [{ id, label, minTier }] }
 */

import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth } from "../middleware/auth";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";
import { tierFromSubscription, modelsForTier, DEFAULT_MODEL_ID } from "../llm/models";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

export const listModelsFunction = onCall(async (request) => {
  const uid = requireAuth(request);
  const snap = await db.collection(USERS_COLLECTION).doc(uid).get();
  const tier = tierFromSubscription(snap.get(USER_FIELDS.subscriptionStatus) as string | undefined);
  const models = modelsForTier(tier).map(({ id, label, minTier }) => ({ id, label, minTier }));
  return { tier, defaultModelId: DEFAULT_MODEL_ID, models };
});
