# Step 24: Dead-link expiry

- **Week:** W2
- **Status:** Done
- **Owner:** Ravi (platform backend lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(jobs): dead-link expiry checker (roadmap step-24)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #95 (`d6d7729`)

## Goal

Jobs whose apply link is closed or dead expire automatically and drop out of search. Seekers stop seeing listings that no longer accept applications, without a staff person clicking each one.

## Context and dependencies

Search (step-07) and the hidden feed (step-23) both use `publicListingFilter()` in `backend-core/jobs`. Expired listings (`listingStatus=expired`) are already excluded once this checker writes that status. Dedupe (step-22) shares `backend-core/jobs`; this step starts after step-22 merges so expiry fields do not collide with dedupe writes.

`docs/14-job-pool-and-matching.md` describes a `jobs.reverify_open` cadence (daily for scouted/aggregated, weekly for direct) and a `job.expired` event. The shipped checker implements the cadence and status write; it does **not** emit `job.expired`. There is no company "pause reverify" flag.

The runner lives in joined-backend only, behind `JOBS_EXPIRY_CHECKER_ENABLED` (off by default). Tests use a fake HTTP transport — no network.

## In scope

- A checker that requests each active job's apply URL politely (HEAD then GET, timeout, per-host rate limit, honest user agent) and detects closed signals (404/410, redirect to a careers index, known "no longer accepting" ATS markers).
- Mark a job `expired` only after N consecutive failures across checks (N from config); record last check time and reason.
- Recheck cadence from config: daily for scouted and aggregated, weekly for direct.
- In-process goroutine behind an env flag, off by default.
- Search excludes expired jobs via the existing public listing filter.
- Go tests with a fake `http.RoundTripper`; no network in tests.

## Out of scope

- No runs against production apply URLs in this step.
- No scraping of sites whose terms forbid it.
- No frontend changes.
- No `job.expired` analytics event (docs/14 is aspirational).
- No merge to `main`. Never an `acorn*` branch.
- No live money or production data writes.

## Files and areas to touch

- `backend-core/jobs/expiry.go` — `ExpiryConfig`, `LoadExpiryConfig()`, thresholds and intervals
- `backend-core/jobs/expiry_check.go` — `LinkChecker` (HEAD then GET, signals, host limiter)
- `backend-core/jobs/expiry_run.go` — `ExpiryRunner` poll loop and `RunOnce`
- `backend-core/jobs/expiry_store.go` — `ListDueExpiryJobs`, `SaveExpiryCheck` on `jobs`
- `backend-core/jobs/listing.go` — `ListingExpired`, `TakedownCauseDeadLink = "dead_link"`
- `backend-core/jobs/expiry_test.go`, `expiry_check_test.go`, `expiry_run_test.go`
- `backend-core/config/config.go` — `JobsExpiryCheckerEnabled()`
- `backend-core/config/config_test.go`
- `joined-backend/cmd/server/main.go` — start the runner when enabled
- `joined-backend/.env.example` — `JOBS_EXPIRY_CHECKER_ENABLED`

Do not touch `backend-core/scout/`, `backend-core/billing/`, admin-backend (runner is joined-backend only), or frontends.

## Implementation notes

**No public HTTP API.** joined-backend `main` starts:

```go
expiryCfg := jobs.LoadExpiryConfig()
if expiryCfg.Enabled {
  go jobs.NewExpiryRunner(p.Jobs, expiryCfg, slog.Default()).Run(ctx)
}
```

**Master switch:** `JOBS_EXPIRY_CHECKER_ENABLED=true|1` (`config.JobsExpiryCheckerEnabled()`, default off).

**Tuning env** (`LoadExpiryConfig` in `expiry.go`):

| Variable | Default |
| --- | --- |
| `JOBS_EXPIRY_FAILURES` | `3` consecutive failures before expire |
| `JOBS_EXPIRY_TIMEOUT` | `10s` |
| `JOBS_EXPIRY_HOST_INTERVAL` | `1s` per-host polite gap |
| `JOBS_EXPIRY_POLL_INTERVAL` | `1h` |
| `JOBS_EXPIRY_BATCH` | `50` jobs per tick |
| `JOBS_EXPIRY_SCOUTED_INTERVAL` | `24h` |
| `JOBS_EXPIRY_AGGREGATED_INTERVAL` | same as scouted |
| `JOBS_EXPIRY_DIRECT_INTERVAL` | `168h` (7d) |

**Probe:** User-Agent `JoinedBot/1.0 (+job apply-link verification)`. HEAD first, GET if needed. Max 5 redirects. GET body capped at 1 MiB.

**Closed signals:** HTTP 404/410; redirect to a careers index; ATS body phrases / JSON markers (`signalATSClosed`, `signalCareersIndex`, …). GET ≥400 that is not "still open" counts as failure; 5xx records `http_5xx`.

**On expire:** `listingStatus=expired`, `takedownCause=dead_link`, `expiredAt`, preserve `previousListingStatus`. Every check updates `linkCheckFailures`, `lastLinkCheckedAt`, `linkCheckSignal`.

**Search exclusion:** `publicListingFilter()` — expired listings drop out of catalog and `source=hidden`.

**Collection:** structured `jobs` in `DEST_DB`.

**Edge cases:** One transient failure must not expire. N is config, not a magic number in the handler. Due selection uses daily/weekly cutoffs in `dueExpiryFilter`; unit tests also cover per-job `checkDue`.

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass.
2. A job that fails N checks becomes `expired` and no longer appears in search; one transient failure does not expire it.
3. Tests use a fake transport; CI never hits the network for this checker.
4. The runner stays off unless `JOBS_EXPIRY_CHECKER_ENABLED` is set.
5. Diff stays in Ravi's lane.

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/jobs/... -run 'Expiry|LinkChecker'
go test ./backend-core/config/... -run JobsExpiry
```

Keep fake-transport tests for: 404/410 expire after N, 5xx does not expire on first failure, careers-index redirect, ATS closed body, search exclusion after expire.

Manual (human-run): enable the flag against a local fixture job whose apply URL a test server returns 410. After N cycles the job is `expired` and `GET /v1/search/jobs` omits it.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- `docs/14` `job.expired` event is not emitted. A later analytics step can add it.
- Due-filter cutoffs are coarse daily/weekly, not a per-job exact interval clock.
- Runner is joined-backend only; admin-backend does not re-check links.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (this step originally landed on retired `stage-roadmap` as #95). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
