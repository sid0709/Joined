# Step 14: E2E smoke test harness

- **Week:** W1, Foundations
- **Owner:** Quinn (tests and CI lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `test(e2e): smoke test harness (roadmap step-14)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

A small end-to-end smoke suite proves the main pages load and key APIs answer, so later steps can add journeys.

## In scope

- Playwright (or the repo's existing E2E tool, if one exists) under `tests/e2e/`, with a config that starts or targets local services.
- Smoke checks: joined-frontend home and search page render, `/company` redirects to `/` when company mode is off (after step-04), joined-backend health and `/v1/search/jobs` respond, scoutwell-frontend home renders.
- A CI job (in `.github/workflows/`) that runs the smoke suite on PRs into `stage-roadmap`, allowed to be non-blocking at first if services are heavy to start; explain the choice.

## Out of scope

- No product code changes, no deploys.

## Acceptance criteria

1. `tests/e2e` runs locally with one documented command.
2. CI runs it on PRs into `stage-roadmap`.
3. Diff touches only `tests/**` and `.github/workflows/**` (plus a root dev dependency only if Elon approves).
