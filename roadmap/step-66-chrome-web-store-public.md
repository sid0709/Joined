# Step 66: Chrome Web Store public listing package

- **Week:** W4
- **Status:** Done
- **Owner:** Maya (scout-extension lane)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(scout-extension): chrome web store public listing package (roadmap step-66)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

`scout-extension/store/listing.md` records `Distribution: unlisted`. A public listing has not been chosen. Version stays `0.0.1`. Nothing is uploaded from CI. `scripting` stays justified next to the other manifest permissions.

## Goal

The Chrome Web Store package is ready to go **public**, or an explicit decision to stay unlisted is recorded in `scout-extension/store/`.

## Context and dependencies

Unlisted package already shipped in [step-15](step-15-scout-extension-store-package.md) #89. Week-1 fixes: [step-64](step-64-scraper-feedback-fixes.md). CI: [step-30](step-30-scout-extension-ci.md) #74. Do not upload from CI.

Current store docs (all unlisted):

- `scout-extension/store/README.md`
- `scout-extension/store/listing.md` — name Scout, Productivity, unlisted install
- `scout-extension/store/assets.md`
- `scout-extension/store/permission-justifications.md`
- `scout-extension/store/single-purpose.md`
- `scout-extension/store/privacy-practices.md`

Package: `bun --filter scout-extension package` → `build` + `check:package` + `scripts/zip-release.ts` → `release/scout-{version}.zip`. Version: `scout-extension/package.json` `"version": "0.0.1"`. Manifest check: `src/packaging/checkManifest.ts` (MV3, no local/dev hosts in prod). Source `manifest.json` still has dev `host_permissions` for :8082/:6003 — production zip must not.

Listing copy today claims: side panel sign-in, capture, drafts, toolbar badge, Chrome notifications, Scoutwell-only. Do not claim features the extension does not ship (Acorn apply, live payouts, etc.).

## In scope

- Update `scout-extension/store/` with real screenshot specs, description, privacy practices, and single-purpose wording for the chosen public vs unlisted state.
- `bun --filter scout-extension package` still produces the zip. Version bump only if this workspace’s convention requires it; Scout version lives in `scout-extension/package.json` (not Acorn’s extension versioning rule).
- If the product choice is “keep unlisted”, say so in `store/listing.md` and skip dashboard publish. Do not upload from CI.
- Align `permission-justifications.md` with the manifest (including `scripting` if used — step-16 note).

## Out of scope

- No automated publish. No `main` merge. No backend.
- Do not check generated marketing mockups into git if `assets.md` says not to.
- No live Chrome Web Store API keys in the repo.

## Files and areas to touch

- `scout-extension/store/listing.md`, `assets.md`, `README.md`, `privacy-practices.md`, `single-purpose.md`, `permission-justifications.md`
- `scout-extension/package.json` — version only if bumping
- `scout-extension/manifest.json` / build-time host stripping — if prod zip still leaks local hosts
- `scout-extension/scripts/zip-release.ts`, `scripts/check-package.ts`
- Do not add `release/*.zip` to git if gitignored

## Implementation notes

Decision recorded in `listing.md` at the top: `Distribution: public` or `Distribution: unlisted` plus who decided.

Screenshots: specify size and content in `assets.md`; keep binaries out of git unless the existing process already commits them.

Privacy practices must match the extension (no “we sell data”, no extra host permissions). Single-purpose wording: official job capture for Scoutwell, not a general scraper.

`checkManifest` must fail the zip if `localhost` or `127.0.0.1` appear in the production manifest.

Do not run store upload in GitHub Actions.

## Acceptance criteria

1. Package zip builds; store docs match the chosen public vs unlisted state.
2. Listing copy does not claim features the extension does not ship.
3. Diff stays in `scout-extension/**`.

## Test and validation

```bash
bun --filter scout-extension typecheck
bun --filter scout-extension test
bun --filter scout-extension package
bun --filter scout-extension lint
```

Inspect `release/scout-*.zip` manifest for leftover dev hosts. CI: `.github/workflows/scout-extension.yml`.

## Risks and soft parks

- Step-16 `scripting` justification if missing.
- Public listing before week-1 fixes (64) will freeze bad copy — sequence 64 then 66.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`. Publish (if public) is a dashboard action after merge, not this PR.
