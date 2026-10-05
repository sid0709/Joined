# Step 14: E2E smoke test harness

- **Week:** W1
- **Status:** Done
- **Owner:** Quinn (lane: `tests/**`, `.github/workflows/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `test(e2e): smoke test harness (roadmap step-14)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#67](https://github.com/sid0709/Joined/pull/67) (`785f4db`)

## Goal

A small end-to-end smoke suite proves the main pages load and key APIs answer, so later steps can add journeys (email auth in step-31, Premium in step-57, Scout/Acorn in step-58).

## Context and dependencies

The repo did not have a Playwright suite under `tests/e2e/` before this step. Root catalog already can pin `@playwright/test` (catalog `1.63.0`). Step-06 put CI on `stage-roadmap`. Step-04's company-mode redirect is one of the assertions. Step-07's `GET /v1/search/jobs` is the API check.

What shipped in #67: `tests/e2e/playwright.config.ts`, specs for joined-frontend (home, search, `/company` → `/`), joined-backend (`/health`, `/v1/search/jobs`), scoutwell-frontend home, `.github/workflows/e2e-smoke.yml` on PRs into `stage-roadmap`, **`continue-on-error: true`**. Follow-up commits on the same branch added Mongo in CI, scoutwell-backend, search UI assertions (`b146154`), and (step-31) `email-auth.e2e.ts`. Step-33 also listed `stage-roadmap-w34` on this workflow.

## In scope

- Playwright under `tests/e2e/`, with a config that starts or targets local services.
- Smoke checks: joined-frontend home and search page render, `/company` redirects to `/` when company mode is off (after step-04), joined-backend health and `/v1/search/jobs` respond, scoutwell-frontend home renders.
- A CI job in `.github/workflows/` that runs the smoke suite on PRs into `stage-roadmap`, allowed to be non-blocking at first if services are heavy to start; explain the choice.

## Out of scope

- No product code changes.
- No deploys.
- No full email or Premium journeys (steps 31, 57, 58).
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `tests/e2e/playwright.config.ts` (new)
- `tests/e2e/specs/joined-frontend.e2e.ts` (new)
- `tests/e2e/specs/joined-backend.e2e.ts` (new)
- `tests/e2e/specs/scoutwell-frontend.e2e.ts` (new)
- `tests/e2e/helpers/origins.ts` (new)
- `tests/e2e/README.md` (new) — one documented command
- `.github/workflows/e2e-smoke.yml` (new)
- root `package.json` — `@playwright/test` `catalog:` devDependency only if missing; flag for Elon

Spec files must be `*.e2e.ts` so `bun test` does not pick them up.

## Implementation notes

### Local command (same as CI)

```bash
bunx playwright test --config tests/e2e/playwright.config.ts
```

Origins overridable: `JOINED_FRONTEND_ORIGIN`, `JOINED_API_ORIGIN`, `SCOUTWELL_FRONTEND_ORIGIN`. Backend log: `JOINED_BACKEND_LOG`.

The human runs `bun run dev` / APIs. Agents do not start those processes. Document that in `tests/e2e/README.md`.

### CI (`.github/workflows/e2e-smoke.yml`)

- Trigger: `pull_request` → `stage-roadmap` (and, after step-33, `stage-roadmap-w34`).
- Job `e2e-smoke`, **`continue-on-error: true`** at job level (non-blocking while services are heavy).
- `bunx playwright install --with-deps chromium` then the command above.
- `EMAIL_PROVIDER=log`.
- Do not add this workflow to `deploy.yml`.

### Assertions

- joined-frontend: home renders, search UI present, `/company` redirects to `/` when company mode is off.
- joined-backend: `/health` and `/v1/search/jobs` respond.
- scoutwell-frontend: home renders.

## Acceptance criteria

1. `tests/e2e` runs locally with one documented command.
2. CI runs it on PRs into `stage-roadmap`.
3. Diff touches only `tests/**` and `.github/workflows/**` (plus a root dev dependency only if Elon approves).
4. The workflow is explicitly non-blocking (`continue-on-error`) with a comment explaining why.

## Test and validation

```bash
bunx playwright test --config tests/e2e/playwright.config.ts
bun run ci lint
bun run ci format
```

Do not start `bun run dev`, `next dev`, or `go run ./cmd/server` from this task. If services are not up, document that the suite is meant to run against the human-started stack / CI services block.

## Risks and soft parks

- **e2e-smoke is still `continue-on-error: true`** on `stage-roadmap-w34` (step-14 / step-31 area). Promoting it to a required check is a later Quinn decision; do not silently flip it in an unrelated PR.
- GitHub Actions runner starvation can cancel jobs. Cancelled is not green. Because this job is `continue-on-error`, a red or cancelled smoke must not be read as "all checks passed" for product confidence.
- Step-31 adds email-auth specs to the same folder; keep the smoke specs small so they stay fast.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #67), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
