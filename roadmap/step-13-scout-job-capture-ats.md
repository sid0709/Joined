# Step 13: Scout extension job capture and ATS detection

- **Week:** W1
- **Status:** Done
- **Owner:** Maya (lane: `scout-extension/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scout-extension): job capture and ats detection (roadmap step-13)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#85](https://github.com/sid0709/Joined/pull/85) (`ddb66e4`)
- **Starts after step-02 merges** (shares the manifest and side panel).

## Goal

On a job posting page, the Scout extension recognizes the job board and shows the captured job in the side panel (title, company, location, apply URL, description), ready to submit in a later step.

## Context and dependencies

Depends on step-01 scaffold and step-02 sign-in (#68). Do not submit to the API yet — that is step-16 against Penny's step-27 `POST /v1/scout/submissions/extension`. Step-17 adds the next ATS set using the same registry. Step-15 store copy must justify any new permission (`scripting`).

What shipped in #85: on-demand `chrome.scripting.executeScript` inject of `src/content/capture.ts` (no broad content-script match list), extractors for Greenhouse, Lever, Ashby, Workday, and LinkedIn, JSON-LD `JobPosting` fallback, `BOARD_DETECTION` registry in `src/capture/hosts.ts`, side-panel `DetectedJobPanel`, fixtures under `scout-extension/fixtures/`.

## In scope

- Content script (injected on demand) that detects common ATS and job boards — at least Greenhouse, Lever, Ashby, Workday, and LinkedIn job pages — and extracts title, company, location, apply URL, and description text. Fall back to page metadata (JSON-LD `JobPosting`) when available.
- Side panel shows a "Detected job" card or "No job found on this page".
- Use `activeTab` and scripting on demand; add host permissions only if truly needed and justify them in the PR.
- Unit tests for each extractor with saved HTML fixtures under `scout-extension/`.

## Out of scope

- No submit to the Scout API (step-16).
- No earnings, no notifications (step-18).
- No edits outside `scout-extension/**`.
- No scraping of sites whose terms forbid it; extraction runs only on the page the scout has open.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `scout-extension/src/capture/capture.ts` — `captureJob`, `mergeExtractedFields`
- `scout-extension/src/capture/hosts.ts` — `BOARD_DETECTION`, `detectJobBoard`
- `scout-extension/src/capture/jsonld.ts` — `extractJsonLdJob`
- `scout-extension/src/capture/extractors/*.ts` — per-board extractors + `index.ts` (`BOARD_EXTRACTORS`)
- `scout-extension/src/capture/types.ts` — `CapturedJob`, `JobBoard`
- `scout-extension/src/content/capture.ts` — injected IIFE
- `scout-extension/src/background/index.ts` — `CAPTURE_TAB` / `executeScript`
- `scout-extension/src/hooks/useDetectedJob.ts`
- `scout-extension/src/popup/DetectedJobPanel.tsx`
- `scout-extension/manifest.json` — add `scripting` if not present
- Fixtures: `scout-extension/fixtures/greenhouse.html`, `lever.html`, `ashby.html`, `workday.html`, `linkedin.html`, `jsonld.html`, `no-job.html`
- Tests next to each extractor plus `capture.test.ts`, `hosts.test.ts`

## Implementation notes

- Do **not** register a static `content_scripts` match list or `<all_urls>`. Side panel → `CAPTURE_TAB` message → `chrome.scripting.executeScript` into the active tab.
- Board set for this step: Greenhouse, Lever, Ashby, Workday, LinkedIn. Unknown boards may still capture if JSON-LD or DOM heuristics find a title.
- Extracted fields: `title`, `company`, `location`, `applyUrl`, `description`, `board`.
- `scripting` must be listed in `scout-extension/store/permission-justifications.md` when that file exists (step-15). If step-15 has not landed, justify `scripting` in the PR body.
- Keep extractors pure functions over a document/fixture so `bun test` does not need Chrome.

## Acceptance criteria

1. Build, typecheck, lint, format, and extractor tests pass.
2. Fixtures for each board extract the expected fields (title, company, location, apply URL).
3. Diff stays in `scout-extension/**`.
4. No broad host permissions added beyond what step-02 already needs for the Scout API / website.

## Test and validation

```bash
bun --filter scout-extension typecheck
bun --filter scout-extension test
bun --filter scout-extension lint
bun --filter scout-extension build
```

Add one fixture + test per board and a `no-job` / JSON-LD case.

Manual: load unpacked, open a Greenhouse (or fixture-equivalent) job page, open the side panel, confirm the Detected job card. On a non-job page, confirm "No job found on this page".

## Risks and soft parks

- `unknown` board still captures when a title exists. That is acceptable; do not pretend every career page is a named ATS.
- Step-17 must be able to add a board as one extractor file + fixtures + registry row.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled. Extension CI is `.github/workflows/scout-extension.yml` (step-30).

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #85), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
