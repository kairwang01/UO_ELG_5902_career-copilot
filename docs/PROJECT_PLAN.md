# Project Plan — Career CoPilot

**Course:** ELG/DTI/GNG 5902 — University of Ottawa
**Team:** Team 8
**Project Coordinator:** Kair Wang
**Document Version:** 1.1 (Aligned to official deliverables, May 2026)

---

## 1. Plan Overview

This document is the **execution plan** for transitioning Career CoPilot from a functional MVP into a production-ready platform. It defines the schedule, sprint structure, deliverables, ownership, and review cadence over the course's official timeline (May 2026 → late July 2026).

The plan follows a **lightweight agile methodology** with **short sprints anchored to course deliverables**, weekly team meetings, and trunk-based development on GitHub.

---

## 2. Official Deliverables (Anchor Dates)

All work is anchored to these dates. Internal team deadlines run **48 hours ahead** of each.

| # | Deliverable | Weight | Official Date | Internal Target |
|---|-------------|--------|---------------|-----------------|
| 1 | Team Contract | 5 % | **2026-05-13** | 2026-05-11 |
| 2 | Project Proposal | 5 % | **2026-05-20** | 2026-05-18 |
| 3 | Minimum Viable Prototype | 10 % | **2026-06-17** | 2026-06-15 |
| 4 | Beta Release | 10 % | **2026-07-04** | 2026-07-02 |
| 5 | Project Video | 5 % | **2026-07-08** | 2026-07-06 |
| 6 | Design Day | 10 % | **2026-07-17** | — (live) |
| 7 | Final Release Report | 15 % | **2026-07-26** | 2026-07-24 |
| 8 | Client Evaluation | 10 % | **2026-07-27** | — |
| 9 | Technical Advisor Evaluation | 10 % | **2026-07-27** | — |

---

## 3. Timeline at a Glance

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

## 4. Phase 0 — Initiation (May 8 – May 13)

**Anchor:** Team Contract (5 %) — due **13 May 2026**.

**Goal:** Establish the team, project infrastructure, and a shared understanding of the MVP.

| Task | Owner | Deliverable | Internal Due |
|------|-------|-------------|--------------|
| Team contract drafted and signed | All | `Team_Contract_5902.pdf` | 2026-05-11 |
| GitHub repository initialized | Kair Wang | README, docs/ scaffold | 2026-05-11 |
| Communication channels (Discord/WeChat/Teams) set up | Kair Wang | Posted in Discord | 2026-05-11 |
| MVP codebase access confirmed | Jingxuan Xu, Xiaoyi Zhang | Repo access granted | 2026-05-12 |
| Submit team contract on Brightspace | Kair Wang | Submission confirmation | **2026-05-13** |

**Exit criteria:** Team contract submitted; repository live with documentation; all members have access.

---

## 5. Phase 1 — Proposal & Design (May 13 – May 20)

**Anchor:** Project Proposal (5 %) — due **20 May 2026**.

**Goal:** Define what we will build, how we will build it, and how we will know it works.

### Sprint 1 (May 13 – May 20)

| Task | Owner | Deliverable | Internal Due |
|------|-------|-------------|--------------|
| Project proposal | Kair Wang (lead), all contribute | `docs/PROPOSAL.md` | 2026-05-18 |
| MVP audit (high-level) | Jingxuan Xu, Xiaoyi Zhang | `docs/MVP_AUDIT.md` | 2026-05-17 |
| System architecture v1 | Jingxuan Xu, Kair Wang | `docs/ARCHITECTURE.md` | 2026-05-19 |
| Database refactor plan | Xiaoyi Zhang | `docs/DB_DESIGN.md` | 2026-05-19 |
| Test strategy v1 | Xiaoyan Yang | `docs/TEST_STRATEGY.md` | 2026-05-19 |
| Bug backlog triage | All | Triaged GitHub issues | 2026-05-19 |
| Submit proposal on Brightspace | Kair Wang | Submission confirmation | **2026-05-20** |

**Exit criteria:** Proposal submitted; design docs published; backlog prioritized; team aligned on the engineering plan.

---

## 6. Phase 2 — MVP Hardening (May 20 – June 17)

**Anchor:** Minimum Viable Prototype (10 %) — due **17 June 2026**.

**Goal:** Re-engineer the database, resolve critical bugs, and stabilize the three core flows (resume, interview, verified profile) to MVP quality.

### Sprint 2 (May 20 – June 3) — Database & Critical Bugs (Wave 1)

| Task | Owner | Deliverable |
|------|-------|-------------|
| Database migration scripts | Xiaoyi Zhang | `database/migrations/*` |
| Data-integrity test suite | Xiaoyi Zhang, Xiaoyan Yang | `tests/integrity/*` |
| Auth & user services refactor | Jingxuan Xu | PR(s) merged |
| Critical bug fixes — Wave 1 | All | Issues closed |
| Front-end alignment with new APIs | Kair Wang | PR(s) merged |
| Local dev environment standardized | Jiaoyang Bi | `docs/DEV_SETUP.md` |

### Sprint 3 (June 3 – June 17) — Feature Hardening + MVP Demo

| Task | Owner | Deliverable |
|------|-------|-------------|
| Resume engine resilience (API & infra) | Jingxuan Xu | Retries, fallback, tests |
| Resume scoring logic and prompts | Xiang Zhao | Scoring function, prompt set, eval notes |
| Interview simulator dialog & scoring | Xiang Zhao | Dialog flow, scoring rubric, sample sessions |
| Interview simulator API & error handling | Jingxuan Xu, Jiaoyang Bi | Bug fixes, error handling |
| Candidate ↔ role matching (v1) | Xiang Zhao | Ranking function + tests |
| Verified profile service hardening | Xiaoyi Zhang | Migration + tests |
| Front-end error handling pass | Kair Wang, Xiaoyan Yang | UI states for error cases |
| MVP smoke-test pass | All | Manual QA checklist passed |
| MVP demo preparation | Kair Wang | Demo script + slides |
| **Submit MVP** | Kair Wang | **2026-06-17** |

**Exit criteria:** All P0/P1 bugs resolved; database refactor live; MVP demonstration ready.

---

## 7. Phase 3 — Beta Release (June 17 – July 4)

**Anchor:** Beta Release (10 %) — due **4 July 2026**.

**Goal:** Stand up a comprehensive automated test pipeline, measure and improve performance, and harden the product to Beta quality.

### Sprint 4 (June 17 – June 30) — QA & Test Automation

| Task | Owner | Deliverable |
|------|-------|-------------|
| Unit-test coverage ≥ 80 % (core logic) | Jingxuan Xu, Xiaoyi Zhang | Coverage report |
| API/integration tests | Xiaoyan Yang | `tests/api/*` |
| E2E test suite — golden paths | Xiaoyan Yang, Jiaoyang Bi | `tests/e2e/*` (Playwright) |
| CI pipeline (lint/build/test) on every PR | Jiaoyang Bi | `.github/workflows/*` |
| Performance baseline + load tests | Jingxuan Xu | `docs/PERFORMANCE.md` |
| Query optimization round | Xiaoyi Zhang | Benchmark improvement |

### Sprint 5 (June 30 – July 4) — Beta Polish

| Task | Owner | Deliverable |
|------|-------|-------------|
| Security review (OWASP top 10) | Jiaoyang Bi, Jingxuan Xu | `docs/SECURITY_REVIEW.md` |
| Observability (Sentry, structured logs) | Jingxuan Xu | Live in staging |
| Manual QA scripts | Xiaoyan Yang | `docs/MANUAL_QA.md` |
| Beta release notes | Kair Wang | `docs/RELEASE_NOTES_BETA.md` |
| **Submit Beta release** | Kair Wang | **2026-07-04** |

**Exit criteria:** CI green; coverage targets hit; Beta deployed to staging-equivalent; security pass complete.

---

## 8. Phase 4 — Video & Launch Polish (July 4 – July 17)

**Anchors:** Project Video (5 %) — **8 July 2026**; Design Day (10 %) — **17 July 2026**.

**Goal:** Produce the project video and prepare for the public Design Day showcase.

### Sprint 6 (July 4 – July 17)

| Task | Owner | Deliverable | Due |
|------|-------|-------------|-----|
| Video script + storyboard | Kair Wang | `docs/video/script.md` | 2026-07-05 |
| Video screen captures & voice-over | All (rotating) | Raw recordings | 2026-07-06 |
| Video editing & final cut | Jiaoyang Bi, Xiaoyan Yang | `video/final.mp4` | 2026-07-07 |
| **Submit project video** | Kair Wang | — | **2026-07-08** |
| Production deployment | Kair Wang, Jiaoyang Bi | Live URL + `docs/RUNBOOK.md` | 2026-07-10 |
| Design Day demo plan | Kair Wang | `docs/DESIGN_DAY_PLAN.md` | 2026-07-12 |
| Design Day poster/handout | Xiaoyan Yang, Kair Wang | Printed materials | 2026-07-15 |
| Live demo rehearsal | All | Dry-run pass | 2026-07-16 |
| **Design Day** | All | Live presentation | **2026-07-17** |

**Exit criteria:** Video submitted; production deployment live; Design Day demo executed.

---

## 9. Phase 5 — Final Report & Evaluations (July 17 – July 27)

**Anchors:** Final Release Report (15 %) — **26 July 2026**; Client Evaluation (10 %) and Technical Advisor Evaluation (10 %) — **27 July 2026**.

**Goal:** Document, evaluate, and hand off.

### Sprint 7 (July 17 – July 26)

| Task | Owner | Deliverable | Due |
|------|-------|-------------|-----|
| Final report — draft | Kair Wang (lead), all contribute | `docs/FINAL_REPORT.md` | 2026-07-22 |
| Final report — review pass | All | Reviewed in PR | 2026-07-23 |
| Final report — polish & PDF export | Kair Wang | Final PDF | 2026-07-24 |
| Retrospective | All | `docs/RETROSPECTIVE.md` | 2026-07-25 |
| Documentation index refresh | Kair Wang | `README.md` updated | 2026-07-25 |
| **Submit Final Release Report** | Kair Wang | — | **2026-07-26** |
| Client evaluation participation | All | — | **2026-07-27** |
| Technical advisor evaluation participation | All | — | **2026-07-27** |

**Exit criteria:** Final report submitted; project handoff complete; evaluations submitted.

---

## 10. Meeting Cadence

| Meeting | Frequency | Day/Time | Owner | Purpose |
|---------|-----------|----------|-------|---------|
| Weekly Team Sync | Weekly | Sunday 8 PM EST (MS Teams) | Kair Wang | Status, blockers, next steps |
| Sprint Planning | At sprint boundary | Sunday meeting slot | Kair Wang | Plan upcoming sprint |
| Sprint Retro | At sprint boundary | Sunday meeting slot | Kair Wang | Learnings, process tweaks |
| Stakeholder Check-in | Bi-weekly | TBD | Kair Wang | Update instructor / sponsor |
| Working Sessions | As needed | — | Task owner | Deep work, pairing |

**Agenda Policy:** Agendas distributed via Discord at least **12 hours** before each meeting.

---

## 11. Communication Channels

| Channel | Use For |
|---------|---------|
| **Discord** | Day-to-day chat, urgent questions, async standups |
| **WeChat (group)** | Real-time team chat |
| **Microsoft Teams** | Official document sharing, meeting calls |
| **GitHub Issues / PRs** | All technical work, decisions, code review |
| **Email (uOttawa)** | External / formal communications, course submissions |

---

## 12. Workflow & Conventions

### 12.1 Branching
- `main` — always green; production-ready.
- `feature/<name>` — new features.
- `fix/<name>` — bug fixes.
- `docs/<name>` — documentation changes.
- Short-lived branches (≤ 5 days where possible).

### 12.2 Pull Request Rules
- Required reviewers: **≥ 1 teammate**.
- CI must pass (lint + tests + build).
- Squash-merge into `main`.
- PR description must include: what changed, why, how it was tested.

### 12.3 Commit Messages
Conventional Commits style: `feat(scope): subject`, `fix(scope): subject`, etc.

### 12.4 Definition of Done
1. Code merged into `main`.
2. Tests written and passing in CI.
3. Documentation updated.
4. Reviewer has approved.
5. No new lint or type errors introduced.

---

## 13. Roles and Ownership Matrix

Each domain has exactly **one primary owner**. Secondary owners cover the domain when capacity allows or when the primary is unavailable.

| Area | Primary | Secondary |
|------|---------|-----------|
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

## 14. Risk Tracking

| ID | Risk | Owner | Status |
|----|------|-------|--------|
| R1 | MVP code quality unknown until Phase 1 audit | Jingxuan Xu | Active — Phase 1 audit |
| R2 | Scope creep | Kair Wang | Active — scope gate at every sprint boundary |
| R3 | AI API costs | Jingxuan Xu | Active — caching + budget alerts |
| R4 | Team availability around midterms / finals | Kair Wang | Active — slack built into Phase 5 |
| R5 | Compressed schedule between Beta (Jul 4) and Design Day (Jul 17) | Kair Wang | Active — Sprint 6 buffer protected |

---

## 15. Change Control

Any change to scope, schedule, or major design decisions must:
1. Be proposed in a GitHub Discussion or team meeting.
2. Be discussed by the team (consensus preferred, majority vote fallback).
3. Be recorded in the relevant document with date and author.

The Project Coordinator owns the final call on schedule trade-offs after team input.

---

## 16. Document Status

| Field | Value |
|-------|-------|
| Author | Kair Wang |
| Reviewers | All Team 8 members |
| Status | v1.1 — Aligned to official deliverables |
| Next Review | End of Sprint 0 (2026-05-13) |

---

*This plan is a living document. It will be updated at every sprint boundary.*
