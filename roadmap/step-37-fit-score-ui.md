# Step 37: Fit score UI

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(joined-frontend): show fit score in search (roadmap step-37)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-36 merges** (needs its API).

## Goal

Signed-in seekers see fit score and the short reason on search results and the job page.

## In scope

- `joined-frontend` search cards and `app/(seeker)/jobs/[id]` show the score and reason from step-36. Use `@joined/design-system` (badge/hint), not a custom meter.
- Hide the score for guests and when the API omits it.
- Types stay in the frontend job catalog module; do not invent a second score shape.

## Out of scope

- No backend changes. No company applicant fit UI. No public negative scores.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. Signed-in search shows score + reason; signed-out search does not.
3. Diff stays in Leo's lane.
