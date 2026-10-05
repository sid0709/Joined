# Step 65: Scraper web feedback fixes

- **Week:** W4
- **Status:** Planned
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `fix(scoutwell-frontend): top scraper week-1 web feedback (roadmap step-65)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

The top Scoutwell website bugs from scraper onboarding week are fixed.

## Context and dependencies

Paired with [step-64](step-64-scraper-feedback-fixes.md) (Maya, extension). Prior Scoutwell web: [step-19](step-19-scoutwell-website-gaps.md) #83, [step-20](step-20-scout-earnings-dashboard.md) #86. Payout identity copy: [step-46](step-46-scout-payout-identity.md) #111 left setup cards incomplete (no DOB / `document_ref` / `holder_name`, no `GET /me/identity`). Provider statuses from [step-47](step-47-global-payout-provider.md) #113 may need UI once merged.

Key surfaces:

- Earnings: `scoutwell-frontend/app/(app)/earnings/page.tsx`, `components/earnings/*`, `lib/earnings.ts`
- Payouts: `app/(app)/payouts/page.tsx`, `components/payouts/*` (`payouts-view.tsx`, `setup-cards.tsx`)
- Routes: `lib/routes.ts` (`earnings`, `payouts`, `submit`, …)
- Browser API: `app/api/scout/[...path]/route.ts` → `/v1/scout/...` on `SCOUTWELL_API_URL`
- Design-system required

If a bug is API-shaped, Elon coordinates Penny; do not patch around a broken contract in the UI.

## In scope

- Highest-impact `scoutwell-frontend` issues from week-1 scrapers (earnings dashboard, payouts page, submit flow on the site, copy, nav).
- Use `@joined/design-system`. If a primitive is missing, add it in `packages/design-system` and `joined-theme` in the same change.
- PR lists the feedback items closed.

## Out of scope

- No extension (Maya, step-64). No Joined seeker site unless the feedback is clearly there and still Leo's lane.
- No backend contract changes without Elon/Penny.
- No `acorn*` branch.

## Files and areas to touch

- `scoutwell-frontend/app/(app)/earnings/`, `app/(app)/payouts/`, submit routes as needed
- `scoutwell-frontend/components/earnings/`, `components/payouts/`
- `scoutwell-frontend/lib/earnings.ts`, `lib/routes.ts`
- `packages/design-system/**` + `joined-theme/**` only if a missing primitive blocked the fix
- Do not edit `scout-extension/**`

## Implementation notes

Triage the same W3 feedback channel as step-64. Fix the top web items only.

Payouts: if identity/provider fields shipped on the API, wire `GET /v1/scout/me/identity` and holder/DOB inputs; map `identity_*` problem codes to `Banner` copy. Do not invent codes.

Hosts from `scoutwell-frontend/lib/config.ts`. Tokens only.

Empty/error states already have `error.tsx` / `loading.tsx` on earnings — match that pattern.

## Acceptance criteria

1. `bun --filter scoutwell-frontend typecheck`, lint, and format pass.
2. PR lists the feedback items closed.
3. Diff stays in Leo's lane (`scoutwell-frontend/**` and design-system only if a missing primitive blocked the fix).

## Test and validation

```bash
bun --filter scoutwell-frontend typecheck
bun --filter scoutwell-frontend lint
bun run ci format
bun run ci test
```

Add component/unit tests for any copy or error-code mapping you change. Manual (human): earnings, payouts, submit on local Scoutwell.

## Risks and soft parks

- Step-46 UI gaps (setup cards) may be the entire week-1 list — still list them as closed items.
- Do not mask `ErrPayoutBlocked` vs `identity_*` incorrectly (admin vs scout API differ).
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
