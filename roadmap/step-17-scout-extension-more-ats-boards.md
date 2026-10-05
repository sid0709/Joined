# Step 17: Scout extension more ATS boards

- **Week:** W2
- **Status:** Done
- **Owner:** Maya (lane: `scout-extension/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scout-extension): detect more ats boards (roadmap step-17)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#99](https://github.com/sid0709/Joined/pull/99) (`7d25a02`)
- **Starts after step-13 merges** (extends its extractor set). Can run in parallel with step-16 if it touches only extractor files and fixtures.

## Goal

The extension recognizes the next tier of ATS and job boards, so scouts can capture jobs from more company career pages. Adding a board is one extractor file, one registry row, and fixtures.

## Context and dependencies

Step-13 (#85) shipped Greenhouse, Lever, Ashby, Workday, LinkedIn plus JSON-LD fallback, `BOARD_DETECTION` in `src/capture/hosts.ts`, and `BOARD_EXTRACTORS` in `src/capture/extractors/index.ts`. Stay out of draft/submit UI (step-16) except board-name display on the existing card.

What shipped in #99: extractors and job + no-job fixtures for SmartRecruiters, iCIMS, Workable, BambooHR, Jobvite, and Recruitee. Full named set on the branch is those eleven boards; there is no Taleo / SuccessFactors / ADP extractor.

## In scope

- New extractors following the step-13 pattern for at least SmartRecruiters, iCIMS, Workable, BambooHR, Jobvite, and Recruitee.
- A board-detection registry (URL pattern plus DOM signature) so adding a board is one file plus one fixture.
- Saved HTML fixtures and unit tests for each new board, including one "not a job page" fixture per board.

## Out of scope

- No scraping of sites whose terms forbid it; extraction runs only on the page the scout has open.
- No submit, queue, or UI changes beyond board name display.
- No edits outside `scout-extension/**`.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `scout-extension/src/capture/extractors/smartrecruiters.ts` (new)
- `scout-extension/src/capture/extractors/icims.ts` (new)
- `scout-extension/src/capture/extractors/workable.ts` (new)
- `scout-extension/src/capture/extractors/bamboohr.ts` (new)
- `scout-extension/src/capture/extractors/jobvite.ts` (new)
- `scout-extension/src/capture/extractors/recruitee.ts` (new)
- `scout-extension/src/capture/extractors/index.ts` — register extractors
- `scout-extension/src/capture/hosts.ts` — `BOARD_DETECTION` rows
- `scout-extension/src/capture/types.ts` — board union if needed
- Fixtures: `scout-extension/fixtures/{board}.html` and `{board}-no-job.html` for each new board
- Tests: `extractors/{board}.test.ts`, update `index.test.ts` and `capture.test.ts`

Avoid `src/drafts/**` and `src/status/**` so this can land beside step-16 / step-18.

## Implementation notes

- Match step-13: pure extractors, `detectJobBoard` via URL pattern + DOM signature, `extractForBoard`.
- Company fallbacks: `boardCompanyFallback()` in `capture.ts` when the board page omits a company string.
- Host rules: branded subdomains via `isBrandedHost` / suffix checks. Exclude marketing hosts with `MARKETING_HOST_LABELS`.
- Each new board needs a positive fixture (title, company, location, apply URL) and a negative fixture (not a job page).
- Do not add host permissions. Capture stays on-demand `scripting` + `activeTab`.

## Acceptance criteria

1. Build, typecheck, lint, format, and extractor tests pass.
2. Each new board's fixture extracts title, company, location, and apply URL.
3. Each new board has a "not a job page" fixture that does not extract a job.
4. Diff stays in `scout-extension/**` and does not touch draft/submit modules.

## Test and validation

```bash
bun --filter scout-extension typecheck
bun --filter scout-extension test
bun --filter scout-extension lint
bun --filter scout-extension build
```

Manual: optional, one live career page per board if available. Fixtures are the required proof.

## Risks and soft parks

- ATS DOM changes will break extractors; fixtures freeze the contract we claim.
- Marketing domains that share a suffix must stay excluded.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #99), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
