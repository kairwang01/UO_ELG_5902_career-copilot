# Career CoPilot

> **An AI-powered career platform that helps job seekers perfect their resumes, master interviews through AI simulators, and monetize verified professional profiles by connecting directly with top recruiting agencies.**

[![Status](https://img.shields.io/badge/status-MVP%20%E2%86%92%20Production-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Course](https://img.shields.io/badge/uOttawa-ELG%2FDTI%2FGNG%205902-red)]()
[![Team](https://img.shields.io/badge/team-8-orange)]()

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Core Features](#core-features)
3. [System Architecture](#system-architecture)
4. [Technology Stack](#technology-stack)
5. [Repository Structure](#repository-structure)
6. [Getting Started](#getting-started)
7. [Development Workflow](#development-workflow)
8. [Quality Assurance](#quality-assurance)
9. [Documentation](#documentation)
10. [Contact](#contact)

---

## Project Overview

**Career CoPilot** is an innovative AI-powered platform designed to give job seekers a measurable advantage in a competitive recruitment market. The existing functional MVP delivers the platform's three core capabilities:

- **AI Resume Optimization** — Tailored rewrite and ATS-readiness analysis.
- **AI Interview Simulator** — Role- and industry-specific mock interviews with feedback.
- **Verified Profile Monetization** — Direct candidate–recruiter channel with verified, monetizable profiles.

This project, undertaken by **Team 8 at the University of Ottawa (ELG/DTI/GNG 5902)**, focuses on transitioning the platform from a functional MVP into a **scalable, production-ready, secure, and reliable** application capable of handling real-world traffic. Our scope is heavily concentrated on **backend reliability, database engineering, automated and manual QA pipelines, critical bug fixing, and infrastructure hardening**.

---

## Core Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **AI Resume Coach** | Upload a resume and receive an AI-powered rewrite, ATS-compliance score, keyword optimization, and section-by-section feedback. |
| 2 | **AI Interview Simulator** | Practice technical and behavioral interviews with an AI simulator that adapts to job role, seniority, and industry. Provides scored feedback on clarity, structure, and content. |
| 3 | **Verified Profile** | Multi-step identity and credential verification (education, employment, certifications) producing a tamper-evident verified profile. |
| 4 | **Recruiter Marketplace** | Direct, opt-in channel allowing verified candidates to be discovered by partner recruiting agencies. Candidates retain control and earn from successful placements. |
| 5 | **Career Analytics Dashboard** | Job-search progress, application outcomes, resume performance, and interview readiness metrics. |
| 6 | **Real-time Messaging** | Secure direct messaging between candidates and recruiters, modeled on a "direct-chat" workflow inspired by leading recruiting platforms. |

---

## User Workflow

Career CoPilot supports two main user roles — **candidate** and **agency user** — plus an internal **admin** role for moderation. The full workflow is defined in [`docs/WORKFLOW.md`](docs/WORKFLOW.md); the summary below shows the candidate journey.

```
 1. Sign up     →  2. Build profile  →  3. Upload resume  →  4. Resume review
                                                                      │
                                                                      ▼
 8. Track       ←  7. Chat with     ←  6. View recruiter  ←  5. Interview practice
    outcomes        agency              feed                  (text-based, scored)
```

### Candidate Journey (Summary)

1. **Sign up** — email + password registration with email verification.
2. **Build profile** — personal information, education, work history, skills.
3. **Upload resume** — PDF or DOCX; system extracts structured fields.
4. **Resume review** — AI returns a resume quality score inspired by common ATS screening criteria, plus section-by-section suggestions.
5. **Interview practice** — text-based mock interview with end-of-session score and feedback.
6. **View recruiter feed** — list of agencies and open roles matching the profile.
7. **Chat with agency** — five standard chat actions: send message, schedule a call, share verified profile (consent required), send full resume (consent required), end conversation.
8. **Track outcomes** — status board for chats started, interviews scheduled, offers, and placements.

### Agency Journey (Summary)

1. **Sign up** — agency account created and approved by an admin after document checks.
2. **Post a role** — title, description, requirements, location, salary range.
3. **Receive shortlist** — candidates whose profiles match the role.
4. **Chat with candidate** — same five-action toolbar; agency must request consent to view verified profile or full resume.
5. **Update status** — record outcome (interview → offer → placement).

### Key Rules

- **Consent before disclosure.** Verified profile and full resume are only shared after the owner of the information gives explicit consent in the chat.
- **Verified badge.** Added after an admin reviews the supporting documents (transcript, employment letter, certification). The badge means documents have been manually reviewed — it does not represent legal identity verification.
- **Response rate.** Each profile shows the percentage of messages replied to within 48 hours for transparency only; it does not affect ranking in the MVP.

---

## System Architecture

Career CoPilot is being re-architected from the MVP into a **modular, service-oriented system** designed for horizontal scaling and clear ownership boundaries.

```
                          ┌─────────────────────────┐
                          │     Client (Web/SPA)    │
                          └────────────┬────────────┘
                                       │ HTTPS
                          ┌────────────▼────────────┐
                          │   API Gateway / BFF     │
                          │   (Auth, Rate-limit)    │
                          └────┬────────┬───────────┘
                               │        │
              ┌────────────────┘        └─────────────────┐
              ▼                                           ▼
   ┌──────────────────┐                       ┌──────────────────┐
   │  Core Services   │                       │   AI Services    │
   │  • Auth/User     │                       │  • Resume Engine │
   │  • Profile       │                       │  • Interview Bot │
   │  • Recruiter     │                       │  • Scoring       │
   │  • Messaging     │                       └────────┬─────────┘
   │  • Verification  │                                │
   └────────┬─────────┘                                ▼
            │                                ┌──────────────────┐
            ▼                                │  LLM Provider    │
   ┌──────────────────┐                      │  (External API)  │
   │   PostgreSQL     │                      └──────────────────┘
   │   (primary)      │
   └──────────────────┘
            │
            ▼
   ┌──────────────────┐         ┌──────────────────┐
   │  Redis (cache)   │         │   Object Store   │
   │                  │         │   (Resumes/Docs) │
   └──────────────────┘         └──────────────────┘
```

Detailed architecture, data flow diagrams, and ERDs live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Technology Stack

The stack below is the **proposed production stack** for the MVP → Production transition. Final selections will be confirmed during the Design Phase.

| Layer | Proposed Technology | Rationale |
|-------|---------------------|-----------|
| Frontend | React 18 + TypeScript + Vite | Mature ecosystem, strong typing, fast iteration. |
| State / Data | TanStack Query, Zustand | Predictable async state and lightweight global state. |
| Styling | Tailwind CSS + shadcn/ui | Consistent, accessible component primitives. |
| Backend | Node.js + Express (or NestJS) — TypeScript | Single-language stack for full-stack agility. |
| API | RESTful + OpenAPI 3.1 | Tooling-friendly, contract-first. |
| Auth | JWT + Refresh Tokens, OAuth2 (Google) | Industry-standard. |
| Database | PostgreSQL 16 | Reliability, JSONB flexibility, strong transactional guarantees. |
| Cache / Queue | Redis | Sessions, rate-limiting, lightweight queues. |
| AI Layer | OpenAI / Anthropic API | Best-in-class LLMs for resume and interview reasoning. |
| Object Storage | AWS S3 (or compatible) | Durable storage for resumes and assets. |
| Testing | Jest, Supertest, Playwright | Unit, API, and end-to-end coverage. |
| CI/CD | GitHub Actions | Native integration, free for our scope. |
| Containerization | Docker + Docker Compose | Reproducible local and CI environments. |
| Observability | Sentry, structured logs | Error tracking and traceability. |
| Hosting | Vercel (frontend) / Render or AWS ECS (backend) | Cost-effective managed deployment. |

> **Note:** The team will finalize the stack collectively during **Sprint 0 / Design Phase**. Items marked "or" are open for discussion.

---

## Project Scope (MVP → Production)

The MVP is functional. Our scope is to make it **production-grade**. The five focus areas:

### 1. Database Engineering
- Audit schema for normalization and indexing gaps.
- Resolve identified data-integrity issues.
- Introduce migration tooling and seed data discipline.
- Implement backup, recovery, and retention policies.

### 2. Test Engineering
- Design and implement automated test pipelines (unit, integration, end-to-end).
- Define manual QA scripts for critical user journeys.
- Enforce CI-blocking coverage thresholds.
- Add load and stress testing for high-traffic paths.

### 3. Critical Bug Resolution
- Triage and prioritize the existing bug backlog.
- Resolve P0/P1 issues blocking production readiness.
- Establish a regression test suite for every fix.

### 4. Infrastructure Hardening
- Security review: authentication, authorization, input validation, rate limiting.
- Production-grade error handling and structured logging.
- Secrets management and configuration hygiene.
- Health checks, monitoring, and alerting.

### 5. Scalability & Performance
- Profile hot paths and optimize queries.
- Add caching where measurable.
- Introduce graceful degradation for AI service failures.
- Plan and document horizontal scaling strategy.

---

## Repository Structure

```
career-copilot/
├── README.md
├── LICENSE
├── .gitignore
├── CONTRIBUTING.md
├── docs/
│   ├── ARCHITECTURE.md          # System architecture & design
│   └── WORKFLOW.md              # User workflow
├── frontend/                    # planned
├── backend/                     # planned
├── database/                    # planned
├── infra/                       # planned
└── tests/                       # planned
```

---

## Getting Started

> **Note:** Source code for `frontend/`, `backend/`, `database/`, and `infra/` will be migrated from the MVP during Phase 1. This section will be updated as code lands.

### Prerequisites (planned)
- Node.js ≥ 20
- pnpm or npm
- Docker Desktop
- PostgreSQL 16 (or use bundled Docker Compose)

### Initial Setup (planned)
```bash
git clone https://github.com/kairwang01/UO_ELG_5902_career-copilot.git
cd UO_ELG_5902_career-copilot
docker compose up -d         # Start postgres + redis
pnpm install                 # Install workspace dependencies
pnpm dev                     # Run frontend + backend
```

---

## Development Workflow

We follow a **trunk-based development** model with short-lived feature branches.

1. Create a branch from `main`: `feature/<short-description>` or `fix/<short-description>`.
2. Commit early, push often. Reference the related issue in commit messages.
3. Open a Pull Request — required reviewers: at least one other team member.
4. CI must pass: lint, unit tests, build.
5. Squash-merge into `main` after approval.

**Branch Conventions**

| Prefix | Purpose |
|--------|---------|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `refactor/` | Internal code improvements without behavior change |
| `docs/` | Documentation-only changes |
| `test/` | Test additions or fixes |
| `chore/` | Tooling, dependencies, CI |

Full guidelines: [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Quality Assurance

Quality is the **central theme** of this project. Our QA approach is multi-layered:

| Layer | Tooling | Coverage Target |
|-------|---------|-----------------|
| Unit Tests | Jest | ≥ 80 % on core business logic |
| API Tests | Supertest + Jest | All public endpoints |
| End-to-End Tests | Playwright | All critical user journeys |
| Load Tests | k6 (planned) | Key API paths under realistic load |
| Security Tests | npm audit, OWASP ZAP (manual) | All public surfaces |
| Manual QA | Checklist-driven | Full regression before each release |

---

## Documentation

| Document | Purpose |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | System design and data flow |
| [Workflow](docs/WORKFLOW.md) | User workflow |
| [Contributing](CONTRIBUTING.md) | Contribution and code review process |

---

## Contact

For questions about this repository, please open an issue.
