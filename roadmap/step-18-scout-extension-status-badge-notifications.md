# Step 18: Scout extension status badge and notifications

Status: Done (merged in W2)

- **Week:** W2, Scout complete
- **Owner:** Maya (scout-extension lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(scout-extension): status badge and notifications (roadmap step-18)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-16 and step-28 merge** (needs the draft queue and the submission status API).

## Goal
Scouts see at a glance how many drafts are waiting and get notified when a submitted job is accepted, rejected, or earns.

## In scope
- Toolbar badge: count of unsubmitted drafts; a distinct state for "signed out" and "error".
- Background poll (`chrome.alarms`, modest interval) of the step-28 status and notifications endpoint; store last-seen cursor.
- Chrome notifications for status changes, each opening the side panel or the Scout website on click. A settings toggle to turn notifications off.
- Add the `alarms` and `notifications` permissions only, justified in the PR and in `scout-extension/store/`.
- Unit tests for badge state and notification de-duplication.

## Out of scope
- No push service or backend changes, no edits outside `scout-extension/**`.

## Acceptance criteria
1. Build, typecheck, lint, format, and unit tests pass.
2. The same status change never notifies twice.
3. Diff stays in `scout-extension/**`.
