# Step 01: Scout extension scaffold

- **Week:** W1
- **Status:** Done
- **Owner:** Maya (lane: `scout-extension/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scout-extension): scout extension scaffold (roadmap step-01)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#63](https://github.com/sid0709/Joined/pull/63) (`754616d` / merge `bc0de5a`)

## Goal

Create a brand-new Scout browser extension workspace that builds and loads unpacked in Chrome. This step ships only the shell: Manifest V3, Vite + React entry points, workspace wiring, and a short README. No capture, sign-in, or Scout API calls yet.

## Context and dependencies

The Notion V1 plan requires a Scout Chrome extension built from scratch, targeting the Scout API. `plugins/crawler` talks to the old Athens server and is reference-only. `acorn/extension` is the existing Vite + React MV3 pattern in this monorepo (catalog versions, CRX plugin) and is the build pattern to copy, not the product to fork.

This is the first Scout-extension step. Later Maya steps depend on it: step-02 (sign-in), step-13 (job capture), step-15 (store zip), step-16 (drafts), step-30 (extension CI). Penny owns the Scout API in `scoutwell-backend` and `backend-core/scout`; do not call those APIs here. Shared types for later steps live in `packages/scout`.

What shipped in #63: a new `scout-extension/` workspace added to the root `package.json` workspaces list, MV3 `manifest.json` (name "Scout", version `0.0.1`), Vite + `@crxjs/vite-plugin` + React, a background service worker, a side panel (`popup.html` → `src/popup/`), and `scout-extension/README.md`. The original PR depended on in-repo `@joined/design-system`; that package is gone. Shared UI is now the external `sid-ui` catalog package (`"sid-ui": "catalog:"` in `scout-extension/package.json`; source https://github.com/sid0709/sid-ui). Later steps added `scripting`, `cookies`, `alarms`, and `notifications`; the scaffold itself started with the minimal permission set.

## In scope

- New workspace folder `scout-extension/` at the repo root.
- Chrome Manifest V3 `manifest.json` with name "Scout", version `0.0.1`, and only the permissions this shell needs (`activeTab`, `storage`, `sidePanel`). No host permissions yet.
- Entry points that render or log "Scout":
  - background service worker
  - side panel page (React, using `sid-ui` if it builds cleanly; plain React is fine otherwise)
  - no static content-script match list (later steps inject on demand)
- `package.json` named `scout-extension` with `dev`, `build`, and `typecheck` scripts. Depend on `sid-ui` via `"sid-ui": "catalog:"` (root catalog pin, currently `0.1.0`). Use catalog versions for React, Vite, and TypeScript the same way `acorn/extension` does.
- Add `scout-extension` to the root `package.json` workspaces list. Any root change is limited to that entry plus `bun.lock`.
- Short `scout-extension/README.md`: what it is, how to build, how to load unpacked in Chrome.
- Follow repo lint, format, and workspace-boundary rules so CI passes.

## Out of scope

- No backend changes. Do not touch any Go service, `backend-core`, or any API.
- No login, Scout API calls, job capture, parsing, or submit.
- No pay model or earnings logic.
- Do not copy or refactor `plugins/crawler`. Read it only for manifest shape.
- Do not change `acorn/`, `acorn-backend/**`, `acorn-frontend/**`, the other apps, or shared packages. Do not add `packages/design-system` back; consume `sid-ui` from the catalog.
- No Chrome Web Store packaging (step-15).
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `scout-extension/` (new workspace)
- `scout-extension/manifest.json` (new)
- `scout-extension/package.json` (new)
- `scout-extension/vite.config.ts` (new; follow `acorn/extension` CRX + Vite pattern)
- `scout-extension/tsconfig.json` (new)
- `scout-extension/popup.html` (new; side-panel entry)
- `scout-extension/src/background/index.ts` (new)
- `scout-extension/src/popup/App.tsx` and `src/popup/main.tsx` (new)
- `scout-extension/README.md` (new)
- root `package.json` workspaces list (add `"scout-extension"`)
- `bun.lock` (only if the workspace install changes it)

## Implementation notes

- Copy the **build pattern** from `acorn/extension` (`@crxjs/vite-plugin`, Vite, catalog React/TS, `sid-ui`). Do not copy Acorn product UI or its hosts. Import UI from `sid-ui` (`import { … } from "sid-ui"`), never `sid-ui/src/*` and never a local design-system workspace.
- Side panel is the product chrome (`side_panel.default_path` → `popup.html`). A separate popup is not required.
- Keep permissions minimal. Host permissions and `scripting` arrive in step-02 / step-13.
- Catalog versions: React, Vite, TypeScript, `@types/chrome` from the root `package.json` `catalog`.
- Scripts that later steps expect to keep working: `dev` (`vite build --watch --mode development`), `build` (`tsc && vite build`), `typecheck` (`tsc`).
- Load unpacked from `scout-extension/dist` after `bun --filter scout-extension build`.
- `packages/scout` types are for later steps. Do not import them here.

## Acceptance criteria

1. `bun install` succeeds at the repo root.
2. `bun --filter scout-extension build` produces a `dist/` folder containing a valid MV3 `manifest.json`.
3. Loading `scout-extension/dist` unpacked in Chrome shows the Scout extension with no errors on the extensions page. The side panel opens and shows "Scout".
4. `bun --filter scout-extension typecheck` passes, and repo lint and format checks pass.
5. The diff touches only `scout-extension/**`, the root `package.json` workspaces entry, and `bun.lock`.
6. The PR targets the week's staging branch (historically `stage-roadmap`; follow-ups target `stage-roadmap-w34`) and uses a conventional-commit title that includes `(roadmap step-01)`.

## Test and validation

```bash
bun install
bun --filter scout-extension typecheck
bun --filter scout-extension build
bun run ci lint
bun run ci format
```

Add a small smoke test that the source `manifest.json` is MV3 and named Scout (see `scout-extension/src/smoke.test.ts` as shipped). Run `bun --filter scout-extension test` if the workspace has a `test` script.

Manual: load `scout-extension/dist` unpacked in Chrome, open the side panel, confirm "Scout" with no extension errors.

Repo-wide CI (same as GitHub): `bun run ci` (`tools/ci.mjs` → lint, format, typecheck, dependencies, test, go, build, commits).

## Risks and soft parks

- Later steps will add `scripting`, `cookies`, `alarms`, `notifications`, and host permissions. Do not pre-add them here.
- `plugins/crawler` must stay untouched; copying its Athens hosts would leak the wrong API into the new extension.
- GitHub Actions runner starvation can cancel jobs; "all checks passed" can hide cancelled jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #63), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
