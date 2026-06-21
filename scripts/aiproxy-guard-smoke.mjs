/**
 * aiProxy guard runtime smoke.
 *
 * Closes the gap left by the impl-level callable suites: the AI proxy callable was
 * never exercised through the real functions emulator runtime (the "unit-green /
 * runtime-crashes" class). This drives the DETERMINISTIC guard layer that rejects
 * BEFORE any model call — so it needs no LLM provider key:
 *   1. unauthenticated  → rejected (auth middleware)
 *   2. missing tool     → invalid-argument
 *   3. unknown tool      → invalid-argument
 *   4. oversized payload → invalid-argument (> MAX_PAYLOAD_CHARS)
 *
 * It intentionally never reaches provider.generate, so a successful generation is out
 * of scope (covered separately when a provider key is available).
 */
import { spawn } from 'node:child_process';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-careercopilot';
const PASSWORD = 'QaSeed!2026';
const CANDIDATE_EMAIL = 'candidate@careercopilot.test';
const MAX_PAYLOAD_CHARS = 100_000;

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

const functionsRegion = process.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
const authEmulatorUrl = process.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9199';
const functionsEmulatorHost = process.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1';
const functionsEmulatorPort = Number(process.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001');

function initClientApp(name) {
  const app = initializeApp(firebaseConfig, name);
  const auth = getAuth(app);
  const functions = getFunctions(app, functionsRegion);
  connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
  connectFunctionsEmulator(functions, functionsEmulatorHost, functionsEmulatorPort);
  return { app, auth, functions };
}

async function runSeedScript() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/seed-emulator.mjs'], {
      cwd: new URL('..', import.meta.url).pathname.replace(/\/$/, ''),
      env: process.env,
      stdio: 'inherit',
    });
    child.on('exit', (code, signal) => (code === 0 ? resolve() : reject(new Error(`seed-emulator failed with ${code ?? signal}`))));
  });
}

async function expectCallableRejected(factory, pattern, label) {
  try {
    await factory();
  } catch (error) {
    const text = `${error?.code || ''} ${error?.message || error}`;
    if (pattern.test(text)) {
      console.log(`  ✓ ${label}`);
      return;
    }
    throw new Error(`${label}: rejected but with unexpected error → ${text}`);
  }
  throw new Error(`Expected rejection: ${label}`);
}

async function main() {
  await runSeedScript();

  const anon = initClientApp('aiproxy-anon');
  const candidate = initClientApp('aiproxy-candidate');

  try {
    const anonAiProxy = httpsCallable(anon.functions, 'aiProxy');
    await expectCallableRejected(
      () => anonAiProxy({ tool: 'generateLearningPlan', payload: {} }),
      /unauthenticated/i,
      'unauthenticated aiProxy call rejected',
    );

    await signInWithEmailAndPassword(candidate.auth, CANDIDATE_EMAIL, PASSWORD);
    const aiProxy = httpsCallable(candidate.functions, 'aiProxy');

    await expectCallableRejected(
      () => aiProxy({ payload: {} }),
      /invalid-argument|tool is required/i,
      'missing tool rejected',
    );

    await expectCallableRejected(
      () => aiProxy({ tool: '__no_such_tool__', payload: {} }),
      /invalid-argument|unknown tool/i,
      'unknown tool rejected',
    );

    await expectCallableRejected(
      () => aiProxy({ tool: 'generateLearningPlan', payload: { blob: 'x'.repeat(MAX_PAYLOAD_CHARS + 1) } }),
      /invalid-argument|too large/i,
      'oversized payload rejected',
    );

    console.log('\naiProxy guard runtime smoke passed.');
  } finally {
    await Promise.allSettled([deleteApp(anon.app), deleteApp(candidate.app)]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
