# Step 57: E2E seeker and Premium journeys

- **Week:** W4, QA / launch prep
- **Owner:** Quinn (lane: `tests/**`, `.github/workflows/**`)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `test(e2e): seeker and premium journeys (roadmap step-57)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Extends step-14** (`tests/e2e`).

## Goal

Playwright covers the main seeker path and Premium checkout (test mode), not only smoke page loads.

## In scope

- New specs under `tests/e2e/specs/` for: sign-up/log-in (reuse email helpers), search, open a job, save a job or search if those APIs shipped, applications list, settings billing checkout **in Stripe test mode** (or skip checkout with an explicit annotate if live Stripe is required — never use live keys).
- Keep using `EMAIL_PROVIDER=log` and existing origins/timeouts helpers. Do not start services from product code; follow `tests/e2e/README.md`.
- CI: `.github/workflows/e2e-smoke.yml` already runs on PRs into `stage-roadmap-w34`. Add or keep jobs non-blocking only if services are still heavy; explain in the PR.

## Out of scope

- No product code. No Scout/Acorn journeys (step-58). No live Stripe.

## Acceptance criteria

1. `bunx playwright test --config tests/e2e/playwright.config.ts` documents the new specs.
2. CI runs them on PRs into `stage-roadmap-w34`.
3. Diff stays in `tests/**` and `.github/workflows/**`.
