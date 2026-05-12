# Team Contract — Team 8

**Course:** ELG/DTI/GNG 5902 — University of Ottawa
**Project:** Career CoPilot — Production Readiness & System Optimization for an AI Talent Ecosystem
**Document version:** 2.0 — optimized 2026-05-11
**Submission deadline:** 2026-05-13 (Brightspace)

> This markdown file is the source-of-truth content for the Brightspace PDF submission. Each section maps directly to the corresponding section of the course-provided Team Contract template. Copy each section into the PDF template, then have every member sign before submission.

---

## Cover

| Field | Value |
|---|---|
| Course / Section | ELG/DTI/GNG 5902, Section # *(to confirm)* |
| Team | Team 8 |
| Suggested Projects | 1st choice: **Project 5 (Career CoPilot)** · 2nd: Project 35 · 3rd: Project 3 |

### Team Members

| # | Name | uOttawa Email | Role |
|---|---|---|---|
| 1 | Kair Wang | bwang105@uottawa.ca | Project Coordinator · Product Planning · Front-end Developer |
| 2 | Jingxuan Xu | jxu022@uottawa.ca | Backend & API Lead |
| 3 | Xiaoyi Zhang | xzhan071@uottawa.ca | Database Engineer |
| 4 | Xiaoyan Yang | xyang015@uottawa.ca | QA Lead + UI Implementation Support |
| 5 | Jiaoyang Bi | jbi056@uottawa.ca | DevOps Engineer + Documentation Lead |
| 6 | Xiang Zhao | xzhao022@uottawa.ca | AI / NLP Engineer |

---

## Team Procedures

### 1. Day, Time, and Place for Regular Team Meetings

- **Weekly Team Sync:** Every **Sunday, 8:00 PM EST**, on Microsoft Teams. The Teams call link is pinned in the Discord `#meetings` channel.
- **Sprint Planning + Retrospective:** Held at the boundary of every two-week sprint, immediately after the Sunday team sync (combined session, up to 90 minutes).
- **Backup time:** If the Sunday meeting cannot be held, it is rescheduled to **Monday 8:00 PM EST** on Microsoft Teams.
- **Ad-hoc working sessions:** Scheduled on Discord with at least **24 hours' notice** for any session expected to exceed one hour.
- **In-person meetings:** When needed for high-stakes milestones (e.g., MVP demo prep, Design Day rehearsal), the team meets at the **University of Ottawa STEM Complex** group study rooms or the **Morisset Library** study rooms. Rooms are booked at least **48 hours in advance** by Kair Wang.
- **Standard meeting duration:** 45 minutes for weekly sync; up to 90 minutes for sprint planning sessions.

### 2. Preferred Method of Communication

| Channel | Use | Owner |
|---|---|---|
| **Discord — "Team 8 – Career CoPilot"** | Day-to-day chat, async standups, urgent pings, file links, meeting reminders | All members |
| **WeChat group "Team 8 (5902)"** | Quick real-time discussion | All members |
| **Microsoft Teams** | Meeting calls, official document sharing, calendar invites | Kair Wang (admin) |
| **GitHub Issues / Pull Requests** | All technical work, code review, decisions of record | All members |
| **uOttawa email** | External communications with the instructor, TA, and client | Kair Wang (primary contact) |

**Response-time expectations**

- Discord / WeChat (non-urgent): within **24 hours** on weekdays.
- GitHub PR review when requested: within **2 business days**.
- Urgent / blocking issue (tagged `@urgent` in Discord): acknowledged within **4 hours**.

**Announcements, reminders, and updates** are posted in Discord `#announcements` by the Project Coordinator. When an announcement requires confirmation from all members, it is cross-posted to WeChat with an explicit reply request.

### 3. Decision-Making Policy

1. **Default — Consensus.** Most decisions are made by team consensus, either in the weekly meeting or asynchronously in the relevant GitHub Issue or Discussion. A proposal is considered accepted by consensus when **no member objects within 48 hours** of being posted.
2. **If consensus is not reached — Majority Vote.** A formal vote is called by the Project Coordinator. Each member has one vote. With six members, **four votes carry** the decision. Voting takes place either via a Discord poll open for 24 hours, or by show-of-hands in a meeting when all members are present.
3. **Tie-breaker.** If a vote is deadlocked at 3–3, **Kair Wang (Project Coordinator) has tie-breaking authority**. This authority is used only when a vote is genuinely tied.
4. **Scope, schedule, or budget decisions.** When a decision materially affects course-deliverable scope or deadlines, the Project Coordinator owns the final call after the team has been heard, to protect the project timeline.
5. **Recording.** Every formal decision is recorded in the meeting minutes and, when technical, in the originating GitHub Issue or Discussion thread.

### 4. Setting and Following Meeting Agendas

- **Who sets it:** The Project Coordinator (Kair Wang) sets each agenda. Any team member may submit agenda items via Discord.
- **When:** The agenda is posted to Discord `#meetings` and Microsoft Teams **at least 12 hours before** the scheduled meeting.
- **Notification:** The Discord post notifies all members; a reminder is posted in WeChat **2 hours before** the meeting.
- **Facilitation during the meeting:** Kair Wang facilitates. If Kair is unavailable, **Jiaoyang Bi** facilitates as backup.
- **Keeping the team on track:** The facilitator allocates a default **10 minutes per agenda item**. Off-topic discussion is moved to a "Parking Lot" section and revisited at the end of the meeting or pushed to a follow-up async thread.
- **Closing the meeting:** Before the meeting ends, the facilitator reads aloud all action items, owners, and deadlines, and confirms them with each owner.

### 5. Record Keeping

- **Note-taker:** **Jiaoyang Bi** (Documentation Lead) is the default note-taker. If Jiaoyang is absent, **Xiaoyan Yang** takes notes.
- **Format:** Minutes follow the template stored at `docs/meeting-minutes/README.md` in the team's GitHub repository. Every minute includes: date and time, attendees, absentees, agenda, discussion notes, decisions, action items (owner + due date), and the date of the next meeting.
- **Dissemination:** Minutes are committed to the GitHub repository at `docs/meeting-minutes/YYYY-MM-DD-<type>.md` and a link is posted in Discord `#meetings` within **24 hours** after the meeting ends.
- **Storage:** All agendas and minutes live in the team's GitHub repository (`UO_ELG_5902_career-copilot`). The repository is the single source of truth.
- **Acknowledgment:** Each member is expected to react to the minutes link in Discord within **48 hours**. Unacknowledged minutes are considered accepted after 48 hours have passed.

---

## Team Expectations

### Work Quality

**1. Project standards**

- Every written deliverable is reviewed by at least **one other team member** before submission.
- Code follows the project's **ESLint + Prettier** configuration. Every pull request must pass CI (lint, build, tests).
- Each pull request requires **at least one peer-review approval** before merge.
- Test coverage for core business logic: **80 % minimum** by the Beta release.
- Presentations and reports follow a consistent team template stored in the repository, and receive a single revision pass by the Project Coordinator before submission.
- All deliverables submitted to the course are written in **English**.

**2. Strategies to fulfill these standards**

- **GitHub** is the single source of truth for version control, issues, and the project board.
- **GitHub Projects (kanban)** tracks every task by sprint, with columns: Backlog · In Progress · In Review · Done.
- **Internal deadlines** are set **48 hours before** every official course deadline, to leave room for revision and integration testing.
- A **pre-submission checklist** (in `docs/PRE_SUBMISSION_CHECKLIST.md`) is run by the Project Coordinator before any Brightspace submission.

### Team Participation

**1. Cooperation and equal distribution of tasks**

- Each domain (front-end, backend, database, AI, QA, DevOps) has exactly **one primary owner and one defined secondary**, recorded in `docs/PROJECT_PLAN.md`.
- Workload is reviewed at every sprint retrospective. If any member's load is materially uneven for two consecutive sprints, tasks are rebalanced by team agreement.
- Every member contributes to at least one cross-cutting activity per sprint (testing, documentation, or code review), regardless of their primary domain.

**2. Strategies for including ideas from all members**

- During discussion items, each member has the floor in turn; interruptions are not permitted until the speaker yields.
- Brainstorming uses **"silent-first" idea capture**: every member writes ideas in a shared document for **5 minutes** before group discussion, to give every voice equal weight.
- Feedback is **respectful, specific, and solution-oriented**. Disagreement is about ideas, never about people.

**3. Strategies for keeping on task**

- Sprint goals are set at the start of each two-week sprint and tracked on the GitHub Projects board.
- Each member posts a brief async standup in Discord `#standups` on **Wednesday and Friday** during active sprints, in the format: *yesterday / today / blockers*.
- Blockers are surfaced to the Project Coordinator **as soon as identified**, not at the next meeting.

**4. Preferences for leadership**

- **Shared technical leadership.** Each domain has a primary owner who acts as the technical lead in that domain.
- **One formal coordinator** (Kair Wang) for cross-team coordination, scheduling, and external communication.
- **Rotating note-taker** for meetings (Jiaoyang default; Xiaoyan as backup).

### Personal Accountability

**1. Attendance, punctuality, and participation at team meetings**

- All members attend the Sunday 8:00 PM EST meeting on time.
- Notice of planned absence is posted in Discord `#meetings` **at least 24 hours in advance**, except in genuine emergencies.
- Members who miss a meeting are responsible for reading the minutes and acknowledging them within 48 hours.
- **Three unexcused absences** within one sprint phase are treated as a contract violation.

**2. Responsibility for assignments, timelines, and deadlines**

- Members complete assigned tasks by the **internal deadline** (48 hours before the official course deadline).
- If a task cannot be completed on time, the owner notifies the Project Coordinator **at least 24 hours before** the internal deadline so the team can re-plan.
- Each member owns their tasks end-to-end: implementation, tests, documentation, and review request.

**3. Communication with other team members**

- Members respond to Discord and WeChat messages within **24 hours** on weekdays.
- Members respond to pull-request review requests within **2 business days**.
- Members give **early warning** of any blocker or unavailability rather than going silent.
- **"Silent failure"** (missing a deadline without communication) is itself a contract violation, even if the underlying task is later completed.

**4. Commitment to team decisions and tasks**

- Once a decision is finalized (by consensus or by vote), every member supports and contributes to the agreed direction publicly, regardless of personal preference.
- Disagreement after a decision is raised through the **change-control process**: a new GitHub Discussion or agenda item, not by ignoring the decision in practice.

---

## Consequences for Failing to Follow Procedures and Fulfill Expectations

### 1. Handling Infractions (First Instance)

- The **Project Coordinator (Kair Wang)** raises the issue privately with the member involved **within 48 hours** of becoming aware of it.
- The member is given an opportunity to explain and propose a corrective action.
- A short note (date, issue, agreed corrective action) is recorded in the meeting minutes of the next team meeting and stored at `docs/incident-log/` for the team's records.
- The expectation is that **most issues are resolved at this step.**

### 2. If Infractions Continue

- **Second instance.** The issue is brought to the full team during the next weekly meeting. The team agrees on a **documented improvement plan** with specific actions and a **one-sprint review window**.
- **Third instance.** The team documents the pattern in writing and **notifies the TA and/or course instructor** for guidance. Tasks may be reassigned to other members to keep the project on schedule.
- **Persistent lack of contribution.** Reported formally to the course instructor per course policy. Final evaluation contributions may be affected per the course's peer-evaluation rules.

### 3. Escalation Principle

- No issue is allowed to remain unaddressed for more than **one sprint**.
- Escalation outside the team (TA or instructor) is taken seriously and only after the team has attempted internal resolution.
- **Exception:** academic-integrity concerns are escalated to the course instructor **immediately**, with no internal-resolution step.

---

## Acknowledgment and Signatures

By signing below, each member confirms that:

a) I participated in formulating the standards, roles, and procedures stated in this contract.
b) I understand that I am obligated to abide by these terms and conditions.
c) I understand that if I do not abide by these terms and conditions, I will face the consequences stated in this contract.

| # | Name | Role | Date | Signature |
|---|---|---|---|---|
| 1 | Kair Wang | Project Coordinator · Product Planning · Front-end Developer | 2026-05-08 | ✍︎ |
| 2 | Jingxuan Xu | Backend & API Lead | 2026-05-08 | ✍︎ |
| 3 | Xiaoyi Zhang | Database Engineer | 2026-05-08 | ✍︎ |
| 4 | Xiaoyan Yang | QA Lead + UI Implementation Support | 2026-05-08 | ✍︎ |
| 5 | Jiaoyang Bi | DevOps Engineer + Documentation Lead | 2026-05-08 | ✍︎ |
| 6 | Xiang Zhao | AI / NLP Engineer | 2026-05-11 | ✍︎ |

---

*Template adapted from https://cns.utexas.edu/images/CNS/TIDES/teaching-portal/Team_Contract.doc*
