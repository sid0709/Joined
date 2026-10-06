# Step 16: Scout extension draft queue and submit

- **Week:** W2
- **Status:** Done
- **Owner:** Maya (lane: `scout-extension/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scout-extension): draft queue and submit (roadmap step-16)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#92](https://github.com/sid0709/Joined/pull/92) (`15583de`)
- **Starts after step-13 merges** (builds on the detected-job card). Uses the step-27 intake API; if step-27 has not merged yet, code against its contract behind the client interface and note it in the PR.

## Goal

A scout can save detected jobs into a draft queue, edit them, and submit them to Scout from the side panel. Signed-out scouts can keep drafts but must sign in to submit. Retries never double-submit.

## Context and dependencies

Depends on step-13 (#85) captured-job card and step-02 (#68) session. Penny's step-27 (#82) is `POST /v1/scout/submissions/extension` with `Idempotency-Key`, body `ExtensionSubmissionInput` (`backend-core/scout/types.go`), response `{ submission: { id } }`, replay header `Idempotent-Replayed: true`. Step-18 badges count unsubmitted drafts. Step-28 is status/notifications after submit.

What shipped in #92: `chrome.storage.local` key `scout.draftQueue`, queue helpers, submit state machine (`draft` → `submitting` → `submitted` / `failed`), per-draft `Idempotency-Key` (`crypto.randomUUID()`), rotate key on field edit, `ScoutApiClient.submitExtension`, panel list with edit/delete/submit one/submit all.

Soft-park note from the brief: add `scripting` to `scout-extension/store/permission-justifications.md` if it is not already there. On this branch it is already documented (step-15 + later updates).

## In scope

- "Save to drafts" on the detected-job card; drafts stored in `chrome.storage.local` with a stable local id and the captured fields.
- Draft list in the side panel: edit fields, delete, submit one, submit all.
- Submit through the typed Scout API client with an `Idempotency-Key` per draft. Show per-draft states: draft, submitting, submitted, failed (with retry).
- Signed-out users can keep drafts but must sign in to submit (reuse step-02 state).
- Unit tests for the queue store and submit state machine.

## Out of scope

- No badge or notifications (step-18).
- No earnings view (step-20).
- No backend changes (Penny, step-27).
- No edits outside `scout-extension/**`.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `scout-extension/src/drafts/storage.ts` — `scout.draftQueue`
- `scout-extension/src/drafts/queue.ts` — `enqueueDraft`, dedupe by `applyUrl`
- `scout-extension/src/drafts/submit.ts` — state machine; rotate key on `editDraft`
- `scout-extension/src/drafts/ids.ts` — `newDraftId()`, `newIdempotencyKey()`
- `scout-extension/src/drafts/payload.ts` — `toExtensionInput()`
- `scout-extension/src/hooks/useDrafts.ts`
- `scout-extension/src/popup/DraftQueuePanel.tsx`, `DraftRow.tsx`
- `scout-extension/src/api/client.ts` — `submitExtension(input, idempotencyKey)`
- Tests: `src/drafts/queue.test.ts`, `src/api/client.test.ts`
- `scout-extension/store/permission-justifications.md` — confirm `scripting` is listed (no new permission)

## Implementation notes

### Storage

- Key: `scout.draftQueue` in `chrome.storage.local`.
- Drafts must survive closing the side panel and restarting the browser.

### Submit contract

- `POST /v1/scout/submissions/extension`
- Headers: `Idempotency-Key`, `Authorization: Bearer <scoutwell_session>`, `Content-Type: application/json`
- Body (`ExtensionSubmissionInput`): `title`, `company`, `location`, `apply_url`, `description`, optional `board`
- Response: `{ submission: { id } }`; retries of the same key may see `Idempotent-Replayed: true`
- Editing fields must rotate the idempotency key so a changed payload is a new submit
- Signed-out submit throws a clear error (`Sign in to Scout to submit.`)

### Backend min length

`NormalizeExtensionInput` enforces `MinSummaryChars` on description. The extension does not have to pre-validate that length in the UI, but a failed submit should stay `failed` with retry.

## Acceptance criteria

1. Build, typecheck, lint, format, and unit tests pass.
2. Drafts survive closing the panel and restarting the browser.
3. Retrying a submit for the same draft sends the same idempotency key.
4. Diff stays in `scout-extension/**`.
5. `scripting` is justified in `scout-extension/store/permission-justifications.md` if that file exists.

## Test and validation

```bash
bun --filter scout-extension typecheck
bun --filter scout-extension test
bun --filter scout-extension lint
bun --filter scout-extension build
```

Cover enqueue/dedupe, persist/reload, submit success stores `submissionId`, retry reuses the key, edit rotates the key, signed-out submit rejected.

Manual: capture a job, save to drafts, reload the extension, confirm the draft, sign in, submit, confirm submitted. The human runs scoutwell-backend; do not start it from this task.

## Risks and soft parks

- If step-27 is not merged, implement against the contract above and flag the missing route in the PR.
- No in-panel sync with the server submission list; only the local `submissionId` after success.
- Description min-length is enforced server-side; a short description fails submit.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #92), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
