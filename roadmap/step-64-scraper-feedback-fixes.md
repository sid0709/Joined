# Step 64: Scraper week-1 extension fixes

- **Week:** W4, Feedback / launch prep
- **Owner:** Maya (lane: `scout-extension/**`)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `fix(scout-extension): top scraper week-1 feedback (roadmap step-64)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

The top Scout extension bugs from scraper onboarding week are fixed.

## In scope

- After W3 scraper onboarding, collect the highest-impact extension issues (capture misses, sign-in, draft queue, ATS detect, badge, notifications). Fix them in `scout-extension/**` only.
- Tests/fixtures for each extractor or UI bug. Follow existing capture tests under `scout-extension/src/capture/`.
- If store listing copy must change, keep that for step-66 unless a one-line fix is required.

## Out of scope

- No Scoutwell website (Leo, step-65). No backend. No Chrome Web Store publish in this step.
- No `acorn*` branch.

## Acceptance criteria

1. Build, typecheck, lint, format, and extension tests pass.
2. PR lists the feedback items closed (issue titles or a short bullet list).
3. Diff stays in `scout-extension/**`.
