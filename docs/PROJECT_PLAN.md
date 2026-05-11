# Project Plan — Career CoPilot

**Course:** ELG/DTI/GNG 5902 — University of Ottawa
**Team:** Team 8
**Project Coordinator:** Kair Wang
**Document Version:** 1.0 (Draft, May 2026)

---

## 1. Plan Overview

This document is the **execution plan** for transitioning Career CoPilot from a functional MVP into a production-ready platform. It defines the schedule, sprint structure, deliverables, ownership, and review cadence over the 14-week academic term.

The plan follows a **lightweight agile methodology** with **two-week sprints**, weekly team meetings, and trunk-based development on GitHub.

---

## 2. Timeline at a Glance

```
Week  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9 │ 10 │ 11 │ 12 │ 13 │ 14
──────┼───┼───┼───┼───┼───┼───┼───┼───┼───┼────┼────┼────┼────┼────
Phase │ 0     │ 1     │ 2             │ 3              │ 4       │ 5
Sprint│ S0    │ S1    │ S2    │ S3    │ S4     │ S5    │ S6      │ Final
```

| Phase | Weeks | Sprint(s) | Theme |
|-------|-------|-----------|-------|
| 0 — Initiation | 1–2 | Sprint 0 | Team setup, MVP audit |
| 1 — Discovery & Design | 3–4 | Sprint 1 | Requirements, architecture, test strategy |
| 2 — Hardening | 5–8 | Sprints 2–3 | Database refactor, critical bugs |
| 3 — QA & Automation | 9–11 | Sprints 4–5 | Test pipelines, CI/CD, load testing |
| 4 — Production Readiness | 12–13 | Sprint 6 | Security, observability, deployment |
| 5 — Final Review | 14 | — | Demo, final report |

---

## 3. Phase 0 — Initiation (Weeks 1–2)

**Goal:** Establish the team, project infrastructure, and a shared understanding of the MVP.

### Sprint 0 (Weeks 1–2)

| Task | Owner | Deliverable | Due |
|------|-------|-------------|-----|
| Team contract finalized and signed | All | `Team_Contract.pdf` | Week 1 |
| GitHub repository initialized with README & docs | Kair Wang | `README.md`, `docs/*` | Week 1 |
| Project proposal drafted | Kair Wang | `docs/PROPOSAL.md` | Week 2 |
| MVP codebase audit | Jingxuan Xu, Xiaoyi Zhang | `docs/MVP_AUDIT.md` | Week 2 |
| Bug backlog triage | All | Triaged GitHub issues | Week 2 |
| Development environment standardized | Jiaoyang Bi | `docs/DEV_SETUP.md` | Week 2 |
| Communication & meeting cadence confirmed | Kair Wang | Posted in Discord | Week 1 |

**Exit criteria:** All Phase 0 deliverables published; team agrees on the MVP audit findings; backlog is prioritized.

---

## 4. Phase 1 — Discovery & Design (Weeks 3–4)

**Goal:** Define what we will build, how we will build it, and how we will know it works.

### Sprint 1 (Weeks 3–4)

| Task | Owner | Deliverable | Due |
|------|-------|-------------|-----|
| Functional & non-functional requirements | Kair Wang, Xiaoyan Yang | `docs/REQUIREMENTS.md` | Week 3 |
| System architecture & data model | Jingxuan Xu, Kair Wang | `docs/ARCHITECTURE.md` | Week 4 |
| Database refactor design | Xiaoyi Zhang | `docs/DB_DESIGN.md` | Week 4 |
| Test strategy & coverage plan | Xiaoyan Yang | `docs/TEST_STRATEGY.md` | Week 4 |
| CI/CD strategy | Jiaoyang Bi | `docs/CICD.md` | Week 4 |
| Risk register | Kair Wang | `docs/RISKS.md` | Week 4 |
| Stack finalization | All (consensus) | Decision recorded in `ARCHITECTURE.md` | Week 4 |

**Exit criteria:** Designs approved by team; ready to begin implementation in Phase 2.

---

## 5. Phase 2 — Hardening Sprint (Weeks 5–8)

**Goal:** Re-engineer the database, resolve critical bugs, harden core flows.

### Sprint 2 (Weeks 5–6) — Database & Foundational Fixes

| Task | Owner | Deliverable |
|------|-------|-------------|
| Database migration scripts | Xiaoyi Zhang | `database/migrations/*` |
| Data-integrity test suite | Xiaoyi Zhang, Xiaoyan Yang | `tests/integrity/*` |
| Backend refactor — auth & user services | Jingxuan Xu | PR(s) merged to `main` |
| Critical bug fixes (Wave 1) | All | Issues closed |
| Front-end alignment with new APIs | Kair Wang | PR(s) merged |

### Sprint 3 (Weeks 7–8) — Feature Hardening

| Task | Owner | Deliverable |
|------|-------|-------------|
| Resume engine reliability improvements | Jingxuan Xu | Resilience tests, retries, fallback |
| Interview simulator stability | Jingxuan Xu, Jiaoyang Bi | Bug fixes, error handling |
| Verified profile service hardening | Xiaoyi Zhang | Migration + tests |
| Front-end error handling pass | Kair Wang, Xiaoyan Yang | UI states for all error cases |
| Critical bug fixes (Wave 2) | All | Issues closed |

**Exit criteria:** All P0/P1 bugs from initial triage resolved; database refactor live; integration tests passing.

---

## 6. Phase 3 — QA & Automation (Weeks 9–11)

**Goal:** Stand up a comprehensive, automated quality pipeline.

### Sprint 4 (Weeks 9–10) — Test Automation Build-out

| Task | Owner | Deliverable |
|------|-------|-------------|
| Unit test coverage to ≥ 80 % on core logic | Jingxuan Xu, Xiaoyi Zhang | Coverage report |
| API/integration tests for all public endpoints | Xiaoyan Yang | `tests/api/*` |
| E2E test suite — golden paths | Xiaoyan Yang, Jiaoyang Bi | `tests/e2e/*` (Playwright) |
| CI pipeline (lint, build, test) on every PR | Jiaoyang Bi | `.github/workflows/*` |
| Test data and fixtures strategy | Xiaoyi Zhang | `tests/fixtures/*` |

### Sprint 5 (Week 11) — Performance & Load Testing

| Task | Owner | Deliverable |
|------|-------|-------------|
| Load test scenarios | Jingxuan Xu | `tests/load/*` |
| Baseline performance benchmarks | Jingxuan Xu | `docs/PERFORMANCE.md` |
| Query optimization round | Xiaoyi Zhang | Benchmark improvement table |
| Manual QA scripts for non-automatable journeys | Xiaoyan Yang | `docs/MANUAL_QA.md` |

**Exit criteria:** CI is green; coverage targets hit; performance report published.

---

## 7. Phase 4 — Production Readiness (Weeks 12–13)

**Goal:** Make the platform safe, observable, and deployable.

### Sprint 6 (Weeks 12–13)

| Task | Owner | Deliverable |
|------|-------|-------------|
| Security review (OWASP top 10 checklist) | Jiaoyang Bi, Jingxuan Xu | `docs/SECURITY_REVIEW.md` |
| Secrets & configuration hygiene | Jiaoyang Bi | Audit + remediation PRs |
| Structured logging & error reporting (Sentry) | Jingxuan Xu | Live in staging |
| Health checks & monitoring dashboard | Jiaoyang Bi | Dashboard URL |
| Production deployment + runbook | Kair Wang, Jiaoyang Bi | `docs/RUNBOOK.md` |
| Rollback & incident response procedures | Kair Wang | `docs/INCIDENT_RESPONSE.md` |

**Exit criteria:** Platform deployed to a production-equivalent environment; runbooks published; monitoring live.

---

## 8. Phase 5 — Final Review (Week 14)

**Goal:** Deliver, present, and document the project.

| Task | Owner | Deliverable |
|------|-------|-------------|
| Final report | All | `docs/FINAL_REPORT.md` (or PDF) |
| Final demo | All | Recorded demo + live presentation |
| Documentation index review | Kair Wang | `README.md` updates |
| Project handoff package | Kair Wang | Zip / branch tag |
| Post-mortem & retrospective | All | `docs/RETROSPECTIVE.md` |

---

## 9. Meeting Cadence

| Meeting | Frequency | Day/Time | Owner | Purpose |
|---------|-----------|----------|-------|---------|
| Weekly Team Sync | Weekly | Sunday 8 PM EST (MS Teams) | Kair Wang | Status, blockers, next steps |
| Sprint Planning | Every 2 weeks | At sprint boundary | Kair Wang | Plan upcoming sprint |
| Sprint Retro | Every 2 weeks | At sprint boundary | Kair Wang | Learnings, process tweaks |
| Stakeholder Check-in | Bi-weekly | TBD | Kair Wang | Update instructor / sponsor |
| Ad-hoc Working Sessions | As needed | — | Task owner | Deep work, pairing |

**Agenda Policy:** Agendas distributed via Discord at least **12 hours** before each meeting.

---

## 10. Communication Channels

| Channel | Use For |
|---------|---------|
| **Discord** | Day-to-day chat, urgent questions, async standups |
| **WeChat (group)** | Real-time team chat |
| **Microsoft Teams** | Official document sharing, meeting calls |
| **GitHub Issues / PRs** | All technical work, decisions, code review |
| **Email** | External / formal communications only |

---

## 11. Workflow & Conventions

### 11.1 Branching
- `main` — always green; production-ready.
- `feature/<name>` — new features.
- `fix/<name>` — bug fixes.
- `docs/<name>` — documentation changes.
- Short-lived branches (≤ 5 days where possible).

### 11.2 Pull Request Rules
- Required reviewers: **≥ 1 teammate**.
- CI must pass (lint + tests + build).
- Squash-merge into `main`.
- PR description must include: what changed, why, how it was tested.

### 11.3 Commit Messages
Follow the **Conventional Commits** style:
```
feat(resume): add ATS scoring endpoint
fix(auth): handle expired refresh tokens
docs(plan): add sprint 3 deliverables
test(api): add user endpoint coverage
```

### 11.4 Definition of Done
A task is "Done" when:
1. Code is merged into `main`.
2. Tests are written and passing in CI.
3. Documentation is updated.
4. Reviewer has approved.
5. No new lint or type errors introduced.

---

## 12. Roles and Ownership Matrix

| Area | Primary | Secondary |
|------|---------|-----------|
| Project Coordination | Kair Wang | — |
| Product Planning | Kair Wang | Xiaoyan Yang |
| Front-end | Kair Wang | Xiaoyi Zhang, Xiaoyan Yang |
| Backend / API | Jingxuan Xu | Jiaoyang Bi |
| Database | Xiaoyi Zhang | Jingxuan Xu |
| Testing & QA | Xiaoyan Yang | Xiaoyi Zhang, Jiaoyang Bi |
| Documentation | Jiaoyang Bi | Xiaoyan Yang, Kair Wang |
| DevOps / CI | Jiaoyang Bi | Jingxuan Xu |

---

## 13. Risk Tracking

The full risk register lives in [`docs/RISKS.md`](RISKS.md) (to be created in Sprint 1). High-level risks tracked at the plan level:

| ID | Risk | Owner | Status |
|----|------|-------|--------|
| R1 | MVP code quality unknown until Phase 1 audit | Jingxuan Xu | Active — mitigated by Phase 0 audit |
| R2 | Scope creep | Kair Wang | Active — scope gate at each sprint review |
| R3 | AI API costs | Jingxuan Xu | Active — caching + budget alerts |
| R4 | Team availability around midterms / finals | Kair Wang | Active — buffer in Sprint 5 |

---

## 14. Change Control

Any change to scope, schedule, or major design decisions must:
1. Be proposed in a GitHub Discussion or team meeting.
2. Be discussed by the team (consensus preferred, majority vote fallback).
3. Be recorded in the relevant document with date and author.

The Project Coordinator owns the final call on schedule trade-offs after team input.

---

## 15. Document Status

| Field | Value |
|-------|-------|
| Author | Kair Wang |
| Reviewers | All Team 8 members |
| Status | Draft v1.0 |
| Next Review | End of Sprint 0 (Week 2) |

---

*This plan is a living document. It will be updated at every sprint boundary.*
