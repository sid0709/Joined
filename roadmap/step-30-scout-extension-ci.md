# Step 30: Scout extension CI job

Status: Done (merged in W2)

- **Week:** W2, Scout complete
- **Owner:** Quinn (tests and CI lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `ci(scout-extension): build and test the extension in ci (roadmap step-30)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after: nothing, can start now.** Use a new workflow file so it cannot conflict with step-14's e2e workflow.

## Goal
Every PR into `stage-roadmap` that touches the extension builds, tests, and packages it, so a broken extension never merges.

## In scope
- A workflow in `.github/workflows/` that runs on PRs and pushes to `stage-roadmap` when `scout-extension/**` or shared packages change: install, typecheck, unit tests, build, and manifest validation.
- Upload the built `dist` (or the step-15 zip once it exists) as a short-lived workflow artifact for manual testing.
- No secrets needed; no publishing.

## Out of scope
- No Chrome Web Store upload, no product code changes, no changes to `deploy.yml`.

## Acceptance criteria
1. The PR itself shows the new job running and green.
2. A deliberately broken extension build on a scratch branch makes the job fail (explain in the PR; do not push that branch to a shared PR).
3. Diff touches only `.github/workflows/**`.
