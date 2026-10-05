# Step 16: Scout extension draft queue and submit

Status: Done (merged in W2)

- **Week:** W2, Scout complete
- **Owner:** Maya (scout-extension lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(scout-extension): draft queue and submit (roadmap step-16)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-13 merges** (builds on the detected-job card). Uses the step-27 intake API; if step-27 has not merged yet, code against its contract behind the client interface and note it in the PR.

## Goal
A scout can save detected jobs into a draft queue, edit them, and submit them to Scout from the side panel.

## In scope
- "Save to drafts" on the detected-job card; drafts stored in `chrome.storage.local` with a stable local id and the captured fields.
- Draft list in the side panel: edit fields, delete, submit one, submit all.
- Submit through the typed Scout API client with an `Idempotency-Key` per draft, so retries never double-submit. Show per-draft states: draft, submitting, submitted, failed (with retry).
- Signed-out users can keep drafts but must sign in to submit (reuse step-02 state).
- Unit tests for the queue store and submit state machine.

## Out of scope
- No badge or notifications (step-18), no earnings view, no backend changes, no edits outside `scout-extension/**`.

## Acceptance criteria
1. Build, typecheck, lint, format, and unit tests pass.
2. Drafts survive closing the panel and restarting the browser.
3. Retrying a submit for the same draft sends the same idempotency key. Diff stays in `scout-extension/**`.
