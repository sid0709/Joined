# Step 26: Kill switches

Status: Done (merged in W2)

- **Week:** W2, Job quality
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(killswitch): runtime kill switches (roadmap step-26)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-12 merges** (shares service `main.go` wiring and config).

## Goal
Staff can switch off risky features at runtime, without a deploy, if something goes wrong at launch.

## In scope
- New `backend-core/killswitch` package: named switches (sign-up, email sending, job imports, Acorn AI calls, scout submissions, checkout), env defaults, optional Mongo override doc with a short cache.
- Middleware or helper that returns a clear 503 with a stable error code when a switch is off.
- Wire the switches in joined-backend and admin-backend; staff-only admin-backend endpoints to read and flip switches, with an audit entry.
- Note the one-line wiring for scoutwell-backend and billing for Penny.
- Go tests for defaults, override, and cache expiry.

## Out of scope
- No admin UI (Leo, later), no Scoutwell or billing edits, no flips on production data.

## Acceptance criteria
1. `go vet` and `go test` pass.
2. Flipping a switch locally blocks the feature with a 503 within the cache window and logs an audit entry.
3. Diff stays in Ravi's lane.
