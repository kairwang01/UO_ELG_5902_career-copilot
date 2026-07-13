# Production Deploy Checklist

The complete, ordered runbook for promoting `main` to the production Firebase project
and VM. Maintained so deploys do not rely on hand-computing each round's delta.

> **Scope note:** this lists the **full backend delta of the Hiring Loop v2 + billing
> arc** (commits `82ade3d` → `515a00a`). If every round was already deployed
> individually, only the latest round's delta is outstanding. If deploys were batched,
> deploy the whole set below. **Confirm against prod first:** `firebase functions:list`
> — anything in "New functions" missing there is being called by the client and will
> 500 until deployed.

---

## 0. Prerequisites (set BEFORE deploying functions)

Functions read non-secret settings from the project-specific Functions environment
file. Stripe credentials are bound from Google Secret Manager.

| Var | Needed by | Notes |
|-----|-----------|-------|
| `STRIPE_SECRET_KEY` | `createCheckoutSession`, `createBillingPortalSession`, `stripeWebhook` | Secret Manager only; never write it to the repository or frontend env |
| `STRIPE_WEBHOOK_SECRET` | `stripeWebhook` | from the Stripe dashboard webhook |
| `APP_BASE_URL` | `createCheckoutSession` | checkout success/cancel return URLs |
| `STRIPE_PRICE_ESSENTIALS` `_ACCELERATOR` `_EXECUTIVE` `_STARTER` `_GROWTH` `_PRO` `_SINGLE_POST` `_JOB_PACK` `_PACK_100` `_PACK_500` `_PACK_1000` | `createCheckoutSession` | one Stripe Price ID per plan or credit pack |
| `ALLOW_DEMO_GRANTS` | `setSubscriptionStatus` | `true` ONLY in demo/staging (zero-payment plan activation, tagged `demo_preview`). **Leave unset in production** so paid plans require a real `billing/{uid}.active`. |

Frontend Hosting / build env:

| Var | Needed by | Notes |
|-----|-----------|-------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | embedded Checkout modal | Use `pk_test_*` for sandbox. If omitted, the client falls back to hosted Checkout redirects. Never use `sk_*` in frontend env. |

Verify Java 21 for emulator-only test gates with `java -version`. Do not hardcode a
macOS Homebrew path on Linux CI or production VMs.

---

## 1. Verification gate (must be green before deploy)

```
npx tsc --noEmit                 # root types
npm --prefix functions run build # functions types
npm run build                    # production bundle
npx vitest run tests/skillMatch.test.ts tests/navigationDecisions.test.ts \
  tests/sessionTransitions.test.ts tests/applicationPipeline.test.ts \
  tests/businessAccess.test.ts tests/resumePreview.test.ts   # 36 unit
JAVA_HOME=/opt/homebrew/opt/openjdk@21 npm run test:rules       # 29 rules
JAVA_HOME=/opt/homebrew/opt/openjdk@21 npm run test:callables   # 56 callable
```
Last verified on `515a00a`: **121/121 green** (36 unit + 29 rules + 56 callable), all builds clean.

---

## 2. Firestore rules + indexes

```
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```
- **rules** delta: `application_messages` (3b171b5), `hidden_candidates` (dae0342).
- **indexes** delta: `application_messages (application_id ASC, created_at ASC)` (3b171b5).
  **Required** — the message-thread query 500s in prod without it.

---

## 3. Cloud Functions (targeted — never bare `--only functions` per project discipline)

**New** (don't exist in prod yet — the client already calls them):
```
firebase deploy --only \
  functions:createCheckoutSession,functions:createBillingPortalSession,functions:stripeWebhook,\
  functions:confirmSimulatedCheckout,functions:cancelSubscriptionSimulated
firebase deploy --only functions:sendApplicationMessage
firebase deploy --only functions:bulkUpdateApplicationStatus
```
**Changed** (redeploy):
```
firebase deploy --only functions:aiProxy,functions:setSubscriptionStatus,functions:onUserCreated
firebase deploy --only functions:createJobApplication,functions:createJobPosting,functions:updateJobPosting,functions:listJobApplicants
```
Shared modules changed and ripple to importers — `credits/deductCredits`, `admin/usageLog`,
`admin/schema`, `llm/prompts`, `llm/toolRegistry`. The functions above cover the
charge/AI/screener paths that import them; if unsure, deploy the changed set together.

Source of truth for the delta:
`git diff --name-only 82ade3d~1 515a00a -- functions/src firestore.rules firestore.indexes.json`

---

## 4. Frontend

```
npm run build      # then publish the host bundle (hosting / static server)
```
`515a00a` is pure frontend (resume-prefill review layer); earlier UI (screener,
messaging, bulk, sourcing hide, SessionContext) ships in the same bundle.

---

## 5. Post-deploy smoke

- `firebase functions:list` — confirm the 4 new functions are present.
- Candidate: prefill review → save; apply with screener answers.
- Employer: applicant packet shows screener answers; bulk action + message; Talent Discovery hide persists.
- Billing: a paid plan select with no `billing.active` (prod, `ALLOW_DEMO_GRANTS` unset) → stays `pending_payment` (no role/credit grant).

---

## Deployment log

### 2026-07-13 — Stripe sandbox Checkout enabled

- `BILLING_SIMULATION=false` on all billing Functions.
- Stripe test credentials are stored in Secret Manager; the publishable test key is
  present only in the VM frontend build environment.
- Eleven CAD test Prices cover candidate subscriptions, employer subscriptions,
  employer one-time products, and credit packs.
- `createCheckoutSession`, `createBillingPortalSession`, `stripeWebhook`,
  `confirmSimulatedCheckout`, and `cancelSubscriptionSimulated` were redeployed.
- The production callable created and immediately expired a real `cs_test_` Embedded
  Checkout Session; no payment method was submitted and no charge was made.
- The webhook signature and asynchronous-payment event path returned HTTP 200.

### 2026-06-20 — `career-copilot-a3168` (commit `9b8639a`)
**Deployed:**
- `firestore:rules` (application_messages, hidden_candidates) ✅
- `firestore:indexes` (application_messages composite) ✅
- functions (created): `bulkUpdateApplicationStatus`, `sendApplicationMessage` ✅
- functions (updated): `aiProxy`, `createJobApplication`, `createJobPosting`, `updateJobPosting`, `listJobApplicants`, `onUserCreated` ✅
- Verified live via `firebase functions:list`.

**Held (require an explicit decision / secret — NOT deployed):**
- `createCheckoutSession`, `stripeWebhook` — `functions/.env` has no `STRIPE_*` / `APP_BASE_URL`; would 500 at runtime. Deploy after setting the env vars in §0.
- `setSubscriptionStatus` (new billing gate) — without `ALLOW_DEMO_GRANTS=true` or a live Stripe webhook, every paid-plan selection becomes permanent `pending_payment`. Decide: set `ALLOW_DEMO_GRANTS=true` (demo) **or** wire Stripe (prod), then deploy.

**Still outstanding:** frontend rebuild + host publish (carries 515a00a + the full arc UI). Runtime note: Cloud Functions are on the deprecated Node.js 20 — schedule a `firebase-functions` + runtime bump.

### 2026-06-20 (later) — simulated checkout (commit `94d672e`)
Demo fake-payment path shipped behind `BILLING_SIMULATION` (set `true` in `functions/.env`).
- functions (created): `createCheckoutSession` (now returns the in-app sim URL while the flag is on), `confirmSimulatedCheckout` ✅ — verified live via `functions:list`.
- `stripeWebhook` still **not** deployed (needs `STRIPE_WEBHOOK_SECRET`; unused in simulation).
- **Frontend publish still required** (no Firebase Hosting configured — served by the project's own host): `npm run build` then publish `dist/`. The `/billing/checkout` page + Talent Discovery hide + all earlier UI ride this bundle.
- To switch to real Stripe later: set `STRIPE_SECRET_KEY` (+ `sk_test_` for test mode) and the `STRIPE_PRICE_*`, set `BILLING_SIMULATION` unset/false, deploy `createCheckoutSession,stripeWebhook`.

### 2026-06-26 — embedded Checkout modal
Checkout can now open inside an in-app modal using Stripe Embedded Checkout.
- frontend env required for modal UX: `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- functions (updated): `createCheckoutSession` (supports `uiMode: embedded`, returns `clientSecret`; hosted/simulated fallback remains)
- frontend publish required: `npm run build` then publish `dist/`
- deploy pairing: `firebase deploy --only functions:createCheckoutSession` plus frontend rebuild/publish. Keep `stripeWebhook` deployed/configured for real entitlement activation; modal completion is not the source of truth.
