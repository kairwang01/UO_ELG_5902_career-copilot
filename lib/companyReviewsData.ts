/**
 * companyReviewsData — typed client helpers for the company reviews feature.
 *
 * listCompanyReviews: reads company_reviews for an employer, strips author_uid,
 *   and client-sorts by created_at desc.
 * aggregateRating: computes { avg (1dp), count } from a review array.
 * submitCompanyReview: calls the createCompanyReview Cloud Function.
 */

import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firestoreDb, firebaseFunctions } from "./firebaseClient";

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toIsoOrUndefined(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

function mapReview(data: DocumentData): CompanyReview {
  return {
    rating: typeof data.rating === "number" ? data.rating : 0,
    text: typeof data.text === "string" ? data.text : "",
    verified: data.verified === true,
    created_at: toIsoOrUndefined(data.created_at),
  };
  // NOTE: author_uid is intentionally NOT included — never expose it to UI.
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches all reviews for a given employer, sorted newest-first.
 * author_uid is stripped — not present on the returned type.
 */
export async function listCompanyReviews(
  employerId: string
): Promise<CompanyReview[]> {
  const snap = await getDocs(
    query(
      collection(firestoreDb, "company_reviews"),
      where("employer_id", "==", employerId)
    )
  );

  const reviews = snap.docs.map((d) => mapReview(d.data()));

  // Client-sort by created_at desc (Firestore rules don't allow orderBy here
  // without a composite index that may not exist yet).
  reviews.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  return reviews;
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
