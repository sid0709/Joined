# Step 13: Scout extension job capture and ATS detection

- **Week:** W1, Foundations
- **Owner:** Maya (scout-extension lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(scout-extension): job capture and ats detection (roadmap step-13)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-02 merges** (shares the manifest and side panel).

## Goal

On a job posting page, the Scout extension recognizes the job board and shows the captured job in the side panel, ready to submit in a later step.

## In scope

- Content script that detects common ATS and job boards (at least Greenhouse, Lever, Ashby, Workday, and LinkedIn job pages) and extracts title, company, location, apply URL, and description text. Fall back to page metadata (JSON-LD `JobPosting`) when available.
- Side panel shows a "Detected job" card or "No job found on this page".
- Use `activeTab` and scripting on demand; add host permissions only if truly needed and justify them in the PR.
- Unit tests for each extractor with saved HTML fixtures under `scout-extension/`.

## Out of scope

- No submit to the Scout API yet, no earnings, no notifications, no edits outside `scout-extension/**`.

## Acceptance criteria

1. Build, typecheck, lint, format, and extractor tests pass.
2. Fixtures for each board extract the expected fields.
3. Diff stays in `scout-extension/**`.
