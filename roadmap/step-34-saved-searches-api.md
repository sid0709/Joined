# Step 34: Saved searches API

- **Week:** W3, Scraper onboarding
- **Owner:** Ravi (lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(search): persist saved searches and alert hooks (roadmap step-34)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

Job seekers can persist saved searches, and the backend exposes hooks a later step can use to schedule email alerts.

## In scope

- Investigate current search query shape in `joined-backend` / `backend-core/jobs` and how `joined-frontend` search params look today (read only).
- Authenticated CRUD under the existing `/v1` seeker group: create, list, get, update, delete a saved search (name, query/filters, created/updated timestamps).
- An alert-schedule hook on each saved search: cadence and enabled flag stored with the record (for example daily/weekly/off). Do not send email in this step; document the job/worker integration point for step-35 / step-11's sender.
- Idempotent indexes. Max saved searches per account in config, not a magic number in handlers.
- Go tests for CRUD, ownership, and limits.

## Out of scope

- No frontend (Leo, step-35).
- No real emails. No fit score. No Scout or admin changes.

## Acceptance criteria

1. `go vet` and `go test` pass for touched modules.
2. A seeker can save, list, update, and delete their own searches; another user cannot read them.
3. Diff stays inside Ravi's lane.
