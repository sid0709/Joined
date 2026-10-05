# Step 17: Scout extension more ATS boards

Status: Done (merged in W2)

- **Week:** W2, Scout complete
- **Owner:** Maya (scout-extension lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(scout-extension): detect more ats boards (roadmap step-17)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-13 merges** (extends its extractor set). Can run in parallel with step-16 if it touches only extractor files and fixtures.

## Goal
The extension recognizes the next tier of ATS and job boards, so scouts can capture jobs from more company career pages.

## In scope
- New extractors following the step-13 pattern for at least SmartRecruiters, iCIMS, Workable, BambooHR, Jobvite, and Recruitee.
- A board-detection registry (URL pattern plus DOM signature) so adding a board is one file plus one fixture.
- Saved HTML fixtures and unit tests for each new board, including one "not a job page" fixture per board.

## Out of scope
- No scraping of sites whose terms forbid it; extraction runs only on the page the scout has open.
- No submit, queue, or UI changes beyond board name display, no edits outside `scout-extension/**`.

## Acceptance criteria
1. Build, typecheck, lint, format, and extractor tests pass.
2. Each new board's fixture extracts title, company, location, and apply URL.
3. Diff stays in `scout-extension/**`.
