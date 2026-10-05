# Step 22: Job dedupe

Status: Done (merged in W2)

- **Week:** W2, Job quality
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(jobs): job dedupe key and merge (roadmap step-22)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after: nothing, can start now.** Step-07 has merged; work in new dedupe files in `backend-core/jobs` and stay out of `auth/`, `authapi/`, `httpkit/`, and `config/` (steps 09, 11, 12).

## Goal
The same job never shows up twice: every job gets a dedupe key, and duplicates from different sources merge into one listing.

## In scope
- `dedupe_key` = hash(company, normalized title, normalized location, canonical apply URL), with title, location, and URL normalizers (strip tracking params, case, whitespace).
- Exact-match dedupe on insert or upsert; fuzzy match (same company, title similarity above a configurable threshold, same location, posted within 30 days) merges and keeps the best source (direct > scouted > aggregated).
- Unique partial index on `dedupe_key` for active jobs, created idempotently and opt-in like `SEARCH_ENSURE_INDEX`.
- A dev-only dry-run command that reports duplicate groups without writing.
- Go tests for normalizers, key stability, and merge source priority.

## Out of scope
- No backfill or writes against production data; the dry run is the only tool for existing data.
- No import scheduling (step-25), no expiry (step-24), no frontend changes.

## Acceptance criteria
1. `go vet` and `go test` pass.
2. Two copies of the same job from different sources become one, keeping the higher-priority source.
3. Diff stays in Ravi's lane.
