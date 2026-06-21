/**
 * P0 revenue & abuse controls — callable-logic tests (emulator).
 *
 *  1. setSubscriptionStatus: paid/business plans require a real billing entitlement
 *     (billing/{uid}.active) or an explicit demo grant; an unpaid selection stays
 *     pending and never activates (no employer role, no paid credits).
 *  2. Free AI tools count toward the free-tier daily run cap.
 *
 * Run: firebase emulators:exec --only firestore --project demo-careercopilot \
 *        "npx vitest run tests/revenueControls.callable.test.ts"
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as admin from '../functions/node_modules/firebase-admin';
import { applySubscriptionSelection } from '../functions/src/handlers/setSubscriptionStatus';
import { recordFreeToolRun } from '../functions/src/credits/deductCredits';
import { FREE_TIER_DAILY_RUN_LIMIT, getUserTodayUsage } from '../functions/src/admin/usageLog';

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-careercopilot';
const db = admin.firestore();

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

async function seedUser(uid: string, data: Record<string, unknown> = {}) {
  await db.collection('users').doc(uid).set({
    role: 'candidate', subscription_status: 'free', credits: 100, created_at: '2026-01-01', ...data,
  });
}

beforeEach(clearFirestore);
afterEach(() => { delete process.env.ALLOW_DEMO_GRANTS; });

describe('setSubscriptionStatus paid-entitlement gate', () => {
  it('blocks zero-payment activation of a BUSINESS plan → pending, no role/credit change', async () => {
    await seedUser('emp1');
    const res = await applySubscriptionSelection('emp1', 'pending_biz_pro');

    expect(res.status).toBe('pending_payment');
    expect(res.role).toBe('candidate');            // NOT promoted to employer
    expect(res.subscription_status).toBe('free');  // NOT pro
    expect(res.pending_plan).toBe('pro');

    const user = (await db.collection('users').doc('emp1').get()).data()!;
    expect(user.role).toBe('candidate');
    expect(user.subscription_status).toBe('free');
    expect(user.credits).toBe(100);                // no paid credits granted

    const billing = (await db.collection('billing').doc('emp1').get()).data()!;
    expect(billing.pending_plan).toBe('pro');
    expect(billing.active).toBe(false);
  });

  it('blocks zero-payment activation of a paid CANDIDATE plan', async () => {
    await seedUser('cand1');
    const res = await applySubscriptionSelection('cand1', 'pending_accelerator');

    expect(res.status).toBe('pending_payment');
    const user = (await db.collection('users').doc('cand1').get()).data()!;
    expect(user.subscription_status).toBe('free');
    expect(user.credits).toBe(100);
  });

  it('activates a business plan WITH a real billing entitlement (grant_source paid)', async () => {
    await seedUser('emp2');
    await db.collection('billing').doc('emp2').set({ active: true });

    const res = await applySubscriptionSelection('emp2', 'pending_biz_pro');
    expect(res.status).toBe('active');
    expect(res.role).toBe('employer');
    expect(res.subscription_status).toBe('pro');
    expect(res.grant_source).toBe('paid');

    const user = (await db.collection('users').doc('emp2').get()).data()!;
    expect(user.role).toBe('employer');
    expect(user.credits).toBe(100 + 20000); // pro monthly allotment
  });

  it('demo switch activates but tags grant_source demo_preview and never writes billing.active', async () => {
    process.env.ALLOW_DEMO_GRANTS = 'true';
    await seedUser('emp3');

    const res = await applySubscriptionSelection('emp3', 'pending_biz_starter');
    expect(res.status).toBe('active');
    expect(res.role).toBe('employer');
    expect(res.grant_source).toBe('demo_preview');

    const renewal = (await db.collection('credit_renewals').doc('emp3').get()).data()!;
    expect(renewal.grant_source).toBe('demo_preview');

    const billing = await db.collection('billing').doc('emp3').get();
    // A demo grant must never look like a real paid subscription.
    expect(billing.exists && billing.data()!.active === true).toBe(false);
  });

  it('lets a non-privileged FREE plan stay self-service', async () => {
    await seedUser('cand2', { subscription_status: 'accelerator' });
    const res = await applySubscriptionSelection('cand2', 'free');
    expect(res.status).toBe('active');
    expect(res.subscription_status).toBe('free');
    expect(res.role).toBe('candidate');
    expect(res.grant_source).toBe('self_service');
  });

  it('grants the monthly allotment at most once per month even when entitled (high-water mark)', async () => {
    await seedUser('emp4');
    await db.collection('billing').doc('emp4').set({ active: true });

    await applySubscriptionSelection('emp4', 'pending_biz_starter'); // 3000
    const after1 = (await db.collection('users').doc('emp4').get()).data()!;
    expect(after1.credits).toBe(100 + 3000);

    await applySubscriptionSelection('emp4', 'pending_biz_starter'); // same month → no double grant
    const after2 = (await db.collection('users').doc('emp4').get()).data()!;
    expect(after2.credits).toBe(100 + 3000);
  });
});

describe('free AI tools count toward the free-tier daily run cap', () => {
  it('records a free run with credit_cost 0 / status free and increments the run counter', async () => {
    await seedUser('free1');
    const r = await recordFreeToolRun('free1', 'calculateCompatibility', { requestId: 'req_free_0001' });

    expect(r.counted).toBe(true);
    const events = await db.collection('usage_events').where('uid', '==', 'free1').get();
    expect(events.size).toBe(1);
    expect(events.docs[0].data()).toMatchObject({ tool: 'calculateCompatibility', credit_cost: 0, status: 'free' });
    await expect(getUserTodayUsage('free1')).resolves.toEqual({ runs: 1, credits: 0 });
  });

  it('is idempotent on requestId (no double count)', async () => {
    await seedUser('free2');
    await recordFreeToolRun('free2', 'free-tool', { requestId: 'req_free_dupe' });
    const dup = await recordFreeToolRun('free2', 'free-tool', { requestId: 'req_free_dupe' });

    expect(dup.duplicate).toBe(true);
    await expect(getUserTodayUsage('free2')).resolves.toEqual({ runs: 1, credits: 0 });
  });

  it('blocks a free-tier user after FREE_TIER_DAILY_RUN_LIMIT free runs', async () => {
    await seedUser('free3');
    for (let i = 0; i < FREE_TIER_DAILY_RUN_LIMIT; i++) {
      await recordFreeToolRun('free3', 'free-tool', { requestId: `req_cap_${i}` });
    }
    await expect(
      recordFreeToolRun('free3', 'free-tool', { requestId: 'req_cap_over' }),
    ).rejects.toThrow(/daily limit/i);
  });

  it('does NOT cap a paid user running free tools', async () => {
    await seedUser('paid1', { subscription_status: 'accelerator' });
    const total = FREE_TIER_DAILY_RUN_LIMIT + 2;
    for (let i = 0; i < total; i++) {
      await recordFreeToolRun('paid1', 'free-tool', { requestId: `req_paid_${i}` });
    }
    const usage = await getUserTodayUsage('paid1');
    expect(usage.runs).toBe(total);
  });
});
