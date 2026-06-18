/**
 * updateApplicationStatus — audited employer-owned status transitions.
 *
 * Replaces direct client updateDoc(job_applications/{id}) writes. The callable
 * verifies the employer owns the authoritative job posting, updates the lean
 * application document, and writes a server-only audit event with actor + notes.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth } from "../middleware/auth";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const KNOWN_STATUSES = [
  "Applied",
  "Group Interview",
  "First Interview",
  "Second Interview",
  "Decision Maker Interview",
  "HR Interview",
  "Offer",
  "Hiring Evaluation",
  "Intent Letter",
  "Offer Confirmed",
  "Tripartite Agreement",
  "Signed",
  "Rejected",
] as const;

type ApplicationStatus = (typeof KNOWN_STATUSES)[number];

const KNOWN_STATUS_SET = new Set<string>(KNOWN_STATUSES);
const STATUS_ALIASES: Record<string, ApplicationStatus> = {
  applied: "Applied",
  apply: "Applied",
  submitted: "Applied",
  "resume submitted": "Applied",
  "投递简历": "Applied",
  "已投递": "Applied",
  interviewing: "First Interview",
  interview: "First Interview",
  "interview-stage": "First Interview",
  "interview stage": "First Interview",
  "面试中": "First Interview",
  "group interview": "Group Interview",
  "集体面试": "Group Interview",
  "first interview": "First Interview",
  "初试": "First Interview",
  "second interview": "Second Interview",
  "复试": "Second Interview",
  "decision maker interview": "Decision Maker Interview",
  "hiring manager interview": "Decision Maker Interview",
  "用人决策者面试": "Decision Maker Interview",
  "hr interview": "HR Interview",
  "hr面试": "HR Interview",
  offer: "Offer",
  "录用评估中": "Hiring Evaluation",
  "hiring evaluation": "Hiring Evaluation",
  "intent letter": "Intent Letter",
  "确认意向书": "Intent Letter",
  "offer confirmed": "Offer Confirmed",
  accepted: "Offer Confirmed",
  "确认offer": "Offer Confirmed",
  "tripartite agreement": "Tripartite Agreement",
  "三方协议": "Tripartite Agreement",
  signed: "Signed",
  hired: "Signed",
  "签约": "Signed",
  "已录用": "Signed",
  rejected: "Rejected",
  closed: "Rejected",
  declined: "Rejected",
  "未通过": "Rejected",
};

interface UpdateApplicationStatusRequest {
  applicationId?: unknown;
  status?: unknown;
  reason?: unknown;
  candidateNote?: unknown;
}

function cleanText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function normalizeStatus(value: unknown): ApplicationStatus | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (KNOWN_STATUS_SET.has(raw)) return raw as ApplicationStatus;
  const lower = raw.toLowerCase();
  const caseHit = KNOWN_STATUSES.find((status) => status.toLowerCase() === lower);
  if (caseHit) return caseHit;
  return STATUS_ALIASES[raw] ?? STATUS_ALIASES[lower] ?? null;
}

export const updateApplicationStatusFunction = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuth(request);
  const data = (request.data ?? {}) as UpdateApplicationStatusRequest;

  const applicationId = cleanText(data.applicationId, 256);
  if (!applicationId || applicationId.includes("/")) {
    throw new HttpsError("invalid-argument", "applicationId is required.");
  }

  const nextStatus = normalizeStatus(data.status);
  if (!nextStatus) {
    throw new HttpsError("invalid-argument", "Unknown application status.");
  }

  const reason = cleanText(data.reason, 500);
  const candidateNote = cleanText(data.candidateNote, 1000);
  const appRef = db.collection("job_applications").doc(applicationId);
  const eventRef = db.collection("application_status_events").doc();

  return db.runTransaction(async (tx) => {
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists) {
      throw new HttpsError("not-found", "Application not found.");
    }

    const app = appSnap.data()!;
    const candidateId = typeof app.candidate_id === "string" ? app.candidate_id : "";
    const jobId = typeof app.job_id === "string" ? app.job_id : "";
    if (!candidateId || !jobId) {
      throw new HttpsError("failed-precondition", "Application is missing a candidate or job reference.");
    }

    const jobRef = db.collection("job_postings").doc(jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists || jobSnap.data()?.employer_id !== uid) {
      throw new HttpsError("permission-denied", "You do not own the job for this application.");
    }

    const previousStatus = normalizeStatus(app.status) ?? "Applied";
    if (previousStatus === nextStatus) {
      return {
        applicationId,
        previousStatus,
        status: nextStatus,
        eventId: null,
        changed: false,
      };
    }

    tx.update(appRef, {
      status: nextStatus,
    });
    tx.create(eventRef, {
      application_id: applicationId,
      job_id: jobId,
      candidate_id: candidateId,
      employer_id: uid,
      from_status: previousStatus,
      to_status: nextStatus,
      actor_id: uid,
      actor_role: "employer",
      reason: reason || null,
      candidate_note: candidateNote || null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      applicationId,
      previousStatus,
      status: nextStatus,
      eventId: eventRef.id,
      changed: true,
    };
  });
});
