/**
 * onUserCreated — Firebase Auth trigger.
 *
 * Fires automatically when a new user registers via Firebase Auth.
 * Creates the initial users/{uid} Firestore document with:
 *   - 100 starting credits
 *   - role: "candidate" (default; user can change in profile)
 *   - subscription_status: "free"
 *
 * Without this document, deductCredits throws "not-found" and every
 * AI call fails. This trigger makes registration → AI call work end-to-end.
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { USERS_COLLECTION, USER_FIELDS } from "../credits/schema";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const INITIAL_CREDITS = 100;

export const onUserCreatedFunction = functions.auth.user().onCreate(async (user) => {
  const now = new Date().toISOString();

  const userDoc = {
    [USER_FIELDS.credits]: INITIAL_CREDITS,
    [USER_FIELDS.role]: "candidate",
    [USER_FIELDS.subscriptionStatus]: "free",
    [USER_FIELDS.fullName]: user.displayName ?? null,
    [USER_FIELDS.avatarUrl]: user.photoURL ?? null,
    [USER_FIELDS.createdAt]: now,
    [USER_FIELDS.updatedAt]: now,
  };

  try {
    // merge: true — if Auth.tsx has already written role/subscription_status,
    // those fields are preserved. credits is always set by the trigger.
    await db.collection(USERS_COLLECTION).doc(user.uid).set(userDoc, { merge: true });
    console.log(`onUserCreated: provisioned users/${user.uid} with ${INITIAL_CREDITS} credits`);
  } catch (err) {
    console.error(`onUserCreated: failed to provision users/${user.uid}`, err);
    // Do not rethrow — a failed trigger should not block Auth user creation.
  }
});
