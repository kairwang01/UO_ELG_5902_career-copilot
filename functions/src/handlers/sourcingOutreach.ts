/**
 * sourcingOutreach — consent-gated unlock flow for Discover Talent.
 *
 * discoverTalent intentionally returns only safe, non-contact candidate signals.
 * This handler is the controlled bridge for BOSS/LinkedIn-style sourcing:
 *   - employers/agencies may request contact with a candidate, optionally tied to
 *     one of their jobs.
 *   - candidates may accept or decline the request.
 *   - only after acceptance can the requesting employer fetch the richer packet.
 *
 * Firestore rules let the two parties read their own outreach record, but all
 * writes are server-only through these callables.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "../middleware/auth";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const OUTREACH_STATUSES = new Set(["requested", "accepted", "declined", "cancelled"]);
const RESPONSE_ACTIONS = new Set(["accept", "decline"]);
const MAX_MESSAGE = 2000;
const MAX_NOTE = 1000;

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

function outreachIdFor(employerId: string, candidateId: string, jobId: string): string {
  return [employerId, candidateId, jobId || "general"].map((part) => encodeURIComponent(part)).join("__");
}

async function loadBusinessUser(uid: string): Promise<Record<string, unknown>> {
  const snap = await db.collection("users").doc(uid).get();
  const data = snap.data() ?? {};
  const role = typeof data.role === "string" ? data.role : "";
  if (role !== "employer" && role !== "agency") {
    throw new HttpsError("permission-denied", "Sourcing outreach is available to business accounts only.");
  }
  return data;
}

async function loadCandidateUser(candidateId: string): Promise<Record<string, unknown>> {
  if (!candidateId) throw new HttpsError("invalid-argument", "candidateId is required.");
  const snap = await db.collection("users").doc(candidateId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Candidate not found.");
  const data = snap.data() ?? {};
  if (data.role !== "candidate") {
    throw new HttpsError("failed-precondition", "Sourcing outreach can only target candidate accounts.");
  }
  return data;
}

async function loadOwnedJob(uid: string, jobId: string): Promise<Record<string, unknown> | undefined> {
  if (!jobId) return undefined;
  const snap = await db.collection("job_postings").doc(jobId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Job not found.");
  const data = snap.data() ?? {};
  if (data.employer_id !== uid) {
    throw new HttpsError("permission-denied", "You can only source candidates for your own jobs.");
  }
  return data;
}

function plainJson(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => plainJson(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const maybeTimestamp = value as { toDate?: unknown };
    if (typeof maybeTimestamp.toDate === "function") {
      return (maybeTimestamp.toDate as () => Date)().toISOString();
    }
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const clean = plainJson(nested, depth + 1);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return undefined;
}

function pickString(data: Record<string, unknown>, keys: string[], max: number): string {
  for (const key of keys) {
    const value = str(data[key], max);
    if (value) return value;
  }
  return "";
}

function candidatePacket(candidateId: string, user: Record<string, unknown>, profile: Record<string, unknown> | undefined) {
  return {
    id: candidateId,
    full_name: pickString(user, ["full_name", "name", "display_name"], 200),
    email: pickString(user, ["email"], 320),
    phone: pickString(user, ["phone", "phone_number"], 80),
    location: pickString(user, ["location", "city"], 160),
    headline: pickString(user, ["headline", "target_role", "desired_role"], 240),
    website: pickString(user, ["personal_website", "website", "portfolio_url"], 500),
    linkedin: pickString(user, ["linkedin", "linkedin_url"], 500),
    github: pickString(user, ["github", "github_url"], 500),
    resume_text: pickString(user, ["resume_text"], 80_000),
    talent_profile: plainJson(profile ?? {}),
  };
}

export async function createSourcingOutreachImpl(uid: string, data: Record<string, unknown>) {
  const business = await loadBusinessUser(uid);
  const candidateId = str(data.candidateId, 200);
  if (candidateId === uid) throw new HttpsError("invalid-argument", "You cannot source your own account.");
  await loadCandidateUser(candidateId);

  const message = str(data.message, MAX_MESSAGE);
  if (!message) throw new HttpsError("invalid-argument", "Outreach message is required.");
  const jobId = str(data.jobId, 200);
  const job = await loadOwnedJob(uid, jobId);

  const ref = db.collection("sourcing_outreach").doc(outreachIdFor(uid, candidateId, jobId));
  const now = FieldValue.serverTimestamp();
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    const status = existing.exists ? str(existing.data()?.status, 40) : "";

    if (status === "requested" || status === "accepted") {
      return { outreachId: ref.id, status, duplicate: true };
    }
    if (status && !OUTREACH_STATUSES.has(status)) {
      throw new HttpsError("failed-precondition", "Existing outreach record has an invalid status.");
    }

    tx.set(ref, {
      employer_id: uid,
      candidate_id: candidateId,
      job_id: jobId,
      job_title: pickString(job ?? {}, ["title"], 240),
      company_name: pickString(job ?? business, ["company_name", "company"], 240),
      message,
      status: "requested",
      request_source: str(data.requestSource, 80) || "discover_talent",
      previous_status: status || "",
      created_at: now,
      updated_at: now,
    });

    return { outreachId: ref.id, status: "requested", duplicate: false };
  });
}

export async function respondSourcingOutreachImpl(uid: string, data: Record<string, unknown>) {
  const outreachId = str(data.outreachId, 300);
  if (!outreachId) throw new HttpsError("invalid-argument", "outreachId is required.");
  const action = str(data.action, 20);
  if (!RESPONSE_ACTIONS.has(action)) {
    throw new HttpsError("invalid-argument", "action must be accept or decline.");
  }
  const status = action === "accept" ? "accepted" : "declined";
  const ref = db.collection("sourcing_outreach").doc(outreachId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Outreach request not found.");
    const outreach = snap.data() ?? {};
    if (outreach.candidate_id !== uid) {
      throw new HttpsError("permission-denied", "Only the requested candidate can respond.");
    }
    if (outreach.status !== "requested") {
      throw new HttpsError("failed-precondition", "This outreach request is no longer pending.");
    }

    tx.update(ref, {
      status,
      candidate_response_note: str(data.note, MAX_NOTE),
      responded_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
  });
  return { outreachId, status };
}

export async function cancelSourcingOutreachImpl(uid: string, data: Record<string, unknown>) {
  const outreachId = str(data.outreachId, 300);
  if (!outreachId) throw new HttpsError("invalid-argument", "outreachId is required.");
  const ref = db.collection("sourcing_outreach").doc(outreachId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Outreach request not found.");
    const outreach = snap.data() ?? {};
    if (outreach.employer_id !== uid) {
      throw new HttpsError("permission-denied", "Only the requesting employer can cancel.");
    }
    if (outreach.status !== "requested") {
      throw new HttpsError("failed-precondition", "Only pending outreach requests can be cancelled.");
    }
    tx.update(ref, {
      status: "cancelled",
      cancellation_note: str(data.note, MAX_NOTE),
      updated_at: FieldValue.serverTimestamp(),
    });
  });
  return { outreachId, status: "cancelled" };
}

export async function getSourcingCandidatePacketImpl(uid: string, data: Record<string, unknown>) {
  const outreachId = str(data.outreachId, 300);
  if (!outreachId) throw new HttpsError("invalid-argument", "outreachId is required.");
  const snap = await db.collection("sourcing_outreach").doc(outreachId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Outreach request not found.");
  const outreach = snap.data() ?? {};
  if (outreach.employer_id !== uid) {
    throw new HttpsError("permission-denied", "Only the requesting employer can unlock this packet.");
  }
  if (outreach.status !== "accepted") {
    throw new HttpsError("failed-precondition", "The candidate has not accepted this outreach request.");
  }
  const candidateId = typeof outreach.candidate_id === "string" ? outreach.candidate_id : "";
  if (!candidateId) throw new HttpsError("failed-precondition", "Outreach request is missing candidate reference.");

  const [userSnap, profileSnap] = await Promise.all([
    db.collection("users").doc(candidateId).get(),
    db.collection("talent_profiles").doc(candidateId).get(),
  ]);
  if (!userSnap.exists) throw new HttpsError("not-found", "Candidate not found.");

  return {
    outreachId,
    status: "accepted",
    candidate: candidatePacket(candidateId, userSnap.data() ?? {}, profileSnap.exists ? profileSnap.data() : undefined),
  };
}

export const createSourcingOutreachFunction = onCall({ invoker: "public" }, (request) =>
  createSourcingOutreachImpl(requireAuth(request), request.data ?? {}));

export const respondSourcingOutreachFunction = onCall({ invoker: "public" }, (request) =>
  respondSourcingOutreachImpl(requireAuth(request), request.data ?? {}));

export const cancelSourcingOutreachFunction = onCall({ invoker: "public" }, (request) =>
  cancelSourcingOutreachImpl(requireAuth(request), request.data ?? {}));

export const getSourcingCandidatePacketFunction = onCall({ invoker: "public" }, (request) =>
  getSourcingCandidatePacketImpl(requireAuth(request), request.data ?? {}));
