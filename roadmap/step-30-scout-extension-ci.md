# Step 30: Scout extension CI job

- **Week:** W2
- **Status:** Done
- **Owner:** Quinn (tests and CI lane: `tests/**`, `.github/workflows/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `ci(scout-extension): build and test the extension in ci (roadmap step-30)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #74 (`35af244`)

## Goal

Every PR into the roadmap staging branch that touches the Scout extension builds, tests, and packages it, so a broken extension never merges. The workflow uploads the built `dist` as a short-lived artifact for manual testing.

## Context and dependencies

Can start immediately. Use a **new** workflow file so it cannot conflict with step-14's e2e workflow (`e2e-smoke.yml`). Step-15 (store package zip) may not exist yet — upload `scout-extension/dist/` (the step-15 zip is optional later).

Triggers were originally `stage-roadmap`. Step-33 later mirrored the same workflow onto `stage-roadmap-w34`. The shipped file already lists both branches. Do not change `deploy.yml` (main only).

No secrets. No Chrome Web Store publish (step-66). Product code stays in Maya's lane.

## In scope

- A workflow in `.github/workflows/` that runs on PRs and pushes to the roadmap staging branch(es) when `scout-extension/**` or shared packages change: install, typecheck, unit tests, build, and manifest validation.
- Upload the built `dist` (or the step-15 zip once it exists) as a short-lived workflow artifact.
- No secrets; no publishing.

## Out of scope

- No Chrome Web Store upload.
- No product code changes (`scout-extension/**` source, frontends, Go).
- No changes to `deploy.yml`.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `.github/workflows/scout-extension.yml` — **this is the only file this step should change**

Read only: `scout-extension/package.json` (`typecheck`, `test`, `build`), `scout-extension/dist/manifest.json` after build, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.

## Implementation notes

**Workflow name:** `Scout Extension CI`. **Job:** `build-and-test` (display name `Build and test Scout extension`).

**Triggers (shipped):**

```yaml
on:
  pull_request:
    branches: [stage-roadmap, stage-roadmap-w34]
    paths:
      - "scout-extension/**"
      - ".github/workflows/scout-extension.yml"
  push:
    branches: [stage-roadmap, stage-roadmap-w34]
    paths: # same
```

After #115 the in-repo `packages/design-system` workspace is gone. The extension depends on the external catalog package `sid-ui` (`scout-extension/package.json`). The workflow path filter no longer lists a design-system folder — a `sid-ui` catalog bump is a lockfile/root change, not this job's path filter.

**Steps (exact commands):**

1. `bun --filter scout-extension typecheck`
2. `bun --filter scout-extension test`
3. `bun --filter scout-extension build`
4. Validate `scout-extension/dist/manifest.json` (jq: MV3, name, version)
5. Artifact `scout-extension-${{ github.sha }}` → `scout-extension/dist/`, 7-day retention

**Concurrency:** `scout-extension-${{ github.workflow }}-${{ github.ref }}`, cancel in progress.

Does **not** run `check:package` / `package` zip. No secrets needed.

## Acceptance criteria

1. The PR itself shows the new job running and green on a change that touches `scout-extension/**` or this workflow.
2. A deliberately broken extension build on a scratch branch makes the job fail (explain in the PR; do not push that branch to a shared PR).
3. Diff touches only `.github/workflows/**`.
4. `deploy.yml` is unchanged and still main-only.

## Test and validation

Local parity:

```bash
bun --filter scout-extension typecheck
bun --filter scout-extension test
bun --filter scout-extension build
```

Repo CI: `bun run ci` still passes (this workflow is separate from `tools/ci.mjs`). After push, open the Actions run and confirm **Build and test Scout extension** is green, not cancelled.

To prove failure: on a private scratch branch, break `scout-extension/src` so typecheck fails, push, screenshot the red job, revert. Do not open that scratch as the delivery PR.

## Risks and soft parks

- e2e-smoke is still `continue-on-error` (unrelated workflow). This job must **not** be `continue-on-error`.
- A `sid-ui` catalog bump does not by itself trigger this path-filtered job; extension source or this workflow file must change. That is the post-#115 shape — do not re-add `packages/design-system/**`.
- Infra: GitHub Actions runner starvation can cancel jobs. "All checks passed" can hide cancelled jobs — require real green.

## Definition of done

PR into `stage-roadmap-w34` (this step originally landed on retired `stage-roadmap` as #74). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
