# Step 65: Scraper web feedback fixes

- **Week:** W4, Feedback / launch prep
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `fix(scoutwell-frontend): top scraper week-1 web feedback (roadmap step-65)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

The top Scoutwell website bugs from scraper onboarding week are fixed.

## In scope

- Highest-impact `scoutwell-frontend` issues from week-1 scrapers (earnings dashboard, payouts page, submit flow on the site, copy, nav). Use `@joined/design-system`.
- If a bug is actually API-shaped, Elon coordinates Penny; do not patch around a broken contract in the UI.

## Out of scope

- No extension (Maya, step-64). No Joined seeker site unless the feedback is clearly there and still Leo's lane.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `scoutwell-frontend`.
2. PR lists the feedback items closed.
3. Diff stays in Leo's lane (`scoutwell-frontend/**` and design-system only if a missing primitive blocked the fix).
