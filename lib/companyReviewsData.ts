/**
 * companyReviewsData — typed client helpers for the company reviews feature.
 *
 * listCompanyReviews: reads company_reviews for an employer, strips author_uid,
 *   and client-sorts by created_at desc.
 * aggregateRating: computes { avg (1dp), count } from a review array.
 * submitCompanyReview: calls the createCompanyReview Cloud Function.
 */

import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { firebaseFunctions, firestoreDb } from "./firebaseClient";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CompanyReview {
  /** 1–5 integer */
  rating: number;
  text: string;
  verified: boolean;
  /** Trust tier derived server-side from the candidate's pipeline relationship. */
  verificationTier: 'hired' | 'offer' | 'interviewed';
  /** ISO string; may be undefined if the server timestamp hasn't committed yet */
  created_at: string | undefined;
}

export interface AggregateRating {
  /** Average rounded to 1 decimal place */
  avg: number;
  count: number;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches all reviews for a given employer (newest-first), via the
 * listCompanyReviews Cloud Function. Direct client reads of company_reviews are
 * DENIED in firestore.rules — the raw doc carries author_uid and an
 * identity-encoding doc id, so reads must go through the server, which projects
 * out everything identifying. The returned objects never contain author_uid.
 */
export async function listCompanyReviews(
  employerId: string
): Promise<CompanyReview[]> {
  const fn = httpsCallable<
    { employerId: string },
    { reviews: Array<{ rating: number; text: string; verified: boolean; verification_tier: 'hired' | 'offer' | 'interviewed'; created_at: string | null }> }
  >(firebaseFunctions, "listCompanyReviews");
  const result = await fn({ employerId });
  return (result.data?.reviews ?? []).map((r) => ({
    rating: r.rating,
    text: r.text,
    verified: r.verified,
    verificationTier: r.verification_tier ?? (r.verified ? 'hired' : 'interviewed'),
    created_at: r.created_at ?? undefined,
  }));
}

/**
 * Computes the aggregate rating for a list of reviews.
 * Returns { avg: 0, count: 0 } when the list is empty.
 */
export function aggregateRating(reviews: CompanyReview[]): AggregateRating {
  if (reviews.length === 0) return { avg: 0, count: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const avg = Math.round((sum / reviews.length) * 10) / 10;
  return { avg, count: reviews.length };
}

/**
 * Submits (or revises) a company review via the createCompanyReview Cloud Function.
 */
export async function submitCompanyReview(
  employerId: string,
  rating: number,
  text: string
): Promise<{ ok: boolean }> {
  const fn = httpsCallable<
    { employerId: string; rating: number; text: string },
    { ok: boolean }
  >(firebaseFunctions, "createCompanyReview");
  const result = await fn({ employerId, rating, text });
  return result.data;
}

/**
 * Reads the employer_rating/{employerId} aggregate { avg, count } maintained by the
 * onCompanyReviewWritten trigger. Returns zeros when the doc is absent (no reviews).
 * Client read is allowed by firestore.rules.
 */
export async function getEmployerRating(
  employerId: string
): Promise<{ avg: number; count: number }> {
  try {
    const snap = await getDoc(doc(firestoreDb, "employer_rating", employerId));
    const d = snap.exists() ? snap.data() : undefined;
    return {
      avg: typeof d?.avg === "number" ? d.avg : 0,
      count: typeof d?.count === "number" ? d.count : 0,
    };
  } catch {
    return { avg: 0, count: 0 };
  }
}
