# Project Proposal — Career CoPilot

**Course:** ELG/DTI/GNG 5902 — Master's Project, University of Ottawa
**Team:** Team 8
**Project Coordinator:** Kair Wang
**Date:** May 2026
**Version:** 1.0 (Draft)

---

## 1. Executive Summary

Career CoPilot is an AI-powered career platform that helps job seekers improve their resumes, prepare for interviews via AI simulators, and connect directly with top recruiting agencies through verified, monetizable profiles. The platform has a **functional MVP**, and the goal of this project is to transition that MVP into a **scalable, secure, production-ready application** capable of serving real users at meaningful scale.

Team 8 will focus on **backend reliability, database engineering, test automation, critical bug resolution, and infrastructure hardening** — the engineering disciplines that separate a working prototype from a production product.

---

## 2. Problem Statement

### 2.1 The Market Problem

Today's job-seeking experience is fragmented, opaque, and inefficient for both candidates and recruiters:

- **For candidates:** Resumes are tuned blindly to opaque ATS systems. Interview preparation is generic and often disconnected from the target role. Profiles on existing platforms are unverified — candidates have no way to *prove* their qualifications and recruiters have no efficient way to *trust* them.
- **For recruiters:** Sourcing is high-noise. Verification is expensive and slow. Direct, qualified candidate pipelines remain elusive.
- **For the market overall:** The signal-to-noise ratio in modern job platforms is degrading, while AI tools — applied well — could measurably improve outcomes for both sides.

### 2.2 The Engineering Problem

While the Career CoPilot MVP demonstrates the core product hypothesis, it suffers from typical MVP characteristics that block production launch:

- Database schema and queries have **scalability and integrity issues**.
- The platform lacks a **comprehensive automated test pipeline**.
- A **backlog of critical bugs** remains unresolved.
- **Infrastructure is not hardened** for real-world traffic, security, or reliability.
- **Observability and operational tooling** are minimal.

This project addresses the engineering problem directly so the product is ready for a professional launch.

---

## 3. Goals and Objectives

### 3.1 Primary Goal

Transition the Career CoPilot MVP into a **production-ready, scalable, and reliable platform** suitable for a professional launch.

### 3.2 Specific Objectives

| # | Objective | Success Indicator |
|---|-----------|-------------------|
| O1 | Resolve identified database issues and re-architect schema where needed | Migration scripts, integrity tests, query benchmarks |
| O2 | Build a layered automated test pipeline | ≥ 80 % unit-test coverage on core logic; full E2E coverage of golden paths |
| O3 | Resolve all P0/P1 bugs in the existing backlog | Triaged bug board with all P0/P1 closed |
| O4 | Harden infrastructure: security, logging, monitoring | Security checklist completed; observability dashboard live |
| O5 | Document the system for future maintainers | Architecture, runbooks, and developer onboarding docs published |

---

## 4. Target Users

### 4.1 Primary Persona — "The Career Switcher"
A mid-career professional (5–15 years experience) seeking to move into a higher-paying role or change industries. They are time-poor, willing to invest in tooling, and looking for both **resume polish** and **interview confidence**.

### 4.2 Secondary Persona — "The Recent Graduate"
A new graduate (0–2 years experience) navigating their first competitive job market. They need guided resume feedback, mock interviews, and access to vetted opportunities.

### 4.3 B2B Persona — "The Boutique Recruiting Agency"
A specialized recruiting agency seeking pre-verified, high-signal candidates without the cost of traditional sourcing.

---

## 5. Value Proposition

| Stakeholder | Value Delivered |
|-------------|-----------------|
| Job Seekers | AI-optimized resumes, structured interview practice, verified profile that opens doors |
| Recruiters | Pre-verified candidate pool, direct messaging, reduced sourcing cost |
| Platform | Two-sided marketplace with measurable user outcomes and revenue from successful placements |

---

## 6. Scope

### 6.1 In Scope

- Audit and refactor the existing database schema and queries.
- Design and implement automated test pipelines (unit, integration, E2E).
- Fix the prioritized backlog of critical bugs.
- Harden the platform for production: security, observability, error handling.
- Document architecture, processes, and operational runbooks.
- Implement the end-to-end user workflow defined in [`WORKFLOW.md`](WORKFLOW.md) (candidate journey, agency journey, shared rules).

### 6.2 Out of Scope (for this engagement)

- Greenfield UX/UI redesign — visual identity remains owned by the product team. Team 8 may *implement* visual changes but will not *design* a new brand system.
- Adding net-new product features outside what is required to make the MVP production-ready.
- Marketing, growth, or commercial launch activities.
- Mobile-native (iOS/Android) applications — the web platform is the focus.

### 6.3 Assumptions

- The team has access to the existing MVP codebase, design assets, and bug backlog.
- AI capabilities are powered by third-party LLM APIs (OpenAI / Anthropic) — we are responsible for integration and resilience, not model training.
- Stakeholders (course instructors, project sponsor) are available for weekly check-ins.

### 6.4 Constraints

- Academic schedule: 8 May – 27 July 2026 (approximately 11–12 weeks).
- Five-person team with mixed time availability.
- Free or low-cost infrastructure tier (student/academic).

---

## 7. Approach and Methodology

We will adopt a **lightweight agile process** with **two-week sprints**, weekly team meetings, and **trunk-based development** on GitHub.

### 7.1 Phased Approach

Phases are aligned directly with the official course deliverables.

| Phase | Window | Anchor Deliverable |
|-------|--------|--------------------|
| 0 — Initiation | 8 May – 13 May 2026 | Team Contract |
| 1 — Proposal & Design | 13 May – 20 May 2026 | Proposal |
| 2 — MVP Hardening | 20 May – 17 June 2026 | MVP |
| 3 — Beta Release | 17 June – 4 July 2026 | Beta Release |
| 4 — Video & Launch Polish | 4 July – 17 July 2026 | Video + Design Day |
| 5 — Final Report & Evaluations | 17 July – 27 July 2026 | Final Report + Evals |

Detailed timeline in [`PROJECT_PLAN.md`](PROJECT_PLAN.md).

### 7.2 User Workflow Summary

The platform supports two main roles — **candidate** and **agency user** — plus an internal **admin** for moderation and verification approval. The full end-to-end workflow is defined in [`WORKFLOW.md`](WORKFLOW.md).

The candidate journey covers sign-up, profile building, resume upload, AI resume review, optional verification, AI interview practice, viewing the recruiter feed, starting a chat with an agency, and tracking outcomes. The agency journey covers sign-up, role posting, receiving a candidate shortlist, chatting with candidates, and updating placement status.

Two rules govern data sharing across the workflow:

1. **Consent before disclosure** — verified profile and full resume are only shared after the owner of the information gives explicit consent in the chat.
2. **Verified badge scope** — the badge confirms that documents have been manually reviewed by an admin; it does not represent legal identity verification.

---

## 8. Success Metrics

### 8.1 Engineering Metrics
- **Test coverage** ≥ 80 % on core business logic.
- **All P0/P1 bugs** in the existing backlog resolved.
- **Build/test pipeline** runs green on every PR.
- **Mean response time** for top 5 endpoints improved or held steady under load.
- **Zero critical security findings** in final audit checklist.

### 8.2 Process Metrics
- **Sprint completion rate** ≥ 80 %.
- **PR cycle time** ≤ 2 business days (open → merge).
- **Weekly team meeting attendance** ≥ 90 %.

### 8.3 Deliverable Metrics
- All planned documents published and version-controlled.
- Production-ready deployment demonstrated in final demo.

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| MVP code quality worse than expected | Medium | High | Allocate Phase 1 for thorough audit; descope features if needed. |
| AI API costs exceed budget | Medium | Medium | Cache aggressively; use cheaper models for development; monitor usage. |
| Team member unavailability (illness, exams) | High | Medium | Cross-train roles; documentation-first culture; pair on critical work. |
| Scope creep | Medium | High | Strict scope gates at each phase; Project Coordinator owns scope decisions. |
| Third-party service outage (LLM provider) | Low | Medium | Graceful degradation; design retries and fallbacks. |
| Integration of MVP code blocks early sprints | Medium | High | Audit MVP repository in Phase 0; build vertical slice end-to-end early. |

---

## 10. Deliverables

| # | Deliverable | Owner | Phase |
|---|-------------|-------|-------|
| D1 | Team contract (signed) | All | 0 |
| D2 | Project proposal *(this document)* | Kair Wang | 0 |
| D3 | Repository skeleton & docs | Kair Wang | 0 |
| D4 | MVP audit report | Jingxuan Xu, Xiaoyi Zhang | 1 |
| D5 | System architecture document | Jingxuan Xu, Kair Wang | 1 |
| D6 | Test strategy | Xiaoyan Yang | 1 |
| D7 | Database migration & integrity report | Xiaoyi Zhang | 2 |
| D8 | Closed bug backlog | All | 2 |
| D9 | Automated test pipeline (CI green) | Xiaoyan Yang, Jiaoyang Bi | 3 |
| D10 | Performance & load test report | Jingxuan Xu | 3 |
| D11 | Security & observability hardening report | Jiaoyang Bi | 4 |
| D12 | Production deployment runbook | Kair Wang, Jiaoyang Bi | 4 |
| D13 | Final demo & presentation | All | 5 |
| D14 | Final project report | All | 5 |

---

## 11. Team

| # | Member | Role | uOttawa Email | Primary Responsibilities |
|---|--------|------|---------------|--------------------------|
| 1 | Kair Wang | Project Coordination, Product Planning, Front-end | bwang105@uottawa.ca | Roadmap, sprint planning, stakeholder communication, front-end |
| 2 | Jingxuan Xu | Backend / API Integration | jxu022@uottawa.ca | RESTful API, business logic, third-party integrations |
| 3 | Xiaoyan Yang | UI / Testing / Documentation | xyang015@uottawa.ca | UI, manual & automated testing, docs |
| 4 | Xiaoyi Zhang | Database / Front-end / Testing | xzhan071@uottawa.ca | Schema, migrations, query optimization, testing |
| 5 | Jiaoyang Bi | Documentation / Full Stack / Dev Support | jbi056@uottawa.ca | Cross-stack support, docs, build/CI |

See [`TEAM.md`](TEAM.md) for full responsibilities and decision-making policy.

---

## 12. Schedule (Official Deliverables)

| # | Deliverable | Weight | Due Date |
|---|-------------|--------|----------|
| 1 | Team Contract | 5 % | 2026-05-13 |
| 2 | Project Proposal *(this document)* | 5 % | 2026-05-20 |
| 3 | Minimum Viable Prototype | 10 % | 2026-06-17 |
| 4 | Beta Release | 10 % | 2026-07-04 |
| 5 | Project Video | 5 % | 2026-07-08 |
| 6 | Design Day | 10 % | 2026-07-17 |
| 7 | Final Release Report | 15 % | 2026-07-26 |
| 8 | Client Evaluation | 10 % | 2026-07-27 |
| 9 | Technical Advisor Evaluation | 10 % | 2026-07-27 |

---

## 13. Approval

This proposal is submitted for approval by the course instructor and project sponsor.

| Name | Role | Date | Signature |
|------|------|------|-----------|
| Kair Wang | Project Coordinator | May 8, 2026 | ✍︎ |
| Jingxuan Xu | Backend / API | May 8, 2026 | ✍︎ |
| Xiaoyan Yang | UI / Testing / Docs | May 8, 2026 | ✍︎ |
| Xiaoyi Zhang | Database / Front-end / Testing | May 8, 2026 | ✍︎ |
| Jiaoyang Bi | Documentation / Full Stack | May 8, 2026 | ✍︎ |

---

*Document version: 1.0 — Initial draft. Will be reviewed and finalized in Week 2.*
