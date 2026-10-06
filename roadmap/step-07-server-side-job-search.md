# Step 07: Server-side job search

- **Week:** W1
- **Status:** Done
- **Owner:** Ravi (lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(search): server-side job search (roadmap step-07)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#71](https://github.com/sid0709/Joined/pull/71) (`24e9850`)
- **Runs in parallel with step-03.** Stay out of `backend-core/auth` and `backend-core/authapi` to avoid conflicts.

## Goal

Job search, filtering, sorting, and paging happen on the server, so the browser never needs the whole catalog. The existing `GET /v1/search/jobs` response stays backward compatible for `joined-frontend`.

## Context and dependencies

Today's handler is `joined-backend/internal/httpapi/search.go` over `backend-core/jobs`. Empty criteria still return a catalog list. This step adds a real query builder, Mongo `$text` (opt-in index), filters that match the job schema, and cursor paging.

Leo's frontend already calls `/v1/search/jobs`. Do not change the frontend. Hidden-jobs feed is step-23 (`source=hidden` was reserved here). Fit score is step-36. Dedupe (step-22) later reuses `SEARCH_ENSURE_INDEX` to create `dedupe_key_active` as well.

What shipped in #71: `backend-core/jobs/search_query.go`, `SearchQuery` / `HasCriteria()`, `SEARCH_ENSURE_INDEX` in `backend-core/config` and `joined-backend/.env.example`, `platform.Open` optional `EnsureSearchIndexes`, catalog vs paged `SearchResults` with `nextCursor` / `hasMore`.

## In scope

- Server-side query: keyword text search (Mongo text index or equivalent), filters that match the job schema (location or remote, job type, seniority, salary range, posted date, company), sort (relevance, newest), cursor or page-based paging with a stable order and a max page size.
- Indexes created idempotently at startup when opted in (dev only; no production writes in this step).
- Response shape that stays backward compatible, or adds fields, so the current frontend keeps working.
- Go tests for query building, filters, paging, and limits.

## Out of scope

- No frontend changes (Leo adapts the UI later if needed).
- No hidden-jobs feed product (W2 step-23). `source=hidden` may exist as a filter but is not this step's UX.
- No fit score (W3 step-36).
- No auth changes (stay out of `auth/` and `authapi/`).
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `backend-core/jobs/search_query.go` (new) and `search_query_test.go`
- `backend-core/jobs` catalog/store helpers used by search
- `backend-core/config/config.go` — `SearchEnsureIndex()`
- `backend-core/platform/platform.go` — optional index ensure
- `joined-backend/internal/httpapi/search.go` — `parseSearchQuery` → `SearchJobs`
- `joined-backend/cmd/server/main.go` — `EnsureSearchIndex: config.SearchEnsureIndex()`
- `joined-backend/.env.example` — `SEARCH_ENSURE_INDEX`

Do not edit `packages/job-schema/**` unless a filter name is missing there (it was not required for #71).

## Implementation notes

### `GET /v1/search/jobs`

Query params: `q`, `location`, `workplace`, `employment`, `seniority`, `company`, `currency`, `sort`, `cursor`, `remote=true`, `source`, `salaryMin`, `salaryMax`, `postedDays`, `limit`.

- No criteria → existing `SearchCatalog` `{jobs, total}` (legacy cap 2000).
- With criteria (`HasCriteria()`) → `SearchResults` `{jobs, total, nextCursor?, hasMore}`.
- `sort`: `relevance` (requires `q`) or `newest` / default.
- Paging: default limit 50, max 100. Cursor format `objectIdHex:unixAnalyzedAt`.
- `sort=relevance` + `cursor` + keyword → **400** `"cursor-based paging not supported with relevance sort"`.
- `source=hidden` → scouted/hidden listings only (`SearchSourceHidden`). Used later by step-23.

Item shape (`catalogJob`) embeds `SearchJob` plus `applyLink`, `companyUrl`, `companyLogo`, `listingSource`, `hidden`, optional `companyProfile`.

### Mongo

- Collection: `JOBS_COLLECTION` (default `jobs`) in `DEST_DB`.
- Text index name `search_text`, weights: `job.title` 10, `job.company` 8, `job.skills` 5, `job.summary` 3, `job.description` 1. Created only when `SEARCH_ENSURE_INDEX` is `true`/`1`.
- Filters: `publicListingFilter()` + `$text` for keyword; escaped regex (max 200 chars) for location/company; exact workplace/employment/seniority; salary overlap on `job.pay.*`; `postedDays` on `postedAt`.

### Env

| Variable              | Default | Effect                                                                                |
| --------------------- | ------- | ------------------------------------------------------------------------------------- |
| `SEARCH_ENSURE_INDEX` | false   | At `platform.Open`, `EnsureSearchIndexes` (and, after step-22, `EnsureDedupeIndexes`) |

Only `joined-backend` passes this flag. admin-backend does not. Production is expected to create the text index out of band unless this is set in a controlled env.

## Acceptance criteria

1. `go vet` and `go test` pass for touched modules.
2. Search with keyword plus filters returns correct, paged results against local Mongo.
3. Existing frontend search still works unchanged (empty query still returns catalog).
4. Diff stays inside Ravi's lane and outside `auth/` and `authapi/`.

## Test and validation

```bash
go test ./backend-core/jobs/... -run 'Search|EnsureSearch'
go test ./backend-core/config/...
bun run vet:go
bun run ci go
```

Cover `TestBuildSearchFilter`, `TestSearchQueryPaging`, `TestSearchQueryFilters`, `TestEnsureSearchIndexesIdempotent`, `TestClampSearchLimitCapsPageSize`, hidden-source filter.

Manual: `GET http://127.0.0.1:8080/v1/search/jobs?q=engineer&limit=10` against local Mongo. Confirm `hasMore` / `nextCursor`. Confirm `?` with no params still returns `{jobs, total}`. The human runs joined-backend; do not start it from this task.

## Risks and soft parks

- Empty-query catalog path is a different code path from paged search. Do not break it.
- Relevance + cursor is intentionally unsupported.
- Step-22 will hang dedupe index creation on the same `SEARCH_ENSURE_INDEX` flag. Do not invent a second ensure flag unless Elon asks.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #71), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
