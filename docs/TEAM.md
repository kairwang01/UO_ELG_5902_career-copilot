# Team — Career CoPilot

**Course:** ELG/DTI/GNG 5902 — University of Ottawa
**Team:** Team 8

---

## 1. Members

| # | Name | Role | uOttawa Email |
|---|------|------|---------------|
| 1 | **Kair Wang** *(Project Coordinator)* | Project Coordination · Product Planning · Front-end Developer | bwang105@uottawa.ca |
| 2 | **Jingxuan Xu** | Backend & API Lead | jxu022@uottawa.ca |
| 3 | **Xiaoyi Zhang** | Database Engineer | xzhan071@uottawa.ca |
| 4 | **Xiaoyan Yang** | QA Lead + UI Implementation Support | xyang015@uottawa.ca |
| 5 | **Jiaoyang Bi** | DevOps Engineer + Documentation Lead | jbi056@uottawa.ca |
| 6 | **Xiang Zhao** | AI / NLP Engineer | xzhao022@uottawa.ca |

---

## 2. Role Responsibilities

### Kair Wang — Project Coordinator · Product Planning · Front-end Developer
- Owns the overall project roadmap, sprint plan, and milestones.
- Coordinates weekly meetings, agendas, and stakeholder communication.
- Owns the front-end architecture: tooling, component library, routing, integration with the API.
- Develops core front-end components and pages alongside Xiaoyan.
- Maintains the documentation index at the project level.
- Final escalation point for scope and schedule decisions.

### Jingxuan Xu — Backend & API Lead
- Designs and implements the RESTful API and core business services (auth, user, profile, messaging, verification, recruiter, notifications).
- Owns the API plumbing into the AI service layer and the integration with third-party LLM providers (auth, retries, rate limiting, cost tracking, response caching).
- Drives backend performance, resilience, and reliability.
- Authors the backend portions of the architecture document and the security review.
- Provides backup support to Xiang on AI service interfaces.

### Xiaoyi Zhang — Database Engineer
- Owns the PostgreSQL schema and migration discipline.
- Resolves identified database issues and produces the data-integrity test suite.
- Owns query performance and indexing decisions.
- Owns the backup and recovery procedure.
- Builds test fixtures and seed data for development and CI.
- Provides light front-end support when database work is light.

### Xiaoyan Yang — QA Lead + UI Implementation Support
- Owns the overall test strategy and the quality gate policy.
- Owns the automated test pipeline: unit tests, API/integration tests, and E2E tests (Playwright).
- Writes and maintains manual QA scripts and regression suites for the critical user journeys.
- Triages new bugs and produces release-readiness reports.
- Implements UI components alongside Kair, focusing on routine implementation and styling so Kair can focus on architecture.
- Reviews documentation produced by other members.

### Jiaoyang Bi — DevOps Engineer + Documentation Lead
- Owns CI/CD pipelines (GitHub Actions): lint, build, test, deploy.
- Owns Docker and the local developer environment (Docker Compose, env templates, setup docs).
- Owns deployment to staging and production environments.
- Owns observability: Sentry, structured logging, health checks, monitoring dashboard.
- Authors and maintains operational runbooks and the deployment guide.
- Drives the documentation system end to end (structure, freshness, index hygiene).
- Provides backup support to Jingxuan on backend tasks where capacity allows.

### Xiang Zhao — AI / NLP Engineer
- Owns the AI Interview Simulator: dialog flow, turn handling, end-of-session scoring, and feedback generation.
- Owns the AI Resume Coach scoring and feedback logic (resume quality score inspired by common ATS screening criteria).
- Owns the candidate ↔ role matching and ranking logic.
- Designs prompts and runs evaluations on AI outputs (accuracy, consistency, hallucination checks).
- Works with Jingxuan on AI service interfaces and with Xiaoyan on test methodology for AI features.

---

## 3. Decision-Making Policy

1. **Default — Consensus.** Most decisions are made by team consensus during meetings or in writing on GitHub.
2. **If consensus stalls — Majority Vote.** Six-member team; four votes carry the decision.
3. **Tie-breaker — Project Coordinator.** Kair Wang has tie-breaking authority *only* when a vote is deadlocked.
4. **Scope & schedule disputes — Project Coordinator owns the call** after team input, to keep the project on time.

All decisions of consequence are recorded:
- Architectural decisions → `docs/adr/`
- Scope/schedule changes → updated `PROJECT_PLAN.md` with a changelog note
- Process changes → updated `TEAM.md` or `CONTRIBUTING.md`

---

## 4. Communication

| Channel | Use |
|---------|-----|
| Discord (server) | Day-to-day chat, async standups, urgent pings |
| WeChat (group) | Quick real-time discussion |
| Microsoft Teams | Official meetings, document sharing |
| GitHub Issues / PRs | All technical work, decisions, code review |
| Email | External / formal communication only |

**Response-time expectations**
- Discord / WeChat: within **24 hours** on weekdays.
- GitHub PR review: within **2 business days** of request.
- Urgent (production-blocking) issue: **as soon as possible**, with an ack within 4 hours.

---

## 5. Meeting Cadence

| Meeting | Frequency | Time | Owner |
|---------|-----------|------|-------|
| Weekly Team Sync | Weekly | **Sundays 8 PM EST** via MS Teams | Kair Wang |
| Sprint Planning | Every 2 weeks | At sprint boundary | Kair Wang |
| Sprint Retro | Every 2 weeks | At sprint boundary | Kair Wang |
| Stakeholder Check-in | Bi-weekly | TBD with instructor | Kair Wang |

**Agenda Policy:** Agenda distributed via Discord **≥ 12 hours** before each meeting. Minutes published in `docs/meeting-minutes/` within 24 hours after the meeting.

---

## 6. Expectations

Per the signed Team Contract:

- **Attendance & punctuality** — attend all scheduled meetings on time unless prior notice is given. Repeated unexplained absence is a contract violation.
- **Deadlines** — complete assigned tasks before their stated deadlines. Internal deadlines run **48 hours ahead** of official deadlines.
- **Communication** — communicate blockers as early as possible. No silent failure.
- **Commitment** — once a decision is finalized, all members support and contribute to it.

---

## 7. Handling Infractions

1. **First instance** — the team discusses the issue directly and constructively with the member involved, in a 1:1 or full-team setting depending on severity.
2. **Recurring issues** — the team documents incidents and notifies the TA / professor.
3. **Persistent non-contribution** — task reassignment and formal reporting per course policy.

The Project Coordinator is responsible for initiating these conversations promptly and respectfully.

---

## 8. Working Hours and Availability

The team operates **asynchronously** with one synchronous meeting per week. Each member is expected to:
- Be reachable on Discord during their typical work hours.
- Post a brief async update on Discord at least **twice a week** during active sprints.
- Communicate planned unavailability (exams, travel) at least **48 hours** in advance.

---

## 9. Onboarding (for any future members or graders)

To get oriented, read in this order:
1. [README](../README.md)
2. [Project Proposal](PROPOSAL.md)
3. [Project Plan](PROJECT_PLAN.md)
4. [System Architecture](ARCHITECTURE.md)
5. [Contributing Guide](../CONTRIBUTING.md)

---

*Last updated: May 2026.*
