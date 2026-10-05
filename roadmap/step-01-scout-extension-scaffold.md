# Step 01: Scout extension scaffold

- **Week:** W1 (Oct 5 to 11), Scout extension
- **Target branch:** `stage-roadmap` (open the PR into `stage-roadmap`, never `main`)
- **Roadmap line:** "Build Scout extension from scratch targeting Scout API (crawler is reference only, not the base)"

## Goal

Create a brand-new, empty Scout browser extension that builds and loads in Chrome. This is only the shell: manifest, entry points, and build wiring. No features yet.

## In scope

- A new workspace folder `scout-extension/` at the repo root.
- Chrome Manifest V3 `manifest.json` with name "Scout", version `0.0.1`, minimal permissions (`activeTab`, `storage`, `sidePanel` only if used). No host permissions yet.
- Entry points, each a placeholder that renders or logs "Scout":
  - background service worker
  - popup or side panel page (React, using `sid-ui` if it builds cleanly; plain React is fine otherwise)
  - empty content script registered for no sites yet, or omitted with a TODO
- `package.json` named `scout-extension` with `dev`, `build`, `typecheck` scripts. Use catalog versions (`catalog:`) for React, Vite, and TypeScript, the same way `acorn/extension` does.
- Add `scout-extension` to the root `package.json` workspaces list. Any root change is limited to that.
- A short `scout-extension/README.md`: what it is, how to build, how to load unpacked in Chrome.
- Follow repo conventions (lint, format, workspace-boundary rules) so CI passes.

## Out of scope

- No backend changes. Do not touch any Go service, `backend-core`, or any API.
- No login, no Scout API calls, no job capture, no parsing, no submit. Those are later steps.
- No pay model or earnings logic.
- Do not copy or refactor `plugins/crawler`. It talks to the old Athens server. Read it only as a reference for manifest shape.
- Do not change `acorn/`, the other apps, or shared packages.
- No Chrome Web Store packaging.
- No merge to `main`.

## Acceptance criteria

1. `bun install` succeeds at the repo root.
2. `bun --filter scout-extension build` produces a `dist/` folder containing a valid MV3 `manifest.json`.
3. Loading `scout-extension/dist` unpacked in Chrome shows the Scout extension with no errors on the extensions page. The popup or side panel opens and shows "Scout".
4. `bun --filter scout-extension typecheck` passes, and the repo's lint and format checks pass.
5. The diff touches only `scout-extension/**`, the root `package.json` workspaces entry, and `bun.lock`.
6. The PR targets `stage-roadmap` and has the title `roadmap step-01: Scout extension scaffold`.

## References (read only)

- `acorn/extension/`: an existing Vite + React MV3 extension in this repo. Copy its build pattern, not its code.
- `plugins/crawler/`: older extension that talks to Athens. Reference only.
- `packages/scout/`: Scout API contract types for later steps. Not used in this step.
