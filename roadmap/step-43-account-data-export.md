# Step 43: Account data export

- **Week:** W3, Scraper onboarding
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(auth): account data export endpoint (roadmap step-43)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

A signed-in user can download their data. Account delete already exists (`DELETE /v1/auth/account`).

## In scope

- Authenticated export endpoint next to the existing auth routes in `backend-core/authapi` / `backend-core/auth` (for example `GET /v1/auth/account/export` or `POST` that returns a job id if the payload is large).
- Bundle profile, resumes, applications, interviews, messages, and transactions the account owns (`docs/90-compliance-privacy-security.md`). JSON (+ file URLs or inline files if small). Do not include other users' PII.
- Rate limit. Do not log the payload. Tests for auth, contents, and isolation.

## Out of scope

- No frontend (Leo, step-44).
- No change to delete semantics except documenting that export is separate.
- No production data dumps.

## Acceptance criteria

1. `go vet` and `go test` pass.
2. Owner receives their data; another session cannot. Delete still works.
3. Diff stays inside Ravi's lane.
