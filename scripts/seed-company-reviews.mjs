/**
 * seed-company-reviews.mjs
 * Writes demo company_reviews and employer_rating docs directly to the
 * test Firebase project (career-copilot-a3168) via the Firestore REST API,
 * using the stored Firebase CLI access token — no service account needed.
 *
 * Usage:  node scripts/seed-company-reviews.mjs
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import https from 'https';
import { homedir } from 'os';
import { join } from 'path';

const configPath = join(homedir(), '.config/configstore/firebase-tools.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const TOKEN = config.tokens.access_token;
const PROJECT = 'career-copilot-a3168';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = BASE + path;
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      headers: {
        Authorization: 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(url, opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Convert a plain JS object to a Firestore REST fields map. */
function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string')  fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = { doubleValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (v && typeof v === 'object' && v.__serverTimestamp) fields[k] = { timestampValue: new Date().toISOString() };
    else if (v instanceof Date) fields[k] = { timestampValue: v.toISOString() };
  }
  return fields;
}

async function upsert(collection, docId, data) {
  const fields = toFields(data);
  const path = `/${collection}/${docId}`;
  // PATCH with updateMask updates only specified fields (upsert semantics).
  const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const res = await request('PATCH', `${path}?${mask}`, { fields });
  if (res.status >= 400) {
    throw new Error(`PATCH ${path} → ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return res;
}

// ── Review data ────────────────────────────────────────────────────────────────

const EMPLOYERS = [
  {
    id: 'dChmNQnLLFSIiunSlXmMnySXiql2',
    name: 'NovaSphere Technologies Inc.',
    reviews: [
      {
        uid: 'demo_candidate_001',
        tier: 'hired',
        rating: 5,
        text: 'Incredibly smooth interview process — the recruiter kept me updated at every stage. Onboarding was well-structured and the team was welcoming from day one.',
        daysAgo: 12,
      },
      {
        uid: 'demo_candidate_002',
        tier: 'offer',
        rating: 4,
        text: 'Three rounds total: a take-home, a technical screen, and a culture fit. Feedback was prompt. I ultimately declined the offer for personal reasons, but the process itself was professional and respectful.',
        daysAgo: 28,
      },
      {
        uid: 'demo_candidate_003',
        tier: 'interviewed',
        rating: 3,
        text: 'The technical interview was fair and the questions were relevant. Communication afterwards was a bit slow — took about two weeks to get a status update. Would still recommend applying.',
        daysAgo: 45,
      },
      {
        uid: 'demo_candidate_004',
        tier: 'interviewed',
        rating: 4,
        text: 'Good energy during the on-site. Interviewers were genuinely curious about my background, not just running through a checklist. HR was responsive throughout.',
        daysAgo: 60,
      },
    ],
  },
  {
    id: 'dtoxQCaGjGcO9fqZ4hAHH9W6Y852',
    name: 'Tencent IEG Gaming Group',
    reviews: [
      {
        uid: 'demo_candidate_010',
        tier: 'hired',
        rating: 4,
        text: 'Large company, so the process was more formal than a startup. Four rounds including a panel interview with the team leads. Compensation discussion was transparent and fair.',
        daysAgo: 8,
      },
      {
        uid: 'demo_candidate_011',
        tier: 'interviewed',
        rating: 2,
        text: 'The role description did not match what was discussed in the interview. Expectations around overtime were only mentioned at the final stage, which felt like a bait-and-switch. Proceed with caution.',
        daysAgo: 35,
      },
      {
        uid: 'demo_candidate_012',
        tier: 'offer',
        rating: 5,
        text: 'Excellent experience overall. The team was passionate about their projects and it showed. The technical bar was high but fair, and the interviewers gave hints when I was stuck rather than just watching me struggle.',
        daysAgo: 50,
      },
    ],
  },
];

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  for (const employer of EMPLOYERS) {
    console.log(`\n→ ${employer.name} (${employer.id})`);
    let totalRating = 0;

    for (const r of employer.reviews) {
      const docId = `${employer.id}_${r.uid}`;
      const createdAt = new Date(Date.now() - r.daysAgo * 86400_000);
      await upsert('company_reviews', docId, {
        employer_id: employer.id,
        company_name: employer.name,
        author_uid: r.uid,
        rating: r.rating,
        text: r.text,
        verification_tier: r.tier,
        verified: r.tier === 'hired',
        created_at: createdAt,
        updated_at: createdAt,
      });
      totalRating += r.rating;
      console.log(`  ✓ review by ${r.uid}  [${r.tier}]  ★${r.rating}`);
    }

    // Write the aggregate employer_rating doc (same shape as the Cloud Function trigger).
    const count = employer.reviews.length;
    const avg = Math.round((totalRating / count) * 10) / 10;
    await upsert('employer_rating', employer.id, {
      avg,
      count,
      updated_at: new Date(),
    });
    console.log(`  ✓ employer_rating: avg=${avg} count=${count}`);
  }

  console.log('\nDone. Refresh the app and browse jobs to see ratings and reviews.');
}

main().catch(e => { console.error('\nSeed failed:', e.message); process.exit(1); });
