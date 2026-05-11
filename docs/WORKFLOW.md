# Career CoPilot — User Workflow

**Owner:** Kair Wang (Project Coordinator)
**Status:** v2 — approved 2026-05-11
**Audience:** Team 8, course instructor, technical advisor

---

## 1. Scope

Career CoPilot is a web-based platform that helps job seekers improve their resumes, practice interviews, and manage early-stage communication with recruiting agencies. This document defines the end-to-end user workflow that the MVP must support by **2026-06-17**.

## 2. User Roles

- **Candidate** — job seeker.
- **Agency user** — staff at a partner recruiting agency.
- **Admin** — internal team account for moderation and verification approval.

## 3. Candidate Workflow

| # | Step | Description |
|---|------|-------------|
| 1 | Sign up | Email + password registration; email verification required. |
| 2 | Build profile | Personal information, education, work history, skills. |
| 3 | Upload resume | Accepts PDF or DOCX; system extracts structured fields. |
| 4 | Resume review | The system analyses the resume and returns a **resume quality score inspired by common ATS screening criteria**, plus section-by-section suggestions. The candidate can accept, edit, or ignore each suggestion. |
| 5 | Profile verification | Candidate submits supporting documents (transcript, employment letter, certification). An admin reviews and approves. A verified badge is added to the profile after approval. |
| 6 | Interview practice | Candidate selects a target role and starts a text-based mock interview. The system asks questions, records answers, and returns a score with feedback at the end of the session. |
| 7 | View recruiter feed | Candidate sees a list of agencies and open roles that match their profile. |
| 8 | Start a chat | Candidate clicks **Connect** on an agency. A chat thread is created. |
| 9 | Chat actions | Inside a chat, the candidate has five standard actions: send message, schedule a call, share verified profile (requires consent), send full resume (requires consent), end the conversation. |
| 10 | Track outcomes | A simple status board shows chats started, interviews scheduled, offers received, and placements closed. |

## 4. Agency Workflow

| # | Step | Description |
|---|------|-------------|
| 1 | Sign up | Agency account creation; admin approves the account after document checks. |
| 2 | Post a role | Title, description, requirements, location, salary range. |
| 3 | Receive shortlist | The system shows candidates whose profiles match the role. |
| 4 | Start a chat | Agency user clicks **Connect** on a candidate to open a chat. |
| 5 | Chat actions | Same five-action toolbar as the candidate side. The agency user must request consent before viewing the verified profile or full resume. |
| 6 | Update status | Agency user records the outcome of each candidate: interview → offer → placement. |

## 5. Shared Behaviour

- **Consent before disclosure.** The verified profile and full resume are only shared after **the owner of the information gives explicit consent in the chat**.
- **Response rate.** Each profile shows the percentage of messages replied to within 48 hours. The metric is shown for transparency only and does not affect ranking in the MVP.
- **Verified badge.** Profiles display a verified badge after admin approval of the supporting documents. The verified badge only means that submitted documents were manually reviewed by an admin; **it does not represent legal identity verification**.
- **Notifications.** Email notifications for: new chat, new message, verification status change, role status change.
- **Reporting.** Both sides can report a chat for review by an admin.

## 6. MVP Scope (due 2026-06-17)

The following are in scope for the MVP submission:

1. Authentication and the three user roles.
2. Profile creation and resume upload with structured parsing.
3. AI-based resume review with a **resume quality score inspired by common ATS screening criteria** and suggestions.
4. Verification submission and admin approval workflow (manual approval is acceptable).
5. Role posting by agencies.
6. Candidate ↔ agency chat with the five standard actions (polling-based message refresh is acceptable).
7. AI text-based interview simulator with end-of-session score.
8. Status tracking for chats, interviews, offers, and placements.
9. **Basic event logs will be recorded for resume reviews, interview sessions, chat actions, and status updates to support testing and final reporting.**

The following are **not** in the MVP and will be considered for the Beta release (2026-07-04):

- Real-time chat using WebSockets.
- Voice or video interview practice.
- Automated verification (third-party identity APIs).
- Payment processing for candidate monetisation.
- Mobile-native applications.

## 7. Non-Functional Requirements

- All user-facing pages should respond within **2 seconds** under normal load.
- AI-bound endpoints (resume review, interview turn) should respond within **8 seconds**.
- All data in transit is sent over HTTPS.
- Passwords are stored using a strong hashing algorithm.
- Uploaded files are scanned and stored separately from the application server.

---

## Document History

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| v1 | 2026-05-11 | Kair Wang | Initial draft. |
| v2 | 2026-05-11 | Kair Wang | Approved version. Adjustments: neutral platform-goal wording; "resume quality score inspired by common ATS screening criteria" replaces "ATS-style score"; consent rewritten around the information owner; verified badge clarified as document review only; added event-logging item to MVP scope. |
