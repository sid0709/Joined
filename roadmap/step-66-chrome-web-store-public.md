# Step 66: Chrome Web Store public listing package

- **Week:** W4, Launch prep
- **Owner:** Maya (scout-extension lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(scout-extension): chrome web store public listing package (roadmap step-66)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

The Chrome Web Store package is ready to go **public**, or an explicit decision to stay unlisted is recorded in `scout-extension/store/`.

## In scope

- Update `scout-extension/store/` (today: unlisted listing.md / assets.md / README). Real screenshots specs, description, privacy practices, and single-purpose wording.
- `bun --filter scout-extension package` still produces the zip. Version bump only if Acorn-style versioning does not apply; Scout extension version lives with that workspace's existing convention.
- If the product choice is "keep unlisted", say so in `store/listing.md` and skip dashboard publish. Do not upload from CI.

## Out of scope

- No automated publish. No `main` merge. No backend.
- Do not check generated marketing mockups into git if the existing assets.md says not to.

## Acceptance criteria

1. Package zip builds; store docs match the chosen public vs unlisted state.
2. Listing copy does not claim features the extension does not ship.
3. Diff stays in `scout-extension/**`.
