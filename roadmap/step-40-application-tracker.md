# Step 40: Application tracker

- **Week:** W3
- **Status:** Done
- **Owner:** Leo (web frontends lane: `joined-frontend/**`, `scoutwell-frontend/**`, `admin-frontend/**`, `connected-frontend/**`, `packages/google-signin/**`; UI from the external catalog package `sid-ui` — in-repo `packages/design-system` and `joined-theme` are gone after #115)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(joined-frontend): application tracker notes and reminders (roadmap step-40)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #112 (`cacb512`; follow-up `553e68d` scopes extras storage by user)

## Goal

Seekers can keep a saved stage, notes, and reminders on each application. Stage moves persist through the candidate applications API. Notes and reminder times survive refresh for that signed-in browser until a backend PATCH exists.

## Context and dependencies

Independent of steps 34–39. Applications workspace: `joined-frontend/app/(seeker)/(candidate)/applications`. Board already existed; this step added per-card notes and a reminder.

**API today** (`backend-core/candidate/applications.go`, `joined-backend/internal/httpapi/me.go` `patchApplication`):

- `GET /v1/me/applications` → `{ applications, appliedJobIds }`
- `PATCH /v1/me/applications/{id}` — `ApplicationPatch`: `columnId`, `closedReason`, `nextStep` only. **No `notes` / `remindAt`.**

Saved-board rows use synthetic id `saved:{jobId}`.

The original step said "do not invent local-only storage." #112 **does** store notes and `remindAt` in user-scoped localStorage (`joined-frontend/lib/application-extras.ts`, key `joined.application-extras:{userId}`) because the backend ignores those fields. `application-patch.ts` still types `notes` / `remindAt` and comments that the backend does not persist them. `persistFollowUp` skips the API when `savedBoardJobId(id)` is set.

A Ravi follow-up (not this PR) must extend `ApplicationPatch` + the store; then the UI can drop localStorage.

Clear extras on sign-out: `clearApplicationExtras` from `account-menu.tsx`, `remove-account.tsx`, `company-mode-coming.tsx`.

## In scope

- Per-card notes and a reminder date/time the seeker owns on the applications board.
- Persist stage moves through the existing candidate applications API (`columnId`).
- Persist notes and reminders through the API **if the fields exist**; if they do not, keep the user-scoped localStorage already shipped and document the Ravi follow-up — do not add a second storage key.
- `sid-ui` for the note editor and reminder control (already used in `application-follow-up.tsx`, `application-drawer.tsx`, `applications-workspace.tsx`). Respect the existing stage list; do not add company pipeline stages.

## Out of scope

- No company ATS board.
- No email reminder worker unless it already exists; UI can store the reminder even if send comes later.
- No Scout changes.
- No backend schema change in Leo's PR (flag Ravi separately).
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `joined-frontend/app/(seeker)/(candidate)/applications/page.tsx`
- `joined-frontend/components/applications/applications-workspace.tsx`
- `joined-frontend/components/applications/application-follow-up.tsx`, `application-reminder-banners.tsx`, `application-drawer.tsx`
- `joined-frontend/lib/application-extras.ts` — localStorage
- `joined-frontend/lib/application-patch.ts`, `application-reminders.ts`, `applications.ts`
- Tests: `application-extras.test.ts`, `application-patch.test.ts`, `application-reminders.test.ts`, `applications.test.ts`
- Backend (Ravi follow-up only): `backend-core/candidate/applications.go` `ApplicationPatch`, `joined-backend/internal/httpapi/me.go`

## Implementation notes

**Stage:** PATCH `columnId` (including saved-board flow in `me.go`). This is the part that already survives refresh across devices.

**Notes / remindAt:** write to `APPLICATION_EXTRAS_STORAGE_PREFIX` + `userId` first. Attempt API PATCH; backend currently drops unknown fields. After a backend field lands, write through and treat localStorage as cache only.

**Reminder UI:** store ISO string or null. Banners in `application-reminder-banners.ts`. No send worker in this step.

**Design system:** TextArea / DateTime / Dialog / Toast from `sid-ui`. Tokens only. Do not import a removed `@joined/design-system` path.

**Isolation:** extras **must** be user-scoped (`553e68d`). Do not use a single global key.

**Saved cards:** extras stay local; do not invent a backend id for `saved:{jobId}` here.

## Acceptance criteria

1. `bun --filter joined-frontend` typecheck, lint, and build pass.
2. Stage survives refresh via the API for the signed-in seeker.
3. Notes and reminder survive refresh for that user in that browser (user-scoped storage) until a backend PATCH exists.
4. Signing out clears extras for that user. Another user on the same browser does not see them.
5. Diff stays in Leo's lane (plus a flagged Ravi PR only if fields were added).

## Test and validation

```bash
bun test joined-frontend/lib/application-extras.test.ts
bun test joined-frontend/lib/application-patch.test.ts
bun test joined-frontend/lib/application-reminders.test.ts
bun test joined-frontend/lib/applications.test.ts
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun --filter joined-frontend build
bun run ci
```

Human-run: move a card, add a note and reminder, refresh, sign out, sign in as another user — extras stay isolated.

## Risks and soft parks

- **Notes / `remindAt` are still in user-scoped localStorage until a backend PATCH persists them.** No cross-device sync.
- Original "no local-only storage" rule was relaxed in #112 because the API fields were missing.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (#112 already merged). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
