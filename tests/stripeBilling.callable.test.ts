/**
 * Stripe entitlement tests.
 *
 * The webhook itself is signature-verified HTTP, but the critical product
 * contract is this: a Stripe-confirmed entitlement writes billing.active and
 * then activates the same server-only subscription path used by the app.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from '../functions/node_modules/firebase-admin';
import {
  activateStripeEntitlement,
  deactivateStripeEntitlement,
} from '../functions/src/handlers/stripeBilling';

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-careercopilot';
const db = admin.firestore();

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

async function seedUser(uid: string, data: Record<string, unknown> = {}) {
  await db.collection('users').doc(uid).set({
    role: 'candidate',
    subscription_status: 'free',
    credits: 100,
    created_at: '2026-01-01',
    ...data,
  });
}

beforeEach(clearFirestore);

describe('Stripe entitlements activate billing-gated plans', () => {
  it('activates a paid candidate plan through billing.active and grants paid credits', async () => {
    await seedUser('cand-stripe');

    const res = await activateStripeEntitlement({
      uid: 'cand-stripe',
      plan: 'accelerator',
      audience: 'candidate',
      stripeCustomerId: 'cus_candidate',
      stripeSubscriptionId: 'sub_candidate',
      checkoutSessionId: 'cs_candidate',
      checkoutMode: 'subscription',
    });

    expect(res.status).toBe('active');
    expect(res.subscription_status).toBe('accelerator');
    expect(res.grant_source).toBe('paid');

    const user = (await db.collection('users').doc('cand-stripe').get()).data()!;
    expect(user.role).toBe('candidate');
    expect(user.subscription_status).toBe('accelerator');
    // 100 seeded + accelerator monthly grant (1000 after the 2026-06 pricing revamp; was 750).
    expect(user.credits).toBe(1100);

    const billing = (await db.collection('billing').doc('cand-stripe').get()).data()!;
    expect(billing).toMatchObject({
      active: true,
      plan: 'accelerator',
      audience: 'candidate',
      provider: 'stripe',
      stripe_customer_id: 'cus_candidate',
      stripe_subscription_id: 'sub_candidate',
    });
  });

  it('activates a business plan and promotes the user to employer', async () => {
    await seedUser('emp-stripe');

    const res = await activateStripeEntitlement({
      uid: 'emp-stripe',
      plan: 'pro',
      audience: 'business',
      stripeCustomerId: 'cus_employer',
      stripeSubscriptionId: 'sub_employer',
      checkoutSessionId: 'cs_employer',
      checkoutMode: 'subscription',
    });

    expect(res.status).toBe('active');
    expect(res.role).toBe('employer');
    expect(res.subscription_status).toBe('pro');

    const user = (await db.collection('users').doc('emp-stripe').get()).data()!;
    expect(user.role).toBe('employer');
    expect(user.subscription_status).toBe('pro');
    expect(user.credits).toBe(20100);
  });

  it('deactivates a canceled subscription without demoting an employer out of the portal role', async () => {
    await seedUser('cancel-stripe');
    await activateStripeEntitlement({
      uid: 'cancel-stripe',
      plan: 'starter',
      audience: 'business',
      stripeCustomerId: 'cus_cancel',
      stripeSubscriptionId: 'sub_cancel',
      checkoutSessionId: 'cs_cancel',
      checkoutMode: 'subscription',
    });

    await deactivateStripeEntitlement({
      uid: 'cancel-stripe',
      audience: 'business',
      stripeSubscriptionId: 'sub_cancel',
      reason: 'cancelled',
    });

    const user = (await db.collection('users').doc('cancel-stripe').get()).data()!;
    expect(user.role).toBe('employer');
    expect(user.subscription_status).toBe('free');

    const billing = (await db.collection('billing').doc('cancel-stripe').get()).data()!;
    expect(billing.active).toBe(false);
    expect(billing.status).toBe('cancelled');
  });
});
