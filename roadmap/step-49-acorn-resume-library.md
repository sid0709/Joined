# Step 49: Acorn résumé library

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends; **coordinate Elon** for `acorn/**`)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*` as a git branch)
- **PR title:** `feat(acorn-website): resume upload library (roadmap step-49)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after or in parallel with step-48** if files do not overlap.

## Goal

Acorn website can upload and manage résumés in the same library the extension uses.

## In scope

- Résumé library page on `acorn/website` calling existing Acorn library-resume APIs (`backend-core/acornapi` already has library-resume routes). Upload, list, preview, delete, set default.
- Reuse extension/shared types (`acorn/packages/shared`) rather than a new DTO.
- `@joined/design-system` file uploader/cards. Size/type limits from existing Acorn constants, not new magic numbers.

## Out of scope

- No Joined résumé builder (step-39). No billing. No extension rewrite beyond reading the same library.
- No `acorn*` git branch.

## Acceptance criteria

1. Build, typecheck, lint, and format pass.
2. A résumé uploaded on the website appears in the extension library for that account (documented against the existing API).
3. Diff stays in `acorn/website/**` (and shared types only if required), with Elon on the PR.
