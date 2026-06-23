/**
 * sourcing-outreach callable integration tests — real Firestore emulator +
 * Admin SDK. Proves: only business accounts can request outreach, job ownership
 * is enforced, candidates own accept/decline, and a richer candidate packet is
 * only available after explicit acceptance.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from '../functions/node_modules/firebase-admin';
import {
  createSourcingOutreachImpl,
  respondSourcingOutreachImpl,
  cancelSourcingOutreachImpl,
  getSourcingCandidatePacketImpl,
} from '../functions/src/handlers/sourcingOutreach';

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-careercopilot';
const db = admin.firestore();

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

async function seed() {
  await db.collection('users').doc('emp').set({
    role: 'employer',
    company_name: 'Acme Robotics',
  });
  await db.collection('users').doc('agency').set({ role: 'agency', company_name: 'Agency Co' });
  await db.collection('users').doc('cand').set({
    role: 'candidate',
    full_name: 'Cand Idate',
    email: 'cand@example.com',
    phone: '+1 555 0100',
    resume_text: 'Senior product engineer with React, Python, and hiring-platform experience.',
  });
  await db.collection('users').doc('other').set({ role: 'employer', company_name: 'Other Co' });
  await db.collection('job_postings').doc('job1').set({
    employer_id: 'emp',
    title: 'Product Engineer',
    company_name: 'Acme Robotics',
    is_active: true,
  });
  await db.collection('job_postings').doc('job2').set({
    employer_id: 'other',
    title: 'Data Engineer',
    company_name: 'Other Co',
    is_active: true,
  });
  await db.collection('talent_profiles').doc('cand').set({
    summary: { headline: 'Product-minded engineer' },
    skills: { technical: ['React', 'Python'] },
  });
}

const request = (over: Record<string, unknown> = {}) => ({
  candidateId: 'cand',
  jobId: 'job1',
  message: 'Your product engineering background looks aligned with our role.',
  ...over,
});

beforeEach(clearFirestore);

describe('createSourcingOutreach', () => {
  it('a job-owning employer can request consent; the candidate is not unlocked yet', async () => {
    await seed();
    const { outreachId, status, duplicate } = await createSourcingOutreachImpl('emp', request());
    expect(status).toBe('requested');
    expect(duplicate).toBe(false);
    const doc = (await db.collection('sourcing_outreach').doc(outreachId).get()).data()!;
    expect(doc.employer_id).toBe('emp');
    expect(doc.candidate_id).toBe('cand');
    expect(doc.job_id).toBe('job1');
    expect(doc.company_name).toBe('Acme Robotics');
    await expect(getSourcingCandidatePacketImpl('emp', { outreachId })).rejects.toThrow(/not accepted/i);
  });

  it('dedupes an active request instead of creating repeat spam', async () => {
    await seed();
    const first = await createSourcingOutreachImpl('emp', request());
    const second = await createSourcingOutreachImpl('emp', request({ message: 'Checking again.' }));
    expect(second.outreachId).toBe(first.outreachId);
    expect(second.duplicate).toBe(true);
    expect(second.status).toBe('requested');
  });

  it('rejects candidate callers, non-candidate targets, and jobs not owned by the caller', async () => {
    await seed();
    await expect(createSourcingOutreachImpl('cand', request())).rejects.toThrow(/business/i);
    await expect(createSourcingOutreachImpl('emp', request({ candidateId: 'agency' }))).rejects.toThrow(/candidate/i);
    await expect(createSourcingOutreachImpl('emp', request({ jobId: 'job2' }))).rejects.toThrow(/own/i);
  });
});

describe('respond / cancel / unlock', () => {
  it('the requested candidate can accept and then the employer can fetch the consented packet', async () => {
    await seed();
    const { outreachId } = await createSourcingOutreachImpl('emp', request());
    await respondSourcingOutreachImpl('cand', { outreachId, action: 'accept', note: 'Happy to connect.' });
    const packet = await getSourcingCandidatePacketImpl('emp', { outreachId });
    expect(packet.status).toBe('accepted');
    expect(packet.candidate.full_name).toBe('Cand Idate');
    expect(packet.candidate.email).toBe('cand@example.com');
    expect(packet.candidate.resume_text).toMatch(/React/);
    expect(packet.candidate.talent_profile).toMatchObject({
      summary: { headline: 'Product-minded engineer' },
    });
  });

  it('a stranger cannot respond or fetch the packet', async () => {
    await seed();
    const { outreachId } = await createSourcingOutreachImpl('emp', request());
    await expect(respondSourcingOutreachImpl('other', { outreachId, action: 'accept' })).rejects.toThrow(/candidate/i);
    await respondSourcingOutreachImpl('cand', { outreachId, action: 'accept' });
    await expect(getSourcingCandidatePacketImpl('other', { outreachId })).rejects.toThrow(/requesting employer/i);
  });

  it('declined or cancelled requests cannot be unlocked', async () => {
    await seed();
    const declined = await createSourcingOutreachImpl('emp', request());
    await respondSourcingOutreachImpl('cand', { outreachId: declined.outreachId, action: 'decline' });
    await expect(getSourcingCandidatePacketImpl('emp', { outreachId: declined.outreachId })).rejects.toThrow(/not accepted/i);

    const recreated = await createSourcingOutreachImpl('emp', request({ message: 'One more tailored note.' }));
    await cancelSourcingOutreachImpl('emp', { outreachId: recreated.outreachId, note: 'Role closed.' });
    await expect(respondSourcingOutreachImpl('cand', { outreachId: recreated.outreachId, action: 'accept' })).rejects.toThrow(/no longer pending/i);
  });

  it('allows only one terminal consent action under concurrent candidate responses', async () => {
    await seed();
    const { outreachId } = await createSourcingOutreachImpl('emp', request());

    const results = await Promise.allSettled([
      respondSourcingOutreachImpl('cand', { outreachId, action: 'accept' }),
      respondSourcingOutreachImpl('cand', { outreachId, action: 'decline' }),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const doc = (await db.collection('sourcing_outreach').doc(outreachId).get()).data()!;
    expect(['accepted', 'declined']).toContain(doc.status);
    if (doc.status === 'accepted') {
      await expect(getSourcingCandidatePacketImpl('emp', { outreachId })).resolves.toMatchObject({ status: 'accepted' });
    } else {
      await expect(getSourcingCandidatePacketImpl('emp', { outreachId })).rejects.toThrow(/not accepted/i);
    }
  });

  it('allows only one terminal action when candidate response and employer cancellation race', async () => {
    await seed();
    const { outreachId } = await createSourcingOutreachImpl('emp', request());

    const results = await Promise.allSettled([
      respondSourcingOutreachImpl('cand', { outreachId, action: 'accept' }),
      cancelSourcingOutreachImpl('emp', { outreachId, note: 'Role paused.' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const status = (await db.collection('sourcing_outreach').doc(outreachId).get()).get('status');
    expect(['accepted', 'cancelled']).toContain(status);
  });
});
