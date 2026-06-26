import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from '../functions/node_modules/firebase-admin';
import { discoverTalentImpl } from '../functions/src/handlers/discoverTalent';
import { updateWeb3ConfigImpl } from '../functions/src/handlers/web3Config';

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-careercopilot';
const db = admin.firestore();

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

async function seedVerifiedRail() {
  await db.collection('users').doc('emp').set({ role: 'employer', company_name: 'Acme' });
  await db.collection('users').doc('cand-staked').set({
    role: 'candidate',
    full_name: 'Staked Candidate',
    nft_staked: true,
    resume_text: 'Product engineer with React, TypeScript, Python, distributed systems, platform delivery, and strong hiring marketplace experience across several production launches.',
  });
  await db.collection('users').doc('cand-plain').set({
    role: 'candidate',
    full_name: 'Plain Candidate',
    nft_staked: false,
    resume_text: 'Product engineer with React, TypeScript, Python, distributed systems, platform delivery, and strong hiring marketplace experience across several production launches.',
  });
}

beforeEach(clearFirestore);

describe('discoverTalent verified rail', () => {
  it('does not surface nft_staked candidates when the Web3 module is disabled', async () => {
    await seedVerifiedRail();

    const result = await discoverTalentImpl('emp', {});

    expect(result.eligible).toBe(2);
    expect(result.candidates).toEqual([]);
  });

  it('surfaces staked candidates only after the Web3 module is enabled', async () => {
    await seedVerifiedRail();
    await updateWeb3ConfigImpl('super-web3', { enabled: true });

    const result = await discoverTalentImpl('emp', {});

    expect(result.eligible).toBe(2);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      id: 'cand-staked',
      nft_staked: true,
    });
  });

  it('keeps talent discovery business-only', async () => {
    await seedVerifiedRail();
    await db.collection('users').doc('cand-caller').set({ role: 'candidate' });

    await expect(discoverTalentImpl('cand-caller', {})).rejects.toThrow(/business accounts/i);
  });
});
