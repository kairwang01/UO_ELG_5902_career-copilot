/**
 * companyReviews — Glassdoor-style company review feature.
 *
 * createCompanyReviewFunction:
 *   Server-only writes with graded employer-verification gate.
 *   A candidate may write a review for employer X iff they reached the interview
 *   stage or beyond in the application pipeline for that employer. Eligibility is
 *   checked against the immutable `application_status_events` audit log (so a
 *   candidate who interviewed but was later rejected still qualifies), with a
 *   belt-and-suspenders cross-check against current `job_applications` statuses.
 *   The highest stage ever reached determines the `verification_tier`:
 *     - "interviewed" — reached any interview round
 *     - "offer"       — received an offer / intent letter / hiring evaluation
 *     - "hired"       — signed (Signed status)
 *
 * Review doc id is `${employerId}_${uid}` — one review per candidate per company,
 * revisions allowed via set(..., {merge:true}).
 *
 * Reads (listCompanyReviewsFunction) are open to any signed-in user. The callable
 * uses the Admin SDK to project out `author_uid` and the identity-encoding doc id,
 * returning `verification_tier` in place of the raw `verified` boolean so readers
 * can see how deeply a reviewer engaged with the company without exposing PII.
 *
 * NOTE: the export line in index.ts is added by a separate agent.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { requireAuth } from "../middleware/auth";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Pipeline status → group. Mirrors lib/applicationPipeline.ts, inlined because
// functions/src cannot import the root lib/ (tsconfig includes src/** only).
const INTERVIEW_STATUSES = new Set([
  "Group Interview",
  "First Interview",
  "Second Interview",
  "Decision Maker Interview",
  "HR Interview",
]);
const OFFER_STATUSES = new Set([
  "Offer",
  "Hiring Evaluation",
  "Intent Letter",
  "Offer Confirmed",
  "Tripartite Agreement",
]);
const HIRED_STATUSES = new Set(["Signed"]);

type VerificationTier = "interviewed" | "offer" | "hired";

// Rank so we can take the highest stage ever reached. 0 = below threshold.
function statusTierRank(status: string): number {
  if (HIRED_STATUSES.has(status)) return 3;
  if (OFFER_STATUSES.has(status)) return 2;
  if (INTERVIEW_STATUSES.has(status)) return 1;
  return 0;
}

const RANK_TO_TIER: Record<number, VerificationTier> = {
  3: "hired",
  2: "offer",
  1: "interviewed",
};

interface CreateCompanyReviewRequest {
  employerId: string;
  rating: number;
  text: string;
}

export const createCompanyReviewFunction = onCall(
  { invoker: "public" },
  async (request) => {
    const uid = requireAuth(request);
    const data = request.data as CreateCompanyReviewRequest;

    // ── Input validation ────────────────────────────────────────────────────

    if (
      !data.employerId ||
      typeof data.employerId !== "string" ||
      data.employerId.trim().length === 0 ||
      data.employerId.trim().length > 128
    ) {
      throw new HttpsError(
        "invalid-argument",
        "employerId must be a non-empty string of at most 128 characters."
      );
    }

    const employerId = data.employerId.trim();

    if (
      typeof data.rating !== "number" ||
      !Number.isInteger(data.rating) ||
      data.rating < 1 ||
      data.rating > 5
    ) {
      throw new HttpsError(
        "invalid-argument",
        "rating must be an integer between 1 and 5."
      );
    }

    const text =
      typeof data.text === "string" ? data.text.trim() : "";
    if (text.length < 20 || text.length > 2000) {
      throw new HttpsError(
        "invalid-argument",
        "Review text must be between 20 and 2000 characters."
      );
    }

    // ── Verification: highest pipeline stage ever reached at this employer ──
    // Use the immutable audit log so a candidate who interviewed and was later
    // rejected still qualifies (their current status would be "Rejected").
    let bestRank = 0;

    // .limit(200) is a defensive read cap, not a correctness guarantee: we only
    // need the max rank across all events, which is order-independent, so no
    // orderBy is needed. In practice a candidate will have far fewer than 200
    // status transitions at one employer; the belt-and-suspenders job_applications
    // query below covers the edge case where an application was written directly
    // at an interview status with no preceding events.
    const eventsSnap = await db
      .collection("application_status_events")
      .where("candidate_id", "==", uid)
      .where("employer_id", "==", employerId)
      .limit(200)
      .get();
    eventsSnap.docs.forEach((d) => {
      const toStatus = typeof d.data().to_status === "string" ? d.data().to_status : "";
      bestRank = Math.max(bestRank, statusTierRank(toStatus));
    });

    // Also consider current application statuses (belt-and-suspenders).
    const appsSnap = await db
      .collection("job_applications")
      .where("candidate_id", "==", uid)
      .where("employer_id", "==", employerId)
      .limit(25)
      .get();
    appsSnap.docs.forEach((d) => {
      const status = typeof d.data().status === "string" ? d.data().status : "";
      bestRank = Math.max(bestRank, statusTierRank(status));
    });

    if (bestRank < 1) {
      throw new HttpsError(
        "failed-precondition",
        "Only candidates who interviewed (or progressed further) through the platform can review this company."
      );
    }

    const verificationTier: VerificationTier = RANK_TO_TIER[bestRank];

    // ── Snapshot company_name from users/{employerId} ───────────────────────

    const employerSnap = await db.collection("users").doc(employerId).get();
    const companyName: string =
      employerSnap.data()?.company_name ?? "Company";

    // ── Write (upsert — user may revise their one review) ───────────────────

    const docId = `${employerId}_${uid}`;
    const reviewRef = db.collection("company_reviews").doc(docId);

    const existingSnap = await reviewRef.get();
    const createdAt = existingSnap.exists
      ? existingSnap.data()?.created_at
      : admin.firestore.FieldValue.serverTimestamp();

    await reviewRef.set(
      {
        employer_id: employerId,
        company_name: companyName,
        author_uid: uid,
        rating: data.rating,
        text,
        verification_tier: verificationTier,
        verified: verificationTier === "hired",
        created_at: createdAt,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true };
  }
);

/**
 * listCompanyReviewsFunction — returns a company's reviews with ZERO identifying
 * data. Direct client reads of company_reviews are denied in firestore.rules
 * because the raw doc carries author_uid AND an identity-encoding doc id
 * (`${employerId}_${uid}`) — readable directly via the SDK regardless of the
 * client helper. This callable (Admin SDK) projects out both, so a reviewer can
 * never be de-anonymized.
 */
interface ListCompanyReviewsRequest {
  employerId?: unknown;
}

export const listCompanyReviewsFunction = onCall({ invoker: "public" }, async (request) => {
  requireAuth(request); // any signed-in user may read aggregate reviews (no PII returned)

  const data = (request.data ?? {}) as ListCompanyReviewsRequest;
  const employerId = typeof data.employerId === "string" ? data.employerId.trim() : "";
  if (!employerId) {
    throw new HttpsError("invalid-argument", "employerId is required.");
  }

  const snap = await db
    .collection("company_reviews")
    .where("employer_id", "==", employerId)
    .get();

  const reviews = snap.docs
    .map((d) => {
      const r = d.data();
      const createdAt =
        r.created_at && typeof (r.created_at as { toDate?: unknown }).toDate === "function"
          ? (r.created_at as admin.firestore.Timestamp).toDate().toISOString()
          : null;
      const tier =
        r.verification_tier === "hired" ||
        r.verification_tier === "offer" ||
        r.verification_tier === "interviewed"
          ? r.verification_tier
          : r.verified === true
          ? "hired"
          : "interviewed";
      return {
        rating: typeof r.rating === "number" ? r.rating : 0,
        text: typeof r.text === "string" ? r.text : "",
        verified: r.verified === true,
        verification_tier: tier,
        created_at: createdAt,
      };
    })
    // newest first (ISO strings sort lexicographically; nulls last)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return { reviews };
});

/**
 * onCompanyReviewWritten — maintains employer_rating/{employerId} = { avg, count }
 * so job cards can show a rating chip without an expensive per-card callable.
 * Mirrors the employer_responsiveness aggregate pattern. Best-effort: never throws
 * into a Cloud Function retry loop.
 */
export const onCompanyReviewWrittenFunction = onDocumentWritten(
  "company_reviews/{id}",
  async (event) => {
    try {
      const after = event.data?.after?.data();
      const before = event.data?.before?.data();
      const employerId =
        (typeof after?.employer_id === "string" && after.employer_id) ||
        (typeof before?.employer_id === "string" && before.employer_id) ||
        "";
      if (!employerId) return;

      const snap = await db
        .collection("company_reviews")
        .where("employer_id", "==", employerId)
        .get();

      const ratings = snap.docs
        .map((d) => d.data().rating)
        .filter((r): r is number => typeof r === "number");
      const count = ratings.length;
      const avg =
        count === 0
          ? 0
          : Math.round((ratings.reduce((a, b) => a + b, 0) / count) * 10) / 10;

      await db.collection("employer_rating").doc(employerId).set({
        avg,
        count,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      // best-effort; swallow so the function never retries forever
      console.error("onCompanyReviewWritten failed", err);
    }
  }
);
