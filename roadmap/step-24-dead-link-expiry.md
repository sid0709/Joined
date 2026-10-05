# Step 24: Dead-link expiry

Status: Done (merged in W2)

- **Week:** W2, Job quality
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(jobs): dead-link expiry checker (roadmap step-24)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-22 merges** (same `backend-core/jobs` package).

## Goal
Jobs whose apply link is closed or dead are expired automatically and drop out of search.

## In scope
- A checker that requests each active job's apply URL politely (HEAD then GET, timeout, per-host rate limit, honest user agent) and detects closed signals (404/410, redirect to a careers index, known "no longer accepting" markers per ATS).
- Mark a job `expired` only after N consecutive failures across checks (N in config); record last check time and reason.
- Recheck cadence from config (daily for scouted and aggregated, weekly for direct). Runs in-process behind an env flag, off by default.
- Search excludes expired jobs. Go tests with a fake HTTP transport; no network in tests.

## Out of scope
- No runs against production data in this step, no scraping of sites whose terms forbid it, no frontend changes.

## Acceptance criteria
1. `go vet` and `go test` pass.
2. A job that fails N checks becomes expired and no longer appears in search; one transient failure does not expire it.
3. Diff stays in Ravi's lane.
