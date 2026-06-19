/**
 * Job-posting callable integration tests — exercise the REAL handler logic
 * (createJobPostingImpl / updateJobPostingImpl / setJobPostingActiveImpl) against
 * the Firestore emulator via the Admin SDK. Proves the trust contract:
 * candidate denied, employer allowed, company identity from server profile,
 * free plan limit = 3, reopen re-checks the limit, invalid fields rejected,
 * cross-employer edit denied, audit events written.
 *
 * Run: firebase emulators:exec --only firestore --project demo-careercopilot \
 *        "npx vitest run tests/jobPostings.callable.test.ts"
 * (emulators:exec sets FIRESTORE_EMULATOR_HOST + GCLOUD_PROJECT.)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from '../functions/node_modules/firebase-admin';
import {
  createJobPostingImpl,
  updateJobPostingImpl,
  setJobPostingActiveImpl,
} from '../functions/src/handlers/jobPostings';

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-careercopilot';
const db = admin.firestore();

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

const EMPLOYER = {
  role: 'employer', subscription_status: 'free', company_name: 'Acme', company_size: '50',
  industry: 'Tech', founded_year: '2010', company_website: 'https://acme.example', credits: 100, created_at: '2026-01-01',
};
const CANDIDATE = { role: 'candidate', subscription_status: 'free', credits: 100, created_at: '2026-01-01' };

const validPosting = (over: Record<string, unknown> = {}) => ({
  title: 'Software Engineer', location: 'Toronto', work_mode: 'remote', employment_type: 'full_time',
  experience_level: 'mid', department: 'Engineering', description: 'Build great things',
  responsibilities: 'Ship features', required_qualifications: 'BS in CS', required_skills: ['TypeScript', 'React'],
  application_deadline: '2026-12-31', headcount: 2, ...over,
});

beforeEach(clearFirestore);

describe('createJobPosting callable', () => {
  it('candidate CANNOT create a job', async () => {
    await db.collection('users').doc('cand').set(CANDIDATE);
    await expect(createJobPostingImpl('cand', { posting: validPosting() })).rejects.toThrow(/employer/i);
  });

  it('employer CAN create a job; company comes from server profile, not the request', async () => {
    await db.collection('users').doc('emp').set(EMPLOYER);
    const { jobId } = await createJobPostingImpl('emp', { posting: validPosting({ company_name: 'FORGED-INC' }) });
    const doc = (await db.collection('job_postings').doc(jobId).get()).data()!;
    expect(doc.company_name).toBe('Acme'); // server profile wins, not 'FORGED-INC'
    expect(doc.employer_id).toBe('emp');
    expect(doc.work_mode).toBe('remote');
    expect(doc.experience_level).toBe('mid');
    expect(doc.required_skills).toEqual(['TypeScript', 'React']);
    expect(doc.is_active).toBe(true);
    const events = await db.collection('job_posting_events').where('job_id', '==', jobId).get();
    expect(events.size).toBe(1);
    expect(events.docs[0].data().action).toBe('created');
  });

  it('rejects invalid required fields (missing work_mode)', async () => {
    await db.collection('users').doc('emp').set(EMPLOYER);
    await expect(createJobPostingImpl('emp', { posting: validPosting({ work_mode: undefined }) })).rejects.toThrow(/work mode/i);
  });

  it('rejects a posting with no required skills', async () => {
    await db.collection('users').doc('emp').set(EMPLOYER);
    await expect(createJobPostingImpl('emp', { posting: validPosting({ required_skills: [] }) })).rejects.toThrow(/skill/i);
  });

  it('requires a company profile before posting', async () => {
    await db.collection('users').doc('emp').set({ ...EMPLOYER, company_name: null });
    await expect(createJobPostingImpl('emp', { posting: validPosting() })).rejects.toThrow(/company/i);
  });

  it('enforces the free-plan active-job limit (3)', async () => {
    await db.collection('users').doc('emp').set(EMPLOYER);
    for (let i = 0; i < 3; i++) await createJobPostingImpl('emp', { posting: validPosting() });
    await expect(createJobPostingImpl('emp', { posting: validPosting() })).rejects.toThrow(/plan allows/i);
  });
});

describe('update / close / reopen', () => {
  it('an employer cannot edit another employer\'s job', async () => {
    await db.collection('users').doc('emp').set(EMPLOYER);
    await db.collection('users').doc('emp2').set(EMPLOYER);
    const { jobId } = await createJobPostingImpl('emp', { posting: validPosting() });
    await expect(updateJobPostingImpl('emp2', { jobId, posting: validPosting({ title: 'Hijacked' }) })).rejects.toThrow(/your own/i);
  });

  it('reopening re-checks the active-job limit', async () => {
    await db.collection('users').doc('emp').set(EMPLOYER);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await createJobPostingImpl('emp', { posting: validPosting() })).jobId);
    await setJobPostingActiveImpl('emp', { jobId: ids[0], isActive: false }); // 2 active
    await createJobPostingImpl('emp', { posting: validPosting() }); // back to 3 active
    await expect(setJobPostingActiveImpl('emp', { jobId: ids[0], isActive: true })).rejects.toThrow(/plan allows/i);
  });

  it('close writes a "closed" audit event', async () => {
    await db.collection('users').doc('emp').set(EMPLOYER);
    const { jobId } = await createJobPostingImpl('emp', { posting: validPosting() });
    await setJobPostingActiveImpl('emp', { jobId, isActive: false, reason: 'Filled' });
    const events = await db.collection('job_posting_events').where('job_id', '==', jobId).where('action', '==', 'closed').get();
    expect(events.size).toBe(1);
    expect(events.docs[0].data().reason).toBe('Filled');
  });
});
