/**
 * seed-emulator.mjs — provision the three QA accounts the auth/routing acceptance
 * criteria need, against the LOCAL Firebase emulators (never prod).
 *
 *   candidate         → role 'candidate'              → must land on /workspace (candidate shell)
 *   employer          → role 'employer' + biz plan    → must land on /portal (employer shell)
 *   admin-candidate   → role 'candidate' + admin auth → must land on /workspace, NOT /admin
 *
 * The last account is the regression guard for "admin authority must not hijack a
 * candidate's product surface" (decideWorkspaceShell / navigationDecisions).
 *
 * Run (starts the auth+firestore emulators, seeds, exits):
 *   npm run seed:emulator
 * Or against already-running emulators:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 \
 *     node scripts/seed-emulator.mjs
 *
 * Idempotent per email. All accounts share the password below (emulator only).
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin');

// Hard-pin to the emulators so this can NEVER touch a real project.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9199';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-careercopilot';
const PASSWORD = 'QaSeed!2026';

admin.initializeApp({ projectId: PROJECT_ID });
const auth = admin.auth();
const db = admin.firestore();

const now = new Date().toISOString();

async function ensureUser(email, displayName) {
  try {
    return await auth.getUserByEmail(email);
  } catch {
    return await auth.createUser({ email, password: PASSWORD, emailVerified: true, displayName });
  }
}

async function writeProfile(uid, data) {
  await db.collection('users').doc(uid).set(
    { credits: 100, created_at: now, updated_at: now, ...data },
    { merge: true },
  );
}

async function grantAdmin(uid) {
  const ref = db.collection('platform_config').doc('access');
  const snap = await ref.get();
  const admin_uids = snap.exists ? [...(snap.data().admin_uids || [])] : [];
  if (!admin_uids.includes(uid)) admin_uids.push(uid);
  await ref.set({ admin_uids, updated_at: now }, { merge: true });
  await auth.setCustomUserClaims(uid, { admin: true });
}

async function main() {
  // 1. Plain candidate
  const candidate = await ensureUser('candidate@careercopilot.test', 'Casey Candidate');
  await writeProfile(candidate.uid, {
    role: 'candidate',
    full_name: 'Casey Candidate',
    subscription_status: 'free',
    resume_text:
      'Casey Candidate — Frontend Engineer\n\nEXPERIENCE\nFrontend Engineer (2021–present): React, TypeScript, accessibility.',
  });

  // 2. Employer / business
  const employer = await ensureUser('employer@careercopilot.test', 'Erin Employer');
  await writeProfile(employer.uid, {
    role: 'employer',
    full_name: 'Erin Employer',
    subscription_status: 'job_pack',
    company_name: 'Seed Test Co',
    company_size: '11-50',
  });

  // 3. Admin who is ALSO a product candidate — must reach /workspace, never auto /admin.
  const adminCandidate = await ensureUser('admin-candidate@careercopilot.test', 'Avery Admin');
  await writeProfile(adminCandidate.uid, {
    role: 'candidate',
    full_name: 'Avery Admin',
    subscription_status: 'free',
    resume_text: 'Avery Admin — Product Manager who also operates the platform.',
  });
  await grantAdmin(adminCandidate.uid);

  // Verify the seed (no browser needed).
  const checks = [
    ['candidate', candidate.uid, 'candidate'],
    ['employer', employer.uid, 'employer'],
    ['admin-candidate', adminCandidate.uid, 'candidate'],
  ];
  for (const [label, uid, expectedRole] of checks) {
    const doc = await db.collection('users').doc(uid).get();
    const role = doc.get('role');
    if (role !== expectedRole) {
      throw new Error(`Seed check failed: ${label} role=${role}, expected ${expectedRole}`);
    }
    console.log(`  ✓ ${label.padEnd(16)} ${uid}  role=${role}`);
  }
  const access = await db.collection('platform_config').doc('access').get();
  if (!(access.get('admin_uids') || []).includes(adminCandidate.uid)) {
    throw new Error('Seed check failed: admin-candidate not in platform_config/access.admin_uids');
  }
  console.log(`  ✓ admin-candidate is in admin_uids (admin authority granted, role stays candidate)`);
  console.log(`\nSeeded 3 QA accounts (password: ${PASSWORD}) against ${PROJECT_ID} emulators.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed failed:', e?.message || e);
    process.exit(1);
  });
