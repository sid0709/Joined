# Step 27: Scout extension submission intake API

- **Week:** W2
- **Status:** Done
- **Owner:** Penny (money and Scout backend lane: `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scout): extension submission intake api (roadmap step-27)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #82 (`143ea70`)

## Goal

The Scout extension can submit captured jobs to Scoutwell safely, with the scout's session and no duplicates. One idempotency key creates one submission; a replay returns the same row.

## Context and dependencies

Can start immediately. Runs in parallel with step-05 (share-of-applies earnings); keep out of the earnings files and rebase on step-05 if the Scoutwell route file conflicts.

Reuses existing Scoutwell submission routes, `scout_submissions`, and `scout_idempotency` (`backend-core/scout`). Auth matches step-02: cookie `scoutwell_session` (override `SCOUTWELL_SESSION_COOKIE`) or `Authorization: Bearer <session token>`. The captured-job shape comes from step-13 (title, company, location, apply URL, description, board).

The extension client (`scout-extension/src/api/client.ts`, `scout-extension/src/drafts/payload.ts` `toExtensionInput()`) is Maya's lane — read only. Types in `packages/scout` are in Penny's lane and must match Go.

`docs/61-scout-api.md` still does not list `POST /v1/scout/submissions/extension` (doc gap). `KILLSWITCH_SCOUT_SUBMISSIONS` (step-26) is documented for this route but is **not** wired in scoutwell-backend today.

## In scope

- Investigate existing Scoutwell submission routes, `scout_submissions`, and `scout_idempotency` (reuse them).
- Accept the step-13 captured-job shape with validation and size limits; require `Idempotency-Key`.
- Auth from the extension with the scout session (cookie or bearer). API keys are rejected.
- CORS allowlist for configured extension origin(s) only (`EXTENSION_ORIGINS` merged with `CORS_ORIGINS`).
- Matching request and response types in `packages/scout`.
- Go tests for validation, idempotency, and auth.

## Out of scope

- No earnings or payout changes (stay out of step-05 files).
- No Stripe / billing.
- No extension product code (Maya).
- No production data writes.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `scoutwell-backend/internal/httpapi/scout.go` — `scoutSubmitExtension`, `maxExtensionBody`, idempotency
- `scoutwell-backend/internal/httpapi/server.go` — CORS merge (`Origins` + `ExtensionOrigins`)
- `scoutwell-backend/cmd/server/main.go` — `EXTENSION_ORIGINS`, `SCOUTWELL_SESSION_COOKIE`
- `scoutwell-backend/internal/httpapi/scout_extension_test.go`
- `scoutwell-backend/.env.example` — `CORS_ORIGINS`, `EXTENSION_ORIGINS`
- `backend-core/scout/submissions.go` — `SubmitFromExtension`, `extensionToSubmission`
- `backend-core/scout/validate.go` — `NormalizeExtensionInput`, field limits
- `backend-core/scout/types.go` — `ExtensionSubmissionInput`
- `backend-core/scout/idempotency.go` — `scout_idempotency`, 24h TTL
- `backend-core/scout/intake_test.go`
- `backend-core/scout/store.go` — collections + indexes
- `packages/scout/src/types.ts` — `ExtensionSubmissionInput`, `ExtensionSubmissionResponse`

Read only: `scout-extension/src/drafts/payload.ts`, `scout-extension/src/api/client.ts`, `docs/61-scout-api.md`.

## Implementation notes

**Endpoint:** `POST /v1/scout/submissions/extension`

**Auth:** Session only. Cookie `scoutwell_session` or bearer session token. API keys → 403 `forbidden`. Non-scout role → 403. Terms not accepted → 403 `terms_required`.

**Headers:**

- `Idempotency-Key` required, 1–255 chars (`httpkit.IdempotencyHeader`).
- Replay: `Idempotent-Replayed: true`.
- Success: `Location: /v1/scout/submissions/{id}`.

**Body:**

```json
{
  "title": "string",
  "company": "string",
  "location": "string",
  "apply_url": "string",
  "description": "string",
  "board": "string"
}
```

`board` is optional. Limits (`backend-core/scout/validate.go`): title 2–160, company/location 2–120, description 40–12,000 (`MinSummaryChars` / `MaxSummaryChars`), board max 80, `apply_url` must pass `ParseJobURL` (generic job-board index URLs rejected). Max body 64 KiB (`maxExtensionBody`) → 413.

**Defaults when mapped to `Submit`:** `workplace=remote`, `employment=full_time`, `equity=true`, `not_duplicate_claim=true`.

**Response:** `201` `{ "submission": <full Submission> }` — wrapped, unlike `POST /v1/scout/submissions`.

**Collections:** `scout_submissions`; `scout_idempotency` unique `{userId, route, key}`, TTL 24h on `createdAt`. Same key + different body → 409 `idempotency_key_reused`. 5xx responses are not cached.

**CORS:** `CORS_ORIGINS` + `EXTENSION_ORIGINS` (comma-separated, no wildcard). `chrome-extension://…` via `EXTENSION_ORIGINS`. Disallowed Origin on OPTIONS gets no `Access-Control-Allow-Origin`; POST from a disallowed origin still succeeds (ACAO withheld).

**Env:** `HTTP_ADDR` (default `127.0.0.1:8082`), `MONGO_URI`, `DEST_DB`, `CORS_ORIGINS`, `EXTENSION_ORIGINS`, `SCOUTWELL_SESSION_COOKIE`. Extension build-time: `VITE_SCOUT_API_HOST`, `VITE_SCOUTWELL_WEB_ORIGIN` (Maya).

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass; `bun --filter @joined/scout typecheck` passes.
2. Submitting twice with the same idempotency key creates one submission; the second response is a replay.
3. Missing key, oversized body, invalid URL, and non-scout session are rejected.
4. Diff stays in Penny's lane.

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/scout/... -count=1
go test ./scoutwell-backend/internal/httpapi/... -count=1 -run Extension
bun --filter @joined/scout typecheck
```

Keep tests for auth (cookie, bearer, API key, candidate role), CORS allow/deny, idempotency replay and conflict, validation limits, and 413.

Manual (human-run): submit a captured job from a loaded unpacked extension against local Scoutwell; submit again with the same key — one row.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- `KILLSWITCH_SCOUT_SUBMISSIONS` is not enforced on Scoutwell yet (step-26 Penny follow-up).
- `docs/61-scout-api.md` omits this route.
- CORS does not block POST from a bad Origin; it only withholds ACAO.
- Step-16 note (extension packaging): add `scripting` to `scout-extension/store/permission-justifications.md` if not already there (Maya, not this PR).

## Definition of done

PR into `stage-roadmap-w34` (this step originally landed on retired `stage-roadmap` as #82). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
