# Career CoPilot

AI career-coaching platform. Candidates upload a resume, get a score + AI tools
(cover letters, mock interviews, career paths, etc.); employers post jobs and
discover talent. React 19 + Vite SPA frontend, Firebase (Auth + Firestore +
Storage + Cloud Functions) backend. All AI runs server-side via Cloud Functions.

## Commands

Frontend (repo root):
- `npm run dev` — Vite dev server on **:3000** (host 0.0.0.0)
- `npm run build` — production build (`vite build`)
- `npm run preview` — preview built bundle
- `npm run marketing:qa` — Playwright screenshot QA for marketing site
- `npm run seed:emulator` — seed local emulator with demo data
- `npm run eval:ai` — run AI quality evals (`evals/`)
- `npm run check:stripe-env` — verify Stripe env vars are set
- `npm run scan:functional-bugs` — static scan for known bug signatures

Smoke tests (require functions build + emulators):
- `npm run smoke:auth-routing` — auth & routing smoke
- `npm run smoke:hiring-loop` — full hiring loop smoke
- `npm run smoke:billing-credits` — billing & credits smoke
- `npm run smoke:sourcing-outreach` — sourcing outreach smoke
- `npm run smoke:aiproxy-guard` — aiProxy security smoke
- `npm run smoke:runtime-critical` — run all smoke tests

Unit / integration tests (Vitest, emulator-backed):
- `npm run test:rules` — Firestore security rules tests
- `npm run test:callables` — callable function integration tests
- `npm run test:coverage` — coverage report for core logic modules

Cloud Functions (`cd functions`):
- `npm run build` — `tsc` (must pass before deploy; runs as predeploy hook)
- `npm run dev` / `npm run serve` — Firebase emulators (functions + auth), project `demo-careercopilot`
- `npm run lint` — eslint over `src/`

Emulator ports: functions 5001, auth 9199, firestore 8080, UI 4001.

Vitest is active. Tests live in `tests/`. Coverage is scoped to the pure
core-logic modules in `lib/` (see `vitest.config.ts`). Emulator-backed tests
run sequentially (no parallelism) to avoid Firestore race conditions.
`@cucumber/cucumber` is a dependency but no feature suite is currently active.

## Architecture

### Two apps, one bundle
Entry is `index.tsx` → lazy-loads `marketing/SiteApp.tsx` (the marketing site +
router). The authenticated product lives in `CareerApp.tsx`, lazy-loaded from
the router. Routing is `react-router-dom` v7.

Routes are defined in `config/site.ts` (`SITE_ROUTES`):
- `/` — marketing home
- `/workspace` — signed-in candidate workspace
- `/portal` — employer/business portal
- `/pricing`, `/employers`, `/admin`, `/sample-report`

- **`marketing/`** — public marketing site (landing, pricing, employer pages).
  Self-contained: own components, contexts, design tokens (`design-tokens.ts`,
  `site-theme.css`). Read `marketing/ANTI-PATTERNS.md` and `marketing/Design.md`
  before changing marketing UI.
- **`CareerApp.tsx`** — the signed-in candidate workspace shell.
- **`components/employer/`** — employer portal (separate shell, `EmployerPortal.tsx`).
- **`components/admin/`** — admin console (LLM config, model registry, quotas, prompts).
- **`components/agency/` + `components/AgencyHub.tsx`** — recruiting agency surface.
- **`components/business/`** — business portal auth modals (`BusinessSignInModal`,
  `BusinessSignUpModal`, `BusinessForgotPasswordModal`) and `businessPlans.ts`.
- **`components/dashboard/`** — `Dashboard.tsx`, `Chart.tsx`, `CandidateWorkspacePages.tsx`.
- **`components/modals/`** — `CreditModal.tsx`, `OnboardingFlow.tsx`, `WorkspaceTour.tsx`.
- **`components/onboarding/`** — post-signup guided onboarding UI.

### Contexts
`contexts/` provides app-wide React contexts:
- **`SessionContext.tsx`** — single source of truth for session / profile / role.
  Replaces the old per-surface `useSiteSession` hook calls that caused N parallel
  Firestore reads and redirect race conditions. Every consumer reads from this one
  provider (`useSessionContext`). Exposes `session`, `profile`, `ready`,
  `sessionResolved`, `isAdmin`, `isBusiness`.
- **`CreditsContext.tsx`** — live credit balance for the signed-in user.
- **`ToolResultsContext.tsx`** — shared result state across tool runs.
- **`ApiStatusContext.tsx`** — API health flag (`online` / `degraded` / `offline`).

### Access control (`lib/access/`)
Pure, unit-tested decision functions — keep these free of side effects:
- **`sessionTransitions.ts`** — `decideSessionTransition(prevId, nextId)` —
  classifies auth changes as `signed_in | signed_out | none`.
- **`navigationDecisions.ts`** — `decideWorkspaceShell()`, `signedInHomeRedirectPath()`,
  `businessPortalNavPath()` — route/shell decisions given session + profile state.
- **`businessAccess.ts`** — `hasBusinessPortalAccess(role, subscriptionStatus)`.
- **`permissions.ts`** — per-feature permission checks.

These are covered by tests in `tests/sessionTransitions.test.ts`,
`tests/navigationDecisions.test.ts`, and `tests/businessAccess.test.ts`.

### Talent Profile
`TalentProfileForm.tsx` + `lib/talentProfile.ts` + `services/talentProfile.ts`.
A structured, reusable candidate profile (work history, skills, education, etc.)
stored at `talent_profiles/{uid}` (owner-only; employers never read it directly —
server-side Admin SDK reads it for Discover Talent / apply flow). AI auto-fill
via `extractTalentProfile` in `services/aiClient.ts`. Profile completeness is an
**apply gate** — `isTalentProfileReady()` must pass before a candidate can submit
an application.

### Application audit trail & anti-ghosting
- Status transitions go through the `updateApplicationStatus` callable (server only).
  Each transition writes an immutable audit event to `application_status_events`
  (actor, notes, timestamp). Clients never write to this collection.
- `employer_responsiveness/{employerId}` — Firestore-triggered aggregate
  (`responsiveness.ts`); powers the "typically responds within ~N days" badge on
  job cards. Client read is allowed; writes are server-only.
- Candidate-visible receipt: `MyApplications` shows an "Reviewed by employer"
  badge and any employer note — sourced from the application document directly.

### Notification system
`notifications.ts` is a Firestore trigger on `job_applications` updates. When
`status` changes it writes to `users/{candidateId}/notifications/{auto}` (in-app)
and enqueues an email via the `mail` collection (Firebase Email Extension). All
notification logic is best-effort (wrapped in try/catch; never throws to avoid
Cloud Function retry loops).

### Frontend data access — go through `lib/data`
Components import `{ data }` from `lib/data` (NOT firebase directly for
profiles/auth/api-keys). It's a `DataClient` interface backed by
`firebaseDataClient`. To swap backends you'd repoint the one binding in
`lib/data/index.ts`. Direct `firebase/firestore` calls exist for live
subscriptions (e.g. `onSnapshot` in `CareerApp.tsx`) — that's fine for reads.

`lib/firebaseClient.ts` initializes the app from `VITE_FIREBASE_*` env vars and
exports `app`, `firebaseAuth`, `firestoreDb`, `firebaseFunctions`.

### AI / LLM — entirely server-side
There is **no LLM key in the browser.** The client calls Cloud Functions
(`services/aiClient.ts` and friends) which call the model.

**Two callable paths:**
- **`aiProxy`** (generic dispatcher) — handles all ~30 long-tail tools registered
  in `functions/src/llm/toolRegistry.ts`. One callable, one deploy, one credit-
  deduction path. Frontend sends `{ tool, payload, model?, requestId? }`.
  Adding a new AI tool = one entry in `toolRegistry.ts`, no new function.
- **Dedicated handlers** — `analyzeResume`, `generateCoverLetter`,
  `generateCareerPath`, `mockInterview`, etc. — for tools with complex auth,
  file I/O, or distinct credit logic.

**Model / tier system (`functions/src/llm/models.ts`):**
- `free` — Gemini (default) + KairLLM gateway (shared; daily cap enforced).
- `paid` — free models + DeepSeek (our key). Subscriptions: essentials / accelerator / executive.
- `business` — free models + custom BYOA endpoint (`users/{uid}.custom_provider`).
  Qualifies via role `employer` OR business subscriptions (starter / growth / pro /
  single_post / job_pack).
- Config resolution: Firestore `platform_config/llm` → `functions/.env` fallback.
  Call `ensurePlatformCaches()` at the top of a handler before reading keys.
  See `functions/src/config/env.ts`.

**Resilience features (all in `models.ts`):**
- **Multi-key pooling** — `ModelEntry.api_keys[]` (preferred) or `api_key` (legacy).
  Keys are tried in order; cooled-down keys (tracked in `key_health` Firestore
  collection, 10-minute cooldown) are skipped.
- **In-process sticky key** — `lastSuccessfulKeyIndex` map remembers the last
  working key index per provider+model across requests in the same process.
- **Fallback chains** — `ModelEntry.fallbackChain[]` lists fallback model IDs on
  availability-class errors. If no explicit chain is set, an implicit chain of up
  to 3 other tier-allowed models is used automatically.
- **Free-tier output cap** — `FreeTierOutputCapProvider` wraps free-tier requests
  with a `maxOutputTokens` ceiling (admin-configurable via
  `platform_config/quotas.free_max_output_tokens`; default 8192 = no artificial cut).

**Client-side dedup (`lib/inFlightDedupe.ts`):** `withInFlightDedupe()` collapses
concurrent identical callable invocations (keyed by `requestId`) onto one in-flight
promise — prevents double-charges from rapid re-submits.

### Credits & plans
`config.ts` holds plans (`ALL_PLANS`, `BUSINESS_PLANS`), tool→tier gating
(`TOOL_ACCESS`), and Stripe links (currently **test** links). Per-tool credit
costs in `config/credits.ts` (`TOOL_CREDIT_COSTS`). Server-side credit deduction
in `functions/src/credits/`. Monthly credits are granted on subscribe via
`grantMonthlyCredits` handler — the recurring free-grant faucet is OFF; grants
are plan-aware.

- `INITIAL_USER_CREDITS = 100` — one-time grant for new sign-ups (server-side).
- `PLAN_CREDITS.free = 50` — plan value for display; actual initial grant is 100.
- Credit packs (one-time purchases): 100 / 500 / 1000 credits via Stripe.
- `ENGLISH_PRO_PRACTICE_REWARD = 5` — credits rewarded for practice sessions.

### Observability
`lib/observability.ts` initializes Sentry (`@sentry/react`) at app boot.
No-op unless `VITE_SENTRY_DSN` is set — dynamically imported only when the DSN
is present so dev/CI pay zero cost. Never sends PII to Sentry.

### Feature flags
`config/featureFlags.ts`. Web3 (wallet identity / Proof-of-Talent on Sepolia)
is an experimental opt-in, **default OFF**, persisted per-browser in
localStorage, toggled from the admin Web3 tab. Core product must never depend on it.

## Conventions

- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`). UI primitives are
  Radix + `class-variance-authority` in `components/ui/`. Use `clsx` /
  `tailwind-merge`. Icons from `lucide-react`. Charts via `recharts`.
- **Path alias:** `@/` → repo root (e.g. `@/components/...`).
- **Imports in browser:** `index.html` uses an importmap pulling several deps
  from CDNs (esm.sh). `fs`/`path`/`assert` in `package.json` are inert shims —
  do not write Node-only code in frontend modules.
- **User-facing strings are i18n'd.** No hardcoded copy in components — add a
  key and use `useLocalization` (`hooks/useLocalization.ts`) / `t(...)`.
- **i18n gotcha — keep TWO dirs in sync:** translations are fetched at runtime
  from `/localization/*.json`, which Vite serves from **`public/localization/`**.
  The top-level **`localization/`** dir is the source-of-record copy. When you
  add or change a key you must update BOTH `localization/<lang>.json` and
  `public/localization/<lang>.json`. Languages: en, zh, de, fr, ja, vi (English
  is the fallback for missing keys). Keep all six at full parity.
- **No `alert()`.** Use the toast system (`components/Toast.tsx`, `useToast`).
- **Modals** go through the shared `useModalBehavior` hook / `components/ui/dialog.tsx`.
- **Security rules** are real and enforced: `firestore.rules`, `storage.rules`.
  Update them when adding collections or storage paths.
- **Credits schema dual-maintenance:** `config/credits.ts` and
  `functions/src/credits/schema.ts` are separate builds. When a credit cost
  changes, update both files.

## Environment / deploy

- Firebase project `career-copilot-a3168` is the **shared TEST project**, not
  prod. `firebase deploy` ships functions + rules only — it does **not** deploy
  the frontend.
- Frontend env: copy `.env.example` → `.env.local`, fill `VITE_FIREBASE_*`.
  Optional: `VITE_SENTRY_DSN` (activates error monitoring), `VITE_SENTRY_TRACES_RATE`.
- Functions env: copy `functions/.env.example` → `functions/.env` (gitignored,
  never commit). Test phase uses plain env vars, not Secret Manager.
- Email extension config: see `docs/firestore-send-email.env.example`.

## Git

- **Do NOT add Claude attribution** to commits — no `Co-Authored-By: Claude` or
  "Generated with Claude Code" lines. (Repo-wide rule.)
- Default work branch is `dev`; PRs target `main`.
