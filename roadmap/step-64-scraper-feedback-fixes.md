# Step 64: Scraper week-1 extension fixes

- **Week:** W4
- **Status:** Planned
- **Owner:** Maya (lane: `scout-extension/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `fix(scout-extension): top scraper week-1 feedback (roadmap step-64)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

The top Scout extension bugs from scraper onboarding week are fixed, with a test or fixture for each closed item.

## Context and dependencies

W3 scraper onboarding happens first; this step absorbs the highest-impact extension issues (capture misses, sign-in, draft queue, ATS detect, badge, notifications). Prior extension steps (all Done in W1/W2): [01](step-01-scout-extension-scaffold.md) #63, [02](step-02-scout-extension-signin.md) #68, [13](step-13-scout-job-capture-ats.md) #85, [15](step-15-scout-extension-store-package.md) #89, [16](step-16-scout-extension-draft-queue-submit.md) #92, [17](step-17-scout-extension-more-ats-boards.md) #99, [18](step-18-scout-extension-status-badge-notifications.md) #100, [30](step-30-scout-extension-ci.md) #74.

Website bugs are [step-65](step-65-scraper-web-feedback-fixes.md) (Leo). Store listing package is [step-66](step-66-chrome-web-store-public.md). Intake API: `POST /v1/scout/submissions/extension` (scoutwell-backend, [step-27](step-27-scout-extension-intake-api.md) #82). Notifications: verify against code (step-18 note: drafted as `GET /v1/scout/notifications?since=`).

Tests live under `scout-extension/src/capture/` (`capture.test.ts`, `extractors/*.test.ts`), content/background capture tests. CI: `.github/workflows/scout-extension.yml` runs `bun --filter scout-extension typecheck`, `test`, `build`. Scripts: `package.json` `test` = `bun test`, `package` = build + check + zip.

`scout-extension/store/permission-justifications.md` — add `scripting` if step-16 still needs it and it is missing.

## In scope

- After W3 onboarding, collect the highest-impact extension issues and fix them in `scout-extension/**` only.
- Tests/fixtures for each extractor or UI bug. Follow existing capture tests.
- If store listing copy must change, keep that for step-66 unless a one-line fix is required.
- List closed feedback items in the PR body.

## Out of scope

- No Scoutwell website (Leo, step-65). No backend. No Chrome Web Store publish.
- No `acorn*` branch.
- No drive-by redesign of the side panel.

## Files and areas to touch

- `scout-extension/src/capture/` and `src/capture/extractors/`
- `scout-extension/src/content/`, `src/background/`
- `scout-extension/src/` sign-in, draft queue, badge, notifications modules as needed
- `scout-extension/store/permission-justifications.md` — only if a permission is missing
- Tests next to the changed module
- Do not touch `scoutwell-frontend/**`

## Implementation notes

Triage against the feedback channel process from W3 ops (not a coding step). Fix the top items only; park the rest as a list in the PR.

Capture: add a fixture HTML page per missed ATS/board, same pattern as existing extractor tests. Do not hit live job URLs from CI.

Sign-in: Scoutwell origin and API hosts come from `src/api/hosts.ts` / `config.ts` — no new hardcoded hosts.

Notifications: confirm the real path in `scoutwell-backend` / `packages/scout` before changing the client. Do not assume `?since=` if the code uses another query.

Version: Scout extension version is `scout-extension/package.json` `"version": "0.0.1"`. Bump only if the workspace convention for this package says so (Acorn’s “every change bumps version” rule is `acorn/extension`, not Scout). Prefer leaving 0.0.1 until step-66 unless Maya already bumped.

## Acceptance criteria

1. `bun --filter scout-extension typecheck`, `test`, `build`, and repo lint/format pass.
2. PR lists the feedback items closed (issue titles or a short bullet list).
3. Diff stays in `scout-extension/**`.

## Test and validation

```bash
bun --filter scout-extension typecheck
bun --filter scout-extension test
bun --filter scout-extension build
bun --filter scout-extension lint
bun run ci format
```

CI workflow: `.github/workflows/scout-extension.yml`.

## Risks and soft parks

- Step-16: add `scripting` to `permission-justifications.md` if not already there.
- Step-18: notifications endpoint was drafted as `GET /v1/scout/notifications?since=` — verify against code.
- Store copy belongs in step-66.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
