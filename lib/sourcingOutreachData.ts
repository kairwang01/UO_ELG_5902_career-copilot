/**
 * Client helpers for consent-gated sourcing outreach.
 *
 * Reads use Firestore because rules allow each party to read only their own
 * request status. All writes/unlocks are callables so the client cannot forge
 * acceptance or access candidate PII before consent.
 */
import { collection, getDocs, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestoreDb, firebaseFunctions } from './firebaseClient';

export type SourcingOutreachStatus = 'requested' | 'accepted' | 'declined' | 'cancelled';

export interface SourcingOutreach {
  id: string;
  employer_id: string;
  candidate_id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  message: string;
  status: SourcingOutreachStatus;
  created_at: string;
  updated_at: string;
  responded_at: string;
}

export interface ConsentedCandidatePacket {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  website: string;
  linkedin: string;
  github: string;
  resume_text: string;
  talent_profile: unknown;
}

const OUTREACH_STATUSES = new Set<SourcingOutreachStatus>(['requested', 'accepted', 'declined', 'cancelled']);

const cleanString = (value: unknown, max = 4000): string => (
  typeof value === 'string' ? value.trim().slice(0, max) : ''
);

const toIsoString = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'object' && value !== null && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  if (typeof value === 'string') return value.trim();
  return '';
};

const cleanStatus = (value: unknown): SourcingOutreachStatus => (
  typeof value === 'string' && OUTREACH_STATUSES.has(value as SourcingOutreachStatus)
    ? value as SourcingOutreachStatus
    : 'requested'
);

export const normalizeSourcingOutreach = (id: string, data: DocumentData): SourcingOutreach => ({
  id: cleanString(id, 160),
  employer_id: cleanString(data.employer_id, 160),
  candidate_id: cleanString(data.candidate_id, 160),
  job_id: cleanString(data.job_id, 160),
  job_title: cleanString(data.job_title, 240),
  company_name: cleanString(data.company_name, 240),
  message: cleanString(data.message, 4000),
  // Whitelist-validate so an unexpected stored value can't drive the UI into an
  // undefined status branch (defaults to 'requested').
  status: cleanStatus(data.status),
  created_at: toIsoString(data.created_at),
  updated_at: toIsoString(data.updated_at),
  responded_at: toIsoString(data.responded_at),
});

const byNewest = (a: SourcingOutreach, b: SourcingOutreach) => b.created_at.localeCompare(a.created_at);

export async function listSourcingOutreachForCandidate(uid: string): Promise<SourcingOutreach[]> {
  const snap = await getDocs(query(collection(firestoreDb, 'sourcing_outreach'), where('candidate_id', '==', uid)));
  return snap.docs.map((d) => normalizeSourcingOutreach(d.id, d.data())).sort(byNewest);
}

export async function listSourcingOutreachForEmployer(uid: string): Promise<SourcingOutreach[]> {
  const snap = await getDocs(query(collection(firestoreDb, 'sourcing_outreach'), where('employer_id', '==', uid)));
  return snap.docs.map((d) => normalizeSourcingOutreach(d.id, d.data())).sort(byNewest);
}

export function subscribeSourcingOutreachForCandidate(
  uid: string,
  onChange: (requests: SourcingOutreach[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  return onSnapshot(
    query(collection(firestoreDb, 'sourcing_outreach'), where('candidate_id', '==', uid)),
    (snap) => onChange(snap.docs.map((d) => normalizeSourcingOutreach(d.id, d.data())).sort(byNewest)),
    (error) => onError?.(error),
  );
}

export async function createSourcingOutreach(input: {
  candidateId: string;
  message: string;
  jobId?: string;
  requestSource?: string;
}): Promise<{ outreachId: string; status: SourcingOutreachStatus; duplicate: boolean }> {
  const res = await httpsCallable<typeof input, { outreachId: string; status: SourcingOutreachStatus; duplicate: boolean }>(
    firebaseFunctions,
    'createSourcingOutreach',
  )(input);
  return res.data;
}

export async function respondSourcingOutreach(input: {
  outreachId: string;
  action: 'accept' | 'decline';
  note?: string;
}): Promise<void> {
  await httpsCallable<typeof input, { outreachId: string; status: SourcingOutreachStatus }>(
    firebaseFunctions,
    'respondSourcingOutreach',
  )(input);
}

export async function cancelSourcingOutreach(input: { outreachId: string; note?: string }): Promise<void> {
  await httpsCallable<typeof input, { outreachId: string; status: SourcingOutreachStatus }>(
    firebaseFunctions,
    'cancelSourcingOutreach',
  )(input);
}

export async function getSourcingCandidatePacket(outreachId: string): Promise<ConsentedCandidatePacket> {
  const res = await httpsCallable<{ outreachId: string }, { candidate: ConsentedCandidatePacket }>(
    firebaseFunctions,
    'getSourcingCandidatePacket',
  )({ outreachId });
  return normalizeConsentedCandidatePacket(res.data.candidate);
}

export function normalizeConsentedCandidatePacket(data: unknown): ConsentedCandidatePacket {
  const raw = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};

  return {
    id: cleanString(raw.id, 160),
    full_name: cleanString(raw.full_name, 240),
    email: cleanString(raw.email, 320),
    phone: cleanString(raw.phone, 120),
    location: cleanString(raw.location, 240),
    headline: cleanString(raw.headline, 500),
    website: cleanString(raw.website, 1000),
    linkedin: cleanString(raw.linkedin, 1000),
    github: cleanString(raw.github, 1000),
    resume_text: cleanString(raw.resume_text, 60000),
    talent_profile: raw.talent_profile && typeof raw.talent_profile === 'object' && !Array.isArray(raw.talent_profile)
      ? raw.talent_profile
      : null,
  };
}
