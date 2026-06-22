/**
 * Usage-counter + idempotent deduction tests.
 *
 * Run: firebase emulators:exec --only firestore --project demo-careercopilot \
 *        "npx vitest run tests/usageCounters.callable.test.ts"
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from '../functions/node_modules/firebase-admin';
import { deductCredits } from '../functions/src/credits/deductCredits';
import { getTodayUsageTotals, getUserTodayUsage, recordObservedToolRun, utcDayKey } from '../functions/src/admin/usageLog';

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-careercopilot';
const db = admin.firestore();

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

async function seedUser(uid = 'user1', credits = 100) {
  await db.collection('users').doc(uid).set({
    role: 'candidate',
    subscription_status: 'free',
    credits,
    created_at: '2026-01-01',
  });
}

async function counterDocs() {
  const snap = await db.collection('usage_counters').get();
  return snap.docs.map((doc) => doc.data());
}

beforeEach(clearFirestore);

describe('usage counters and idempotent credit deduction', () => {
  it('deducts once, writes O(1) daily counters, and records ledger in the same transaction', async () => {
    await seedUser('user1', 100);

    const result = await deductCredits('user1', 7, 'resume-analysis', { requestId: 'req_counter_001' });

    expect(result.charged).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.balanceAfter).toBe(93);

    const user = (await db.collection('users').doc('user1').get()).data()!;
    expect(user.credits).toBe(93);

    const usageEvents = await db.collection('usage_events').where('uid', '==', 'user1').get();
    expect(usageEvents.size).toBe(1);
    expect(usageEvents.docs[0].data()).toMatchObject({
      uid: 'user1',
      tool: 'resume-analysis',
      credit_cost: 7,
      status: 'deducted',
      day_key: utcDayKey(),
      request_id: 'req_counter_001',
      balance_after: 93,
    });

    const counters = await counterDocs();
    expect(counters).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'global', day_key: utcDayKey(), runs: 1, credits: 7 }),
      expect.objectContaining({ scope: 'user', uid: 'user1', day_key: utcDayKey(), runs: 1, credits: 7 }),
    ]));

    const ledger = await db.collection('credit_ledger').where('uid', '==', 'user1').get();
    expect(ledger.size).toBe(1);
    expect(ledger.docs[0].data()).toMatchObject({
      amount: -7,
      balance_after: 93,
      reason: 'tool_deduction',
      tool: 'resume-analysis',
      request_id: 'req_counter_001',
    });

    await expect(getTodayUsageTotals()).resolves.toEqual({ runs: 1, credits: 7 });
    await expect(getUserTodayUsage('user1')).resolves.toEqual({ runs: 1, credits: 7 });
  });

  it('reuses requestId as an idempotency key and never double-charges', async () => {
    await seedUser('user1', 100);

    const first = await deductCredits('user1', 7, 'resume-analysis', { requestId: 'req_counter_002' });
    const second = await deductCredits('user1', 7, 'resume-analysis', { requestId: 'req_counter_002' });

    expect(first.charged).toBe(true);
    expect(second.charged).toBe(false);
    expect(second.duplicate).toBe(true);

    const user = (await db.collection('users').doc('user1').get()).data()!;
    expect(user.credits).toBe(93);

    const usageEvents = await db.collection('usage_events').where('uid', '==', 'user1').get();
    expect(usageEvents.size).toBe(1);
    const ledger = await db.collection('credit_ledger').where('uid', '==', 'user1').get();
    expect(ledger.size).toBe(1);
    await expect(getTodayUsageTotals()).resolves.toEqual({ runs: 1, credits: 7 });
    await expect(getUserTodayUsage('user1')).resolves.toEqual({ runs: 1, credits: 7 });
  });

  it('falls back to legacy usage_events when a counter doc does not exist yet', async () => {
    const now = admin.firestore.Timestamp.now();
    await db.collection('usage_events').add({
      uid: 'legacy-user',
      tool: 'resume-analysis',
      credit_cost: 5,
      status: 'deducted',
      created_at: now,
    });
    await db.collection('usage_events').add({
      uid: 'legacy-user',
      tool: 'career-path',
      credit_cost: 11,
      status: 'deducted',
      created_at: now,
    });

    await expect(getTodayUsageTotals()).resolves.toEqual({ runs: 2, credits: 16 });
    await expect(getUserTodayUsage('legacy-user')).resolves.toEqual({ runs: 2, credits: 16 });
  });
});

describe('observed (uncharged) tool runs — admin visibility only, zero cap impact', () => {
  it('writes "observed" usage events but never charges, bumps counters, or counts toward the cap', async () => {
    await seedUser('obs-user', 50);

    await recordObservedToolRun('obs-user', 'career-coach');
    await recordObservedToolRun('obs-user', 'discover-talent');

    // The observed events exist (this is the admin volume signal).
    const events = await db.collection('usage_events').where('uid', '==', 'obs-user').get();
    expect(events.size).toBe(2);
    expect(events.docs.every((d) => d.data().status === 'observed')).toBe(true);
    expect(events.docs.every((d) => d.data().credit_cost === 0)).toBe(true);

    // No usage_counters written → the free-tier run cap input is untouched.
    expect((await counterDocs()).length).toBe(0);

    // Balance unchanged and the cap-read view sees ZERO runs, so these calls can never
    // push a free user toward resource-exhausted on other tools.
    const user = (await db.collection('users').doc('obs-user').get()).data()!;
    expect(user.credits).toBe(50);
    await expect(getUserTodayUsage('obs-user')).resolves.toEqual({ runs: 0, credits: 0 });
  });

  it('is invisible to the charged run counter when mixed with a real deduction', async () => {
    await seedUser('mix-user', 100);
    await recordObservedToolRun('mix-user', 'career-coach');
    await deductCredits('mix-user', 7, 'resume-analysis', { requestId: 'req_mix_001' });
    await recordObservedToolRun('mix-user', 'list-job-applicants');

    // Only the charged run counts; the 2 observed calls do not inflate runs/credits.
    await expect(getUserTodayUsage('mix-user')).resolves.toEqual({ runs: 1, credits: 7 });
    const events = await db.collection('usage_events').where('uid', '==', 'mix-user').get();
    expect(events.size).toBe(3); // 2 observed + 1 deducted
  });
});
