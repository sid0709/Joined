# Step 28: Scout submission status and notifications API

- **Week:** W2
- **Status:** Done
- **Owner:** Penny (money and Scout backend lane: `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scout): submission status and notifications api (roadmap step-28)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #94 (`5bb628c`)

## Goal

The extension and the Scout website can ask what changed for a scout's submissions since a cursor: accepted, rejected, published, or earned. Each status change produces one notification, returned once per cursor.

## Context and dependencies

Starts after step-27 (intake) and step-05 (earnings) merge — same Scoutwell routes and earnings credit events.

Reuses collection `scout_notifications`. Writers already exist conceptually on admin decision, publish, and reward paths (`notifyDecision`, `notifyPublished`, `notifyRewardImpl` in `backend-core/scout`). This step makes the list / mark-read HTTP surface and the change-feed `since=` cursor the extension poller needs (`scout-extension/src/status/poll.ts`, Maya — read only).

Verified against code: `GET /v1/scout/notifications?since=` is the change-feed. Presence of `since` (even empty) selects oldest-first `_id > since`. Inbox mode (newest first, `cursor`) is used only when `since` is omitted.

`docs/61-scout-api.md` mentions notifications but not the `since` vs `cursor` split. Profile flags `notify_decisions` / `notify_rewards` can suppress storing those kinds.

## In scope

- Write a `scout_notifications` entry on submission status changes and on earnings credits (reuse the existing collection).
- A paged `since=<cursor>` endpoint returning notifications plus unread count, and a mark-read endpoint.
- Types in `packages/scout` (`ScoutNotification`, `NotificationPage`, `MarkReadInput`, `SubmissionChangeEvent`).
- Go tests for cursor paging, ordering, and one-notification-per-change.

## Out of scope

- No email or push sending.
- No extension or Scoutwell website product code (Maya / Leo).
- No production data writes.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `backend-core/scout/notifications.go` — `ListNotifications`, `MarkRead`, `notify*`, `SinceQuery`
- `backend-core/scout/notifications_test.go`
- `backend-core/scout/store.go` — `scout_notifications` indexes
- `backend-core/scout/admin.go`, `backend-core/scout/submissions.go`, `backend-core/scout/earnings.go` — emit notifications
- `scoutwell-backend/internal/httpapi/scout.go` — `scoutNotifications`, `scoutMarkRead`
- `scoutwell-backend/internal/httpapi/scout_notifications_test.go`
- `packages/scout/src/types.ts`, `packages/scout/src/labels.ts` (`SUBMISSION_CHANGE`)

Read only: `scout-extension/src/api/client.ts`, `scout-extension/src/status/poll.ts` (`MAX_STATUS_POLL_PAGES=20`).

## Implementation notes

**`GET /v1/scout/notifications`** — session only (no API keys).

| Mode | Query | Sort | Cursor |
| --- | --- | --- | --- |
| Change feed | `since` present (value may be `""`) | oldest first, `_id > since` | last seen notification `id` as `since` |
| Inbox | `since` absent | newest first | `cursor` + optional `limit` |

Constants: `scout.SinceQuery = "since"`, `NotificationsPath`, `MarkReadPath`. Invalid `since` (not an id) → 422 `validation_failed`.

**Response** (`NotificationPage`):

```json
{
  "data": [],
  "next_cursor": "",
  "unread_count": 0
}
```

**Notification fields:** `id`, `kind`, `tone`, `title`, `body`, `subject_id?`, `event?`, `read`, `created_at`. Internal BSON `key` dedupes change events (`event:subjectId`). Duplicate insert → ignore (`IsDuplicateKeyError`).

**Change `event` values:** `accepted`, `rejected`, `published`, `earned` (`EventAccepted`, …). Kinds include `decision`, `reward`, `level`, `payout`, `verification`. `needs_review` notices have no `event`.

**`POST /v1/scout/notifications/read`** — session only. Body `{ "ids": ["…"] }`. Empty/missing `ids` marks all unread as read. Response `204`.

**Paging:** `limit` default 25, max 100 (`defaultListLimit` / `maxListLimit` in `store.go`).

**Indexes:** `{scoutUserId, _id}`; unique partial on `key`.

**`GET /v1/scout/submissions?updated_since=`** remains a separate RFC3339 poll (docs/61). This step is notification-based.

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass; `bun --filter @joined/scout typecheck` passes.
2. A status change produces exactly one notification, returned once per `since` cursor.
3. Mark-read clears unread count for the scout who owns the rows; another scout cannot read them.
4. Diff stays in Penny's lane.

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/scout/... -count=1 -run Notification
go test ./scoutwell-backend/internal/httpapi/... -count=1 -run Notifications
bun --filter @joined/scout typecheck
```

Keep tests for: empty `?since=`, `?since={id}`, invalid since, inbox `cursor` when `since` is omitted, unread count, mark-all vs mark-ids, one notice per change key.

Manual (human-run): approve a local submission, poll `GET /v1/scout/notifications?since=`, confirm one `accepted` event, poll again with that id, confirm empty page.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- e2e-smoke is still `continue-on-error` (step-14 / step-31 area). A green PR check can hide a failed smoke suite.
- Profile flags can suppress decision/reward notifications — pollers must tolerate gaps.
- Extension poll uses `since` only (not inbox `cursor`).
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (this step originally landed on retired `stage-roadmap` as #94). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
