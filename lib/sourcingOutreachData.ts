/**
 * Client helpers for consent-gated sourcing outreach.
 *
 * Reads use Firestore because rules allow each party to read only their own
 * request status. All writes/unlocks are callables so the client cannot forge
 * acceptance or access candidate PII before consent.
 */
import { collection, getDocs, onSnapshot, query, where, type DocumentData, type Timestamp } from 'firebase/firestore';
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

const toIsoString = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return '';
};

const mapOutreach = (id: string, data: DocumentData): SourcingOutreach => ({
  id,
  employer_id: String(data.employer_id ?? ''),
  candidate_id: String(data.candidate_id ?? ''),
  job_id: String(data.job_id ?? ''),
  job_title: String(data.job_title ?? ''),
  company_name: String(data.company_name ?? ''),
  message: String(data.message ?? ''),
  // Whitelist-validate so an unexpected stored value can't drive the UI into an
  // undefined status branch (defaults to 'requested').
  status: (['requested', 'accepted', 'declined', 'cancelled'].includes(String(data.status))
    ? (data.status as SourcingOutreachStatus)
    : 'requested'),
  created_at: toIsoString(data.created_at),
  updated_at: toIsoString(data.updated_at),
  responded_at: toIsoString(data.responded_at),
});

const byNewest = (a: SourcingOutreach, b: SourcingOutreach) => b.created_at.localeCompare(a.created_at);

export async function listSourcingOutreachForCandidate(uid: string): Promise<SourcingOutreach[]> {
  const snap = await getDocs(query(collection(firestoreDb, 'sourcing_outreach'), where('candidate_id', '==', uid)));
  return snap.docs.map((d) => mapOutreach(d.id, d.data())).sort(byNewest);
}

export async function listSourcingOutreachForEmployer(uid: string): Promise<SourcingOutreach[]> {
  const snap = await getDocs(query(collection(firestoreDb, 'sourcing_outreach'), where('employer_id', '==', uid)));
  return snap.docs.map((d) => mapOutreach(d.id, d.data())).sort(byNewest);
}

export function subscribeSourcingOutreachForCandidate(
  uid: string,
  onChange: (requests: SourcingOutreach[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  return onSnapshot(
    query(collection(firestoreDb, 'sourcing_outreach'), where('candidate_id', '==', uid)),
    (snap) => onChange(snap.docs.map((d) => mapOutreach(d.id, d.data())).sort(byNewest)),
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
  return res.data.candidate;
}
