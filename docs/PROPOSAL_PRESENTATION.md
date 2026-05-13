# Project Proposal Presentation — Slide-by-Slide Content

**Course:** GNG/ELG/DTI 5902 — Industry Internship Project, University of Ottawa
**Team:** Team 8 — Career CoPilot
**Submission date:** **2026-05-20** (Brightspace)
**In-class presentation:** 2026-05-21
**Document version:** 0.1 — Draft (pre-client-meeting)

> This is the working content draft for the 13-slide Project Proposal Presentation. Content marked **[TBD]** needs input from either the team or the client meeting on 2026-05-13. Once content is approved, this will be converted into a `.pptx` deck.

---

## Slide 1 — Proposal

**Type:** Section divider / opener

**On-slide text:**
- Proposal
- In-class activity

**Speaker note:** Brief intro. *(15 seconds — Kair Wang)*

---

## Slide 2 — Title Slide

**On-slide text:**

```
GNG / ELG / DTI 5902 — Industry Internship Project

Team ID:        Team 8 — Career CoPilot
Project ID:     Team 8, ELG 5902, Spring 2026
Sponsor:        CaIoT (Career CoPilot)

Project Proposal Presentation
Due 2026-05-20

Presented by (in speaking order):
  1. Kair Wang        — Student ID [TBD]
  2. Jingxuan Xu      — Student ID [TBD]
  3. Xiaoyi Zhang     — Student ID [TBD]
  4. Xiaoyan Yang     — Student ID [TBD]
  5. Jiaoyang Bi      — Student ID [TBD]
  6. Xiang Zhao       — Student ID [TBD]
```

**Design notes:**
- Apply a non-default theme (template instruction).
- Minimal animation.

**[TBD]:** Collect six uOttawa student numbers; confirm speaking order. Default speaking order proposed above (matches role flow: PM → backend → DB → QA → DevOps → AI).

---

## Slide 3 — Problem Definition and Project Overview

**Problem statement**

- **What is the problem?**
  Job seekers do not have an affordable way to improve their resumes, practise interviews, and reach recruiting agencies through a single trusted channel. The Career CoPilot MVP works as a product idea but is not ready for real users. It has database integrity gaps, no automated test pipeline, an open list of critical bugs, and infrastructure that has not been hardened against real traffic.
- **Who has the problem?**
  Two user groups: **candidates** (career switchers and recent graduates) and **recruiting agencies** that need pre-qualified, verified candidates.
- **What form will the solution take?**
  A web platform with four features: an AI resume review, an AI interview simulator, a manually verified candidate profile, and direct chat between candidates and partner agencies. The team's job is to re-engineer the platform so it runs reliably under real user traffic.

**Project Mentor:** [TBD — confirm with Prof. Gita whether she is the mentor or whether one will be assigned]

**Project Sponsor:** Abi K, Founder, **CaIoT** (Career CoPilot)

**Why this matters to the sponsor**

- CaIoT has a working MVP but needs the engineering work that turns an MVP into a launchable product.
- Team 8 takes on the database, testing, bug-fix, and infrastructure work that a small founding team usually cannot staff full-time.

**Potential benefits**

- For candidates: clearer resume feedback, structured interview practice, and a verified profile that can be shared with vetted agencies.
- For recruiting agencies: a pre-verified candidate pipeline.
- For CaIoT: a platform stable enough to put in front of real users.

**End users**

- Primary: candidates (career switchers and recent graduates).
- Secondary: recruiting agency users.

**General approach**

- Audit the MVP with the sponsor, prioritise the bug backlog together, then run six two-week sprints that work through the database, tests, AI features, and infrastructure in order.

**What the team hopes to learn**

- How to take a working prototype to a state where it can be put in front of real users.
- How to integrate and evaluate AI features (resume scoring, interview dialog, candidate-role matching).
- How to design and run an end-to-end testing pipeline on a real codebase.

---

## Slide 4 — Background

**Investigated and ongoing learning resources**

**Academic references** (≥ 2):

1. Bian, S. et al. (2020). *Learning to Match Jobs with Resumes from Sparse Interaction Data.* arXiv:2009.13299. — Informs the candidate ↔ role matching approach.
2. Yang, B. et al. (2024). *JobFormer: Skill-Aware Job Recommendation with Semantic-Enhanced Transformer.* arXiv:2404.04313. — Informs semantic matching and recommendation design.

**Industry / non-peer-reviewed references** (≥ 2):

3. **OWASP Top 10 (2021)** — guides the security review checklist in Phase 4 of the project.
4. **Atlassian — Agile Project Management with Jira** — informs the team's sprint structure and dependency tracking.

**Additional learning resources used during the project:**

- Playwright documentation (E2E testing framework).
- Sentry error-tracking best-practice guides.
- OpenAI / Anthropic API documentation (LLM integration).

---

## Slide 5 — Project Guidance

**Project Client / Sponsor**

- **Abi K**, Founder, CaIoT
- LinkedIn: [TBD — to capture from the May 13 meeting]
- Organization website: [TBD]
- Role / interaction:
  - Provides product vision, MVP code access, and prioritization input.
  - **Bi-weekly check-in calls** + async email for non-urgent questions.

**Project Mentor**

- **[TBD — confirm with Prof. Gita Sukthankar]**
- Role / interaction: course-level guidance, milestone reviews.

**Technical Advisor**

- **[TBD — to be confirmed with Prof. Gita]**
- Role / interaction: technical sounding-board on architecture, testing, and production-readiness decisions.

**Expected expertise**

- From the sponsor: business context, MVP internals, real user feedback, success criteria.
- From the mentor: project-management coaching, milestone evaluation.
- From the technical advisor: independent technical review and best-practice guidance.

**Project approval meeting**

- Kickoff meeting held 2026-05-13 (Wednesday, 9:00 PM EST) — 30-minute video call.
- Format: short team intro, project plan walk-through, expectations, discussion, project approval.

---

## Slide 6 — Roles and Responsibilities

**Team and ownership** (see [TEAM.md](TEAM.md) and [PROJECT_PLAN.md](PROJECT_PLAN.md))

| Member | Primary Role | Background (one line) |
|---|---|---|
| Kair Wang | Project Coordinator · Product Planning · Front-end Developer | [TBD — one-line background to be supplied by Kair] |
| Jingxuan Xu | Backend & API Lead | [TBD — one-line background to be supplied by Jingxuan] |
| Xiaoyi Zhang | Database Engineer | [TBD — one-line background to be supplied by Xiaoyi] |
| Xiaoyan Yang | QA Lead + UI Implementation Support | [TBD — one-line background to be supplied by Xiaoyan] |
| Jiaoyang Bi | DevOps Engineer + Documentation Lead | [TBD — one-line background to be supplied by Jiaoyang] |
| Xiang Zhao | AI / NLP Engineer | Built a candidate prescreening chatbot in a prior role: NLP dialogue, candidate scoring, recommendation logic |

**Knowledge gaps and how they will be filled**

| Gap | How we will close it |
|---|---|
| Deploying a system that handles real user traffic | Technical advisor and the sponsor's prior experience |
| Keeping LLM costs in budget and handling provider outages | Walk-through with the sponsor on current usage, plus independent reading |
| Recruiting and agency domain knowledge | Sponsor walk-through and short interviews with one or two agency contacts |
| Evaluating AI feature quality against real-user inputs | Sample data from the sponsor where shareable, plus an internal evaluation set built by the team |

**Team contract:** signed by all six members and submitted 2026-05-13 (see `Team_Contract_5902.pdf` in the repo).

---

## Slide 7 — Project Context

**External systems we will interact with**

- **LLM provider** (OpenAI or Anthropic) — for AI resume coaching and AI interview simulator.
- **Object storage** (AWS S3 or compatible) — for resumes and generated documents.
- **PostgreSQL** managed hosting — for primary application data.
- **Sentry** — error tracking and observability.

**Third-party tools we will use**

- **GitHub** — version control and pull-request code review.
- **Jira** — task tracking and sprint board.
- **Microsoft Teams** — meeting calls and document sharing.
- **Playwright** — end-to-end test framework.
- **Docker / Docker Compose** — local development and CI environments.

**Development environment**

- Node.js + TypeScript stack (frontend and backend).
- Local Docker Compose for Postgres + Redis.
- Visual Studio Code (recommended IDE).
- ESLint + Prettier enforced via CI.

**Potential deployment environment**

- Frontend: Vercel (static + CDN).
- Backend: Render or AWS ECS (containerised).
- Database: managed Postgres (Render / Supabase / RDS).
- Object storage: S3-compatible service.

**Individuals and organizations outside the team**

- Sponsor — Abi K (CaIoT) — bi-weekly check-ins.
- Mentor — [TBD] — milestone reviews.
- Technical advisor — [TBD] — as-needed consultation.
- Course instructor — Prof. Gita Sukthankar — course-level oversight.

**Key dependencies**

- **People's time** — sponsor availability for bi-weekly calls; advisor availability for consultations.
- **Resources** — access to the existing MVP codebase, design assets, and LLM API credits (covered by the sponsor or a free tier).
- **Information** — bug backlog, MVP architecture, user data (if shareable).

**How the end user will use the solution**

- Candidate signs up → builds profile → uploads resume → receives AI feedback → practises interviews → views matched agencies → starts a chat → tracks outcomes.
- Agency user signs up → posts a role → receives a shortlist → starts a chat → records outcomes.

**Benefits to end users**

- Section-by-section resume feedback the candidate can act on the same day.
- Interview practice that is scored against a fixed rubric, so the candidate can see what to work on.
- A verified profile, so agencies know the candidate's claims have been checked by a human reviewer.
- A direct chat with an agency, with consent required before the verified profile or full resume is shared.

---

## Slide 8 — Testing and Data Collection Plan

**How testing will be done**

- **Unit tests** (Jest) — pure logic and helpers; target ≥ 80 % coverage on core business logic.
- **API / integration tests** (Supertest) — every public endpoint.
- **End-to-end tests** (Playwright) — all critical user journeys.
- **Load tests** (k6) — top API paths under realistic load.
- **Manual QA** — checklist-driven regression before each milestone.
- **AI output evaluation** — accuracy, consistency, and hallucination checks on AI features (Xiang Zhao).

**Test setup**

- Every pull request triggers the CI pipeline (lint, build, unit, integration, E2E).
- Staging environment mirrors production for E2E and manual QA.
- Test data fixtures live in `tests/fixtures/`.

**Test environment**

- Local: Docker Compose stack (Postgres + Redis + app).
- CI: GitHub Actions runners with ephemeral Postgres and Redis containers.
- Staging: deployed staging environment for end-to-end and manual QA.

**Test cases (high-level)**

- Authentication: registration, login, refresh-token rotation, expired token handling.
- Resume upload: PDF / DOCX parsing, score calculation, suggestion display, error states.
- Interview simulator: session start, turn flow, scoring, end-of-session feedback.
- Verified profile: submission, admin approval, badge display.
- Chat: thread creation, message exchange, consent gating, status updates.

**Data used to develop and test**

- **Synthetic data**: test resumes and role descriptions generated for development.
- **Real (anonymized) data**: requested from the sponsor where appropriate (AI evaluation benchmarks).

**If data is not available**

- Generate synthetic resumes covering varied roles, industries, and experience levels.
- Use publicly available resume datasets if licensing permits.
- Iterate on the AI evaluation set with the sponsor as feedback comes in.

---

## Slide 9 — Design Specs

**Metrics** (units, type, addressed need)

| # | Metric | Unit | Type | Need addressed |
|---|---|---|---|---|
| M1 | Page Time-To-Interactive (P95) | seconds | non-functional | Candidate usability |
| M2 | API response latency — read endpoints (P95) | ms | non-functional | Candidate / agency UX |
| M3 | API response latency — AI endpoints (P95) | seconds | non-functional | AI features UX |
| M4 | Error rate over rolling 1-hour window | % | non-functional | Reliability |
| M5 | Unit-test coverage on core business logic | % | constraint | Quality / sponsor confidence |
| M6 | P0 / P1 bugs at MVP and Beta submission | count | constraint | Quality |
| M7 | Resume scoring agreement vs. human rater (eval set) | % | functional | AI quality (Resume Coach) |
| M8 | Interview-turn scoring consistency (re-runs of same input) | % agreement | functional | AI quality (Interview Sim) |
| M9 | Monthly infra cost | CAD | constraint | Student budget |

**Target specifications**

| # | Metric | Ideal | Marginally acceptable | Reasoning |
|---|---|---|---|---|
| M1 | TTI on 3G simulated | < 3 s | < 5 s | Page must be usable on a typical mobile connection |
| M2 | Read API P95 | < 150 ms | < 300 ms | Within the Web Vitals "Good" interaction band |
| M3 | AI API P95 | < 3 s | < 8 s | Floor is set by the LLM provider's typical latency |
| M4 | Error rate | < 0.1 % | < 1 % | Below this, the platform feels broken to users |
| M5 | Coverage | ≥ 90 % | ≥ 80 % | Standard expectation for a graded engineering project |
| M6 | P0 / P1 at submission | 0 | ≤ 2 P1, 0 P0 | The team's definition of "shippable" for Beta |
| M7 | Resume score agreement | ≥ 90 % | ≥ 75 % | Below this, candidate-facing feedback cannot be trusted |
| M8 | Interview scoring consistency | ≥ 90 % | ≥ 80 % | The same answer should not get very different scores |
| M9 | Monthly infra cost | $0 (free tiers) | < $30 | Limited by the team's student budget |

**Benchmarking — comparable products**

- **LinkedIn** — direct-recruiter messaging, profile completeness signals.
- **Indeed** — job board with applicant tracking; broad candidate funnel.
- **Resume.io** — guided resume builder with template-based feedback.
- **Big Interview** — structured AI interview practice.

Career CoPilot covers all four functions (resume coach, interview simulator, verified profile, direct chat) in a single workflow. The two features that the reference products do not have, and that Career CoPilot does, are explicit candidate consent before profile disclosure and an admin-reviewed verification step.

*(Images / screenshots of each benchmark to be added to the slide.)*

---

## Slide 10 — Solution Design and Implementation Methodology

**Development methodology**

- Lightweight Agile with **two-week sprints** anchored to course deliverables (see `docs/PROJECT_PLAN.md`).
- **Trunk-based development** on GitHub with short-lived feature branches and squash-merge.
- All tasks tracked in **Jira**; pull-request titles reference the Jira ticket ID.
- Sprint planning and retrospective at every sprint boundary.

**Architecture summary** (full detail in `docs/ARCHITECTURE.md`)

- React + TypeScript SPA on the frontend.
- Node.js + Express services behind a single API gateway.
- PostgreSQL primary store; Redis for cache and rate-limiting.
- AI service layer wraps the LLM provider with retries, rate limiting, and cost tracking.

**Methods, algorithms, tools, structures**

| Component | Method / Tool | Why |
|---|---|---|
| Resume scoring | LLM scoring driven by a fixed prompt set, combined with rule-based ATS checks | The LLM handles open-ended feedback; the rule-based checks cover the things rules are good at, such as keyword and formatting checks |
| Interview simulator | Turn-based dialog with a fixed scoring rubric | A turn-based flow is easier to test, and a fixed rubric makes scores comparable across sessions |
| Candidate ↔ role matching | Semantic-similarity ranking and tag filters | Light enough to ship in the MVP; we can replace the ranker later once we have real usage data |
| Auth | JWT access tokens with rotating refresh tokens | Widely documented, well-understood failure modes |
| Storage | PostgreSQL, Redis, S3-compatible object storage | The team already knows this stack; the operational cost is low |
| Test pipeline | Jest, Supertest, Playwright, k6 | Unit, API, end-to-end, and load layers each catch a different class of bug |
| Observability | Sentry and structured logs | Errors and request traces are visible without building our own tooling |
| Project management | Jira sprints and GitHub pull requests | Easy to audit (ticket-to-PR links) and familiar to anyone reviewing the project |

**New methods or structures**

- The project uses established methods. No new algorithm is invented. The team's contribution is the way these methods are put together, deployed, and evaluated inside this career-platform workflow.

---

## Slide 11 — Learning Outcomes

**Knowledge.** Learn production Node.js and TypeScript service architecture, and the techniques needed to use third-party LLM APIs without breaking when the provider is slow or down.

**Problem Analysis and Research.** Run an MVP gap analysis with the sponsor, triage the existing bug backlog, and measure AI feature quality against a held-out evaluation set.

**Design.** Design the system for security, for scaling under traffic, and for ease of use. Design the prompt set and scoring rubric for the AI features. Design the test pipeline and the observability setup.

**Verification and Validation Techniques.** Unit testing, integration testing, end-to-end testing in Playwright, load testing in k6, manual regression QA, and an evaluation script for AI output quality.

**Tools.** GitHub, Jira, Docker, Playwright, Sentry, OpenAI or Anthropic API, PostgreSQL, Redis, k6.

**Project Management and Professional Skills.** Sprint planning and retrospectives, written and spoken communication with the sponsor and the course staff, peer code review, and the written final report.

**Society and Sustainable Development.** Understand how AI tools can lower the barrier to career resources for candidates who do not have access to expensive coaching or to a strong professional network.

---

## Slide 12 — Project Plan

**High-level project plan** (see `docs/PROJECT_PLAN.md` for the full version)

| Phase | Window | Anchor Deliverable | Key Tasks |
|---|---|---|---|
| P0 — Initiation | 8 – 13 May | Team Contract | Team contract, repo, Jira, MVP access |
| P1 — Proposal & Design | 13 – 20 May | Proposal | Requirements, architecture v1, test strategy v1, this proposal |
| P2 — MVP Hardening | 20 May – 17 June | MVP | Database refactor, critical bug fixes, AI scoring & dialog logic, MVP demo |
| P3 — Beta Release | 17 June – 4 July | Beta | Automated test pipeline, performance, security review, observability |
| P4 — Video & Launch Polish | 4 – 17 July | Video + Design Day | Project video, production deployment, Design Day demo |
| P5 — Final Report & Evaluations | 17 – 27 July | Final Report + Evals | Final report, retrospective, client & advisor evaluations |

**Buffer policy** — internal deadlines run ahead of the official course deadlines by between 2 and 4 days, scaled to the size of each deliverable.

**Single-owner rule** — every task in Jira has one owner; support roles are named but not accountable.

**Dependencies** — Critical-path dependencies are documented in Section 5 of `docs/PROJECT_PLAN.md` and tracked in Jira.

---

## Slide 13 — Milestone Deliverables

| Milestone | Deliverables | Est. hours per student |
|---|---|---|
| **Project Proposal and Presentation** *(due 2026-05-20)* | Development environment, tools, and resources · Product specs · Dataset and test environment · Methodology, algorithms, and models · Detailed project plan | **20** |
| **Minimum Viable Prototype Presentation** *(due 2026-06-17)* | MVP demo · Resume Coach (Component A) · Interview Simulator (Component B) · Test results · Sponsor validation | **70** |
| **Beta Release Presentation** *(due 2026-07-04)* | Beta demo · Matched-recruiter feed and chat (Component A) · Security review and observability (Component B) · Automated test pipeline results · Sponsor validation | **80** |
| **Video, Prototype Showcase, and Final Presentation** *(video 2026-07-08 · Design Day 2026-07-17)* | Recorded presentation · Pitch video (problem, solution, prototype) · Full prototype · Sponsor and advisor testimonials · Group-member testimonials · Student evaluations · Design Day | **40** |
| **Final Report, Client Evaluation, and Team Peer Review** *(report 2026-07-26 · evaluations 2026-07-27)* | Final release · Production deployment of all components · Handoff documentation · Evaluation forms | **30** |

**Total hours per student: 240**

---

## Open Items Before Submission (Action List)

| # | Open Item | Owner | Notes |
|---|---|---|---|
| 1 | Collect six uOttawa student IDs | Kair Wang | Slide 2 |
| 2 | Each member writes a one-line background for Slide 6 | All members | Slide 6 |
| 3 | Confirm Project Mentor identity | Kair Wang | Slide 3, Slide 5 |
| 4 | Confirm Technical Advisor identity | Kair Wang | Slide 5 |
| 5 | Capture Abi K's LinkedIn URL and CaIoT website | Kair Wang | Slide 5 — get from May 13 meeting |
| 6 | Confirm with sponsor: LLM provider, infra cost expectations, existing test data | Kair Wang | Slide 7, Slide 8 — May 13 meeting |
| 7 | Add benchmark screenshots (LinkedIn, Indeed, Resume.io, Big Interview) | Xiaoyan Yang | Slide 9 |
| 8 | Confirm speaking order and assign slides to presenters | Kair Wang | Slide 2 |
| 9 | Choose visual theme (non-default) | Xiaoyan Yang | All slides |
| 10 | Apply consistent fonts and minimal animation | Xiaoyan Yang | All slides |
| 11 | Convert this markdown into a `.pptx` file | Kair Wang (Claude assist) | After content sign-off |

---

## Document History

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-05-12 | 0.1 | Initial draft pre-client-meeting. Content pulled from `PROPOSAL.md`, `ARCHITECTURE.md`, `WORKFLOW.md`, `PROJECT_PLAN.md`. | Kair Wang |
| 2026-05-12 | 0.2 | Polish pass: removed marketing language and AI-tell phrasing; replaced vague justifications with specific reasoning; left member backgrounds as `[TBD]` so each member can write their own. | Kair Wang |
