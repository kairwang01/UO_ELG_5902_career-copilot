# Beta Redesign — Visual QA

## Run screenshot pass

```bash
# Terminal 1
VITE_BETA_REDESIGN=true npm run dev

# Terminal 2
npm run beta:qa
```

Outputs to `beta/qa-screenshots/` (PNG gitignored; `QA-REPORT.md` committed when re-run locally).

## Routes covered

| Route | Purpose |
|-------|---------|
| `/` | Job seeker homepage |
| `/employers` | Employer landing |
| `/sample-report` | Full report preview |
| `/pricing` | Dual-audience pricing |
| `/portal` | Sign-in bridge |
| `/app` | MVP shell (lazy) |

## Viewports

- Desktop: 1280×800
- Mobile: 390×844

## Manual checks (each release)

- [ ] Hero CTA visible above fold on mobile
- [ ] No horizontal scroll on any route
- [ ] Header hamburger opens full nav
- [ ] Report Issues tab: issue / why / fix readable on mobile
- [ ] Candidate shortlist/message states toggle
- [ ] Pricing cards stack 1-col on mobile
- [ ] Case snapshots — no stock photos, no star ratings
- [ ] zh locale renders without mixed EN/ZH in same string

## Latest automated pass

See `beta/qa-screenshots/QA-REPORT.md` after running `npm run beta:qa`.
