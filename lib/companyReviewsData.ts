/**
 * companyReviewsData — typed client helpers for the company reviews feature.
 *
 * listCompanyReviews: reads company_reviews for an employer, strips author_uid,
 *   and client-sorts by created_at desc.
 * aggregateRating: computes { avg (1dp), count } from a review array.
 * submitCompanyReview: calls the createCompanyReview Cloud Function.
 */

import { httpsCallable } from "firebase/functions";
import { firebaseFunctions } from "./firebaseClient";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CompanyReview {
  /** 1–5 integer */
  rating: number;
  text: string;
  verified: boolean;
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
    { reviews: Array<{ rating: number; text: string; verified: boolean; created_at: string | null }> }
  >(firebaseFunctions, "listCompanyReviews");
  const result = await fn({ employerId });
  return (result.data?.reviews ?? []).map((r) => ({
    rating: r.rating,
    text: r.text,
    verified: r.verified,
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
