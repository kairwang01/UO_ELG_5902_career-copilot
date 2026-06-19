import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestoreDb, firebaseFunctions } from './firebaseClient';

export interface JobPosting {
  id: string;
  employer_id: string;
  title: string;
  company_name: string | null;
  // Company context, snapshot from the employer profile at creation so candidate
  // job cards can show scale/industry without reading the owner-only employer doc.
  company_size: string | null;
  industry: string | null;
  founded_year: string | null;
  location: string | null;
  description: string | null;
  salary_range: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface JobPostingWithCount extends JobPosting {
  applicant_count: number;
}

export interface JobApplication {
  id: string;
  job_id: string;
  candidate_id: string;
  application_date: string;
  compatibility_score: number | null;
}

export interface JobPostingPatch {
  title: string;
  location: string;
  description: string;
  salary_range: string;
  company_name?: string | null;
  company_size?: string | null;
  industry?: string | null;
  founded_year?: string | null;
}

const toIsoString = (value: unknown): string => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'object' && 'toDate' in value) {
    return (value as Timestamp).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const sortByCreatedDesc = <T extends { created_at: string }>(rows: T[]) => (
  [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
);

const mapJobPosting = (id: string, data: DocumentData): JobPosting => ({
  id,
  employer_id: String(data.employer_id ?? ''),
  title: String(data.title ?? ''),
  company_name: data.company_name ?? null,
  company_size: data.company_size ?? null,
  industry: data.industry ?? null,
  founded_year: data.founded_year ?? null,
  location: data.location ?? null,
  description: data.description ?? null,
  salary_range: data.salary_range ?? null,
  is_active: data.is_active ?? true,
  created_at: toIsoString(data.created_at),
  updated_at: data.updated_at ? toIsoString(data.updated_at) : null,
});

const mapApplication = (id: string, data: DocumentData): JobApplication => ({
  id,
  job_id: String(data.job_id ?? ''),
  candidate_id: String(data.candidate_id ?? ''),
  application_date: toIsoString(data.application_date),
  compatibility_score: data.compatibility_score ?? null,
});

export const listEmployerJobs = async (employerId: string): Promise<JobPosting[]> => {
  const jobsQuery = query(
    collection(firestoreDb, 'job_postings'),
    where('employer_id', '==', employerId),
  );
  const snap = await getDocs(jobsQuery);
  return sortByCreatedDesc(snap.docs.map((jobDoc) => mapJobPosting(jobDoc.id, jobDoc.data())));
};

// Reads every application addressed to this employer in a SINGLE owner-scoped query.
// The employer_id filter both satisfies firestore.rules (owner-scoped read) and avoids
// the previous N+1 (one query per job). All employer-side application reads go through here.
export const listApplicationsForEmployer = async (employerId: string): Promise<JobApplication[]> => {
  const appsQuery = query(
    collection(firestoreDb, 'job_applications'),
    where('employer_id', '==', employerId),
  );
  const snap = await getDocs(appsQuery);
  return snap.docs.map((appDoc) => mapApplication(appDoc.id, appDoc.data()));
};

export const listApplicationsForJobs = async (jobIds: string[], employerId: string): Promise<JobApplication[]> => {
  const wanted = new Set(jobIds);
  const all = await listApplicationsForEmployer(employerId);
  return all.filter((app) => wanted.has(app.job_id));
};

export const listEmployerJobsWithCounts = async (employerId: string): Promise<JobPostingWithCount[]> => {
  const [jobs, applications] = await Promise.all([
    listEmployerJobs(employerId),
    listApplicationsForEmployer(employerId),
  ]);
  const counts = new Map<string, number>();
  for (const app of applications) {
    counts.set(app.job_id, (counts.get(app.job_id) ?? 0) + 1);
  }
  return jobs.map((job) => ({ ...job, applicant_count: counts.get(job.id) ?? 0 }));
};

export const listActiveEmployerJobs = async (employerId: string): Promise<JobPosting[]> => (
  (await listEmployerJobs(employerId)).filter((job) => job.is_active)
);

// Job-posting writes are server-only (firestore.rules deny direct client writes).
// These callables enforce employer role, per-plan active-job limits, server-read
// company identity, and an audit trail. The patch's company_* fields are ignored
// server-side — the callable reads them from the employer's authoritative profile.
export const saveJobPosting = async (
  _employerId: string,
  patch: JobPostingPatch,
  existingJobId?: string,
): Promise<void> => {
  const posting = {
    title: patch.title,
    location: patch.location,
    description: patch.description,
    salary_range: patch.salary_range,
  };
  if (existingJobId) {
    const fn = httpsCallable<{ jobId: string; posting: typeof posting }, { jobId: string }>(firebaseFunctions, 'updateJobPosting');
    await fn({ jobId: existingJobId, posting });
    return;
  }
  const fn = httpsCallable<{ posting: typeof posting }, { jobId: string }>(firebaseFunctions, 'createJobPosting');
  await fn({ posting });
};

/** Close (deactivate) or reopen a job posting via the server callable (owner +
 *  entitlement enforced; reopening re-checks the active-job limit). */
export const setJobPostingActive = async (jobId: string, isActive: boolean, reason?: string): Promise<void> => {
  const fn = httpsCallable<{ jobId: string; isActive: boolean; reason?: string }, { jobId: string; isActive: boolean }>(firebaseFunctions, 'setJobPostingActive');
  await fn({ jobId, isActive, reason });
};

export const listAllActiveJobPostings = async (): Promise<JobPosting[]> => {
  const activeQuery = query(
    collection(firestoreDb, 'job_postings'),
    where('is_active', '==', true),
  );
  const snap = await getDocs(activeQuery);
  return sortByCreatedDesc(snap.docs.map((jobDoc) => mapJobPosting(jobDoc.id, jobDoc.data())));
};
