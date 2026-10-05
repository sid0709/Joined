# Step 12: Error logging

- **Week:** W1
- **Status:** Done
- **Owner:** Ravi (lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(httpkit): structured error logging (roadmap step-12)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#75](https://github.com/sid0709/Joined/pull/75) (`6b70a91`)
- **Runs in parallel with step-09 or step-11.** Touch only `backend-core/httpkit`, `backend-core/config`, and service `main.go` wiring.

## Goal

Every Go service logs errors in one structured format with request ids, and can forward errors to an error tracker when configured. A panic becomes a 500, not a crashed process.

## Context and dependencies

Shared HTTP helpers already live in `backend-core/httpkit` (`WriteError`, etc.). Services start from `joined-backend/cmd/server/main.go`, `admin-backend/cmd/server/main.go`, and `backend-core/cmd/server`. Scoutwell wiring is one line for Penny — note it, do not edit `scoutwell-backend` (Penny's lane). The tree now also has a separate `acorn-backend` Go module (`go.work`); note the same one-line `httpkit.Wrap` for Elon and do not edit `acorn-backend/**` or `acorn-frontend/**`.

W4 monitoring (step-63) is metrics/domains, not this step. Frontend error reporting is out of scope.

What shipped in #75: `httpkit.Wrap` = logging + panic recovery, `X-Request-ID` (16 hex if missing), one JSON slog line per request (`request_id`, `method`, `path`, `status`, `latency_ms`, optional `user_id`), `SENTRY_DSN` via `config.LoadErrorReporting()` that currently warns and returns `NoOpReporter` (no Sentry SDK).

## In scope

- Structured JSON logging (Go `log/slog`) with request id, route, status, latency, and user id when known, set up once in `httpkit`.
- Panic recovery middleware that logs the stack and returns 500.
- Optional error-tracker hook behind env (`SENTRY_DSN`). Off when unset; no new module unless the change is small, and flag any `go.mod` change for Elon.
- Wire it into joined-backend, admin-backend, and backend-core servers. Note the one-line wiring for scoutwell-backend (Penny) and `acorn-backend` (Elon).

## Out of scope

- No metrics or tracing (W4 step-63).
- No frontend error reporting.
- No Sentry SDK dependency unless Elon approves. A no-op + warning is acceptable.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `backend-core/httpkit/logging.go` (new) and `logging_test.go`
- `backend-core/httpkit/recovery.go` (new) and `recovery_test.go`
- `backend-core/httpkit/reporter.go` (new)
- `backend-core/config/config.go` — `LoadErrorReporting()`
- `joined-backend/cmd/server/main.go` — `httpkit.Wrap(slog.Default(), reporter, handler)`
- `admin-backend/cmd/server/main.go` — same
- `backend-core/cmd/server/routes.go` / `main.go` — same

Do not edit `backend-core/auth/**` or `jobs/**` in this PR (parallel with 09/11). Do not edit `scoutwell-backend/**`, `acorn-backend/**`, or `acorn-frontend/**`.

## Implementation notes

- `httpkit.Wrap(logger, reporter, handler)` = `Logging(Recovery(reporter, next))`.
- Request id: honor inbound `X-Request-ID` or generate 16 hex chars; echo it on the response.
- One slog record per request. On panic include `error` + `stack`.
- Recovery: if headers not sent, write **500** `{"error":"Internal server error"}`. Re-panic `http.ErrAbortHandler`.
- `SENTRY_DSN`: `NewReporter(dsn)` — if set, log a warning and return `NoOpReporter` until a real adapter is approved. Tests must not need a DSN.
- `httpkit.SetUserID` is available for handlers/middleware. Step-09 `RequireRole` does not call it yet; do not expand this PR into auth middleware unless the touch is a one-liner and step-09 has merged.

## Acceptance criteria

1. `go vet` and `go test` pass.
2. A forced panic in a test returns 500 and logs one structured line with the request id.
3. Diff stays in Ravi's lane (httpkit, config, service mains).
4. Unset `SENTRY_DSN` means no outbound tracker calls.

## Test and validation

```bash
go test ./backend-core/httpkit/...
go test ./backend-core/config/...
bun run ci go
```

Cover `TestWrapLogging`, `TestWrapPanicWithoutRequestID`, `TestWrapRePanicsErrAbortHandler`, reporter no-op when DSN empty.

Manual: hit any joined-backend route and confirm a JSON log line with `request_id` and `status`. Do not start servers from this task.

## Risks and soft parks

- Sentry is not actually wired; `SENTRY_DSN` only warns. Real adapter is a follow-up (likely step-63).
- Handlers that already `slog.Error` before `WriteError` will double-log. Acceptable.
- `user_id` is missing on most production routes until `SetUserID` is called from auth middleware.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #75), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
