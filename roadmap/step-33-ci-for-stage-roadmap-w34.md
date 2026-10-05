# Step 33: CI for pull requests into stage-roadmap-w34

- **Week:** W3, Scraper onboarding
- **Owner:** Quinn (lane: `tests/**`, `.github/workflows/**`)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `ci(workflows): run ci on stage-roadmap-w34 (roadmap step-33)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

Every PR into `stage-roadmap-w34`, and every push to it, runs the same checks CI already runs for `main` and `stage-roadmap`.

## In scope

- Update `.github/workflows/ci.yml` triggers so `pull_request` and `push` on `stage-roadmap-w34` run all CI jobs (lint, format, typecheck, dependencies, test, go, build, commit-conventions).
- Update `.github/workflows/e2e-smoke.yml` so PRs into `stage-roadmap-w34` run the same smoke suite as PRs into `stage-roadmap`.
- Mirror any equivalent staging-only workflow (for example `.github/workflows/scout-extension.yml`) onto `stage-roadmap-w34` the same way it already runs on `stage-roadmap`.
- Make sure nothing in `.github/workflows/deploy.yml` can fire from `stage-roadmap-w34` CI. Deploy must stay tied to `main` only.
- If commitlint comments or branch allowlists mention only `stage-roadmap`, include `stage-roadmap-w34`.

## Out of scope

- No product code changes.
- No new deploy targets.
- No merge to `main`. No `acorn*` branch.

## Acceptance criteria

1. The PR itself shows CI running against `stage-roadmap-w34`.
2. Deploy workflow provably cannot run for `stage-roadmap-w34` (explain in the PR).
3. Diff stays in `.github/workflows/**` (plus commitlint config only if needed).
