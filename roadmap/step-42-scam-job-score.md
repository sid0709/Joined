# Step 42: Scam job score

- **Week:** W3, Scraper onboarding
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(jobs): scam score and admin hold (roadmap step-42)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Runs in parallel with steps 34 and 36.**

## Goal

Risky jobs get a scam/fake score and are held out of the public pool for admin review.

## In scope

- Investigate scout auto-checks (`backend-core/scout` types include `ReasonScam`) and job import/publish paths in `backend-core/jobs` (read only for scout; do not edit Penny's lane).
- A scam/fake score on the job record from listing signals (payment requests, off-platform chat, crypto, implausible salary, thin company). Thresholds in config.
- Above the hold threshold: job is not returned by public search; staff can see it in admin (existing jobs/review surfaces or a small admin-backend list). Log why it was held.
- Go tests for scoring, hold vs publish, and search exclusion.

## Out of scope

- No seeker-facing "this is a scam" badge (reports are step-41; public scores stay off — `docs/32`).
- No changes in `backend-core/scout` or `billing`.

## Acceptance criteria

1. `go vet` and `go test` pass for touched modules.
2. A fixture listing that trips the threshold is held from public search and visible to staff.
3. Diff stays inside Ravi's lane.
