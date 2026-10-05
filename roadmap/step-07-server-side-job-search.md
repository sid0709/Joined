# Step 07: Server-side job search

- **Week:** W1, Foundations
- **Owner:** Ravi (lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap`
- **PR title:** `roadmap step-07: server-side job search`
- **Runs in parallel with step-03.** Keep out of `backend-core/auth` and `backend-core/authapi` to avoid conflicts.

## Goal

Job search, filtering, sorting, and paging happen on the server, so the browser never needs the whole catalog.

## In scope

- Investigate the current `/v1/search/jobs` handler in `joined-backend` and `backend-core/jobs`, and how `joined-frontend` uses it today (read only).
- Server-side query: keyword text search (Mongo text index or equivalent), filters that match the job schema (location or remote, job type, seniority, salary range, posted date, company), sort (relevance, newest), cursor or page-based paging with a stable order and a max page size.
- Indexes created idempotently at startup or through a documented migration helper (dev only; no production writes in this step).
- Response shape that stays backward compatible, or adds a versioned field, so the current frontend keeps working.
- Go tests for query building, filters, paging, and limits.

## Out of scope

- No frontend changes (Leo adapts the UI in a later step if needed).
- No hidden-jobs feed (W2), no fit score (W3).
- No auth changes.

## Acceptance criteria

1. `go vet` and `go test` pass for touched modules.
2. Search with keyword plus filters returns correct, paged results against local Mongo.
3. Existing frontend search still works unchanged.
4. Diff stays inside Ravi's lane and outside `auth/` and `authapi/`.
