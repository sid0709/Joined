# Step 22: Job dedupe

- **Week:** W2
- **Status:** Done
- **Owner:** Ravi (lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(jobs): job dedupe key and merge (roadmap step-22)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#88](https://github.com/sid0709/Joined/pull/88) (`1352c1f`)
- **Starts after: nothing, can start now.** Step-07 has merged; work in new dedupe files in `backend-core/jobs` and stay out of `auth/`, `authapi/`, `httpkit/`, and `config/` (steps 09, 11, 12). Index ensure may call into `platform` the same way search does.

## Goal

The same job never shows up twice: every job gets a `dedupeKey`, and duplicates from different sources merge into one listing, keeping the higher-priority source.

## Context and dependencies

Step-07 (#71) added search and `SEARCH_ENSURE_INDEX` / `EnsureSearchIndexes` at `platform.Open`. Reuse that opt-in flag for the unique partial dedupe index rather than inventing a second env. Import already writes jobs via `backend-core/jobs` (`import_runner.go`); hook `PlanDedupeWrite` on that path. Step-24 (dead-link expiry) and step-25 (import schedule) are later and must not be implemented here.

What shipped in #88: `dedupe.go` (key + normalizers + fuzzy), `dedupe_index.go`, `dedupe_merge.go` (`PlanDedupeWrite`, `DuplicateGroups`), `dedupe_store.go`, `DedupeKey` on `storedSearchJob`, `EnsureDedupeIndexes` behind `SEARCH_ENSURE_INDEX`, dry-run CLI `admin-backend/cmd/dedupejobs` (non-dry-run exits 1).

## In scope

- `dedupe_key` = hash(company, normalized title, normalized location, canonical apply URL), with title, location, and URL normalizers (strip tracking params, case, whitespace).
- Exact-match dedupe on insert or upsert; fuzzy match (same company, title similarity above a configurable threshold, same location, posted within 30 days) merges and keeps the best source (direct > scouted > aggregated).
- Unique partial index on `dedupeKey` for active jobs, created idempotently and opt-in like `SEARCH_ENSURE_INDEX`.
- A dev-only dry-run command that reports duplicate groups without writing.
- Go tests for normalizers, key stability, and merge source priority.

## Out of scope

- No backfill or writes against production data; the dry run is the only tool for existing data.
- No import scheduling (step-25), no expiry (step-24), no frontend changes.
- No `packages/job-schema` change unless a field is missing (not required for #88).
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `backend-core/jobs/dedupe.go` (new)
- `backend-core/jobs/dedupe_index.go` (new)
- `backend-core/jobs/dedupe_merge.go` (new)
- `backend-core/jobs/dedupe_store.go` (new)
- `backend-core/jobs/dedupe_test.go` (new)
- `backend-core/jobs/catalog.go` — persist `dedupeKey`
- `backend-core/platform/platform.go` — `EnsureDedupeIndexes` when search indexes are ensured
- `admin-backend/cmd/dedupejobs/main.go` (new) — dry-run CLI
- Import save path (`import_runner.go`) — call `PlanDedupeWrite` / `upsertDeduped`

Stay out of `backend-core/auth/**`, `authapi/**`, `httpkit/**`, and prefer not to reshape `config.go` (reuse `SearchEnsureIndex()`).

## Implementation notes

### Key

- BSON/JSON field: `dedupeKey`.
- SHA-256 hex of `{company, title, location, canonicalApplyURL}` joined with `\x1f`.
- Normalizers: lowercase, trim, collapse whitespace. URL: drop `utm_*`, `gclid`, and similar tracking params, sort query keys, drop fragment.

### Fuzzy merge

- Defaults: title similarity **> 0.9** (Levenshtein on normalized titles), **±30 days** on `postedAt`, same company (ID or normalized name), same location (not “not listed”).
- Source priority: **direct > scouted > aggregated**. Higher rank replaces the existing row; equal/lower skips incoming.
- Actions: `insert` | `replace` | `skip`.
- Duplicate-key race on insert: retry `dedupeSave` once.

### Index

- Name: `dedupe_key_active`
- Unique partial on `dedupeKey` where `dedupeKey > ""` and `listingStatus` in `["", active]`
- Created by `EnsureDedupeIndexes`, bundled behind **`SEARCH_ENSURE_INDEX=true`** (same flag as step-07). No `DEDUPE_ENSURE_INDEX`.

### Dry-run CLI

```bash
go run ./admin-backend/cmd/dedupejobs -dry-run=true [-title-similarity=0.95]
```

Non-dry-run must exit 1 ("only reports duplicates"). Stdout: JSON array of `DuplicateGroup` `{reason: "exact"|"fuzzy", dedupeKey?, listings: [...]}`.

## Acceptance criteria

1. `go vet` and `go test` pass.
2. Two copies of the same job from different sources become one, keeping the higher-priority source.
3. Diff stays in Ravi's lane.
4. Dry-run reports groups and does not write.

## Test and validation

```bash
go test ./backend-core/jobs/... -run 'Dedupe|PlanDedupe|EnsureDedupe'
bun run vet:go
bun run ci go
```

Cover key stability (tracking-param URLs hash equal), fuzzy threshold, source priority replace vs skip, idempotent index ensure.

Manual: run the dry-run CLI against local Mongo only. Do not pass `-dry-run=false`. Do not run against production.

## Risks and soft parks

- Sharing `SEARCH_ENSURE_INDEX` means enabling search indexes also builds the unique dedupe index. Call that out in the PR so ops is not surprised.
- Old rows with empty `dedupeKey` recompute via `DedupeRecord.Key()`; a unique-index rollout on a dirty catalog can fail until the dry-run is reviewed.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #88), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
