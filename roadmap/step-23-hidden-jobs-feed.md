# Step 23: Server-side hidden-jobs feed

Status: Done (merged in W2)

- **Week:** W2, Job quality
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(search): server-side hidden-jobs feed (roadmap step-23)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after: nothing, can start now.** Runs in parallel with step-22; touch only the step-07 search query and handler files, not the dedupe files.

## Goal
Job seekers can browse "hidden jobs" (scouted jobs not found on major boards) through a server-side filtered, paged feed.

## In scope
- Investigate how scouted jobs are stored and marked today (`jobs` source field, `temp_scout_jobs`) and how the frontend shows them (read only).
- A `source=hidden` (scouted) filter on `/v1/search/jobs` plus a hidden flag in each result, using the step-07 paging and sort rules.
- Only published, active, quality-checked scouted jobs appear; pending or rejected submissions never do.
- Backward-compatible response; Go tests for the filter and visibility rules.

## Out of scope
- No frontend changes (Leo adds the tab or badge later), no Scout submission changes (Penny's lane), no fit score (W3).

## Acceptance criteria
1. `go vet` and `go test` pass.
2. Against local Mongo, the hidden filter returns only active scouted jobs, paged and sorted.
3. Diff stays in Ravi's lane and outside `auth/` and `authapi/`.
