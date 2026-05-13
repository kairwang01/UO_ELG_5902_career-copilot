# Project Plan — Career CoPilot

**Course:** ELG/DTI/GNG 5902 — University of Ottawa
**Team:** Team 8
**Project Coordinator:** Kair Wang
**Document Version:** 1.2 (2026-05-12) — restructured per professor's plan guidance

---

## 1. Plan Overview

This document is the **execution plan** for transitioning Career CoPilot from a functional MVP into a production-ready platform. It defines the schedule, sprint structure, task ownership, dependencies, and review cadence over the course's official timeline (May 2026 → late July 2026).

The plan follows a **lightweight agile methodology** with **short sprints anchored to course deliverables**, weekly team meetings, and trunk-based development on GitHub. Tasks live in Jira; code review lives in GitHub pull requests.

---

## 2. Plan Maintenance and Update Cadence

The professor has indicated that **every future deliverable will include a graded component on the freshness and accuracy of this project plan**. This section defines how we keep the plan current.

### 2.1 Update Schedule

| Trigger | Action | Owner |
|---|---|---|
| **At every sprint boundary** (every two weeks) | Review the plan, mark completed tasks, add new tasks discovered during the sprint, adjust dates if needed. | Kair Wang |
| **When a deliverable is submitted** | Confirm the plan matches what was actually delivered; log the update in the Changelog (Section 17). | Kair Wang |
| **When scope or schedule changes mid-sprint** | Update the affected task rows immediately and post a note in WeChat / Discord. | Kair Wang |
| **When a new dependency is identified** | Update the relevant task's **Depends on** column and reflect it in the Jira board. | Task owner |

### 2.2 Principles

- **Single-owner rule.** Every task has exactly **one owner**. The owner is responsible for completing the task well and on time. Others may be listed as **Support**.
- **Buffer rule.** Internal deadlines are set **earlier** than the official course deadline. The buffer is scaled to the size of the deliverable (see Section 3).
- **Dependency rule.** If Task B depends on Task A, Task B does not begin before Task A is complete. Dependencies are noted inline in the task tables and tracked in Jira.
- **Documentation rule.** When ideas, designs, or scope change, the change is captured in the affected document and reflected in this plan's Changelog (Section 17).

### 2.3 Tooling

- **Jira** — single source of truth for tasks, sprint board, and dependency links.
- **GitHub** — code, pull requests, and this plan document.
- **Project Coordinator (Kair Wang)** — accountable for the plan being current at every grade-bearing moment.

---

## 3. Official Deliverables and Internal Buffers

All work is anchored to the course deliverable dates. Internal team deadlines are set ahead of each official date; the **buffer scales with the size of the deliverable** so a delay in any single task does not cascade into a missed Brightspace submission.

| # | Deliverable | Weight | Official Date | Internal Target | Buffer |
|---|---|---|---|---|---|
| 1 | Team Contract | 5 % | **2026-05-13** | 2026-05-11 | 2 days |
| 2 | Project Proposal | 5 % | **2026-05-20** | 2026-05-17 | 3 days |
| 3 | Minimum Viable Prototype | 10 % | **2026-06-17** | 2026-06-13 | 4 days |
| 4 | Beta Release | 10 % | **2026-07-04** | 2026-06-30 | 4 days |
| 5 | Project Video | 5 % | **2026-07-08** | 2026-07-05 | 3 days |
| 6 | Design Day | 10 % | **2026-07-17** | rehearsal 2026-07-15 | 2 days (rehearsal) |
| 7 | Final Release Report | 15 % | **2026-07-26** | 2026-07-22 | 4 days |
| 8 | Client Evaluation | 10 % | **2026-07-27** | — | — |
| 9 | Technical Advisor Evaluation | 10 % | **2026-07-27** | — | — |

---

## 4. Timeline at a Glance

```
 May            │   June              │   July
 ──────────────────────────────────────────────────────────────────────
 [P0] [P1]  ─── Phase 2: MVP Hardening ──── [P3 Beta] [P4] [P4]  [P5]
 8    13  20                              17        4   8    17   26 27
 │    │   │                               │         │   │     │   │
 │    │   │                               │         │   │     │   └─ Evals (7/27)
 │    │   │                               │         │   │     └───── Design Day (7/17)
 │    │   │                               │         │   └─────────── Video (7/8)
 │    │   │                               │         └─────────────── Beta (7/4)
 │    │   │                               └───────────────────────── MVP (6/17)
 │    │   └───────────────────────────────────────────────────────── Proposal (5/20)
 │    └───────────────────────────────────────────────────────────── Team Contract (5/13)
 └──────────────────────────────────────────────────────────────── Project Start
```

| Phase | Window | Sprint(s) | Anchor Deliverable |
|-------|--------|-----------|--------------------|
| **P0** — Initiation | 8 May – 13 May | Sprint 0 | Team Contract |
| **P1** — Proposal & Design | 13 May – 20 May | Sprint 1 | Proposal |
| **P2** — MVP Hardening | 20 May – 17 June | Sprints 2–3 | MVP |
| **P3** — Beta Release | 17 June – 4 July | Sprints 4–5 | Beta Release |
| **P4** — Video & Launch Polish | 4 July – 17 July | Sprint 6 | Video + Design Day |
| **P5** — Final Report & Evaluations | 17 July – 27 July | Sprint 7 | Final Report + Evals |

---

## 5. Critical Path and Dependencies

The full dependency graph lives in Jira. The highest-level dependencies that drive the schedule:

```
Team Contract ── Proposal ── MVP Audit ── Architecture v1 ── DB Refactor Plan
                                ├──────── Test Strategy v1
                                │
                  (Proposal complete) ── MVP Hardening Sprints
                                           ├── DB Migrations ── Auth Refactor
                                           └── AI Logic ────── AI API Plumbing
                                                                    │
                                                              MVP Demo ── Beta Sprints
                                                                            ├── Test Pipeline
                                                                            └── Performance Pass
                                                                                  │
                                                                            Beta Release ── Video Production
                                                                                              │
                                                                                       Production Deployment ── Design Day
                                                                                                                  │
                                                                                                            Final Report ── Evaluations
```

If any task on this critical path slips, the Project Coordinator must call a re-planning session within 24 hours.

---

## 6. Phase 0 — Initiation (May 8 – May 13)

**Anchor:** Team Contract (5 %) — due **2026-05-13**.
**Goal:** Establish the team, project infrastructure, and a shared understanding of the MVP.

### Sprint 0 Tasks

| # | Task | Owner | Support | Depends on | Deliverable | Internal Due |
|---|------|-------|---------|------------|-------------|--------------|
| T0.1 | Team contract drafted | Kair Wang | All members | — | `docs/TEAM_CONTRACT.md` | 2026-05-10 |
| T0.2 | Team contract signed by all members | Kair Wang | All members | T0.1 | `Team_Contract_5902.pdf` | 2026-05-11 |
| T0.3 | GitHub repository initialized | Kair Wang | — | — | README, `docs/` scaffold | 2026-05-11 |
| T0.4 | Communication channels set up (WeChat, Teams) | Kair Wang | — | — | Channels live, links shared | 2026-05-11 |
| T0.5 | Jira workspace and project created | Kair Wang | Jiaoyang Bi | T0.3 | Jira URL + initial backlog | 2026-05-13 |
| T0.6 | MVP codebase access confirmed | Jingxuan Xu | Xiaoyi Zhang | Client meeting | Repo access granted to all | 2026-05-14 |
| T0.7 | Development environment standardized | Jiaoyang Bi | — | T0.6 | `docs/DEV_SETUP.md` | 2026-05-15 |
| T0.8 | Submit team contract on Brightspace | Kair Wang | — | T0.2 | Submission receipt | **2026-05-13** |

**Exit criteria:** Team contract submitted; repository and Jira live; all members have access to the codebase.

---

## 7. Phase 1 — Proposal & Design (May 13 – May 20)

**Anchor:** Project Proposal (5 %) — due **2026-05-20**.
**Goal:** Define what we will build, how we will build it, and how we will know it works.

### Sprint 1 Tasks

| # | Task | Owner | Support | Depends on | Deliverable | Internal Due |
|---|------|-------|---------|------------|-------------|--------------|
| T1.1 | Client kickoff meeting + meeting minutes | Kair Wang | Jiaoyang Bi (notes) | — | `docs/meeting-minutes/2026-05-13-client-kickoff.md` | 2026-05-14 |
| T1.2 | MVP audit report | Jingxuan Xu | Xiaoyi Zhang | T0.6 | `docs/MVP_AUDIT.md` | 2026-05-15 |
| T1.3 | Database refactor plan | Xiaoyi Zhang | — | T1.2 | `docs/DB_DESIGN.md` | 2026-05-16 |
| T1.4 | System architecture v1 | Jingxuan Xu | Kair Wang, Xiang Zhao | T1.2 | `docs/ARCHITECTURE.md` | 2026-05-16 |
| T1.5 | Test strategy v1 | Xiaoyan Yang | — | T1.4 | `docs/TEST_STRATEGY.md` | 2026-05-16 |
| T1.6 | Bug backlog triage | Jingxuan Xu | All members | T1.2 | Triaged Jira tickets | 2026-05-16 |
| T1.7 | Project proposal draft | Kair Wang | All members | T1.2, T1.4, T1.5 | `docs/PROPOSAL.md` | 2026-05-17 |
| T1.8 | Proposal review pass | Xiaoyan Yang | All members | T1.7 | Review comments resolved | 2026-05-18 |
| T1.9 | Submit proposal on Brightspace | Kair Wang | — | T1.8 | Submission receipt | **2026-05-20** |

**Exit criteria:** Proposal submitted; design docs published; bug backlog prioritized in Jira; team aligned on the engineering plan.

---

## 8. Phase 2 — MVP Hardening (May 20 – June 17)

**Anchor:** Minimum Viable Prototype (10 %) — due **2026-06-17**.
**Goal:** Re-engineer the database, resolve critical bugs, and stabilize the three core flows (resume, interview, verified profile) to MVP quality.

### Sprint 2 (May 20 – June 3) — Database & Critical Bugs (Wave 1)

| # | Task | Owner | Support | Depends on | Deliverable |
|---|------|-------|---------|------------|-------------|
| T2.1 | Database migration scripts | Xiaoyi Zhang | — | T1.3 | `database/migrations/*` |
| T2.2 | Data-integrity test suite | Xiaoyi Zhang | Xiaoyan Yang | T2.1 | `tests/integrity/*` |
| T2.3 | Auth & user services refactor | Jingxuan Xu | — | T1.4 | PR(s) merged |
| T2.4 | Critical bug fixes — Wave 1 (coordination) | Jingxuan Xu | All (each owns their bugs) | T1.6 | Jira tickets closed |
| T2.5 | Front-end alignment with new APIs | Kair Wang | — | T2.3 | PR(s) merged |
| T2.6 | Local dev environment standardized | Jiaoyang Bi | — | T0.7 | `docs/DEV_SETUP.md` finalised |

### Sprint 3 (June 3 – June 13) — Feature Hardening + MVP Demo

| # | Task | Owner | Support | Depends on | Deliverable |
|---|------|-------|---------|------------|-------------|
| T3.1 | Resume engine resilience (API & infra) | Jingxuan Xu | — | T2.3 | Retries, fallback, tests |
| T3.2 | Resume scoring logic and prompts | Xiang Zhao | — | T3.1 | Scoring function, prompt set, eval notes |
| T3.3 | Interview simulator API & error handling | Jingxuan Xu | Jiaoyang Bi | T2.3 | Bug fixes, error handling |
| T3.4 | Interview simulator dialog & scoring | Xiang Zhao | — | T3.3 | Dialog flow, scoring rubric, sample sessions |
| T3.5 | Candidate ↔ role matching (v1) | Xiang Zhao | — | T2.1 | Ranking function + tests |
| T3.6 | Verified profile service hardening | Xiaoyi Zhang | — | T2.1 | Migration + tests |
| T3.7 | Front-end error handling pass | Kair Wang | Xiaoyan Yang | T2.5 | UI states for error cases |
| T3.8 | MVP smoke-test pass | Xiaoyan Yang | All members | T3.1–T3.7 | Manual QA checklist passed |
| T3.9 | MVP demo preparation | Kair Wang | — | T3.8 | Demo script + slides |
| T3.10 | **Submit MVP** | Kair Wang | — | T3.9 | **2026-06-17** |

**Exit criteria:** All P0/P1 bugs resolved; database refactor live; MVP demonstration ready by **2026-06-13** (internal target).

---

## 9. Phase 3 — Beta Release (June 17 – July 4)

**Anchor:** Beta Release (10 %) — due **2026-07-04**.
**Goal:** Stand up a comprehensive automated test pipeline, measure and improve performance, and harden the product to Beta quality.

### Sprint 4 (June 17 – June 30) — QA & Test Automation

| # | Task | Owner | Support | Depends on | Deliverable |
|---|------|-------|---------|------------|-------------|
| T4.1 | Unit-test coverage push to ≥ 80 % (coordination) | Xiaoyan Yang | Jingxuan Xu, Xiaoyi Zhang, Xiang Zhao (write tests for their code) | T3.10 | Coverage report |
| T4.2 | API / integration test suite | Xiaoyan Yang | — | T3.10 | `tests/api/*` |
| T4.3 | E2E test suite — golden paths | Xiaoyan Yang | Jiaoyang Bi | T3.10 | `tests/e2e/*` (Playwright) |
| T4.4 | CI pipeline (lint/build/test) on every PR | Jiaoyang Bi | — | T0.3 | `.github/workflows/*` |
| T4.5 | Performance baseline + load tests | Jingxuan Xu | — | T3.10 | `docs/PERFORMANCE.md` |
| T4.6 | Query optimization round | Xiaoyi Zhang | — | T4.5 | Benchmark improvement table |
| T4.7 | AI feature evaluation report | Xiang Zhao | — | T3.10 | Accuracy, consistency, hallucination notes |

### Sprint 5 (June 30 – July 4) — Beta Polish

| # | Task | Owner | Support | Depends on | Deliverable |
|---|------|-------|---------|------------|-------------|
| T5.1 | Security review (OWASP top 10) | Jiaoyang Bi | Jingxuan Xu | T4.4 | `docs/SECURITY_REVIEW.md` |
| T5.2 | Observability (Sentry, structured logs, health checks) | Jiaoyang Bi | Jingxuan Xu | T4.4 | Live in staging |
| T5.3 | Manual QA scripts | Xiaoyan Yang | — | T4.3 | `docs/MANUAL_QA.md` |
| T5.4 | Beta release notes | Kair Wang | — | T5.1–T5.3 | `docs/RELEASE_NOTES_BETA.md` |
| T5.5 | **Submit Beta release** | Kair Wang | — | T5.4 | **2026-07-04** (internal target 2026-06-30) |

**Exit criteria:** CI green; coverage targets hit; Beta deployed to staging-equivalent; security pass complete.

---

## 10. Phase 4 — Video & Launch Polish (July 4 – July 17)

**Anchors:** Project Video (5 %) — **2026-07-08**; Design Day (10 %) — **2026-07-17**.
**Goal:** Produce the project video and prepare for the public Design Day showcase.

### Sprint 6 Tasks

| # | Task | Owner | Support | Depends on | Deliverable | Due |
|---|------|-------|---------|------------|-------------|-----|
| T6.1 | Video script + storyboard | Kair Wang | — | T5.5 | `docs/video/script.md` | 2026-07-05 |
| T6.2 | Video screen captures and voice-over | Kair Wang | All (rotating clips) | T6.1 | Raw recordings | 2026-07-06 |
| T6.3 | Video editing + final cut | Jiaoyang Bi | Xiaoyan Yang | T6.2 | `video/final.mp4` | 2026-07-07 |
| T6.4 | **Submit project video** | Kair Wang | — | T6.3 | — | **2026-07-08** |
| T6.5 | Production deployment | Jiaoyang Bi | Kair Wang | T5.5 | Live URL + `docs/RUNBOOK.md` | 2026-07-10 |
| T6.6 | Design Day demo plan | Kair Wang | — | T5.5 | `docs/DESIGN_DAY_PLAN.md` | 2026-07-12 |
| T6.7 | Design Day poster + handout | Xiaoyan Yang | Kair Wang | T6.6 | Printed materials | 2026-07-15 |
| T6.8 | Live demo rehearsal | Kair Wang | All members | T6.5, T6.6 | Dry-run pass | 2026-07-15 |
| T6.9 | **Design Day** | Kair Wang | All members | T6.8 | Live presentation | **2026-07-17** |

**Exit criteria:** Video submitted; production deployment live and stable; Design Day demo executed successfully.

---

## 11. Phase 5 — Final Report & Evaluations (July 17 – July 27)

**Anchors:** Final Release Report (15 %) — **2026-07-26**; Client and Technical Advisor Evaluations (10 % each) — **2026-07-27**.
**Goal:** Document, evaluate, and hand off.

### Sprint 7 Tasks

| # | Task | Owner | Support | Depends on | Deliverable | Due |
|---|------|-------|---------|------------|-------------|-----|
| T7.1 | Final report — draft | Kair Wang | All members (each contributes their section) | T6.9 | `docs/FINAL_REPORT.md` | 2026-07-22 |
| T7.2 | Final report — review pass | Xiaoyan Yang | All members | T7.1 | Reviewed in PR | 2026-07-23 |
| T7.3 | Final report — polish and PDF export | Kair Wang | — | T7.2 | Final PDF | 2026-07-24 |
| T7.4 | Retrospective | Kair Wang | All members | T6.9 | `docs/RETROSPECTIVE.md` | 2026-07-25 |
| T7.5 | Documentation index refresh | Jiaoyang Bi | Kair Wang | T7.3 | `README.md` updated | 2026-07-25 |
| T7.6 | **Submit Final Release Report** | Kair Wang | — | T7.3 | — | **2026-07-26** |
| T7.7 | Client evaluation submission | Kair Wang | All members (each completes their own form) | T6.9 | — | **2026-07-27** |
| T7.8 | Technical advisor evaluation submission | Kair Wang | All members (each completes their own form) | T6.9 | — | **2026-07-27** |

**Exit criteria:** Final report submitted; project handoff complete; evaluations submitted.

---

## 12. Meeting Cadence

| Meeting | Frequency | Day/Time | Owner | Purpose |
|---|---|---|---|---|
| Weekly Team Sync | Weekly | Sunday 8 PM EST (MS Teams) | Kair Wang | Status, blockers, next steps |
| Sprint Planning | At sprint boundary | Sunday meeting slot | Kair Wang | Plan upcoming sprint, refresh this plan |
| Sprint Retro | At sprint boundary | Sunday meeting slot | Kair Wang | Learnings, process tweaks |
| Stakeholder Check-in | Bi-weekly | TBD with instructor | Kair Wang | Update instructor / sponsor |
| Working Sessions | As needed | — | Task owner | Deep work, pairing |

**Agenda Policy:** Agendas distributed via WeChat / Discord at least **12 hours** before each meeting.

---

## 13. Communication Channels

| Channel | Use For |
|---|---|
| **Discord** | Day-to-day chat, urgent questions, async standups |
| **WeChat (group)** | Real-time team chat |
| **Microsoft Teams** | Official document sharing, meeting calls |
| **Jira** | Task tracking, sprint board, ticket backlog |
| **GitHub Pull Requests** | Code review and technical decisions of record (each PR links to a Jira ticket) |
| **Email (uOttawa)** | External / formal communications, course submissions |

---

## 14. Workflow & Conventions

### 14.1 Branching
- `main` — always green; production-ready.
- `feature/<name>` — new features.
- `fix/<name>` — bug fixes.
- `docs/<name>` — documentation changes.
- Short-lived branches (≤ 5 days where possible).

### 14.2 Pull Request Rules
- PR title leads with the Jira ticket ID (e.g., `CCP-42 feat(resume): add ATS scoring endpoint`).
- Required reviewers: **≥ 1 teammate**.
- CI must pass (lint + tests + build).
- Squash-merge into `main`.
- PR description must include: what changed, why, how it was tested.

### 14.3 Commit Messages
Conventional Commits style: `feat(scope): subject`, `fix(scope): subject`, etc.

### 14.4 Definition of Done
1. Code merged into `main`.
2. Tests written and passing in CI.
3. Documentation updated.
4. Reviewer has approved.
5. No new lint or type errors introduced.
6. Linked Jira ticket moved to **Done**.

---

## 15. Roles and Ownership Matrix

Each domain has exactly **one primary owner**. Support roles cover the domain when capacity allows or when the primary is unavailable.

| Area | Primary | Support |
|---|---|---|
| Project Coordination | Kair Wang | — |
| Product Planning | Kair Wang | Xiaoyan Yang |
| Front-end Architecture & Core Components | Kair Wang | Xiaoyan Yang |
| Front-end Implementation Support | Xiaoyan Yang | Xiaoyi Zhang |
| Backend & API Services | Jingxuan Xu | Jiaoyang Bi |
| LLM Provider Integration (auth, retries, cost tracking) | Jingxuan Xu | Xiang Zhao |
| Database (schema, migrations, performance) | Xiaoyi Zhang | Jingxuan Xu |
| AI / NLP Logic — Interview Simulator, Scoring, Matching | Xiang Zhao | Jingxuan Xu |
| Prompt Design & AI Output Evaluation | Xiang Zhao | Xiaoyan Yang |
| Testing & QA (unit, integration, E2E, manual) | Xiaoyan Yang | Xiaoyi Zhang |
| DevOps · CI/CD · Deployment | Jiaoyang Bi | Jingxuan Xu |
| Observability (Sentry, logging, monitoring) | Jiaoyang Bi | Jingxuan Xu |
| Documentation | Jiaoyang Bi | Xiaoyan Yang, Kair Wang |

---

## 16. Risk Tracking

| ID | Risk | Owner | Status |
|----|------|-------|--------|
| R1 | MVP code quality unknown until Phase 1 audit | Jingxuan Xu | Active — Phase 1 audit |
| R2 | Scope creep | Kair Wang | Active — scope gate at every sprint boundary |
| R3 | AI API costs | Jingxuan Xu | Active — caching + budget alerts |
| R4 | Team availability around midterms / finals | Kair Wang | Active — slack built into Phase 5 |
| R5 | Compressed schedule between Beta (Jul 4) and Design Day (Jul 17) | Kair Wang | Active — Sprint 6 buffer protected |
| R6 | Plan drift — plan not updated as project evolves | Kair Wang | Active — Plan Maintenance process (Section 2) |
| R7 | Task hand-off failure when an owner is unavailable | Kair Wang | Active — Support role defined for every domain |

---

## 17. Change Control and Changelog

### 17.1 Change Control Process

Any change to scope, schedule, or major design decisions must:
1. Be proposed in a Jira ticket, GitHub Discussion, or team meeting.
2. Be discussed by the team (consensus preferred, majority vote fallback).
3. Be recorded in the affected document with date and author.
4. Be reflected in this plan (task table or Section 17.2 changelog) within 24 hours.

The Project Coordinator owns the final call on schedule trade-offs after team input.

### 17.2 Changelog

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-05-11 | 1.0 | Initial plan covering all six phases. | Kair Wang |
| 2026-05-11 | 1.1 | Aligned phases and dates to the official course deliverables. | Kair Wang |
| 2026-05-11 | 1.1 | Added Sprint 3 AI tasks for Xiang Zhao; updated ownership matrix to split AI logic from API plumbing. | Kair Wang |
| 2026-05-11 | 1.1 | Reallocated team roles so each domain has exactly one primary owner. | Kair Wang |
| 2026-05-12 | 1.1 | Switched task tracking from GitHub Projects to Jira. | Kair Wang |
| 2026-05-12 | 1.2 | Restructured per professor's plan guidance: added Plan Maintenance section, scaled buffers per deliverable, refactored task tables to one owner + support + depends on schema, added Critical Path section, added this Changelog. | Kair Wang |

---

## 18. Document Status

| Field | Value |
|---|---|
| Author | Kair Wang |
| Reviewers | All Team 8 members |
| Status | v1.2 — Restructured per professor's plan guidance |
| Last Updated | 2026-05-12 |
| Next Scheduled Update | 2026-05-13 (end of Sprint 0) |

---

*This plan is a living document. It is updated at every sprint boundary and at every deliverable submission, and the updates are graded.*
