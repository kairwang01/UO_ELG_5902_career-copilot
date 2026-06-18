/**
 * companyReviews — Glassdoor-style company review feature.
 *
 * createCompanyReviewFunction:
 *   Server-only writes with employer-verification gate.
 *   A candidate is a "verified employee" of employer X iff they have a
 *   job_applications doc where candidate_id==caller, employer_id==X, status is
 *   a completed hire state.
 *
 * Review doc id is `${employerId}_${uid}` — one review per candidate per company,
 * revisions allowed via set(..., {merge:true}).
 *
 * Reads are open to any signed-in user (no PII — author_uid is stored but never
 * returned; reads go through listCompanyReviews in lib/companyReviewsData.ts which
 * strips it on the client side).
 *
 * NOTE: the export line in index.ts is added by a separate agent.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAuth } from "../middleware/auth";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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

    // ── Verification: caller must be hired through the platform at this employer ──

    const hiredSnap = await db
      .collection("job_applications")
      .where("candidate_id", "==", uid)
      .where("employer_id", "==", employerId)
      .limit(10)
      .get();

    const isVerified = hiredSnap.docs.some((d) => {
      // "Signed" is the pipeline's only hired status (lib/applicationPipeline.ts,
      // group 'hired'). There is no "Hired" status — that branch never matched.
      return d.data().status === "Signed";
    });

    if (!isVerified) {
      throw new HttpsError(
        "failed-precondition",
        "Only verified employees (hired through the platform) can review this company."
      );
    }

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
        verified: true,
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
      return {
        rating: typeof r.rating === "number" ? r.rating : 0,
        text: typeof r.text === "string" ? r.text : "",
        verified: r.verified === true,
        created_at: createdAt,
      };
    })
    // newest first (ISO strings sort lexicographically; nulls last)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return { reviews };
});
