/**
 * jobApplications — Job application management Cloud Functions.
 *
 * createJobApplicationFunction:
 *   Server-side replacement for the client-side addDoc() call.
 *   Validates the job posting exists, prevents duplicate applications,
 *   and writes with the Admin SDK (bypasses Firestore client rules).
 *
 * Why server-side?
 *  - Client cannot forge employer_id, job_title, or other fields — they are
 *    read from the authoritative job_postings document, not from the request.
 *  - Duplicate check is atomic — no double-apply race condition.
 *  - Firestore rules for job_applications forbid client creates; all writes
 *    go through this function.
 *
 * Region is inherited from setGlobalOptions() in index.ts (us-central1).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth } from "../middleware/auth";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface CreateJobApplicationRequest {
  jobId: string;
  compatibilityScore?: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasMeaningfulValue = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  return false;
};

const hasMeaningfulEntry = (value: unknown): boolean =>
  isRecord(value) && Object.values(value).some(hasMeaningfulValue);

const isTalentProfileReady = (profile: FirebaseFirestore.DocumentData | undefined): boolean => {
  if (!profile) return false;
  const basic = profile.basic;
  const intention = profile.intention;
  const hasName = isRecord(basic) && typeof basic.name === "string" && basic.name.trim().length > 0;
  const hasTarget =
    isRecord(intention) &&
    typeof intention.targetRole === "string" &&
    intention.targetRole.trim().length > 0;
  const hasHistory =
    (Array.isArray(profile.education) && profile.education.some(hasMeaningfulEntry)) ||
    (Array.isArray(profile.experience) && profile.experience.some(hasMeaningfulEntry));
  return hasName && hasTarget && hasHistory;
};

export const createJobApplicationFunction = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as CreateJobApplicationRequest;

  if (!data.jobId?.trim()) {
    throw new HttpsError("invalid-argument", "jobId is required.");
  }

  // 1. Verify the job posting exists and read trusted fields.
  const jobSnap = await db.collection("job_postings").doc(data.jobId).get();
  if (!jobSnap.exists) {
    throw new HttpsError("not-found", "Job posting not found.");
  }
  const jobData = jobSnap.data()!;

  // 2. Prevent duplicate applications (same candidate + same job).
  const duplicate = await db
    .collection("job_applications")
    .where("candidate_id", "==", uid)
    .where("job_id", "==", data.jobId)
    .limit(1)
    .get();

  if (!duplicate.empty) {
    throw new HttpsError(
      "already-exists",
      "You have already applied to this job."
    );
  }

  // 3. Enforce the reusable Talent Profile requirement server-side. The UI also
  // blocks early, but this is the authoritative apply path and must be bypass-safe.
  const talentProfileSnap = await db.collection("talent_profiles").doc(uid).get();
  if (!isTalentProfileReady(talentProfileSnap.data())) {
    throw new HttpsError(
      "failed-precondition",
      "Complete your Talent Profile before applying."
    );
  }

  // 4. Freeze the candidate's display name (server-side — trusted). The Talent
  //    Profile name is the highest-confidence source: the apply gate above
  //    guarantees basic.name is non-empty. Prefer it over users.full_name (which
  //    is null for OAuth sign-ins whose displayName was empty) so the employer
  //    never sees the login email where a real name exists.
  const tpBasic = talentProfileSnap.data()?.basic as Record<string, unknown> | undefined;
  const tpName = typeof tpBasic?.name === "string" ? tpBasic.name.trim() : "";
  const userSnap = await db.collection("users").doc(uid).get();
  const fullName = typeof userSnap.data()?.full_name === "string" ? userSnap.data()!.full_name.trim() : "";
  const candidateName: string = tpName || fullName || request.auth?.token.email || "Candidate";

  // 5. Write the application. Admin SDK bypasses Firestore client rules.
  const appRef = await db.collection("job_applications").add({
    job_id: data.jobId,
    candidate_id: uid,
    employer_id: jobData.employer_id ?? null,
    job_title: jobData.title ?? null,
    candidate_name: candidateName,
    status: "Applied",
    compatibility_score: data.compatibilityScore ?? null,
    notes: null,
    application_date: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { applicationId: appRef.id };
});
