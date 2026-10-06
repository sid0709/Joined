# Step 25: Job import schedule

- **Week:** W2
- **Status:** Done
- **Owner:** Ravi (platform backend lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(jobs): scheduled job import runner (roadmap step-25)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #97 (feature commits `805edfa`, `9459615`; `#97` is not in the commit subject)

## Goal

Permitted job feeds import on a schedule, through normalize and dedupe, with a run log staff can read. New jobs land once; repeats merge. Nothing scrapes a site whose terms forbid it, and no new production source turns on by default.

## Context and dependencies

Starts after step-22 (dedupe) merges: the runner calls `PlanDedupeWrite` / `DefaultDedupeConfig` / `DedupePool` in `backend-core/jobs`. Imports write into `DEST_DB` / `DEST_COLLECTION` (`temp_jobs` by default), which is the existing Athens → temp_jobs staging path used by admin migration (`POST /v1/migration/jobs-copy`). Analyze/publish stays a separate step.

If step-26 is merged, the runner respects the `job_imports` kill switch (`RunnerOptions.Gate` / `jobImportsGate` in `admin-backend/cmd/server/main.go`). `RegisterImportKillSwitch` exists for tests; production wires the gate through `killswitch.On(..., JobImports)`.

Admin UI for the run list is Leo, later (step-54 quality/sources). No new production sources in this step.

## In scope

- Investigate the current import and `temp_jobs` migration path (read first, reuse what exists).
- A scheduler that runs each configured source on its interval, with a lock so only one instance runs the scheduled import at a time, and per-run stats (fetched, inserted, replaced, skipped, failed).
- A source registry with an enabled flag. Production source: `athens` (reads `SOURCE_DB` / `SOURCE_COLLECTION`). `fake` is tests only.
- A read-only admin-backend endpoint listing recent runs.
- Disabled by default via env (`JOB_IMPORT_ENABLED`). Respects the step-26 import kill switch when present.
- Go tests with `FakeSource`.

## Out of scope

- No scraping of sites whose terms forbid it.
- No new production sources turned on.
- No admin UI (Leo, later).
- No merge to `main`. Never an `acorn*` branch.
- No live production import against real partner feeds unless the human already configured a permitted local source.

## Files and areas to touch

- `backend-core/config/job_import.go` — `LoadJobImport()`, collection name constants
- `backend-core/jobs/import.go` — `ImportRun`, `ImportRunsResponse`, status constants
- `backend-core/jobs/import_runner.go` — `Runner`, dedupe + stage loop
- `backend-core/jobs/import_schedule.go` — `Runner.Start()` ticker
- `backend-core/jobs/import_source.go` — `SourceRegistry`, `AthensSource`, `FakeSource`
- `backend-core/jobs/import_lock.go` — `StoreImportLock`, doc id `scheduled-job-import`
- `backend-core/jobs/import_store.go` — `StoreRunLog`, `Stage()` → `temp_jobs`
- `backend-core/jobs/import_killswitch.go` — `ImportKillSwitch`, `RegisterImportKillSwitch`
- `admin-backend/cmd/server/main.go` — registry, runner goroutine, HTTP options
- `admin-backend/internal/httpapi/import_runs.go` — `GET /v1/jobs/import-runs`
- `admin-backend/internal/httpapi/import_runs_test.go`
- `admin-backend/.env.example` — `SOURCE_DB`, `DEST_COLLECTION=temp_jobs` (add `JOB_IMPORT_*` if missing)

Do not touch `backend-core/scout/`, `backend-core/billing/`, or frontends.

## Implementation notes

**Admin endpoint:** `GET /v1/jobs/import-runs`. Auth: `ADMIN_API_TOKEN` bearer (all admin routes except health/public analyzer/crawler) plus staff Google session when configured (`requireStaff()`).

**Response** (`jobs.ImportRunsResponse`):

```json
{
  "enabled": false,
  "sources": [{ "id": "athens", "enabled": false }],
  "runs": []
}
```

**`ImportRun` fields:** `id`, `startedAt`, `endedAt`, `status`, `reason?`, `sources[]` (per-source stats), `totals` (`fetched`, `inserted`, `replaced`, `skipped`, `failed`).

**Run statuses:** `disabled`, `locked`, `ok`, `failed`, `partial`, `killed`.

**Env** (`backend-core/config/job_import.go`):

| Variable                      | Default / behavior                  |
| ----------------------------- | ----------------------------------- |
| `JOB_IMPORT_ENABLED`          | `true`/`1` to enable the runner     |
| `JOB_IMPORT_INTERVAL`         | `1h`                                |
| `JOB_IMPORT_SOURCES`          | comma list; empty → all sources off |
| `JOB_IMPORT_RUNS_COLLECTION`  | `job_import_runs`                   |
| `JOB_IMPORT_LOCKS_COLLECTION` | `job_import_locks`                  |
| `JOB_IMPORT_RECENT_LIMIT`     | `20`                                |
| `JOB_IMPORT_TIMEOUT`          | `20m` (run + lock TTL)              |

**Pipeline:** fetch → `ImportRecord.Normalize()` → `PlanDedupeWrite` → `Store.Stage()` upserts into `DEST_DB` / `DEST_COLLECTION` (`temp_jobs`) on `(source, sourceRef)`.

**Lock:** single document `_id: "scheduled-job-import"` in `job_import_locks`; in-process mutex + Mongo CAS. This is one global lock for the whole scheduled run (not a per-source lock).

**Kill switch:** when `job_imports` is off, run status is `killed` and per-source reason is `"import kill switch blocked this source"`. Admin migration `jobs-copy` / `companies-copy` also honor the same switch.

**Scheduler host:** admin-backend only (`go importRunner.Start(...)`). Unset `JOB_IMPORT_ENABLED` → `Start()` returns immediately; a direct `Run()` still appends `ImportRunDisabled`.

**Edge cases:** Athens import reads upstream Athens (`SOURCE_DB`), writes `temp_jobs`. It does not publish into the search `jobs` index. Repeats must merge, not duplicate.

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass.
2. A fake source run locally inserts new jobs once and merges repeats on the next run.
3. The admin list endpoint returns recent runs to staff and 401/403 without staff auth.
4. The runner is off by default and no-ops when the import kill switch is off.
5. Diff stays in Ravi's lane.

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/jobs/... -run Import
go test ./backend-core/config/... -run JobImport
go test ./admin-backend/internal/httpapi/... -run ImportRuns
```

Keep `FakeSource` tests for insert-then-merge, lock contention (`locked` status), disabled run, and kill-switch `killed`. HTTP tests for staff auth and payload shape.

Manual (human-run): `JOB_IMPORT_ENABLED=true JOB_IMPORT_SOURCES=athens` against a local Athens DB, then `GET /v1/jobs/import-runs` with the admin token.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- `JOB_IMPORT_*` vars are missing from some `.env.example` files; operators must read `job_import.go`.
- Roadmap said "one instance per source"; code uses one global lock for the scheduled run.
- No admin UI. Step-54 may add source management on top of this log.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (this step originally landed on retired `stage-roadmap` as #97). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
