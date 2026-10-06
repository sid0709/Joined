# Step 33: CI for pull requests into stage-roadmap-w34

- **Week:** W3
- **Status:** Done
- **Owner:** Quinn (tests and CI lane: `tests/**`, `.github/workflows/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `ci(workflows): run ci on stage-roadmap-w34 (roadmap step-33)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #104 (`5045c2e`)

## Goal

Every PR into `stage-roadmap-w34`, and every push to it, runs the same checks CI already runs for `main` and `stage-roadmap`. Deploy must stay tied to `main` only.

## Context and dependencies

W3/W4 work targets `stage-roadmap-w34` (cut from `main` at `af09b2adb0aeac2959f982be92850afcbce83fd6`). Without this step, PRs into that branch do not run lint, typecheck, Go, or e2e. Kickoff of other W3 steps can run concurrent once workflows cover the branch.

Shipped: `.github/workflows/ci.yml` `pull_request` + `push` branches include `main`, `stage-roadmap`, **`stage-roadmap-w34`**. `e2e-smoke.yml` and `scout-extension.yml` already list `stage-roadmap-w34`. `deploy.yml` `workflow_run.branches: [main]` and `ci-succeeded` requires `head_branch == 'main'`. Comments in `deploy.yml` state staging CI will not trigger deploy.

`commitlint.config.mjs` / `tools/ci.mjs` `commits` job already lint conventional commits. A later unmerged branch mentioned `stage-roadmap-w34` in a commitlint comment; #104 changed **workflows only**.

e2e-smoke remains `continue-on-error: true`. Required CI jobs must still be actually green, not cancelled.

## In scope

- Update `.github/workflows/ci.yml` triggers so `pull_request` and `push` on `stage-roadmap-w34` run all CI jobs (lint, format, typecheck, dependencies, test, go, build, commit-conventions).
- Update `.github/workflows/e2e-smoke.yml` so PRs into `stage-roadmap-w34` run the same smoke suite as PRs into `stage-roadmap`.
- Mirror any equivalent staging-only workflow (for example `.github/workflows/scout-extension.yml`) onto `stage-roadmap-w34` the same way it already runs on `stage-roadmap`.
- Make sure nothing in `.github/workflows/deploy.yml` can fire from `stage-roadmap-w34` CI.
- If commitlint comments or branch allowlists mention only `stage-roadmap`, include `stage-roadmap-w34`.

## Out of scope

- No product code changes.
- No new deploy targets.
- No merge to `main`. No `acorn*` branch.

## Files and areas to touch

- `.github/workflows/ci.yml`
- `.github/workflows/e2e-smoke.yml`
- `.github/workflows/scout-extension.yml`
- `.github/workflows/deploy.yml` — **read only** unless a comment must state the main-only guard; do not add `stage-roadmap-w34` to deploy triggers
- `commitlint.config.mjs` — only if a branch allowlist needs updating

Local mirror: `tools/ci.mjs` (`bun run ci`). Do not change product workspaces.

## Implementation notes

**`ci.yml` jobs and local equivalents** (`bun run ci <job>`):

| Job                | Command                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| lint               | `bun run ci lint` → workspaces lint, repo eslint, `check:boundaries`                                                                                                           |
| format             | `bun run ci format` → `format:check`                                                                                                                                           |
| typecheck          | `bun run ci typecheck`                                                                                                                                                         |
| dependencies       | `bun run ci dependencies` → `check:deps`                                                                                                                                       |
| test               | `bun run ci test` → `bun test --coverage` + `check:test-policy`                                                                                                                |
| go                 | `bun run ci go` → `vet:go`, `test:go` (`tools/go.mjs` runs every module in `go.work`: `acorn-backend`, `admin-backend`, `backend-core`, `joined-backend`, `scoutwell-backend`) |
| build              | `bun run ci build` (CI sets placeholder `JOINED_API_URL`, `SCOUTWELL_API_URL`)                                                                                                 |
| commit-conventions | `commitlint --from <merge-base> --to HEAD`                                                                                                                                     |

**Deploy guard:** `workflow_run` `branches: [main]` plus `head_branch == 'main'` in `ci-succeeded`. Explain this in the PR. `workflow_dispatch` on deploy is a human action, not CI-on-w34.

**Concurrency:** `ci.yml` cancels in-progress runs on the same ref. Cancelled is not green.

## Acceptance criteria

1. The PR itself shows CI running against `stage-roadmap-w34`.
2. Deploy workflow provably cannot run for `stage-roadmap-w34` (explain in the PR: `branches: [main]` + `head_branch` check).
3. Diff stays in `.github/workflows/**` (plus commitlint config only if needed).
4. e2e-smoke and scout-extension also trigger for this branch.

## Test and validation

```bash
bun run ci
```

After push, open the Actions tab on the PR into `stage-roadmap-w34`. Confirm lint, format, typecheck, dependencies, test, go, build, commit-conventions, and `ci-passed` ran and are green (not cancelled). Confirm **Deploy** did not start.

Scout-extension job only appears if those paths changed; that is expected.

## Risks and soft parks

- e2e-smoke is still `continue-on-error`. Do not treat its outcome as a merge gate.
- Infra: GitHub Actions runner starvation cancels jobs. "All checks passed" can hide cancelled jobs — require real green.
- `cancel-in-progress: true` on CI can cancel an in-flight run when a new push lands; the latest run must finish green.

## Definition of done

PR into `stage-roadmap-w34`. CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
