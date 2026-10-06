# Step 23: Server-side hidden-jobs feed

- **Week:** W2
- **Status:** Done
- **Owner:** Ravi (platform backend lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(search): server-side hidden-jobs feed (roadmap step-23)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #91 (`cf6f411`)

## Goal

Job seekers can browse "hidden jobs" (scouted jobs that are not on major boards) through a server-side filtered, paged feed. Search already existed from step-07; this step adds a `source=hidden` filter and a `hidden` flag on each result so a later frontend can show a Hidden tab without client-side guessing.

## Context and dependencies

Hidden jobs are scouted listings. Scoutwell writes pending captures into `temp_scout_jobs` (`backend-core/jobs/scouted.go`, `ScoutedSource = "scoutwell"`, `scoutedJobType = "scouted"`). Only published rows in the structured `jobs` collection (`DEST_DB` / `JOBS_COLLECTION`) belong in search. Pending or rejected submissions must never appear.

This step depends on step-07 (server-side job search, merged). It ran in parallel with step-22 (dedupe); the hidden-feed change stays in the search query and handler files, not the dedupe files. Step-24 later expires dead apply links and drops those rows from the same public filter. Step-34 saved-search `Filters.Source` round-trips `"hidden"` with this query. Leo's frontend still loads the unfiltered catalog today (`joined-frontend/lib/jobs/catalog.ts` `loadSearchCatalog()`) and filters client-side on `job.source === "scouted"` (`job-filter-toolbar.tsx`); the API field `hidden` is not yet on `joined-frontend/lib/jobs/types.ts`. That frontend wiring is a later Leo step, not this one.

Product context: `docs/11-platform-job-hunter.md` (hidden-jobs filter), `docs/13-platform-scout.md` (scouted = hidden), `docs/14-job-pool-and-matching.md` (sources table).

## In scope

- Investigate how scouted jobs are stored and marked (`jobs` `source` / `listingSource`, `temp_scout_jobs`) and how the frontend shows them (read only).
- A `source=hidden` filter on `GET /v1/search/jobs` using step-07 paging and sort (`newest` default, `relevance` when `q` is set).
- A `hidden` boolean on each catalog/search result when `job.source` is `"scouted"` or `"scoutwell"`, or the document `source` is `"scoutwell"`.
- Only published, active, quality-checked scouted jobs appear. `publicListingFilter()` keeps `listingStatus` in `{nil, "", "active"}` and excludes `pending_review`, `draft`, `removed`, and `expired`.
- Backward-compatible JSON (camelCase, matching `joined-frontend/lib/jobs/types.ts` field names).
- Go tests for the filter, visibility rules, paging, sort, and HTTP query parsing.

## Out of scope

- No frontend changes (Leo adds the tab or badge later). Do not edit `joined-frontend/**`.
- No Scout submission, earnings, or payout changes (Penny's lane: `backend-core/scout/**`, `scoutwell-backend/**`).
- No fit score (step-36 / W3).
- No merge to `main`. Never open a PR into an `acorn*` branch.
- No live production data writes.

## Files and areas to touch

- `backend-core/jobs/search_query.go` — `SearchSourceHidden = "hidden"`, `hiddenSourceFilter()`, `listingMatchesSearch()`, `SearchJobs()`
- `backend-core/jobs/catalog.go` — `catalogJob.Hidden`, `CatalogJob()`, `ListCatalog()`
- `backend-core/jobs/search_hidden_test.go` — filter, paging, sort, JSON shape (new)
- `backend-core/jobs/scouted.go` — read-only context for `ScoutedSource` / `temp_scout_jobs`
- `joined-backend/internal/httpapi/search.go` — `GET /v1/search/jobs`, `parseSearchQuery()` reads `source`
- `joined-backend/internal/httpapi/search_test.go` — HTTP query parsing for `source=hidden`
- `joined-backend/internal/httpapi/server.go` — existing route registration (do not add a second search route)

Do not touch `auth/`, `authapi/`, `backend-core/scout/`, `backend-core/billing/`, or frontend apps.

## Implementation notes

**Endpoint:** `GET /v1/search/jobs` on joined-backend (`HTTP_ADDR` default `127.0.0.1:8080`).

**Query params** (existing `parseSearchQuery`): `q`, `location`, `workplace`, `employment`, `seniority`, `company`, `currency`, `sort`, `cursor`, `remote=true`, `source`, `salaryMin`, `salaryMax`, `postedDays`, `limit`.

**Routing:**

- No criteria → `ListCatalog()` → `{ "jobs": [...], "total": number }` (cap `maxSearchCatalog = 2000`).
- Any criteria, including `source=hidden` alone → `SearchJobs()` → `{ "jobs", "total", "nextCursor", "hasMore" }`.

**Hidden filter:** case-insensitive match on `"hidden"`. Mongo `$or`: `job.source` ∈ `{ "scouted", "scoutwell" }` OR top-level `source` = `"scoutwell"`. Combined with `publicListingFilter()`.

**`hidden` flag:** `isHiddenJob(jobSource, listingSource)` — true for scouted/scoutwell sources as above.

**Paging/sort constants:** `defaultPageSize=50`, `maxPageSize=100`. Sorts: `newest` (default), `relevance` (requires `q`; cursor + relevance → 400).

**Collections:** `jobs` in `DEST_DB` (published index). `temp_scout_jobs` is the pre-publish Scout queue and is not in this feed.

**Index env:** `SEARCH_ENSURE_INDEX=true` on joined-backend creates the text index at startup (`backend-core/config/config.go`). Not hidden-specific.

**Edge cases:** `source=HIDDEN` must work (case-insensitive). Legacy rows with empty `listingStatus` stay public. Analyzed path may store `job.source` as `"scoutwell"` while `PublishScouted` uses `"scouted"` — both must match.

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass (or equivalent `go vet` / `go test` on touched modules).
2. Against local Mongo, `GET /v1/search/jobs?source=hidden` returns only active scouted jobs, paged and sorted.
3. Pending, rejected, draft, removed, and expired scouted jobs are absent.
4. Each matching result has `"hidden": true`. Unfiltered catalog responses stay backward-compatible.
5. Diff stays in Ravi's lane and outside `auth/`, `authapi/`, `backend-core/scout/`, `backend-core/billing/`, and all frontends.

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/jobs/... -run 'Hidden|SearchQuery|SearchResultsJSON'
go test ./joined-backend/internal/httpapi/... -run TestParseSearchQuery
```

Add (or keep) tests in `backend-core/jobs/search_hidden_test.go` and `joined-backend/internal/httpapi/search_test.go` for: `source=hidden` / `source=HIDDEN`, public-status only, paging, sort, and JSON `hidden` field.

Manual (human-run local services; the agent does not start servers): `GET /v1/search/jobs?source=hidden` against local Mongo with a published scouted job and a pending `temp_scout_jobs` row. Only the published job appears.

Repo CI: `bun run ci` (lint, format, typecheck, dependencies, test, go, build, commit-conventions). Confirm every job is green, not cancelled.

## Risks and soft parks

- Frontend still does not call `source=hidden` or read the `hidden` field. Leo must wire that later; do not sneak it in here.
- Step-24 expiry reuses `publicListingFilter()`; expired hidden jobs drop out automatically once that checker is on.
- Infra: GitHub Actions runner starvation can cancel jobs. "All checks passed" can hide cancelled jobs — require real green.

## Definition of done

PR into `stage-roadmap-w34` (this step originally landed on retired `stage-roadmap` as #91). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
