# Career CoPilot

> **An AI-powered career platform that helps job seekers perfect their resumes, master interviews through AI simulators, and monetize verified professional profiles by connecting directly with top recruiting agencies.**

[![Status](https://img.shields.io/badge/status-MVP%20%E2%86%92%20Production-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Course](https://img.shields.io/badge/uOttawa-ELG%2FDTI%2FGNG%205902-red)]()
[![Team](https://img.shields.io/badge/team-8-orange)]()

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Mission Statement](#mission-statement)
3. [Core Features](#core-features)
4. [User Workflow](#user-workflow)
5. [System Architecture](#system-architecture)
6. [Technology Stack](#technology-stack)
7. [Project Scope (MVP → Production)](#project-scope-mvp--production)
8. [Project Roadmap](#project-roadmap)
9. [Team and Responsibilities](#team-and-responsibilities)
10. [Repository Structure](#repository-structure)
11. [Getting Started](#getting-started)
12. [Development Workflow](#development-workflow)
13. [Quality Assurance](#quality-assurance)
14. [Documentation Index](#documentation-index)
15. [Contact](#contact)

---

## Project Overview

**Career CoPilot** is an innovative AI-powered platform designed to give job seekers a measurable advantage in a competitive recruitment market. Our existing functional MVP delivers the platform's three core capabilities:

- **AI Resume Optimization** — Tailored rewrite and ATS-readiness analysis.
- **AI Interview Simulator** — Role- and industry-specific mock interviews with feedback.
- **Verified Profile Monetization** — Direct candidate–recruiter channel with verified, monetizable profiles.

This project, undertaken by **Team 8 at the University of Ottawa (ELG/DTI/GNG 5902)**, focuses on transitioning the platform from a functional MVP into a **scalable, production-ready, secure, and reliable** application capable of handling real-world traffic. Our scope is heavily concentrated on **backend reliability, database engineering, automated and manual QA pipelines, critical bug fixing, and infrastructure hardening**.

---

## Mission Statement

> To empower every job seeker with enterprise-grade career tooling that is reliable, secure, and intelligent — and to give recruiters a verified, high-signal pipeline of talent.

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

Our workflow is inspired by the **direct-recruiter model** popularized by BOSS Zhipin (only the workflow concept — not the visual design), reimagined around AI-augmented candidate quality and verified trust.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CAREER COPILOT WORKFLOW                          │
└──────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────┐
  │ 1. Sign  │ →  │ 2. Upload    │ →  │ 3. AI Resume    │ →  │ 4. Verify │
  │   Up     │    │    Resume    │    │   Optimization  │    │  Identity │
  └──────────┘    └──────────────┘    └─────────────────┘    └────┬─────┘
                                                                    │
                                                                    ▼
  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────────────┐
  │ 7. Connect   │ ←  │ 6. Get Matched   │ ←  │ 5. AI Interview Practice │
  │   w/ Agency  │    │    w/ Recruiters │    │   (Scored & Adaptive)    │
  └──────┬───────┘    └──────────────────┘    └──────────────────────────┘
         │
         ▼
  ┌──────────────┐    ┌──────────────────┐
  │ 8. Direct    │ →  │ 9. Monetized     │
  │    Chat      │    │    Placement     │
  └──────────────┘    └──────────────────┘
```

**Workflow stages:**

1. **Sign Up** — Email/SSO registration, role selection (candidate vs. recruiter).
2. **Upload Resume** — Parsed into structured data.
3. **AI Resume Optimization** — Section-level rewrites, keyword tuning, ATS scoring.
4. **Identity Verification** — KYC-style credential checks producing a verified badge.
5. **AI Interview Practice** — Adaptive mock interviews with scored feedback.
6. **Recruiter Matching** — Verified profile surfaced to relevant partner agencies.
7. **Agency Connection** — Candidate opts in; recruiter requests a chat.
8. **Direct Chat** — Real-time secure messaging.
9. **Placement & Monetization** — Successful placements unlock candidate earnings.

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

## Project Roadmap

The project is structured into **five phases over approximately 14 weeks**, aligned with the academic schedule.

| Phase | Duration | Milestones | Key Deliverables |
|-------|----------|------------|------------------|
| **Phase 0 — Initiation** | Weeks 1–2 | Team contract, repository setup, MVP audit | Team contract, project proposal, GitHub repo |
| **Phase 1 — Discovery & Design** | Weeks 3–4 | Requirements, architecture, test strategy | Requirements doc, system design, test plan |
| **Phase 2 — Hardening Sprint** | Weeks 5–8 | Database refactor, critical bug fixes | Migration scripts, fixed bug backlog, audit report |
| **Phase 3 — QA & Automation** | Weeks 9–11 | Test pipelines, CI/CD, load testing | Automated test suite, CI workflows, performance report |
| **Phase 4 — Production Readiness** | Weeks 12–13 | Security review, observability, deployment | Hardened deployment, runbooks, monitoring |
| **Phase 5 — Final Review** | Week 14 | Demo, final report, handoff | Final demo, full documentation, presentation |

A more granular sprint-by-sprint plan lives in [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md).

---

## Team and Responsibilities

**Team 8 — ELG/DTI/GNG 5902, University of Ottawa**

| # | Member | Primary Role | Areas of Ownership |
|---|--------|--------------|---------------------|
| 1 | **Kair Wang** *(Project Coordinator)* | Project Coordination, Product Planning, Front-end | Roadmap, sprint planning, stakeholder communication, front-end architecture, UI components |
| 2 | **Jingxuan Xu** | Backend / API Integration | RESTful API design, business logic, third-party AI integration, backend services |
| 3 | **Xiaoyan Yang** | UI / Testing / Documentation | UI implementation, manual & automated test design, documentation maintenance |
| 4 | **Xiaoyi Zhang** | Database / Front-end / Testing | Database schema, migrations, query optimization, front-end support, test coverage |
| 5 | **Jiaoyang Bi** | Documentation / Full Stack / Dev Support | Cross-stack support, documentation, developer tooling, build/CI support |

**Project Coordinator:** Kair Wang is responsible for sprint orchestration, agenda-setting, timeline tracking, and external communication.

Detailed role responsibilities and decision-making policies live in [`docs/TEAM.md`](docs/TEAM.md).

---

## Repository Structure

```
career-copilot/
├── README.md                    # This file — project entry point
├── LICENSE                      # MIT License
├── .gitignore
├── CONTRIBUTING.md              # Contribution guidelines
├── docs/
│   ├── PROPOSAL.md              # Project proposal
│   ├── PROJECT_PLAN.md          # Sprint plan and timeline
│   ├── ARCHITECTURE.md          # System architecture & design
│   ├── TEAM.md                  # Roles, decisions, processes
│   ├── TEST_STRATEGY.md         # QA approach (to be added)
│   └── meeting-minutes/         # Weekly meeting notes
├── frontend/                    # React + TypeScript (planned)
├── backend/                     # Node.js + Express (planned)
├── database/                    # Schema, migrations, seeds (planned)
├── infra/                       # Docker, CI/CD configs (planned)
└── tests/                       # End-to-end and integration tests (planned)
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
git clone https://github.com/kairwang01/career-copilot.git
cd career-copilot
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

Detailed strategy will be published in `docs/TEST_STRATEGY.md` during Phase 1.

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| [Project Proposal](docs/PROPOSAL.md) | Problem statement, goals, success criteria |
| [Project Plan](docs/PROJECT_PLAN.md) | Sprint-by-sprint timeline and deliverables |
| [Architecture](docs/ARCHITECTURE.md) | System design, data model, infrastructure |
| [Team](docs/TEAM.md) | Roles, decision-making, communication |
| [Contributing](CONTRIBUTING.md) | Contribution and code review process |

---

## Contact

**Project Coordinator** — Kair Wang
University of Ottawa, ELG/DTI/GNG 5902, Team 8

For questions about this repository, please open an issue.

---

*Career CoPilot — Helping every job seeker become the best version of their professional self.*
