# Step 18: Scout extension status badge and notifications

- **Week:** W2
- **Status:** Done
- **Owner:** Maya (lane: `scout-extension/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scout-extension): status badge and notifications (roadmap step-18)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#100](https://github.com/sid0709/Joined/pull/100) (`1b5db58`)
- **Starts after step-16 and step-28 merge** (needs the draft queue and the submission status API).

## Goal

Scouts see at a glance how many drafts are waiting and get a desktop notification when a submitted job is accepted, rejected, or earns. The same status change never notifies twice.

## Context and dependencies

Depends on step-16 (#92) draft queue (`scout.draftQueue`) and Penny's step-28 (#94) notifications API. **Verify against code:** the notifications endpoint is `GET /v1/scout/notifications?since=` (`ScoutApiClient.listNotifications`, query key `since`; `backend-core/scout/notifications.go`; `scoutwell-backend` `scoutNotifications`). That matches the drafted contract.

Badge uses step-02 auth states (signed-out / error). Store justifications in `scout-extension/store/permission-justifications.md` must gain `alarms` and `notifications`.

What shipped in #100: toolbar badge (`waitingDraftCount`, `?` signed-out, `!` error, cap `99+`), `chrome.alarms` `scout.status-poll` every 1 minute, cursor in `scout.statusPoll`, dedupe keys, desktop notifications for `accepted` / `rejected` / `earned`, settings toggle `scout.desktopNotifications` (default true).

## In scope

- Toolbar badge: count of unsubmitted drafts; a distinct state for "signed out" and "error".
- Background poll (`chrome.alarms`, modest interval) of the step-28 status and notifications endpoint; store last-seen cursor.
- Chrome notifications for status changes. A settings toggle to turn notifications off.
- Add the `alarms` and `notifications` permissions only, justified in the PR and in `scout-extension/store/`.
- Unit tests for badge state and notification de-duplication.

## Out of scope

- No push service or backend changes.
- No edits outside `scout-extension/**`.
- No earnings dashboard (Leo, step-20).
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `scout-extension/src/badge/appearance.ts` — `toolbarBadgeAppearance()`, `waitingDraftCount()`
- `scout-extension/src/badge/apply.ts` — `applyToolbarBadge()`
- `scout-extension/src/status/alarm.ts` — `STATUS_POLL_ALARM = "scout.status-poll"`
- `scout-extension/src/status/poll.ts` — `listNotifications(since)`
- `scout-extension/src/status/dedupe.ts` — `planStatusNotifications()`, `notificationDedupeKey()`
- `scout-extension/src/status/notify.ts` — `chrome.notifications.create`
- `scout-extension/src/status/types.ts`
- `scout-extension/src/settings/desktopNotifications.ts`
- `scout-extension/src/popup/NotificationSettings.tsx`
- `scout-extension/src/api/client.ts` — `listNotifications(since)` with `SINCE_QUERY = "since"`
- `scout-extension/src/background/index.ts` — alarm, cookie, and storage listeners
- `scout-extension/manifest.json` — `alarms`, `notifications`
- `scout-extension/store/permission-justifications.md` — add those two
- Tests: `src/status/*.test.ts`, `src/badge/*.test.ts`, `settings/desktopNotifications.test.ts`

## Implementation notes

### Badge

- Unsubmitted drafts → numeric count; `99+` cap.
- Signed out → `?`. Error → `!`.
- Refresh on status poll, draft storage changes, and cookie changes.

### Poll

- Alarm: `scout.status-poll`, `periodInMinutes: 1`.
- `GET /v1/scout/notifications?since=<cursor>` — confirmed in client and backend.
- Storage key `scout.statusPoll`: `{ since, seenKeys, bootstrapped }`.
- Bootstrap skips the initial backlog so installing the extension does not dump old events.
- Desktop-notifiable events: `accepted`, `rejected`, `earned` (not `published`).

### Toggle

- `chrome.storage.local` key `scout.desktopNotifications`, default **true**.
- Server profile flags `notify_decisions` / `notify_rewards` are **not** wired to this toggle. Backend still filters in-app notifications on insert. Do not expand this PR into profile PATCH.

### Click behavior

Roadmap asked that a notification click open the side panel or the Scout website. **Shipped #100 does not register `chrome.notifications.onClicked`.** Treat click-to-open as a follow-up, or implement it here if still missing when doing this work.

Do not call `POST /v1/scout/notifications/read` from the extension (server unread inbox is a website concern).

## Acceptance criteria

1. Build, typecheck, lint, format, and unit tests pass.
2. The same status change never notifies twice.
3. Diff stays in `scout-extension/**`.
4. `alarms` and `notifications` are justified in `store/permission-justifications.md`.

## Test and validation

```bash
bun --filter scout-extension typecheck
bun --filter scout-extension test
bun --filter scout-extension lint
bun --filter scout-extension build
```

Cover badge appearance for signed-out / error / count / 99+, poll cursor advance, bootstrap skip, dedupe of the same event, toggle off suppresses `notifications.create`.

Manual: queue a draft (badge ≥ 1), sign out (badge `?`), sign in, wait for a poll against a local notification, confirm one desktop notification only.

## Risks and soft parks

- Notification click does not open the side panel or Scoutwell (`onClicked` missing). Record as a follow-up.
- Poll interval is fixed at 1 minute, not configurable.
- Extension does not mark notifications read on the server.
- Server `notify_*` flags are unused by the desktop toggle.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #100), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
