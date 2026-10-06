# Step 06: CI for pull requests into stage-roadmap

- **Week:** W1
- **Status:** Done
- **Owner:** Quinn (lane: `tests/**`, `.github/workflows/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `ci: enable CI for stage-roadmap PRs and pushes (roadmap step-06)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#64](https://github.com/sid0709/Joined/pull/64) (`e3e50ca` / merge `609a681`)

## Goal

Every PR into `stage-roadmap`, and every push to it, runs the same checks CI runs for `main`. Deploy must stay tied to `main` only.

## Context and dependencies

Root CI is `.github/workflows/ci.yml`. Jobs call `bun run ci <job>` from `tools/ci.mjs` (lint, format, typecheck, dependencies, test, go, build, plus commit-conventions). Deploy is `.github/workflows/deploy.yml` via `workflow_run` after CI on `main`.

This step does not add product tests. Step-14 adds the Playwright smoke workflow. Step-33 later extends the same `branches` arrays to `stage-roadmap-w34` (already on this branch). Step-30 is Maya's scout-extension workflow.

What shipped in #64: `on.pull_request.branches` and `on.push.branches` became `[main, stage-roadmap]`, with a comment on adding future staging branches. Deploy comments and `workflow_run.branches: [main]` plus `head_branch == 'main'` stayed main-only.

## In scope

- Update `.github/workflows/ci.yml` triggers so `pull_request` and `push` on `stage-roadmap` run all CI jobs (lint, format, typecheck, dependencies, test, go, build, commit-conventions).
- Prove nothing in `.github/workflows/deploy.yml` can fire from `stage-roadmap` CI. If deploy triggers on CI completion, restrict it to `main` explicitly.
- A short comment in the workflow on how to add future staging branches.

## Out of scope

- No product code changes.
- No new deploy targets.
- No e2e workflow yet (step-14).
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `.github/workflows/ci.yml` — `on.pull_request.branches` and `on.push.branches`
- `.github/workflows/deploy.yml` — comments and main-only guards only if they are not already explicit

Do not edit `tests/**`, app code, or `tools/ci.mjs` unless a trigger comment belongs there (it does not).

## Implementation notes

### CI jobs (must all run on the staging branch)

| Job id               | Display name                          | Command                   |
| -------------------- | ------------------------------------- | ------------------------- |
| `lint`               | Lint and workspace boundaries         | `bun run ci lint`         |
| `format`             | Check formatting                      | `bun run ci format`       |
| `typecheck`          | Typecheck all workspaces              | `bun run ci typecheck`    |
| `dependencies`       | One version per library               | `bun run ci dependencies` |
| `test`               | Test and coverage                     | `bun run ci test`         |
| `go`                 | Vet and test Go                       | `bun run ci go`           |
| `build`              | Build applications                    | `bun run ci build`        |
| `commit-conventions` | Check commit conventions and PR title | commitlint                |
| `ci-passed`          | All CI passed                         | gates on the jobs above   |

Local parity: `bun run ci` runs the same list via `tools/ci.mjs`. Commitlint is `bunx commitlint --from <merge-base> --to HEAD`; every commit message must be `type(scope): subject`.

### Deploy guard

`deploy.yml` must remain:

- `workflow_run` on the CI workflow, `branches: [main]`
- Job-level check that `head_branch == 'main'`
- No `push` trigger on `stage-roadmap`

Explain this in the PR body so Quinn can confirm without reading Actions YAML by guesswork.

### Follow-up already on this branch

Step-33 (`ab9ff78`, PR #104) added `stage-roadmap-w34` to `ci.yml`, `e2e-smoke.yml`, and `scout-extension.yml`. Follow-up work on this step should not revert that.

## Acceptance criteria

1. The PR itself shows CI running against `stage-roadmap` (historically) / the active staging branch.
2. Deploy workflow provably cannot run for `stage-roadmap` (explained in the PR).
3. Diff touches only `.github/workflows/**`.

## Test and validation

```bash
bun run ci lint
bun run ci format
# Full local parity with GitHub CI:
bun run ci
```

Manual: on the GitHub PR, confirm every `ci.yml` job queued. Confirm the Deploy workflow did not start. If a job is **cancelled**, do not treat the PR as green (runner starvation hides behind "all checks passed").

## Risks and soft parks

- GitHub Actions runner starvation cancels jobs; cancelled is not green. `ci-passed` must depend on successful (not skipped/cancelled) jobs.
- `concurrency.cancel-in-progress: true` on `ci.yml` will cancel older runs on the same ref. That is expected; the latest run still needs a full pass.
- E2E smoke (step-14) is a separate workflow and remains `continue-on-error: true`. Do not "fix" that here.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #64), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
