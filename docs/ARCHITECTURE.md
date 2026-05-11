# System Architecture — Career CoPilot

**Version:** 1.0 (Draft, May 2026)
**Owner:** Jingxuan Xu (Backend) & Kair Wang (Coordinator / Front-end)
**Status:** Draft — to be finalized in Sprint 1

---

## 1. Purpose

This document describes the **target production architecture** for Career CoPilot. It captures the system's components, data flow, integration points, and the engineering principles that guide design decisions. It is the reference document for all engineering work in Phases 2–4.

---

## 2. Architectural Principles

| # | Principle | Implication |
|---|-----------|-------------|
| P1 | **Separation of concerns** | Frontend, API, business logic, AI, and storage are independently testable and deployable. |
| P2 | **Stateless services** | All HTTP services are stateless; state lives in Postgres / Redis / object storage. |
| P3 | **Fail gracefully** | AI providers and external services can fail; user-facing flows degrade rather than crash. |
| P4 | **Observability by default** | Every request is traceable; every error reaches Sentry; every critical path has metrics. |
| P5 | **Security at every layer** | Authentication, input validation, rate limiting, and least-privilege access throughout. |
| P6 | **Simple before clever** | Choose proven, boring technology unless complexity is justified by a concrete need. |

---

## 3. High-Level System Diagram

```
                            ┌──────────────────────────────┐
                            │       Web Client (SPA)       │
                            │  React + TS + Vite + Tailwind│
                            └──────────────┬───────────────┘
                                           │ HTTPS / JSON
                                           ▼
                            ┌──────────────────────────────┐
                            │      API Gateway (BFF)       │
                            │  • TLS termination           │
                            │  • Auth (JWT verification)   │
                            │  • Rate limiting             │
                            │  • Request logging           │
                            └────┬─────────────────────┬───┘
                                 │                     │
                ┌────────────────┘                     └────────────────┐
                ▼                                                       ▼
   ┌────────────────────────────┐                       ┌────────────────────────────┐
   │      Core API Services     │                       │      AI Service Layer      │
   │  • Auth & Identity         │                       │  • Resume Engine           │
   │  • User & Profile          │                       │  • Interview Simulator     │
   │  • Verification            │                       │  • Scoring & Feedback      │
   │  • Recruiter & Marketplace │                       │  • Prompt Templates        │
   │  • Messaging               │                       └──────────┬─────────────────┘
   │  • Notifications           │                                  │
   └──────┬─────────┬───────────┘                                  │
          │         │                                              ▼
          │         │                                  ┌──────────────────────────┐
          │         │                                  │ External LLM Provider    │
          │         │                                  │ (OpenAI / Anthropic)     │
          │         │                                  └──────────────────────────┘
          ▼         ▼
 ┌───────────────┐ ┌────────────────┐    ┌────────────────────┐
 │  PostgreSQL   │ │     Redis      │    │   Object Storage   │
 │  (primary)    │ │ • Sessions     │    │   • Resumes        │
 │  • Users      │ │ • Rate limits  │    │   • Documents      │
 │  • Profiles   │ │ • Job queues   │    │   • Audio (interv.)│
 │  • Resumes    │ │ • Cache        │    └────────────────────┘
 │  • Sessions   │ └────────────────┘
 │  • Messages   │
 │  • Payments   │
 └───────┬───────┘
         │ async
         ▼
 ┌────────────────────┐
 │  Background Jobs   │
 │  • Verification    │
 │  • Email           │
 │  • AI batch        │
 │  • Webhooks        │
 └────────────────────┘
```

---

## 4. Component Responsibilities

### 4.1 Web Client (Frontend)
**Owner:** Kair Wang, Xiaoyi Zhang, Xiaoyan Yang
- React + TypeScript single-page application.
- Talks to API Gateway only.
- Owns: routing, form validation, optimistic UI, accessibility.
- Does **not** call external services directly.

### 4.2 API Gateway / BFF
**Owner:** Jingxuan Xu
- Single public entry point for all client requests.
- Handles TLS, auth verification, rate limiting, request shaping.
- Routes requests to internal services.

### 4.3 Core API Services
**Owner:** Jingxuan Xu
- **Auth & Identity** — registration, login, token refresh, SSO.
- **User & Profile** — profile CRUD, preferences, settings.
- **Verification** — KYC-style credential verification workflow.
- **Recruiter & Marketplace** — recruiter accounts, candidate discovery, opt-in.
- **Messaging** — direct messaging between candidates and recruiters.
- **Notifications** — email / in-app notifications.

### 4.4 AI Service Layer
**Owner:** Jingxuan Xu, Jiaoyang Bi
- Wraps all LLM provider calls behind an internal API.
- Owns prompt templates, retries, cost tracking, response caching.
- **Resume Engine** — parsing, rewriting, ATS scoring.
- **Interview Simulator** — turn-based interview sessions with scoring.
- **Scoring & Feedback** — pluggable scoring functions per use case.

### 4.5 Data Layer
**Owner:** Xiaoyi Zhang
- **PostgreSQL 16** — primary relational store, ACID guarantees.
- **Redis** — sessions, rate-limit counters, lightweight queues, caches.
- **Object Storage (S3-compatible)** — resumes, generated documents, audio.

### 4.6 Background Jobs
**Owner:** Jingxuan Xu, Jiaoyang Bi
- Verification workflow steps.
- Outbound email.
- Batch AI work (long-running rewrites, scoring).
- Webhook handlers.

---

## 5. Data Flow — Key Scenarios

### 5.1 Resume Upload & Optimization
```
Client ──upload──► API Gateway ──► Resume Service
                                       │
                                       ├─► Object Storage (raw file)
                                       │
                                       ├─► Parse & store structured fields (Postgres)
                                       │
                                       └─► Async: AI Service ─► LLM Provider
                                                  │
                                                  ▼
                                             Update Postgres + notify client
```

### 5.2 AI Interview Session
```
Client ──start session──► Interview Service ──► AI Service ──► LLM Provider
                                  │                  ▲
                                  │ (Postgres)       │
                                  ▼                  │
                       Session log + scoring ────────┘ per turn
```

### 5.3 Direct Messaging
```
Candidate ──send──► Messaging Service ──► Postgres (message)
                            │                 │
                            ├──► Redis pub/sub─┴──► Recruiter (real-time)
                            │
                            └──► Notification (if recipient offline)
```

---

## 6. Data Model (Initial Draft)

> **Status:** Draft. Final schema produced by Xiaoyi Zhang in Sprint 1, captured in `docs/DB_DESIGN.md`.

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| `users` | id, email, password_hash, role, created_at | `role ∈ {candidate, recruiter, admin}` |
| `profiles` | id, user_id, name, headline, summary, verified_at | One-to-one with `users` |
| `resumes` | id, user_id, file_url, parsed_json, ats_score | Versioned per upload |
| `verifications` | id, user_id, type, status, evidence_url | `type ∈ {education, employment, certification}` |
| `interview_sessions` | id, user_id, role_context, started_at, score | Has many `interview_turns` |
| `interview_turns` | id, session_id, prompt, response, score | One turn per question |
| `messages` | id, sender_id, recipient_id, body, sent_at, read_at | Threaded by recipient pair |
| `recruiter_orgs` | id, name, verified_at | Recruiter parent entity |
| `placements` | id, candidate_id, recruiter_id, status, payout_amount | Monetization tracking |
| `audit_log` | id, actor_id, action, target, timestamp | All state-changing actions |

---

## 7. API Conventions

- **Style:** RESTful, JSON over HTTPS.
- **Versioning:** URL path versioning, starting at `/api/v1`.
- **Contract:** OpenAPI 3.1 spec, source of truth in `docs/openapi.yaml`.
- **Errors:** Consistent error envelope:
  ```json
  {
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "Email must be a valid address.",
      "details": [{"field": "email"}]
    }
  }
  ```
- **Pagination:** Cursor-based for high-volume endpoints; page-based otherwise.
- **Rate limiting:** Per-IP + per-user, surfaced via `X-RateLimit-*` headers.

---

## 8. Security

| Concern | Approach |
|---------|----------|
| Authentication | JWT access tokens (short-lived) + refresh tokens (rotating). |
| Authorization | Role-based access control (RBAC) at the service layer. |
| Transport | HTTPS only. HSTS enabled. |
| Input validation | Schema validation (zod / Joi) at API boundary. |
| Injection | Parameterized queries; ORM where appropriate. |
| Secrets | Environment variables; never committed; managed via deployment platform. |
| Rate limiting | Redis-backed, per-route policies. |
| Sensitive data | Hashed passwords (argon2); minimum PII; resume content encrypted at rest. |
| Audit logging | All state-changing actions logged with actor + target. |

A formal security review checklist is run in Phase 4.

---

## 9. Observability

| Telemetry | Tooling |
|-----------|---------|
| Error tracking | Sentry (frontend + backend) |
| Structured logs | JSON logs with request ID, user ID (when authenticated) |
| Metrics | Provider built-ins; custom counters for AI usage + cost |
| Tracing | (Optional) OpenTelemetry if budget allows |
| Health checks | `/healthz` (liveness) and `/readyz` (readiness) on every service |

---

## 10. Deployment Topology (Target)

| Component | Environment | Hosting |
|-----------|-------------|---------|
| Frontend | Vercel | Static + CDN |
| Backend services | Render or AWS ECS | Containerized |
| PostgreSQL | Managed (Render / Supabase / RDS) | — |
| Redis | Managed (Upstash / Render) | — |
| Object storage | AWS S3 (or compatible) | — |
| CI/CD | GitHub Actions | — |
| Monitoring | Sentry (free tier) | — |

We will maintain **at least two environments:**
- **`staging`** — mirrors production; used for QA and demos.
- **`production`** — final deployment for the demo and handoff.

Configuration per environment lives in `.env` files (templates committed, secrets not).

---

## 11. Performance Targets (Initial)

| Metric | Target |
|--------|--------|
| P95 API latency (read endpoints) | < 300 ms |
| P95 API latency (AI-bound endpoints) | < 5 s |
| Frontend Time-To-Interactive (3G simulated) | < 5 s |
| Error rate | < 1 % over any 1-hour window |

Targets will be refined after baseline measurement in Sprint 5.

---

## 12. Open Decisions

| # | Decision | Status | Owner |
|---|----------|--------|-------|
| ADR-001 | Backend framework: Express vs NestJS | Open | Jingxuan Xu |
| ADR-002 | LLM provider: OpenAI vs Anthropic vs both | Open | Jingxuan Xu |
| ADR-003 | Real-time transport: WebSockets vs SSE | Open | Jingxuan Xu, Kair Wang |
| ADR-004 | Object storage provider | Open | Jiaoyang Bi |
| ADR-005 | Test runner standardization | Open | Xiaoyan Yang |

Architecture Decision Records (ADRs) live in `docs/adr/` once decisions are taken.

---

## 13. Glossary

| Term | Meaning |
|------|---------|
| **MVP** | Minimum viable product — the current functional version of Career CoPilot |
| **BFF** | Backend for Frontend — a thin API tailored to the client |
| **ATS** | Applicant Tracking System — software used by employers to screen resumes |
| **KYC** | Know Your Customer — identity verification process |
| **RBAC** | Role-Based Access Control |
| **SPA** | Single Page Application |

---

*This document evolves with the project. All material changes must be reviewed and approved before merge.*
