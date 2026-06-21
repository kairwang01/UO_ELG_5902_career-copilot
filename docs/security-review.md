# Security Review — Career CoPilot (OWASP Top 10, 2021)

Scope: Firestore security rules, Cloud Functions callables, client auth/session, and
the AI-credit/billing paths. This is a code-level review of the trust boundary, not a
penetration test. Evidence references concrete files; findings are tracked at the end.

Trust model in one line: **the client is never trusted.** All privileged state
transitions (role, credits, subscription, job/application/interview/scorecard writes,
sourcing consent, admin actions) run through Cloud Functions callables; Firestore rules
are deny-by-default with narrow owner/role reads and almost no client writes.

---

## A01 — Broken Access Control  ✅ strong

- **Owner-only reads / server-only writes.** `firestore.rules` gates per-user
  collections by `isOwner(uid)` and denies client writes on server-owned data
  (`application_snapshots`, `application_status_events`, `sourcing_outreach`,
  `application_interviews`, `credit_ledger`, `usage_*`). Writes flow through callables.
- **Role is server-pinned.** A prior P0 fix removed client-escalatable `role`; role is
  set server-side at provisioning / via admin callables only. Job posting is gated to
  employers (`isPoster()`); company impersonation is blocked.
- **Callable authorization.** `requireAuth` (uid) on every callable; `requireRole`
  (reviewer < admin < super) on every admin callable, enforced server-side — frontend
  hiding is explicitly *not* relied upon (`adminPortal.ts` role matrix).
- **Cross-party gates.** `updateApplicationStatus` rejects a candidate mutating status
  ("doesn't own the job"); `getSourcingCandidatePacket` releases PII only to the
  requesting employer AND only after `status === "accepted"`; `respond/cancel` are
  restricted to the candidate / employer respectively.
- Verified by `tests/firestore.rules.test.ts` (35) + `tests/*.callable.test.ts` (72) +
  runtime smokes (`smoke:hiring-loop`, `smoke:sourcing-outreach` assert the cross-party
  rejections through the real functions runtime).

## A02 — Cryptographic Failures  ✅ (secrets server-side)

- Stripe + LLM provider keys (`STRIPE_*`, KAIRLLM/Gemini/DeepSeek) live in functions
  env only; never shipped to the client. Admin UI shows only `*_masked` key prefixes
  and never re-displays a raw key (`AdminPortal`/`ApiPlatformPanel`/`BusinessCustomApi`).
- Resume files are owner-only in Storage; employers never receive raw files, only the
  server-snapshotted text via authorized callables.

## A03 — Injection  ✅ (low surface)

- No SQL (Firestore). Callable inputs are validated: `assertNonNegativeInt`,
  string-length caps, enum checks (status/plan/tool keys), `aiProxy` payload cap
  (`MAX_PAYLOAD_CHARS = 100_000`) and unknown-tool rejection — all asserted by
  `smoke:aiproxy-guard`.
- Prompt construction uses a fixed registry; user text is data, not template, and the
  resume formatter prompt explicitly forbids emitting fabricated/forged fields.

## A04 — Insecure Design  ✅

- **Charge-before-call + atomic deduction:** `aiProxy` deducts credits inside a
  Firestore transaction *before* the model call, with a refund path on failure — no
  free runs, no double-spend (`deductCredits.ts`, tested).
- **Consent-gated sourcing:** employers see only safe candidate signals until the
  candidate accepts; PII packet is server-gated. Mirrors BOSS/LinkedIn "trusted reach".
- **Frozen application snapshots:** the resume + screener answers are snapshotted
  server-side at apply time so an employer reviews exactly what was submitted.

## A05 — Security Misconfiguration  ✅ / ⚠ minor

- Rules are deny-by-default (no catch-all allow). `BILLING_SIMULATION` is an explicit,
  env-gated flag (off in prod). ⚠ Ensure prod never sets `BILLING_SIMULATION=true`
  (it bypasses Stripe and grants entitlements directly) — add to the deploy checklist.

## A06 — Vulnerable & Outdated Components  ⚠ ongoing

- `npm audit` shows advisories (typical for a Vite/React app). No known
  critical in a server-reachable path. Recommendation: scheduled `npm audit` review;
  Cloud Functions runtime upgrade (nodejs20 → current LTS) is tracked separately.

## A07 — Identification & Authentication Failures  ✅

- Firebase Auth; `requireAuth` rejects unauthenticated callables (verified by
  `smoke:aiproxy-guard`). Email verification sent on signup. Password update + auth
  flows guarded against synchronous double-submit (ref latches). Half-created-account
  edge (auth user created, profile write fails) is flagged for a rollback/resume design
  (BusinessSignUp) — see findings.

## A08 — Software & Data Integrity Failures  ✅

- Audit trails: `admin_audit_log` (with field-level quota-change diffs),
  `application_status_events`, `credit_ledger`. All server-written.
- **Runtime-write integrity:** modular `FieldValue`/`Timestamp` everywhere (a prior
  namespaced-access bug dropped `serverTimestamp` in the functions runtime — fixed +
  locked by runtime smokes). `npm run smoke:runtime-critical` gates the critical paths.

## A09 — Security Logging & Monitoring Failures  ⚠ partial

- Strong audit logging exists (above). **Gap:** no error/performance monitoring
  (Sentry) wired yet — tracked as SCRUM-39. Until then, runtime visibility relies on
  Cloud Functions logs.

## A10 — SSRF  ✅ (hardened) / ⚠ DNS-rebinding residual

- `extractTextFromUrl` (resume URL import) fetches a user-supplied URL server-side
  behind auth, with: http(s)-only; a host block-list covering localhost, IPv4 private
  ranges (10/8, 172.16/12, 192.168/16, 127/8), link-local `169.254/16` (cloud
  metadata), `metadata.google.internal`, `.local`/`.internal`, **and now IPv6**
  (`::1`, `::`, `fc00::/7` unique-local, `fe80::/10` link-local, and IPv4-mapped
  `::ffff:<private v4>`); **manual redirect following (≤5 hops) that re-validates every
  hop** so a safe URL can't 3xx into an internal host; 10s timeout; 200 KB response cap.
- ⚠ Residual: DNS rebinding (a public hostname resolving to a private IP) is not
  caught by the hostname guard — acceptable behind auth for this milestone; a full fix
  resolves + pins the IP. Tracked, not blocking.

---

## Findings / follow-ups

| # | Sev | Item | Action |
|---|-----|------|--------|
| 1 | Low | SSRF on `extractTextFromUrl` — hostname guard hardened (IPv4+IPv6+mapped, redirect re-validation, caps). | Residual: DNS-rebinding (resolve+pin IP) — optional |
| 2 | Med | No error monitoring | Wire Sentry (SCRUM-39) |
| 3 | Low | `BILLING_SIMULATION` must stay off in prod | Add explicit check to deploy checklist |
| 4 | Low | Half-created account (BusinessSignUp) | Auth-rollback or resume-detection on profile-write failure |
| 5 | Info | Dependency advisories | Scheduled `npm audit`; plan functions runtime upgrade |

No critical or high-severity access-control findings. The trust boundary (client →
callables → rules) is consistently enforced and runtime-tested.
