/**
 * Auth middleware for Firebase HTTPS Callable functions.
 *
 * Firebase automatically verifies the Firebase Auth ID token for onCall functions.
 * This module provides helpers to assert that auth is present and extract the uid,
 * keeping the auth check uniform across all handlers.
 *
 * Convention (all endpoints):
 *   Frontend sends the Firebase ID token via the standard callables mechanism.
 *   Backend calls requireAuth(request) → resolves uid, or throws 'unauthenticated'.
 *
 * For plain HTTPS functions (not callable), a manual token-verification helper
 * will be added here in Phase B if needed.
 */

import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

/**
 * Asserts that the callable request was made by an authenticated user.
 * Firebase Callable functions automatically verify the ID token; this helper
 * just confirms the auth context is present and returns the uid.
 *
 * @returns The authenticated user's uid.
 * @throws HttpsError("unauthenticated") if the request has no valid auth context.
 */
export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to use this feature."
    );
  }
  return request.auth.uid;
}
