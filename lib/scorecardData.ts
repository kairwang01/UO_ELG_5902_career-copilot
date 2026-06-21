/**
 * scorecardData — employer-only interview scorecards.
 *
 * Reads are direct Firestore queries scoped by employer_id so rules can prove
 * every returned scorecard belongs to the caller. The application filter is
 * applied client-side to avoid requiring an extra composite index.
 * Writes use the upsertScorecard callable; candidates have no read/write path.
 */
import { collection, getDocs, query, where, type DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestoreDb, firebaseFunctions } from './firebaseClient';

export type ScorecardRecommendation = 'strong_hire' | 'hire' | 'hold' | 'no_hire';

export const SCORECARD_RATING_KEYS = [
  'role_fit',
  'technical_skill',
  'problem_solving',
  'communication',
  'evidence_depth',
] as const;

export type ScorecardRatingKey = (typeof SCORECARD_RATING_KEYS)[number];

export interface ApplicationScorecard {
  id: string;
  application_id: string;
  interview_id: string;
  job_id: string;
  employer_id: string;
  candidate_id: string;
  stage: string;
  recommendation: ScorecardRecommendation;
  overall_score: number;
  ratings: Record<ScorecardRatingKey, number>;
  evidence: string;
  concerns: string;
  next_steps: string;
  private_notes: string;
  created_at: string | null;
  updated_at: string | null;
}

const toIso = (v: unknown): string | null => (
  v && typeof (v as { toDate?: unknown }).toDate === 'function'
    ? (v as { toDate: () => Date }).toDate().toISOString()
    : null
);

const cleanRecommendation = (v: unknown): ScorecardRecommendation => {
  const value = String(v ?? '');
  return value === 'strong_hire' || value === 'hire' || value === 'hold' || value === 'no_hire'
    ? value
    : 'hold';
};

const cleanRatings = (v: unknown): Record<ScorecardRatingKey, number> => {
  const raw = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
  return SCORECARD_RATING_KEYS.reduce((acc, key) => {
    const n = typeof raw[key] === 'number' ? raw[key] : 0;
    acc[key] = Math.max(0, Math.min(5, Math.round(n)));
    return acc;
  }, {} as Record<ScorecardRatingKey, number>);
};

const mapScorecard = (id: string, d: DocumentData): ApplicationScorecard => ({
  id,
  application_id: String(d.application_id ?? ''),
  interview_id: String(d.interview_id ?? ''),
  job_id: String(d.job_id ?? ''),
  employer_id: String(d.employer_id ?? ''),
  candidate_id: String(d.candidate_id ?? ''),
  stage: String(d.stage ?? 'Interview'),
  recommendation: cleanRecommendation(d.recommendation),
  overall_score: typeof d.overall_score === 'number' ? d.overall_score : 0,
  ratings: cleanRatings(d.ratings),
  evidence: String(d.evidence ?? ''),
  concerns: String(d.concerns ?? ''),
  next_steps: String(d.next_steps ?? ''),
  private_notes: String(d.private_notes ?? ''),
  created_at: toIso(d.created_at),
  updated_at: toIso(d.updated_at),
});

export async function listScorecardsForApplication(applicationId: string, employerId: string): Promise<ApplicationScorecard[]> {
  const snap = await getDocs(query(
    collection(firestoreDb, 'application_scorecards'),
    where('employer_id', '==', employerId),
  ));
  return snap.docs
    .map((d) => mapScorecard(d.id, d.data()))
    .filter((scorecard) => scorecard.application_id === applicationId)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
}

export interface UpsertScorecardInput {
  scorecardId?: string;
  interviewId: string;
  stage?: string;
  recommendation: ScorecardRecommendation;
  overallScore: number;
  ratings: Record<ScorecardRatingKey, number>;
  evidence: string;
  concerns?: string;
  nextSteps?: string;
  privateNotes?: string;
}

export async function upsertScorecard(input: UpsertScorecardInput): Promise<{ scorecardId: string }> {
  const fn = httpsCallable<UpsertScorecardInput, { scorecardId: string }>(firebaseFunctions, 'upsertScorecard');
  const res = await fn(input);
  return res.data;
}
