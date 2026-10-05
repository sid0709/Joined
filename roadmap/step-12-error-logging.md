# Step 12: Error logging

- **Week:** W1, Foundations
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(httpkit): structured error logging (roadmap step-12)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Runs in parallel with step-09 or step-11.** Touch only `backend-core/httpkit`, `backend-core/config`, and service `main.go` wiring.

## Goal

Every Go service logs errors in one structured format with request ids, and can forward errors to an error tracker when configured.

## In scope

- Structured JSON logging (Go `log/slog`) with request id, route, status, latency, and user id when known, set up once in `httpkit`.
- Panic recovery middleware that logs the stack and returns 500.
- Optional error-tracker hook behind env (for example `SENTRY_DSN`). Off when unset; no new module unless the change is small, and flag any `go.mod` change for Elon.
- Wire it into joined-backend, admin-backend, and backend-core servers. Note the one-line wiring for scoutwell-backend for Penny.

## Out of scope

- No metrics or tracing (W4 monitoring), no frontend error reporting.

## Acceptance criteria

1. `go vet` and `go test` pass.
2. A forced panic in a test returns 500 and logs one structured line with the request id.
3. Diff stays in Ravi's lane.
