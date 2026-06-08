# Anti-Patterns — Career CoPilot Beta

Explicit bans for Beta redesign. If a PR introduces any of these, reject it.

## Visual

| # | Banned | Replace with |
|---|--------|--------------|
| V1 | Purple/blue multi-stop gradient hero | Solid surface + optional single-corner radial accent |
| V2 | `bg-gradient-to-r from-blue-600 to-indigo-700` on headlines | Solid `text-primary` or single accent word |
| V3 | Stock photo + fake floating score card ("Resume Score 94%") | Real product screenshot or structured report mock |
| V4 | Three identical feature cards in a row | 1 primary feature + supporting list, or alternating layout |
| V5 | `rounded-2xl shadow-lg` on every card | 8px radius, 1px border, no shadow |
| V6 | Lucide icon 48px above generic feature title | Tool screenshot or inline data preview |
| V7 | Glassmorphism (`backdrop-blur` cards on gradient) | Opaque surfaces |
| V8 | `MOST POPULAR` gradient pill on pricing | Subtle border highlight on recommended tier only |

## Layout

| # | Banned | Replace with |
|---|--------|--------------|
| L1 | Job seeker / employer toggle on same page | Separate routes: `/` and `/employers` |
| L2 | Centered-everything hero + predictable 3-card grid | Asymmetric grid; left-weighted content |
| L3 | Four symmetric pricing cards | Tiered layout with one recommended plan emphasized |
| L4 | Section padding < 80px on desktop marketing pages | `space-section` (80–160px) |

## Copy

| # | Banned | Replace with |
|---|--------|--------------|
| C1 | "An All-in-One AI Career Toolkit" | Outcome-specific: "Upload your resume. See the gaps blocking interviews." |
| C2 | "Connect with Top Talent, Faster." | "See why a candidate matches before you spend time screening." |
| C3 | "AI-powered", "Unlock", "Empower", "Transform", "Seamless" in headlines | Concrete results and verbs |
| C4 | Fake metrics without context (94%, "10x faster") | Named gaps, keywords, role fit with explanation |
| C5 | Mixed Chinese/English in same UI string | Single locale per render; use i18n keys |

## Product / brand

| # | Banned | Replace with |
|---|--------|--------------|
| P1 | uOttawa or any university in product brand UI | Footer academic credit only (if required), never hero/nav |
| P2 | Marketing page listing 17 tools flat | Core 6 tools with depth |
| P3 | Employer dashboard as KPI wallpaper only | Task-driven first screen ("3 roles need attention") |
| P4 | Candidate card showing only match % | role fit, skills matched, missing skills, evidence, action |

## Engineering

| # | Banned | Replace with |
|---|--------|--------------|
| E1 | Rewriting `App.tsx` homepage in place | Beta pages under `beta/pages/` + feature flag |
| E2 | Hard-coded hex in beta page components | `beta/design-tokens.ts` or CSS variables |
| E3 | Beta pages calling Firestore/Stripe on first pass | Mock data in `beta/mock/` until UI stable |
| E4 | Replacing MVP default route before July 4 | `VITE_BETA_REDESIGN` gate in `index.tsx` |

## Lint targets (future)

When ESLint plugin is added, fail build on:
- `from-violet`, `from-indigo`, `to-purple`, `bg-indigo-600`
- `rounded-2xl`, `rounded-3xl` in `beta/**`
- `shadow-lg`, `shadow-xl` in `beta/**`
- `font-extrabold` + `Inter` in display contexts

## Acceptance test

Cover the logo. A new visitor should say:
1. "This helps me fix my resume and prepare for interviews."
2. "Employers see why someone matches, not just a score."
3. "This doesn't look like every other AI SaaS landing page."
