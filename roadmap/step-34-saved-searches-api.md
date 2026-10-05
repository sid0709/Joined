# Step 34: Saved searches API

- **Week:** W3
- **Status:** Done
- **Owner:** Ravi (platform backend lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(search): persist saved searches and alert hooks (roadmap step-34)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #106 (`9bbfbbc`)

## Goal

Job seekers can persist saved searches, and the backend exposes hooks a later step can use to schedule email alerts. A seeker can save, list, update, and delete their own searches; another user cannot read them. This step does not send email.

## Context and dependencies

Investigate current search query shape in `joined-backend` / `backend-core/jobs` (`GET /v1/search/jobs`, including step-23 `source=hidden`) and how `joined-frontend` search params look today (read only: `joined-frontend/lib/jobs/search.ts` `JobFilters`). Frontend UI is Leo, step-35.

Shipped package: `backend-core/savedsearch`. Routes mount on the candidate mux in `joined-backend/internal/httpapi/server.go` (`/v1/me/` behind `authapi.RequireRole(..., RoleCandidate)`). Store: `savedsearch.NewMongoStore`, `EnsureIndexes` in `joined-backend/cmd/server/main.go`. If `SavedSearches` is nil, paths 404.

Email sending is step-11's provider plus step-35 preferences. Worker integration is `Service.ListDue` / `Service.MarkAlerted` — no HTTP, no mailer in this PR.

## In scope

- Authenticated CRUD under the existing `/v1` seeker group: create, list, get, update, delete a saved search (name, query/filters, created/updated timestamps).
- An alert-schedule hook on each saved search: cadence and enabled flag stored with the record (`off` / `daily` / `weekly`). Do not send email; document the job/worker integration point for step-35 / step-11.
- Idempotent indexes. Max saved searches per account in a named constant (shipped: `MaxPerUser = 20` in `types.go` — not an env var).
- Go tests for CRUD, ownership, and limits.

## Out of scope

- No frontend (Leo, step-35).
- No real emails.
- No fit score (step-36).
- No Scout or admin changes.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `backend-core/savedsearch/types.go` — `SavedSearch`, `Filters`, `MaxPerUser`, alert constants
- `backend-core/savedsearch/service.go` — CRUD, `ListDue`, `MarkAlerted`
- `backend-core/savedsearch/handlers.go` — HTTP
- `backend-core/savedsearch/mongo.go`, `memory.go`, `store.go`
- `backend-core/savedsearch/handlers_test.go`, `service_test.go`, `mongo_test.go`
- `joined-backend/cmd/server/main.go` — Mongo store + indexes
- `joined-backend/internal/httpapi/server.go` — mount on candidate mux
- `joined-backend/internal/httpapi/session.go` — `savedSearchCurrentUser`
- `joined-backend/internal/httpapi/saved_searches_routes_test.go`

Read only: `joined-frontend/lib/jobs/search.ts`, `joined-frontend/lib/settings.ts` (`ALERT_FREQUENCIES` includes `instant`, which this API does **not** have).

## Implementation notes

**HTTP** (candidate session):

| Method | Path | Success | Body / response |
| --- | --- | --- | --- |
| GET | `/v1/me/saved-searches` | 200 | `{ "searches": SavedSearch[] }` |
| POST | `/v1/me/saved-searches` | 201 | `SavedSearch` |
| GET | `/v1/me/saved-searches/{id}` | 200 | `SavedSearch` |
| PATCH | `/v1/me/saved-searches/{id}` | 200 | `SavedSearch` |
| DELETE | `/v1/me/saved-searches/{id}` | 204 | — |

**`SavedSearch` JSON:** `id`, `userId`, `name`, `query`, `filters`, `alertFrequency`, `lastAlertedAt`, `createdAt`, `updatedAt`.

**`filters`:** `location`, `workplace`, `employment`, `seniority`, `company`, `salaryMin`, `salaryMax`, `currency`, `postedDays`, `remote`, `sort` (`newest`\|`relevance`), `source` (`""`\|`hidden`). Names match `/v1/search/jobs`.

**`alertFrequency`:** `off` \| `daily` \| `weekly`. No `instant`.

**Limits:** `MaxPerUser = 20`, `MaxNameLength = 80`, `MaxQueryLength = 200`, `MaxFilterLength = 200`, `DefaultName = "Saved search"`. `ListDue` batch `DefaultAlertBatch = 100`, cap `MaxAlertBatch = 500`. Daily interval 24h, weekly 7d.

**Mongo:** `DEST_DB` collection `saved_searches`. Indexes: `user_updated`, `alert_due`.

**Worker hook:** `Service.ListDue(ctx, now, limit)`, `Service.MarkAlerted(ctx, id, now)`. This package does not send email.

**Env:** `MONGO_URI`, `DEST_DB` via `backend-core/config`. No feature flag.

**Frontend mismatch (for step-35):** `JobFilters` uses `q` / `where` / multi-select arrays / `minPay` / `posted` enum / `visa`. API filters are single strings + `salaryMin` / `postedDays`. Map in the UI; do not change the API shape here unless Elon splits a follow-up.

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass for touched modules.
2. A seeker can save, list, update, and delete their own searches; another user cannot read them.
3. Creating more than `MaxPerUser` is rejected (single-threaded). Alert cadence persists; no email is sent.
4. Diff stays inside Ravi's lane.

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/savedsearch/...
go test ./joined-backend/internal/httpapi/... -run SavedSearch
```

Keep tests for CRUD, ownership 404, validation, alert frequency enum, `ListDue` windows, and the 20-cap.

Manual (human-run): sign in as a candidate, POST/GET/PATCH/DELETE against `/v1/me/saved-searches`, then repeat with a second session — isolation holds.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- **Non-atomic 20-saved-search cap can race.** `Create` does `CountByUser` then `Insert` — concurrent creates can exceed 20.
- **`MarkAlerted` is ID-only.** Mongo filter is `_id` only (`mongo.go`); a leaked id updates that row with no `userId` check.
- Roadmap asked for max-in-config; shipped as `MaxPerUser` const, not env.
- Settings UI has `instant`; API does not. Step-35 must reconcile.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34`. CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
