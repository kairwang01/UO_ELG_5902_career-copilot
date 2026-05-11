# Contributing to Career CoPilot

Thank you for contributing to Career CoPilot. This guide describes how Team 8 collaborates on this repository.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Branching Model](#branching-model)
4. [Commit Messages](#commit-messages)
5. [Pull Requests](#pull-requests)
6. [Code Review](#code-review)
7. [Coding Standards](#coding-standards)
8. [Testing](#testing)
9. [Documentation](#documentation)
10. [Issue Reporting](#issue-reporting)

---

## Code of Conduct

We expect every contributor to be respectful, constructive, and inclusive. Feedback is welcome — personal attacks are not. Disagreements are resolved through discussion and the [team's decision-making policy](docs/TEAM.md#3-decision-making-policy).

---

## Getting Started

> Source code for `frontend/`, `backend/`, and `database/` is being migrated from the MVP. This section will expand as code lands.

```bash
# Clone the repository
git clone https://github.com/kairwang01/career-copilot.git
cd career-copilot

# (Planned) Install dependencies and run dev environment
docker compose up -d
pnpm install
pnpm dev
```

If you run into setup issues, check `docs/DEV_SETUP.md` (to be created in Sprint 0).

---

## Branching Model

We use a **trunk-based development** model.

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New functionality | `feature/resume-ats-score` |
| `fix/` | Bug fix | `fix/login-redirect-loop` |
| `refactor/` | Internal cleanup without behavior change | `refactor/auth-service` |
| `docs/` | Documentation only | `docs/update-architecture` |
| `test/` | Test additions or fixes | `test/add-api-coverage` |
| `chore/` | Tooling, dependencies, CI | `chore/upgrade-node-20` |

**Rules:**
- Branch from `main`.
- Keep branches short-lived (target ≤ 5 days).
- Rebase or merge `main` into your branch before opening a PR if it has fallen behind.

---

## Commit Messages

Follow **Conventional Commits**:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Examples**
```
feat(resume): add ATS scoring endpoint
fix(auth): handle expired refresh tokens
docs(plan): update sprint 3 deliverables
test(api): add coverage for user endpoints
refactor(db): extract migration helpers
chore(ci): bump Node to 20 in workflow
```

**Subject rules**
- Imperative mood: "add" not "added" or "adds".
- ≤ 72 characters.
- No trailing period.

---

## Pull Requests

### Before Opening a PR

- [ ] Code builds locally.
- [ ] Tests pass locally.
- [ ] Lint and type-check pass.
- [ ] No leftover debug code (`console.log`, commented blocks).
- [ ] Documentation updated if behavior or APIs changed.
- [ ] Branch is up to date with `main`.

### PR Template

```
## Summary
<what changed and why>

## Related Issue(s)
Closes #...

## How to Test
<step-by-step verification, including any new fixtures>

## Checklist
- [ ] Tests added/updated
- [ ] Docs updated
- [ ] CI passing
```

### PR Rules

- **Reviewers:** at least **1 teammate** must approve.
- **CI:** must be green (lint + tests + build).
- **Merge strategy:** **squash and merge** into `main` to keep history clean.
- **Size:** prefer PRs under ~400 lines of diff. Split larger ones.

---

## Code Review

### As an author
- Self-review your diff before requesting review.
- Respond to comments within **2 business days**.
- Don't take feedback personally — it's about the code, not you.

### As a reviewer
- Aim to leave feedback within **2 business days**.
- Be specific: link to lines and suggest concrete changes.
- Distinguish **blocking** from **non-blocking** feedback with prefixes:
  - `[blocking]` — must be addressed before merge.
  - `[nit]` — minor / optional.
  - `[question]` — clarifying question, not necessarily a change request.
- Approve only when you'd be comfortable owning the code.

---

## Coding Standards

### General
- Use clear, descriptive names.
- Keep functions short and focused.
- Avoid clever code that requires comments to be understood — refactor instead.
- Add comments **only** when the *why* is non-obvious.
- Delete dead code; don't leave it commented out.

### TypeScript / JavaScript
- `strict` mode enabled.
- Prefer `const` over `let`; never `var`.
- Use named exports unless a default makes more sense.
- Avoid `any` — type properly or use `unknown` + narrowing.

### SQL
- Use parameterized queries — never string concatenation.
- All schema changes go through migrations; no manual DB edits.
- Index columns used in WHERE, JOIN, and ORDER BY clauses.

### Style Enforcement
- Code style enforced via **ESLint + Prettier**.
- Run formatters before pushing — CI will block unformatted code.

---

## Testing

Every PR should include or update tests proportional to its change.

| Test Type | Tooling | When |
|-----------|---------|------|
| Unit | Jest | Pure logic, helpers, services |
| API/Integration | Supertest | Every API endpoint change |
| E2E | Playwright | New or modified user-facing flow |
| Performance | k6 (planned) | High-traffic endpoint changes |

**Coverage targets**
- Core business logic: **≥ 80 %**
- Critical paths: **100 % E2E coverage**

**Test naming**
- Describe the behavior, not the implementation: `should reject expired refresh tokens` ✓ — `test refreshToken function` ✗.

---

## Documentation

Documentation is **part of the work**, not an afterthought.

When you change…
- **Public APIs** → update the OpenAPI spec.
- **Architecture** → update `docs/ARCHITECTURE.md` and add an ADR if a decision was taken.
- **Process** → update `docs/TEAM.md` or `CONTRIBUTING.md`.
- **Setup / dev tooling** → update `docs/DEV_SETUP.md`.

Markdown style:
- Use sentence case for headings.
- One sentence per line in long-form prose (helps diffs).
- Prefer tables for structured data over prose lists.

---

## Issue Reporting

Use GitHub Issues for **bugs**, **enhancements**, and **questions**.

### Bug Report Template
```
**What happened?**

**What did you expect?**

**Steps to reproduce**

**Environment** (browser, OS, branch/commit)

**Logs / screenshots** (if relevant)
```

### Labels (used during triage)
- `bug` — confirmed defect.
- `enhancement` — feature or improvement request.
- `documentation` — docs work.
- `priority/P0` — production-blocking.
- `priority/P1` — should fix this sprint.
- `priority/P2` — nice to have.
- `good first issue` — small, well-scoped, suitable for new contributors.

---

## Questions?

Open an issue or ask in the team Discord. We're happy to help.

— Team 8
