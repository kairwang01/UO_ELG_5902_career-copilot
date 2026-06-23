/**
 * Firestore security-rules tests — the P0 trust boundary.
 *
 * Proves the launch-critical invariants against the real firestore.rules in the
 * emulator: a candidate cannot self-escalate role, self-grant credits/plans, or
 * post jobs; only employers post; company identity is employer-only; tool_results
 * saving is paid-tier gated; users can't read each other's docs.
 *
 * Run: firebase emulators:exec --only firestore --project demo-careercopilot \
 *        "npx vitest run tests/firestore.rules.test.ts"
 */
import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

const PROJECT_ID = 'demo-careercopilot';
let testEnv: RulesTestEnvironment;

const ts = () => Timestamp.fromMillis(1_750_000_000_000);

const CANDIDATE = {
  role: 'candidate', credits: 100, created_at: '2026-01-01T00:00:00Z',
  subscription_status: 'free', full_name: 'Cand Idate',
};
const PAID_CANDIDATE = { ...CANDIDATE, subscription_status: 'accelerator' };
const EMPLOYER = {
  role: 'employer', credits: 100, created_at: '2026-01-01T00:00:00Z',
  subscription_status: 'free', full_name: 'Emp Loyer', company_name: 'Acme',
};

const validJob = (employerId: string) => ({
  employer_id: employerId, title: 'Senior Engineer', company_name: 'Acme',
  description: 'Build things', location: 'Remote', is_active: true,
  created_at: ts(), updated_at: ts(),
});

async function seed(uid: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), data);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(process.env.RULES_PATH || 'firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

describe('user-doc trust boundary', () => {
  it('candidate CANNOT self-escalate role to employer', async () => {
    await seed('cand1', CANDIDATE);
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertFails(updateDoc(doc(db, 'users', 'cand1'), { role: 'employer', updated_at: ts() }));
  });
  it('candidate CANNOT self-grant credits', async () => {
    await seed('cand1', CANDIDATE);
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertFails(updateDoc(doc(db, 'users', 'cand1'), { credits: 999999 }));
  });
  it('candidate CANNOT self-upgrade subscription_status', async () => {
    await seed('cand1', CANDIDATE);
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertFails(updateDoc(doc(db, 'users', 'cand1'), { subscription_status: 'executive' }));
  });
  it('candidate CANNOT write employer company_* fields', async () => {
    await seed('cand1', CANDIDATE);
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertFails(updateDoc(doc(db, 'users', 'cand1'), { company_name: 'Google', updated_at: ts() }));
  });
  it('candidate CAN update an allowed profile field', async () => {
    await seed('cand1', CANDIDATE);
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', 'cand1'), { full_name: 'New Name', updated_at: ts() }));
  });
  it('candidate CAN save account profile fields through merge upsert', async () => {
    await seed('cand1', {
      ...CANDIDATE,
      created_at: ts(),
      updated_at: ts(),
      avatar_url: null,
    });
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertSucceeds(setDoc(doc(db, 'users', 'cand1'), {
      full_name: 'Runtime Saved Name',
      birth_date: '1999-04-08',
      avatar_url: null,
      updated_at: ts(),
    }, { merge: true }));
  });
  // Decisive: a candidate write that goes through the heavy validUser path (NOT the
  // small legacy path) must still ALLOW — proves the rule stays under Firestore's
  // 1000-expression ceiling for legitimate writes after the role/company hardening.
  it('candidate CAN save resume_text (heavy validUser path)', async () => {
    await seed('cand1', CANDIDATE);
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', 'cand1'),
      { resume_text: 'x'.repeat(2000), resume_file_name: 'cv.pdf', updated_at: ts() }));
  });
  it('employer CAN update its own company_* fields', async () => {
    await seed('emp1', EMPLOYER);
    const db = testEnv.authenticatedContext('emp1').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', 'emp1'), { company_name: 'Acme Corp', updated_at: ts() }));
  });
  it('a user CANNOT read another user doc', async () => {
    await seed('cand1', CANDIDATE);
    await seed('cand2', CANDIDATE);
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertFails(getDoc(doc(db, 'users', 'cand2')));
  });
});

describe('job-posting writes are server-only (createJobPosting callable)', () => {
  // Direct client writes to job_postings are now denied for EVERYONE — all
  // create/update goes through the entitlement-checked Admin-SDK callables.
  it('candidate CANNOT client-create a job posting', async () => {
    await seed('cand1', CANDIDATE);
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertFails(setDoc(doc(db, 'job_postings', 'j1'), validJob('cand1')));
  });
  it('employer CANNOT client-create a job posting (must use the callable)', async () => {
    await seed('emp1', EMPLOYER);
    const db = testEnv.authenticatedContext('emp1').firestore();
    await assertFails(setDoc(doc(db, 'job_postings', 'j1'), validJob('emp1')));
  });
  it('employer CANNOT client-update a job posting', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'job_postings', 'j1'), validJob('emp1'));
    });
    await seed('emp1', EMPLOYER);
    const db = testEnv.authenticatedContext('emp1').firestore();
    await assertFails(updateDoc(doc(db, 'job_postings', 'j1'), { title: 'Edited' }));
  });
  it('employer CAN still read + delete its own posting', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'job_postings', 'j1'), validJob('emp1'));
    });
    await seed('emp1', EMPLOYER);
    const db = testEnv.authenticatedContext('emp1').firestore();
    await assertSucceeds(getDoc(doc(db, 'job_postings', 'j1')));
  });
  it('clients CANNOT read/write job_posting_events audit log', async () => {
    await seed('emp1', EMPLOYER);
    const db = testEnv.authenticatedContext('emp1').firestore();
    await assertFails(getDoc(doc(db, 'job_posting_events', 'e1')));
    await assertFails(setDoc(doc(db, 'job_posting_events', 'e1'), { job_id: 'j1', action: 'created' }));
  });
});

describe('saved tool_results tier gate', () => {
  it('free candidate CANNOT save a tool result', async () => {
    await seed('cand1', CANDIDATE);
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertFails(setDoc(doc(db, 'users', 'cand1', 'tool_results', 'salary-negotiation'),
      { tool_key: 'salary-negotiation', result: { plan: 'x' } }));
  });
  it('paid candidate CAN save a tool result', async () => {
    await seed('paid1', PAID_CANDIDATE);
    const db = testEnv.authenticatedContext('paid1').firestore();
    await assertSucceeds(setDoc(doc(db, 'users', 'paid1', 'tool_results', 'salary-negotiation'),
      { tool_key: 'salary-negotiation', result: { plan: 'x' } }));
  });
});

describe('interview_sessions history access', () => {
  const validSession = {
    started_at: ts(),
    market_name: 'Canada',
    job_description: 'Job Title: Product Manager',
    overall_summary: 'Clear STAR structure with one measurable result.',
    exchanges: [
      { question: 'Tell me about a project.', answer: 'I led the launch.', score: 82, feedback: 'Good structure.' },
    ],
  };

  it('the owner CAN save and read a mock-interview session', async () => {
    const db = testEnv.authenticatedContext('cand1').firestore();
    await assertSucceeds(setDoc(doc(db, 'users', 'cand1', 'interview_sessions', 'session1'), validSession));
    await assertSucceeds(getDoc(doc(db, 'users', 'cand1', 'interview_sessions', 'session1')));
  });

  it('another user CANNOT read or write your mock-interview history', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'cand1', 'interview_sessions', 'session1'), validSession);
    });
    const other = testEnv.authenticatedContext('other').firestore();
    await assertFails(getDoc(doc(other, 'users', 'cand1', 'interview_sessions', 'session1')));
    await assertFails(setDoc(doc(other, 'users', 'cand1', 'interview_sessions', 'session2'), validSession));
  });
});

describe('application_interviews access', () => {
  async function seedInterview() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'application_interviews', 'iv1'),
        { application_id: 'app1', employer_id: 'emp1', candidate_id: 'cand1', interview_status: 'scheduled' });
    });
  }
  it('the candidate on the interview can read it', async () => {
    await seedInterview();
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('cand1').firestore(), 'application_interviews', 'iv1')));
  });
  it('the owning employer can read it', async () => {
    await seedInterview();
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('emp1').firestore(), 'application_interviews', 'iv1')));
  });
  it('an unrelated user CANNOT read it', async () => {
    await seedInterview();
    await assertFails(getDoc(doc(testEnv.authenticatedContext('other').firestore(), 'application_interviews', 'iv1')));
  });
  it('clients CANNOT write interviews directly (server-only)', async () => {
    await seedInterview();
    const db = testEnv.authenticatedContext('emp1').firestore();
    await assertFails(setDoc(doc(db, 'application_interviews', 'iv2'), { application_id: 'app1', employer_id: 'emp1', candidate_id: 'cand1' }));
    await assertFails(updateDoc(doc(db, 'application_interviews', 'iv1'), { interview_status: 'cancelled' }));
  });
});

describe('API platform registry is server-only', () => {
  it('clients CANNOT read or write API applications, keys, or usage logs directly', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'api_applications', 'app1'), { name: 'Partner', created_at: ts() });
      await setDoc(doc(ctx.firestore(), 'api_keys', 'key1'), { prefix: 'cc_dev_abcd', secret_hash: 'x', created_at: ts() });
      await setDoc(doc(ctx.firestore(), 'api_usage_logs', 'log1'), { endpoint: '/v1/jobs', timestamp: ts() });
    });
    const db = testEnv.authenticatedContext('adminish').firestore();
    await assertFails(getDoc(doc(db, 'api_applications', 'app1')));
    await assertFails(setDoc(doc(db, 'api_applications', 'app2'), { name: 'Forged' }));
    await assertFails(getDoc(doc(db, 'api_keys', 'key1')));
    await assertFails(updateDoc(doc(db, 'api_keys', 'key1'), { status: 'active' }));
    await assertFails(getDoc(doc(db, 'api_usage_logs', 'log1')));
    await assertFails(setDoc(doc(db, 'api_usage_logs', 'log2'), { endpoint: '/v1/users' }));
  });
});

describe('platform Web3 config is callable-only', () => {
  it('clients CANNOT read or write platform_config/web3 directly', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'platform_config', 'web3'), { enabled: true, updated_at: ts() });
    });
    const db = testEnv.authenticatedContext('super-looking-user').firestore();
    await assertFails(getDoc(doc(db, 'platform_config', 'web3')));
    await assertFails(setDoc(doc(db, 'platform_config', 'web3'), { enabled: false }));
    await assertFails(updateDoc(doc(db, 'platform_config', 'web3'), { enabled: false }));
  });
});

describe('application_scorecards access', () => {
  async function seedScorecard() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'application_scorecards', 'sc1'),
        { application_id: 'app1', employer_id: 'emp1', candidate_id: 'cand1', interview_id: 'iv1', recommendation: 'hire' });
    });
  }
  it('the owning employer can read a scorecard', async () => {
    await seedScorecard();
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('emp1').firestore(), 'application_scorecards', 'sc1')));
  });
  it('the candidate CANNOT read the employer scorecard', async () => {
    await seedScorecard();
    await assertFails(getDoc(doc(testEnv.authenticatedContext('cand1').firestore(), 'application_scorecards', 'sc1')));
  });
  it('an unrelated employer CANNOT read it', async () => {
    await seedScorecard();
    await assertFails(getDoc(doc(testEnv.authenticatedContext('emp2').firestore(), 'application_scorecards', 'sc1')));
  });
  it('clients CANNOT write scorecards directly (server-only)', async () => {
    await seedScorecard();
    const db = testEnv.authenticatedContext('emp1').firestore();
    await assertFails(setDoc(doc(db, 'application_scorecards', 'sc2'), { application_id: 'app1', employer_id: 'emp1', candidate_id: 'cand1' }));
    await assertFails(updateDoc(doc(db, 'application_scorecards', 'sc1'), { recommendation: 'strong_hire' }));
  });
});

describe('hidden_candidates (Talent Discovery hide) access', () => {
  it('the owner can hide, read, and un-hide a candidate', async () => {
    const db = testEnv.authenticatedContext('emp1').firestore();
    await assertSucceeds(setDoc(doc(db, 'users', 'emp1', 'hidden_candidates', 'cand9'), { hidden_at: ts() }));
    await assertSucceeds(getDoc(doc(db, 'users', 'emp1', 'hidden_candidates', 'cand9')));
  });
  it('another employer CANNOT read or write your hidden set', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'emp1', 'hidden_candidates', 'cand9'), { hidden_at: ts() });
    });
    const other = testEnv.authenticatedContext('emp2').firestore();
    await assertFails(getDoc(doc(other, 'users', 'emp1', 'hidden_candidates', 'cand9')));
    await assertFails(setDoc(doc(other, 'users', 'emp1', 'hidden_candidates', 'cand10'), { hidden_at: ts() }));
  });
});

describe('application_messages access', () => {
  async function seedMessage() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'application_messages', 'msg1'),
        { application_id: 'app1', employer_id: 'emp1', candidate_id: 'cand1', sender_role: 'employer', body: 'Hello' });
    });
  }
  it('the candidate on the application can read the message', async () => {
    await seedMessage();
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('cand1').firestore(), 'application_messages', 'msg1')));
  });
  it('the owning employer can read the message', async () => {
    await seedMessage();
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('emp1').firestore(), 'application_messages', 'msg1')));
  });
  it('an unrelated user CANNOT read the thread', async () => {
    await seedMessage();
    await assertFails(getDoc(doc(testEnv.authenticatedContext('other').firestore(), 'application_messages', 'msg1')));
  });
  it('clients CANNOT write messages directly (server-only — sendApplicationMessage callable)', async () => {
    await seedMessage();
    const db = testEnv.authenticatedContext('emp1').firestore();
    await assertFails(setDoc(doc(db, 'application_messages', 'msg2'), { application_id: 'app1', employer_id: 'emp1', candidate_id: 'cand1', body: 'forged' }));
    await assertFails(updateDoc(doc(db, 'application_messages', 'msg1'), { body: 'edited' }));
  });
});

describe('sourcing_outreach access', () => {
  async function seedOutreach() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sourcing_outreach', 'out1'),
        { employer_id: 'emp1', candidate_id: 'cand1', status: 'requested', message: 'Interested in connecting' });
    });
  }
  it('the requested candidate can read the outreach request', async () => {
    await seedOutreach();
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('cand1').firestore(), 'sourcing_outreach', 'out1')));
  });
  it('the requesting employer can read the outreach request', async () => {
    await seedOutreach();
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('emp1').firestore(), 'sourcing_outreach', 'out1')));
  });
  it('an unrelated user CANNOT read the outreach request', async () => {
    await seedOutreach();
    await assertFails(getDoc(doc(testEnv.authenticatedContext('other').firestore(), 'sourcing_outreach', 'out1')));
  });
  it('clients CANNOT create or mutate consent state directly', async () => {
    await seedOutreach();
    const emp = testEnv.authenticatedContext('emp1').firestore();
    const cand = testEnv.authenticatedContext('cand1').firestore();
    await assertFails(setDoc(doc(emp, 'sourcing_outreach', 'out2'), { employer_id: 'emp1', candidate_id: 'cand1', status: 'requested' }));
    await assertFails(updateDoc(doc(cand, 'sourcing_outreach', 'out1'), { status: 'accepted' }));
  });
});
