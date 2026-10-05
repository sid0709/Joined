# Step 48: Acorn profile editor

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends; **coordinate Elon** — Elon owns `acorn/**`)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*` as a git branch)
- **PR title:** `feat(acorn-website): profile editor (roadmap step-48)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

Acorn website has a profile editor that writes the same profile the extension already reads.

## In scope

- `acorn/website` currently has a landing page and sign-in placeholder that reuses `joined_session`. Add a signed-in profile page that loads/saves the profile document the extension uses (`acorn` profile APIs / shared types in `acorn/packages/shared`).
- Fields the extension already consumes (identity, contact, work authorization as already modeled). Do not invent a second profile store.
- `@joined/design-system` for form controls. Elon coordinates the `acorn/**` path ownership on the PR.

## Out of scope

- No résumé library (step-49). No billing (50/51). No extension UI rewrite.
- No new git branch named `acorn*`. Open the PR into `stage-roadmap-w34`.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `acorn/website` (and shared types if touched).
2. Saving profile on the website is what the extension reads for the same account.
3. Diff stays in `acorn/website/**` (and shared types only if required), with Elon on the PR.
