# Step 58: E2E scout and Acorn journeys

- **Week:** W4, QA / launch prep
- **Owner:** Quinn (tests and CI lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `test(e2e): scout and acorn journeys (roadmap step-58)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Parallel with step-57** if specs do not share files awkwardly.

## Goal

Playwright covers Scoutwell + Acorn website happy paths.

## In scope

- Scoutwell: home, sign-in (email or existing helper), earnings or payouts page render, submit/capture is **not** required if it needs the extension.
- Acorn website: landing, sign-in placeholder/session, profile or résumé page render if steps 48–49 merged (skip with annotate if not).
- Reuse `tests/e2e/helpers`. Do not hit Chrome Web Store. Do not start Acorn extension automation unless a documented harness already exists.

## Out of scope

- No product code. No extension MV3 browser automation unless already supported.
- No `acorn*` git branch.

## Acceptance criteria

1. New specs run in the existing Playwright config.
2. CI on `stage-roadmap-w34` picks them up.
3. Diff stays in `tests/**` and `.github/workflows/**`.
