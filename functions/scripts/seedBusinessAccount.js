/**
 * Create (or upgrade) a TEST business account for Abi's demo / QA sessions.
 *
 * Sets role='employer', subscription_status='job_pack', and fills in company
 * profile fields so the full employer portal flow is exercisable out-of-the-box.
 * Then seeds 8 realistic job postings under that account using the same templates
 * as seedJobs.js.
 *
 * PREREQUISITES — Application Default Credentials (ADC):
 *   gcloud auth application-default login
 *   — OR —
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *
 * RUN (from the functions/ directory):
 *   node scripts/seedBusinessAccount.js [--email <email>] [--password <password>]
 *
 * Defaults:
 *   --email    abi-test@career-copilot.test
 *   --password AbiTest!2026   (printed on first run; change it immediately)
 *
 * EXAMPLES:
 *   node scripts/seedBusinessAccount.js
 *   node scripts/seedBusinessAccount.js --email abi@example.com --password S3cur3!Pass
 */
const admin = require("firebase-admin");

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
const projectId = process.env.GCLOUD_PROJECT || "career-copilot-a3168";
admin.initializeApp({ projectId });

// ---------------------------------------------------------------------------
// Arg parsing  (--email / --password flags; positional fallbacks for compat)
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);

function flag(name) {
  const idx = argv.indexOf(`--${name}`);
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : null;
}

const email    = flag("email")    || argv[0] || "abi-test@career-copilot.test";
const password = flag("password") || argv[1] || "AbiTest!2026";

// ---------------------------------------------------------------------------
// 8 job-posting templates (subset of seedJobs TEMPLATES, inline copy so this
// script is self-contained; keeps all fields within validJobPosting hasOnly)
// ---------------------------------------------------------------------------
const JOB_TEMPLATES = [
  {
    title: "Senior Frontend Engineer (React / TypeScript)",
    location: "Toronto, ON (Hybrid)",
    salary_range: "CAD 100k–130k/yr",
    description: `We are looking for a Senior Frontend Engineer to join our product team in Toronto. You will own the UI layer for our flagship SaaS dashboard, working closely with Product and Design to ship pixel-perfect features.

**Responsibilities**
- Design and build reusable React / TypeScript components consumed across multiple product surfaces
- Lead frontend architecture decisions: state management, performance budgets, accessibility standards
- Mentor junior engineers through code reviews and pair programming sessions
- Collaborate with the backend team on API contract design (REST + GraphQL)

**Requirements**
- 4+ years of production React experience; strong TypeScript fundamentals
- Familiarity with testing (Vitest / Jest, React Testing Library, Playwright)
- Experience with CI/CD pipelines (GitHub Actions, Vercel / Netlify)
- Nice to have: Tailwind CSS, Storybook, Figma handoffs`,
  },
  {
    title: "Backend Engineer – Node.js / Firebase",
    location: "Ottawa, ON (On-site)",
    salary_range: "CAD 90k–115k/yr",
    description: `We are a government-adjacent SaaS company headquartered in Ottawa. As a Backend Engineer you will design and operate Cloud Functions, Firestore data models, and pub/sub pipelines that process thousands of events per minute.

**Responsibilities**
- Author, deploy, and monitor Firebase Cloud Functions (Node.js 20)
- Design Firestore schemas with cost-efficient read/write patterns
- Build secure, tested callable and HTTP functions; maintain security rules
- Participate in on-call rotation and lead incident post-mortems

**Requirements**
- 3+ years Node.js (TypeScript preferred); working knowledge of Firebase ecosystem
- Understanding of NoSQL data modelling trade-offs
- Familiarity with IAM, Secret Manager, and Cloud Monitoring on GCP
- Past experience with security-sensitive government or fintech projects is a plus`,
  },
  {
    title: "Full-Stack Developer (React + Node.js)",
    location: "Remote (Global)",
    salary_range: "USD 3,000–5,000/mo",
    description: `Early-stage product startup looking for a versatile full-stack developer who thrives in ambiguity and can own features end-to-end.

**Responsibilities**
- Ship features across React frontend and Express / Firebase backend with minimal handoffs
- Design database schemas (Firestore / Postgres) and write migrations
- Implement authentication flows, role-based access control, and billing integrations (Stripe)
- Contribute to DevOps: CI pipelines, preview environments, staging → production deploys

**Requirements**
- 3+ years full-stack experience (any modern framework pair)
- Comfortable switching context between frontend and backend in the same sprint
- Solid grasp of HTTP, JSON APIs, and OAuth 2.0
- Experience with cloud hosting (Firebase, Vercel, Railway, Render, or similar)`,
  },
  {
    title: "Full-Stack Engineer – EdTech Platform",
    location: "Ottawa, ON (Hybrid)",
    salary_range: "CAD 85k–110k/yr",
    description: `We build AI-assisted learning tools for universities across Canada. Join us to work on a mission-driven product that measurably improves student outcomes.

**Responsibilities**
- Develop new LMS integrations (Canvas, Brightspace) using REST and LTI 1.3
- Build instructor dashboards in React with real-time WebSocket updates
- Design and maintain Cloud Functions for automated assessment workflows
- Collaborate with data science team on prompt engineering for AI tutoring features

**Requirements**
- 3+ years full-stack (React + Node.js or Python backend)
- Experience consuming or building REST / GraphQL APIs
- Ability to write clear technical documentation for third-party integrators
- Background in education or EdTech is a strong differentiator`,
  },
  {
    title: "DevOps / Platform Engineer",
    location: "Remote (Canada)",
    salary_range: "CAD 105k–135k/yr",
    description: `We run a multi-tenant SaaS platform on GCP and are looking for a platform engineer to harden our infrastructure, improve developer experience, and keep deployments boring.

**Responsibilities**
- Own Terraform modules for GKE clusters, Cloud SQL, and networking
- Build and maintain CI/CD pipelines in GitHub Actions; enforce security scanning gates
- Implement observability stack: Cloud Monitoring, OpenTelemetry, alerting runbooks
- Drive zero-downtime deployment strategies (canary, blue/green) for critical services

**Requirements**
- 4+ years in a DevOps / SRE / Platform role
- Strong GCP or AWS fundamentals; professional cloud certification is a plus
- Terraform or Pulumi IaC experience
- Comfort with Kubernetes operations (Helm, kustomize, pod autoscaling)
- Scripting in Bash and Python`,
  },
  {
    title: "Product Manager – Developer Platform",
    location: "Remote (Canada)",
    salary_range: "CAD 110k–140k/yr",
    description: `We build developer tools used by over 50,000 engineers. As Product Manager for the Platform team you will define the roadmap for SDKs, APIs, and the developer portal.

**Responsibilities**
- Drive quarterly roadmap planning; own PRDs and acceptance criteria for platform features
- Conduct user interviews and synthesize feedback from the community into actionable insights
- Define and track product KPIs (activation, API adoption, error rates)
- Partner with Developer Relations to create enablement content and documentation strategy

**Requirements**
- 3+ years PM experience, ideally on a developer-facing or API product
- Ability to read and understand code; comfortable in technical architecture discussions
- Data-driven decision making: experience with Amplitude, Mixpanel, or equivalent
- Strong written communication; experience writing public-facing changelog and release notes`,
  },
  {
    title: "QA Automation Engineer",
    location: "Ho Chi Minh City, Vietnam",
    salary_range: "USD 1,800–2,800/mo",
    description: `Enterprise SaaS company seeking a QA Automation Engineer to build a comprehensive test suite that catches regressions before they reach production.

**Responsibilities**
- Design and implement end-to-end test suites using Playwright (TypeScript)
- Integrate tests into GitHub Actions CI; report flakiness and maintain < 2% failure rate
- Write API contract tests with Pact or Supertest
- Collaborate with developers during sprint to shift quality left

**Requirements**
- 2+ years test automation experience (Playwright, Cypress, or Selenium)
- Working knowledge of TypeScript or JavaScript
- Understanding of REST API testing concepts
- Experience with BDD / Gherkin notation is a plus`,
  },
  {
    title: "UI/UX Designer (Product Design)",
    location: "Ho Chi Minh City, Vietnam",
    salary_range: "USD 1,500–2,500/mo",
    description: `Our platform connects freelancers with clients across Southeast Asia. We are hiring a Product Designer to own end-to-end design for the Freelancer Success experience.

**Responsibilities**
- Lead discovery: user interviews, usability testing, journey mapping
- Produce wireframes, high-fidelity mockups, and interactive prototypes in Figma
- Collaborate with frontend engineers during implementation; QA designs in staging
- Contribute to and maintain the design system (components, tokens, documentation)

**Requirements**
- 2+ years product / UX design experience for digital products
- Proficient in Figma; basic familiarity with HTML/CSS is a plus
- Portfolio demonstrating end-to-end design process (discovery → delivery)
- Strong understanding of mobile-first design and accessibility guidelines (WCAG 2.1)`,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  const db   = admin.firestore();
  const auth = admin.auth();

  // 1. Create or upgrade the Auth user
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, emailVerified: true });
    console.log("Existing user updated:", user.uid);
  } catch {
    user = await auth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: "Abi Test Co (Demo)",
    });
    console.log("Created user:", user.uid);
  }

  const uid = user.uid;
  const now = new Date().toISOString();

  // 2. Write the users/{uid} document with employer / company fields.
  //    Fields match the validUser whitelist in firestore.rules (and UserDocument in
  //    type/database.ts). subscription_status='job_pack' is a business tier.
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        role: "employer",
        full_name: "Abi Test Co (Demo)",
        email,
        subscription_status: "job_pack",
        company_name: "Abi Test Co",
        company_size: "11-50",
        industry: "Software",
        company_description:
          "Abi Test Co is a fictional software company created for demo and QA purposes. " +
          "All job postings, candidates, and application data under this account are synthetic.",
        credits: 5000,
        english_pro_streak: 0,
        created_at: now,
        updated_at: now,
      },
      { merge: true }
    );

  console.log(`\nFirestore users/${uid} written (role=employer, subscription=job_pack).`);

  // 3. Seed 8 job postings under this employer.
  //    Fields limited to the validJobPosting hasOnly whitelist (employer_id, title,
  //    is_active, created_at, updated_at + optional description/location/salary_range).
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  const createdIds = [];

  for (const job of JOB_TEMPLATES) {
    const ref = db.collection("job_postings").doc();
    const doc = {
      employer_id:  uid,
      title:        job.title,
      is_active:    true,
      created_at:   ts,
      updated_at:   ts,
    };
    if (job.description) doc.description  = job.description;
    if (job.location)    doc.location     = job.location;
    if (job.salary_range) doc.salary_range = job.salary_range;

    batch.set(ref, doc);
    createdIds.push(ref.id);
  }

  await batch.commit();
  console.log(`\nSeeded ${createdIds.length} job postings:`);
  createdIds.forEach((id) => console.log(`  job_postings/${id}`));

  // 4. Print credentials and next steps
  console.log(`
=============================================================
  TEST BUSINESS ACCOUNT READY
=============================================================
  UID:      ${uid}
  Email:    ${email}
  Password: ${password}
  Role:     employer
  Plan:     job_pack
  Company:  Abi Test Co  (size: 11-50, industry: Software)
  Credits:  5000

  NEXT STEPS
  ----------
  1. Log in at the app with the credentials above.
  2. Navigate to Business portal / employer dashboard.
  3. Complete Organisation Info (logo, website, description) if desired.
  4. Open "Discover Talent" — posted jobs are already seeded.
  5. Use the "Post a Job" flow to create additional postings manually.

  CLEANUP
  -------
  Delete the ${createdIds.length} seeded postings from the Firestore console
  (job_postings/<id>) or via:
    firebase firestore:delete job_postings/<id> --project ${projectId}

  WARNING: This is a TEST account. Do NOT use production user data or
  real API keys while logged in as this account.
=============================================================
`);

  process.exit(0);
})().catch((e) => {
  console.error("Failed:", e.message || e);
  process.exit(1);
});
