# Step 06: CI for pull requests into stage-roadmap

- **Week:** W1, Foundations
- **Owner:** Quinn (lane: `tests/**`, `.github/workflows/**`)
- **Target branch:** `stage-roadmap`
- **PR title:** `roadmap step-06: CI for stage-roadmap`

## Goal

Every PR into `stage-roadmap`, and every push to it, runs the same checks CI runs for `main`.

## In scope

- Update `.github/workflows/ci.yml` triggers so `pull_request` and `push` on `stage-roadmap` run all CI jobs (lint, format, typecheck, dependencies, test, go, build).
- Make sure nothing in `.github/workflows/deploy.yml` can fire from `stage-roadmap` CI. Deploy must stay tied to `main` only. If deploy triggers on CI completion, restrict it to `main` explicitly.
- Optional: a short note in the workflow on how to add future staging branches.

## Out of scope

- No product code changes.
- No new deploy targets.

## Acceptance criteria

1. The PR itself shows CI running against `stage-roadmap`.
2. Deploy workflow provably cannot run for `stage-roadmap` (explain in the PR).
3. Diff touches only `.github/workflows/**`.
