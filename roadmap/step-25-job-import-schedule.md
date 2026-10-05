# Step 25: Job import schedule

Status: Done (merged in W2)

- **Week:** W2, Job quality
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(jobs): scheduled job import runner (roadmap step-25)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-22 merges** (imports go through dedupe).

## Goal
Permitted job feeds import on a schedule, through normalize and dedupe, with a run log staff can see.

## In scope
- Investigate the current import and `temp_jobs` migration path (read first, reuse what exists).
- A scheduler that runs each configured source on its interval, with a lock so only one instance runs a source at a time, and per-run stats (fetched, new, merged, rejected, errors).
- Only permitted sources (ATS public board APIs, partner or employer feeds); a source registry with an enabled flag.
- A read-only admin-backend endpoint listing recent runs. Disabled by default via env; respects the step-26 import kill switch if merged.
- Go tests with fake sources.

## Out of scope
- No scraping of sites whose terms forbid it, no new production sources turned on, no admin UI (Leo, later).

## Acceptance criteria
1. `go vet` and `go test` pass.
2. A fake source run locally inserts new jobs once and merges repeats on the next run.
3. Diff stays in Ravi's lane.
