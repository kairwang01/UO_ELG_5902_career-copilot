// One-off QA seed (emulator only): give the candidate a connected wallet + a
// high-scoring resume analysis so the Web3 preview credential's mint-eligibility
// gate opens. Run AFTER seed-emulator.mjs, against the running emulators.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9199';

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-careercopilot' });
const auth = admin.auth();
const db = admin.firestore();

const candidate = await auth.getUserByEmail('candidate@careercopilot.test');
const now = new Date().toISOString();
const walletAddress = '0x1111111111111111111111111111111111111111';

await db.collection('platform_config').doc('web3').set(
  {
    enabled: true,
    network: 'sepolia',
    chain_id: 11155111,
    contract_address: '0x2A3b1A43842238321a22542a035921A362358189',
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_by: 'seed-web3-preview',
  },
  { merge: true },
);

await db.collection('users').doc(candidate.uid).set(
  {
    wallet_address: walletAddress,
    resume_text: 'QA seed resume text for Web3 preview eligibility. Project leadership, measurable delivery, and strong technical evidence.',
    nft_minted: false,
    nft_staked: false,
    nft_earnings: 0,
    nft_token_id: null,
    updated_at: now,
  },
  { merge: true },
);

await db
  .collection('users')
  .doc(candidate.uid)
  .collection('resume_analyses')
  .doc('qa-web3-eligible')
  .set({
    score: 90,
    market_name: 'Canada',
    summary: 'QA seed — high score to unlock the Proof-of-Talent credential.',
    strengths: ['Clear impact bullets', 'Strong keyword coverage'],
    improvements: ['Add metrics to one project'],
    keywords: ['React', 'TypeScript'],
    created_at: now,
  });

console.log(`Enabled Web3 preview and seeded wallet + score-90 analysis for candidate ${candidate.uid}`);
