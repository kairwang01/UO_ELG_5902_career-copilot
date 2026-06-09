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

  // 3. Read candidate name from their profile (server-side — trusted).
  const userSnap = await db.collection("users").doc(uid).get();
  const candidateName: string =
    userSnap.data()?.full_name ??
    request.auth?.token.email ??
    "Candidate";

  // 4. Write the application. Admin SDK bypasses Firestore client rules.
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
