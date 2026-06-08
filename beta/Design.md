# Career CoPilot — Beta Design System

> Source of truth for the July 4 Beta redesign. MVP production UI is unchanged when `VITE_BETA_REDESIGN` is not set.

## Brand personality

**What we are:** A real career tool platform — diagnose resume gaps, practice interviews, plan career moves, and help employers see *why* a candidate matches.

**What we are not:** Another blue-purple gradient AI SaaS template.

| Trait | Job seeker side | Employer side |
|-------|----------------|---------------|
| Tone | Coach-like, specific, step-by-step | Efficient, evidence-driven, operational |
| Density | Tool UI — readable hierarchy, real data | Recruiting console — task-first, not KPI wallpaper |
| Trust | Show the report, not a fake score card | Show match reasons, not a single number |

## Color system

Semantic tokens live in `beta/design-tokens.ts` and `beta/beta-theme.css`.

| Token | Light | Usage |
|-------|-------|--------|
| `action` | `#1D4ED8` (blue-700) | Primary CTA, links, focus ring — **only for actions** |
| `surface` | `#FFFFFF` | Page background |
| `surface-muted` | `#F8FAFC` | Alternate sections |
| `text-primary` | `#0F172A` | Headlines, body |
| `text-muted` | `#64748B` | Secondary copy |
| `status-ready` | `#16A34A` | ATS ready, skills matched |
| `status-gap` | `#EA580C` | Missing keywords, skill gaps |
| `status-risk` | `#DC2626` | Critical issues, blockers |
| `border` | `#E2E8F0` | Card and table borders |

**Rules**
- No purple/violet/indigo gradients.
- No full-bleed gradient heroes.
- Accent blue ≤ 5% of viewport area on marketing pages.
- Status colors carry meaning — never decorative.

## Typography

| Level | Font | Weight | Size | Use |
|-------|------|--------|------|-----|
| Display | DM Sans | 600 | clamp(2rem, 4vw, 3rem) | Hero headlines only |
| Heading | DM Sans | 600 | 1.25–1.5rem | Section titles |
| Body | DM Sans | 400 | 1rem / 16px | Paragraphs, UI labels |
| Mono | ui-monospace | 400 | 0.875rem | Scores, keywords, data |

- **Banned for display:** Inter 700/800, gradient text on headlines.
- Max line width: 65ch for marketing prose; tool panels can be denser.
- Line-height: 1.5 body, 1.2 display.

## Spacing (8pt grid)

| Token | Value |
|-------|-------|
| `space-1` | 8px |
| `space-2` | 16px |
| `space-3` | 24px |
| `space-4` | 32px |
| `space-6` | 48px |
| `space-8` | 64px |
| `space-section` | clamp(80px, 12vw, 160px) |

Section vertical padding uses `space-section`. No arbitrary values like `p-[13px]`.

## Cards

```
radius: 8px
border: 1px solid var(--beta-border)
shadow: none (default)
padding: 24px
background: var(--beta-surface)
```

Elevated cards (modals, dropdowns): `shadow-sm` only. No `rounded-2xl shadow-lg` defaults.

## Buttons

| Variant | Style |
|---------|--------|
| Primary | `bg-action text-white`, 8px radius, px-6 py-2.5, font-medium |
| Secondary | white bg, border, text-primary |
| Ghost | no border, text-action |

One primary action per viewport section. No gradient buttons.

## Tables (portal / reports)

- Zebra optional; prefer row borders.
- Left-align text; right-align numbers.
- Status column uses semantic badges (ready / gap / risk).
- Minimum 44px row height on mobile.

## Section isolation

Each section uses exactly one separator: surface shift **or** whitespace **or** divider **or** border. Never stack two same-surface sections without separation.

## Tool naming (copy system)

| Old (avoid) | New |
|-------------|-----|
| AI Resume Analysis | Resume Readiness Report |
| AI Mock Interview | Interview Practice |
| AI Opportunity Finder | Role Match |
| Career Path Analysis | Career Path Planner |
| AI Email Crafter | Outreach Drafts |
| Verified Talent NFT | Verified Talent Profile |

## Page IA (Beta)

### Job seeker `/`
1. Hero — upload → real outcomes
2. Sample report preview → `/sample-report`
3. Workflow: Analyze → Match → Practice → Plan
4. Career switcher scenario
5. Core 6 tools (not 17)
6. Pricing teaser → `/pricing`
7. FAQ

### Employer `/employers`
1. Hero — screening efficiency
2. Workflow: Post → Match → Review → Contact
3. Talent pool preview
4. Candidate card anatomy
5. Dashboard preview
6. Pricing teaser
7. Trust / privacy

## Feature flag

```bash
# Enable Beta redesign routes (dev / staging only until July 4)
VITE_BETA_REDESIGN=true npm run dev
```

MVP default: flag unset or `false` → existing `App.tsx` behavior, no router.

When flag is `true`, MVP app runs at `/app/*` so marketing routes (`/`, `/employers`, etc.) do not replace the June 17 deliverable.

## References

- Anti-patterns: `beta/ANTI-PATTERNS.md`
- Tokens: `beta/design-tokens.ts`
- Mock product data: `beta/mock/`
