# Step 62: Load test search and job pages

- **Week:** W4
- **Status:** Done
- **Owner:** Quinn / Ravi (Quinn owns the harness in `tests/**`; Ravi owns API fixes in his lane)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `test(load): search and job pages (roadmap step-62)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

Local-only harness in `tests/load/`. CI does not run it. Thresholds are named constants. The command refuses `joinedhq.com`. A live baseline is produced on a machine where joined-backend and joined-frontend are already running.

## Goal

Search and public job pages have a repeatable load test with a recorded baseline (p95, error rate).

## Context and dependencies

Search API: `GET /v1/search/jobs` on joined-backend (`joined-backend/internal/httpapi/server.go`), already smoked in `tests/e2e/specs/joined-backend.e2e.ts`. Server-side search: [step-07](step-07-server-side-job-search.md) #71. Public job HTML: [step-38](step-38-seo-job-pages.md) #107 (`joined-frontend` `/jobs/{id}`). Hidden feed: [step-23](step-23-hidden-jobs-feed.md) #91.

There is **no** k6/vegeta/load runner under `tests/` today (only e2e, dependency-policy, image-plan). CI: `bun run ci test` is unit/coverage, not load.

If the test shows a backend bug, Ravi fixes in a follow-up PR.

## In scope

- A load script under `tests/` (k6, vegeta, or a small Go/bun runner — pick what the repo can run locally; CI is optional and must not point at production).
- Targets: `GET /v1/search/jobs` and public job HTML on joined-frontend.
- Document concurrency, duration, and pass/fail thresholds (p95 latency, error rate). Thresholds are named constants in the harness, not magic numbers in CI YAML.
- Do not point at production.

## Out of scope

- No production load. No write/apply flood. No Scout/Acorn in this step.
- No huge query-planner rewrite in the harness PR (Ravi follow-up).
- No merge to `main`.

## Files and areas to touch

- `tests/load/` (new) — script + README
- `tests/load/thresholds.ts` or `constants.go` (new) — named limits
- Optional CI job in `.github/workflows/` — local-only is acceptable if documented
- Ravi follow-up only: `joined-backend/**`, `backend-core` search/index code

## Implementation notes

Prefer a bun or Go runner so CI does not need a new toolchain, unless k6 is already installable in the workflow image. Base URL from env:

| Variable          | Default                 |
| ----------------- | ----------------------- |
| `LOAD_API_ORIGIN` | `http://127.0.0.1:8080` |
| `LOAD_WEB_ORIGIN` | `http://localhost:6002` |

Named constants (example values — pick real ones after a local baseline, do not treat these as sacred):

- `LOAD_VUS` — concurrency
- `LOAD_DURATION` — window
- `LOAD_P95_MS` — pass/fail
- `LOAD_ERROR_RATE` — pass/fail (e.g. 0.01)

Paths: `/v1/search/jobs` and `/jobs/{id}` for a fixture id supplied by env (`LOAD_JOB_ID`), never a hardcoded production slug.

Read-only. No `POST` apply, checkout, or import.

## Acceptance criteria

1. One documented command produces a summary (p95, errors).
2. Thresholds are named constants in the harness, not magic numbers in CI YAML.
3. Harness PR stays in `tests/**` (Quinn); API fixes stay in Ravi's lane.

## Test and validation

Document the exact command in `tests/load/README.md`, for example:

```bash
bun tests/load/search.ts
# or
go test ./tests/load/...
```

Human starts joined-backend + joined-frontend. Agent does not. Record a baseline number in the PR (local), not as a committed secret.

## Risks and soft parks

- Do not run this against `joinedhq.com` or `api.joinedhq.com`.
- Runner starvation in Actions: prefer local-only if CI minutes are tight; say so in the PR.
- Infra: cancelled CI can look green. Require real green on the harness PR’s `ci.yml`.

## Definition of done

Harness PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
