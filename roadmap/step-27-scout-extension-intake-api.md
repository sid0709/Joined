# Step 27: Scout extension submission intake API

Status: Done (merged in W2)

- **Week:** W2, Scout complete
- **Owner:** Penny (money and Scout backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(scout): extension submission intake api (roadmap step-27)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after: nothing, can start now.** Runs in parallel with step-05; keep out of the earnings files and rebase on step-05 if the Scoutwell route file conflicts.

## Goal
The Scout extension can submit captured jobs to Scoutwell safely, with the scout's session and no duplicates.

## In scope
- Investigate the existing Scoutwell submission routes, `scout_submissions`, and `scout_idempotency` (reuse them).
- Accept the step-13 captured-job shape (title, company, location, apply URL, description text, board) with validation and size limits; require an `Idempotency-Key`.
- Auth from the extension with the scout session (cookie or bearer, matching step-02); CORS allowlist for the configured extension origin(s) only.
- Matching request and response types in `packages/scout`. Go tests for validation, idempotency, and auth.

## Out of scope
- No earnings or payout changes, no Stripe, no extension code, no production data writes.

## Acceptance criteria
1. `go vet` and `go test` pass; TS typecheck passes for `packages/scout`.
2. Submitting twice with the same idempotency key creates one submission.
3. Diff stays in Penny's lane.
