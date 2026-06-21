/**
 * Sourcing outreach smoke test.
 *
 * Runs only against Firebase emulators. It locks the runtime consent loop:
 *   1. seed candidate/employer accounts and a job,
 *   2. employer creates an outreach request through the real callable,
 *   3. unlock is rejected before candidate consent,
 *   4. candidate signs in through the real UI and accepts in the Dashboard inbox,
 *   5. employer unlocks the consented packet through the real callable.
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const BASE_URL = process.env.SOURCING_SMOKE_BASE_URL || 'http://127.0.0.1:4175';
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-careercopilot';
const PASSWORD = 'QaSeed!2026';
const ARTIFACT_DIR = `${ROOT}/output/playwright`;
const EMPLOYER_EMAIL = 'employer@careercopilot.test';
const CANDIDATE_EMAIL = 'candidate@careercopilot.test';
const JOB_ID = 'qa-sourcing-outreach-role';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9199';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-careercopilot.firebaseapp.com',
  projectId: PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-careercopilot.appspot.com',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:demo',
};

const viteEnv = {
  ...process.env,
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
  VITE_FIREBASE_FUNCTIONS_REGION: process.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1',
  VITE_FIREBASE_USE_EMULATOR: 'true',
  VITE_FIREBASE_AUTH_EMULATOR_URL: process.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9199',
  VITE_FIRESTORE_EMULATOR_HOST: process.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1',
  VITE_FIRESTORE_EMULATOR_PORT: process.env.VITE_FIRESTORE_EMULATOR_PORT || '8080',
  VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST: process.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1',
  VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT: process.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001',
};

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();
const adminAuth = admin.auth();

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: 'inherit',
      ...options,
    });
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with ${code ?? signal}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startVite() {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--host', '127.0.0.1', '--port', '4175', '--strictPort'],
    {
      cwd: ROOT,
      env: viteEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`));
  return child;
}

function initClientApp(name) {
  const app = initializeApp(firebaseConfig, name);
  const auth = getAuth(app);
  const functions = getFunctions(app, viteEnv.VITE_FIREBASE_FUNCTIONS_REGION);
  connectAuthEmulator(auth, viteEnv.VITE_FIREBASE_AUTH_EMULATOR_URL, { disableWarnings: true });
  connectFunctionsEmulator(
    functions,
    viteEnv.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST,
    Number(viteEnv.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT),
  );
  return { app, auth, functions };
}

async function signInClient(email, appName) {
  const client = initClientApp(appName);
  await signInWithEmailAndPassword(client.auth, email, PASSWORD);
  return client;
}

async function clearOutreachFor(employerUid, candidateUid) {
  const snap = await db
    .collection('sourcing_outreach')
    .where('employer_id', '==', employerUid)
    .where('candidate_id', '==', candidateUid)
    .get();
  await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
}

async function seedSourcingFixture() {
  await run(process.execPath, ['scripts/seed-emulator.mjs']);

  const [candidate, employer] = await Promise.all([
    adminAuth.getUserByEmail(CANDIDATE_EMAIL),
    adminAuth.getUserByEmail(EMPLOYER_EMAIL),
  ]);
  const now = new Date().toISOString();

  await Promise.all([
    db.collection('users').doc(candidate.uid).set({
      role: 'candidate',
      full_name: 'Casey Candidate',
      email: CANDIDATE_EMAIL,
      phone: '+1 555 0135',
      location: 'Ottawa, ON',
      linkedin: 'https://www.linkedin.com/in/casey-candidate',
      github: 'https://github.com/casey-candidate',
      resume_text:
        'Casey Candidate — Product-minded frontend engineer with React, TypeScript, accessibility, and hiring-platform experience.',
      updated_at: now,
    }, { merge: true }),
    db.collection('job_postings').doc(JOB_ID).set({
      employer_id: employer.uid,
      title: 'Product Engineer',
      company_name: 'Seed Test Co',
      location: 'Remote Canada',
      is_active: true,
      created_at: now,
      updated_at: now,
    }, { merge: true }),
    db.collection('talent_profiles').doc(candidate.uid).set({
      summary: { headline: 'Product-minded frontend engineer' },
      skills: { technical: ['React', 'TypeScript', 'Accessibility'] },
      updated_at: now,
    }, { merge: true }),
  ]);

  await clearOutreachFor(employer.uid, candidate.uid);
  return { candidateUid: candidate.uid, employerUid: employer.uid };
}

async function assertUnlockRejectedBeforeConsent(functions, outreachId) {
  const getPacket = httpsCallable(functions, 'getSourcingCandidatePacket');
  try {
    await getPacket({ outreachId });
  } catch (error) {
    const message = String(error?.message || error);
    if (/not accepted|has not accepted/i.test(message)) return;
    throw error;
  }
  throw new Error('Expected pre-consent packet unlock to be rejected.');
}

async function acceptInCandidateBrowser(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  try {
    await page.goto(`${BASE_URL}/workspace?auth=signin`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').waitFor({ timeout: 15_000 });
    await page.locator('input[type="email"]').fill(CANDIDATE_EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.locator('[data-qa-auth="signed-in"]').waitFor({ timeout: 25_000 });
    await page.locator('[data-qa-shell="candidate"]').waitFor({ timeout: 25_000 });
    const inbox = page.locator('[data-qa="sourcing-consent-inbox"]');
    await inbox.waitFor({ timeout: 25_000 });
    const requestCard = inbox.locator('[data-qa="sourcing-request-card"][data-qa-sourcing-status="requested"]');
    await requestCard.waitFor({ timeout: 25_000 });
    await requestCard.getByText('Seed Test Co', { exact: true }).waitFor({ timeout: 25_000 });
    await requestCard.locator('[data-qa="sourcing-accept"]').click();
    await inbox.locator('[data-qa="sourcing-recent-card"][data-qa-sourcing-status="accepted"]').waitFor({ timeout: 25_000 });

    if (consoleErrors.length) {
      throw new Error(`Candidate inbox console errors:\n${consoleErrors.join('\n')}`);
    }
    console.log('  ✓ candidate accepted sourcing request in Dashboard inbox');
  } catch (error) {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    await page.screenshot({ path: `${ARTIFACT_DIR}/sourcing-outreach-candidate.png`, fullPage: true });
    throw error;
  } finally {
    await context.close();
  }
}

async function main() {
  const { candidateUid } = await seedSourcingFixture();

  const employerClient = await signInClient(EMPLOYER_EMAIL, 'sourcing-smoke-employer');
  let candidateClient;
  const vite = startVite();
  try {
    const create = httpsCallable(employerClient.functions, 'createSourcingOutreach');
    const request = await create({
      candidateId: candidateUid,
      jobId: JOB_ID,
      message: 'Your product engineering background looks aligned with our Product Engineer role at Seed Test Co.',
      requestSource: 'smoke_test',
    });
    const outreachId = request.data.outreachId;
    if (!outreachId || request.data.status !== 'requested') {
      throw new Error(`Unexpected createSourcingOutreach result: ${JSON.stringify(request.data)}`);
    }
    console.log(`  ✓ employer created sourcing request ${outreachId}`);

    await assertUnlockRejectedBeforeConsent(employerClient.functions, outreachId);
    console.log('  ✓ pre-consent packet unlock rejected');

    await waitForServer(BASE_URL);
    const browser = await chromium.launch({ headless: true });
    try {
      await acceptInCandidateBrowser(browser);
    } finally {
      await browser.close();
    }

    const getPacket = httpsCallable(employerClient.functions, 'getSourcingCandidatePacket');
    const packet = await getPacket({ outreachId });
    const candidate = packet.data.candidate;
    if (candidate.email !== CANDIDATE_EMAIL) throw new Error(`Unexpected packet email: ${candidate.email}`);
    if (!candidate.phone || !candidate.resume_text?.includes('React')) {
      throw new Error(`Packet missing consented contact/resume data: ${JSON.stringify(candidate)}`);
    }
    console.log('  ✓ employer unlocked consented packet after acceptance');

    // Also prove a candidate-authenticated client cannot unlock the employer packet.
    candidateClient = await signInClient(CANDIDATE_EMAIL, 'sourcing-smoke-candidate');
    const candidateGetPacket = httpsCallable(candidateClient.functions, 'getSourcingCandidatePacket');
    try {
      await candidateGetPacket({ outreachId });
      throw new Error('Candidate unexpectedly unlocked employer packet.');
    } catch (error) {
      const message = String(error?.message || error);
      if (!/requesting employer|permission-denied/i.test(message)) throw error;
    }
    console.log('  ✓ non-employer packet unlock rejected');
  } finally {
    vite.kill('SIGTERM');
    await Promise.allSettled([
      deleteApp(employerClient.app),
      candidateClient ? deleteApp(candidateClient.app) : Promise.resolve(),
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
