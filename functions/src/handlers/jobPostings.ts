/**
 * jobPostings — server-only job-posting lifecycle (create / update / close+reopen).
 *
 * Direct client writes to job_postings are forbidden by firestore.rules; every
 * mutation goes through these Admin-SDK callables so the platform can enforce the
 * trust contract a hiring marketplace needs:
 *   - role gate: only employer/agency accounts may post (candidates cannot).
 *   - entitlement: per-plan ACTIVE-job cap (rules can't count; this is why it must
 *     be a callable). Admins bypass.
 *   - identity: company_* fields are read from the employer's authoritative user
 *     doc, NOT the request — a client cannot forge the company on a posting.
 *   - audit: every create/update/close/reopen writes a job_posting_events doc.
 *
 * Region/timeout inherited from setGlobalOptions() in index.ts.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth, isAdminUid } from "../middleware/auth";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Active-job caps per subscription_status. Mirrors the pricing copy
// (site_plan_emp_*_f1 / plan_*_feature_1). Employers default to the free cap.
const JOB_POST_LIMITS: Record<string, number> = {
  free: 3, starter: 8, growth: 20, pro: 100, single_post: 1, job_pack: 10,
};
const DEFAULT_LIMIT = 3;
const POSTER_ROLES = new Set(["employer", "agency"]);

interface Poster {
  role: string;
  subscription_status: string;
  company_name: string | null;
  company_size: string | null;
  industry: string | null;
  founded_year: string | null;
}

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strOrNull = (v: unknown, max: number): string | null => { const s = str(v, max); return s || null; };

async function loadPoster(uid: string): Promise<Poster> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) throw new HttpsError("not-found", "We could not load your profile. Please sign out and back in.");
  const d = snap.data() ?? {};
  return {
    role: typeof d.role === "string" ? d.role : "",
    subscription_status: typeof d.subscription_status === "string" ? d.subscription_status : "free",
    company_name: typeof d.company_name === "string" ? d.company_name : null,
    company_size: typeof d.company_size === "string" ? d.company_size : null,
    industry: typeof d.industry === "string" ? d.industry : null,
    founded_year: typeof d.founded_year === "string" ? d.founded_year : null,
  };
}

function assertPoster(role: string): void {
  if (!POSTER_ROLES.has(role)) {
    throw new HttpsError("permission-denied", "Only employer accounts can post jobs.");
  }
}

const limitFor = (sub: string): number => JOB_POST_LIMITS[sub] ?? DEFAULT_LIMIT;

async function countActiveJobs(uid: string): Promise<number> {
  const snap = await db.collection("job_postings")
    .where("employer_id", "==", uid).where("is_active", "==", true).get();
  return snap.size;
}

async function assertWithinLimit(uid: string, poster: Poster, token?: Record<string, unknown>): Promise<void> {
  if (await isAdminUid(uid, token)) return; // admin override
  const active = await countActiveJobs(uid);
  const limit = limitFor(poster.subscription_status);
  if (active >= limit) {
    throw new HttpsError(
      "failed-precondition",
      `Your plan allows ${limit} active job post${limit === 1 ? "" : "s"}. Close one or upgrade to add more.`,
    );
  }
}

// Core content the client may supply (the form's fields). Company identity is NOT
// taken from here — it is read from the employer's user doc.
function buildContent(input: Record<string, unknown>): Record<string, unknown> {
  const title = str(input.title, 180);
  if (!title) throw new HttpsError("invalid-argument", "A job title is required.");
  return {
    title,
    location: strOrNull(input.location, 180),
    description: strOrNull(input.description, 20000),
    salary_range: strOrNull(input.salary_range, 120),
  };
}

async function writeEvent(jobId: string, employerId: string, action: string, reason: string | null): Promise<void> {
  await db.collection("job_posting_events").add({
    job_id: jobId, employer_id: employerId, action, reason,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  }).catch((e) => console.error("job_posting_events write failed", e));
}

async function ownedJobRef(uid: string, jobId: string) {
  if (!jobId) throw new HttpsError("invalid-argument", "jobId is required.");
  const ref = db.collection("job_postings").doc(jobId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.employer_id !== uid) {
    throw new HttpsError("permission-denied", "You can only change your own job posts.");
  }
  return { ref, snap };
}

export const createJobPostingFunction = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuth(request);
  const poster = await loadPoster(uid);
  assertPoster(poster.role);
  if (!poster.company_name) {
    throw new HttpsError("failed-precondition", "Add your company name in your profile before posting a job.");
  }
  const content = buildContent((request.data?.posting ?? request.data ?? {}) as Record<string, unknown>);
  await assertWithinLimit(uid, poster, request.auth?.token);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = await db.collection("job_postings").add({
    ...content,
    employer_id: uid,
    company_name: poster.company_name,
    company_size: poster.company_size,
    industry: poster.industry,
    founded_year: poster.founded_year,
    is_active: true,
    created_at: now,
    updated_at: now,
  });
  await writeEvent(ref.id, uid, "created", null);
  return { jobId: ref.id };
});

export const updateJobPostingFunction = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuth(request);
  const poster = await loadPoster(uid);
  assertPoster(poster.role);
  const jobId = String(request.data?.jobId ?? "");
  const { ref } = await ownedJobRef(uid, jobId);
  const content = buildContent((request.data?.posting ?? request.data ?? {}) as Record<string, unknown>);
  await ref.update({ ...content, updated_at: admin.firestore.FieldValue.serverTimestamp() });
  await writeEvent(jobId, uid, "updated", null);
  return { jobId };
});

export const setJobPostingActiveFunction = onCall({ invoker: "public" }, async (request) => {
  const uid = requireAuth(request);
  const poster = await loadPoster(uid);
  assertPoster(poster.role);
  const jobId = String(request.data?.jobId ?? "");
  const isActive = request.data?.isActive === true;
  const reason = typeof request.data?.reason === "string" ? request.data.reason.trim().slice(0, 500) : null;
  const { ref, snap } = await ownedJobRef(uid, jobId);

  // Reopening a closed post consumes an active-job slot — re-check the cap.
  if (isActive && snap.data()?.is_active !== true) {
    await assertWithinLimit(uid, poster, request.auth?.token);
  }
  await ref.update({ is_active: isActive, updated_at: admin.firestore.FieldValue.serverTimestamp() });
  await writeEvent(jobId, uid, isActive ? "reopened" : "closed", reason);
  return { jobId, isActive };
});
