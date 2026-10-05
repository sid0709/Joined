# Step 15: Scout extension Chrome Web Store unlisted package

Status: Done (merged in W2)

- **Week:** W2, Scout complete
- **Owner:** Maya (scout-extension lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `chore(scout-extension): chrome web store unlisted package (roadmap step-15)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after: nothing, can start now.** Work only in new `scout-extension/store/` and `scout-extension/scripts/` files plus one `package` script, so it cannot conflict with step-02 or step-13.

## Goal
The Scout extension can be packaged into a Chrome Web Store-ready zip with listing materials, so it can be uploaded as unlisted by Oct 14.

## In scope
- A `package` script in `scout-extension/package.json` that runs the production build and zips `dist/` into `scout-extension/release/scout-<version>.zip` (release folder git-ignored inside `scout-extension/`).
- A check in the script that fails if the manifest has `localhost`/`127.0.0.1` host permissions or a dev API host in a production build.
- `scout-extension/store/`: listing text (name, short and long description), permission justifications for each manifest permission, a single-purpose statement, privacy-practices answers, and placeholder icon and screenshot specs (sizes listed, real art can follow).
- A short "How to release" section in `scout-extension/README.md` (version bump, package, manual upload as unlisted).

## Out of scope
- No actual upload to the Chrome Web Store and no developer-account changes. The upload is a manual step that Elon arranges with the user.
- No feature changes, no new permissions, no edits outside `scout-extension/**`.

## Acceptance criteria
1. `bun --filter scout-extension package` produces a zip whose root contains a valid MV3 `manifest.json`.
2. The packaging check fails on a manifest with a dev host and passes on the production build.
3. Build, typecheck, lint, format pass. Diff stays in `scout-extension/**`.
