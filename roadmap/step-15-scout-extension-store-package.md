# Step 15: Scout extension Chrome Web Store unlisted package

- **Week:** W2
- **Status:** Done
- **Owner:** Maya (lane: `scout-extension/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `chore(scout-extension): chrome web store unlisted package (roadmap step-15)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#89](https://github.com/sid0709/Joined/pull/89) (`c63bcc5`)
- **Starts after: nothing, can start now.** Work only in new `scout-extension/store/` and `scout-extension/scripts/` files plus one `package` script, so it cannot conflict with step-02 or step-13.

## Goal

The Scout extension can be packaged into a Chrome Web Store-ready zip with listing materials, so it can be uploaded as unlisted by Oct 14. The upload itself is a manual step Elon arranges with the user.

## Context and dependencies

Step-01 already has `build` / `typecheck`. Production host rewriting lives in `scout-extension/vite.config.ts` (`VITE_SCOUT_API_HOST`, `VITE_SCOUTWELL_WEB_ORIGIN`). Step-66 is the later public listing. Leo's step-19 install page reads `SCOUT_EXTENSION_STORE_URL` once a listing URL exists.

This step must not fight Maya's feature PRs: add `store/` and `scripts/`, plus `package` / `check:package` scripts. Justify whatever permissions the manifest already has (including `scripting` from step-13).

What shipped in #89: `bun --filter scout-extension package` → production build, `checkProductionBuild(dist/)`, zip `scout-extension/release/scout-<version>.zip` (gitignored), `store/` listing copy, permission justifications (later updated for `alarms` / `notifications` in step-18), README "How to release".

## In scope

- A `package` script in `scout-extension/package.json` that runs the production build and zips `dist/` into `scout-extension/release/scout-<version>.zip` (`release/` git-ignored).
- A check that fails if the manifest has `localhost` / `127.0.0.1` host permissions or a dev API host in a production build.
- `scout-extension/store/`: listing text (name, short and long description), permission justifications for each manifest permission, a single-purpose statement, privacy-practices answers, and placeholder icon and screenshot specs (sizes listed; real art can follow).
- A short "How to release" section in `scout-extension/README.md` (version bump, package, manual upload as unlisted).

## Out of scope

- No actual upload to the Chrome Web Store and no developer-account changes.
- No feature changes, no new permissions.
- No edits outside `scout-extension/**`.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `scout-extension/package.json` — `package`, `check:package` scripts
- `scout-extension/scripts/check-package.ts` (new)
- `scout-extension/scripts/zip-release.ts` (new)
- `scout-extension/src/packaging/checkManifest.ts` (new) and `checkManifest.test.ts`
- `scout-extension/store/listing.md` (new)
- `scout-extension/store/single-purpose.md` (new)
- `scout-extension/store/permission-justifications.md` (new) — must include `scripting`
- `scout-extension/store/privacy-practices.md` (new)
- `scout-extension/store/assets.md` (new)
- `scout-extension/store/README.md` (new)
- `scout-extension/README.md` — How to release
- `scout-extension/.gitignore` — `release/`

## Implementation notes

### Package pipeline

```text
bun run build && bun run check:package && bun scripts/zip-release.ts
```

Zip root must contain a valid MV3 `manifest.json` (not a nested `dist/` folder). Version comes from `package.json` (`0.0.1` at scaffold).

### Production host gate

`checkProductionBuild` / `checkManifest` fails if `host_permissions` include `localhost`, `127.0.0.1`, or a known dev API host. Production defaults: `https://scout.joinedhq.com/*` from `VITE_SCOUT_API_HOST` and `VITE_SCOUTWELL_WEB_ORIGIN`.

### Permission justifications

Document every permission that is actually in the production manifest. After later steps the list is: `activeTab`, `storage`, `scripting`, `sidePanel`, `cookies`, `alarms`, `notifications`, plus production host permissions. **`scripting` must be present** in `permission-justifications.md` (step-16 brief callout; already true on this branch).

Do not add a permission in order to have something to justify.

## Acceptance criteria

1. `bun --filter scout-extension package` produces a zip whose root contains a valid MV3 `manifest.json`.
2. The packaging check fails on a manifest with a dev host and passes on the production build.
3. Build, typecheck, lint, and format pass. Diff stays in `scout-extension/**`.
4. Store docs include a justification for `scripting`.

## Test and validation

```bash
bun --filter scout-extension typecheck
bun --filter scout-extension test
bun --filter scout-extension lint
bun --filter scout-extension package
```

Unit-test `checkManifest` with a fixture that includes `http://127.0.0.1:8082/*` (must fail) and a production host list (must pass).

Manual: unzip `release/scout-0.0.1.zip` and confirm `manifest.json` at the root with no localhost hosts. Do not upload to the store.

## Risks and soft parks

- Real screenshots/icons may still be placeholders in `store/assets.md`. Art is not a code blocker.
- Step-18 will add `alarms` and `notifications`; update justifications in that PR, not by guessing here.
- Step-66 is the public listing package. Keep this step unlisted-only.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #89), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
