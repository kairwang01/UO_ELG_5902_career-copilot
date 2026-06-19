/**
 * interviewData — client access to application_interviews.
 *
 * Reads are direct Firestore queries (rules allow each party to read their own:
 * candidate_id == uid OR employer_id == uid). Writes are server-only callables —
 * the employer schedules / reschedules / cancels / completes; the candidate only
 * confirms.
 */
import { collection, getDocs, query, where, type DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestoreDb, firebaseFunctions } from './firebaseClient';

export type InterviewFormat = 'phone' | 'video' | 'onsite';
export type InterviewStatus = 'scheduled' | 'rescheduled' | 'cancelled' | 'completed';

export interface ApplicationInterview {
  id: string;
  application_id: string;
  job_id: string;
  employer_id: string;
  candidate_id: string;
  stage: string;
  scheduled_at: string;
  timezone: string;
  format: string;
  location_or_link: string;
  interviewer: string;
  notes: string;
  candidate_confirmed: boolean;
  interview_status: string;
}

const mapInterview = (id: string, d: DocumentData): ApplicationInterview => ({
  id,
  application_id: String(d.application_id ?? ''),
  job_id: String(d.job_id ?? ''),
  employer_id: String(d.employer_id ?? ''),
  candidate_id: String(d.candidate_id ?? ''),
  stage: String(d.stage ?? 'Interview'),
  scheduled_at: String(d.scheduled_at ?? ''),
  timezone: String(d.timezone ?? ''),
  format: String(d.format ?? ''),
  location_or_link: String(d.location_or_link ?? ''),
  interviewer: String(d.interviewer ?? ''),
  notes: String(d.notes ?? ''),
  candidate_confirmed: d.candidate_confirmed === true,
  interview_status: String(d.interview_status ?? 'scheduled'),
});

// Cancelled last; otherwise soonest scheduled first.
const byScheduled = (a: ApplicationInterview, b: ApplicationInterview): number => {
  const ac = a.interview_status === 'cancelled' ? 1 : 0;
  const bc = b.interview_status === 'cancelled' ? 1 : 0;
  if (ac !== bc) return ac - bc;
  return a.scheduled_at.localeCompare(b.scheduled_at);
};

export async function listInterviewsForApplication(applicationId: string): Promise<ApplicationInterview[]> {
  const snap = await getDocs(query(collection(firestoreDb, 'application_interviews'), where('application_id', '==', applicationId)));
  return snap.docs.map((d) => mapInterview(d.id, d.data())).sort(byScheduled);
}

export async function listInterviewsForCandidate(uid: string): Promise<ApplicationInterview[]> {
  const snap = await getDocs(query(collection(firestoreDb, 'application_interviews'), where('candidate_id', '==', uid)));
  return snap.docs.map((d) => mapInterview(d.id, d.data())).sort(byScheduled);
}

export interface ScheduleInterviewInput {
  applicationId: string;
  stage?: string;
  scheduledAt: string;
  timezone?: string;
  format: InterviewFormat;
  locationOrLink?: string;
  interviewer?: string;
  notes?: string;
}

export async function scheduleInterview(input: ScheduleInterviewInput): Promise<void> {
  await httpsCallable<ScheduleInterviewInput, { interviewId: string }>(firebaseFunctions, 'scheduleInterview')(input);
}

export interface UpdateInterviewInput {
  interviewId: string;
  interviewStatus?: InterviewStatus;
  scheduledAt?: string;
  timezone?: string;
  format?: InterviewFormat;
  locationOrLink?: string;
  interviewer?: string;
  notes?: string;
  stage?: string;
}

export async function updateInterview(input: UpdateInterviewInput): Promise<void> {
  await httpsCallable<UpdateInterviewInput, { interviewId: string }>(firebaseFunctions, 'updateInterview')(input);
}

export async function confirmInterview(interviewId: string): Promise<void> {
  await httpsCallable<{ interviewId: string }, { interviewId: string }>(firebaseFunctions, 'confirmInterview')({ interviewId });
}
