# Step 54: Admin sources, quality, earnings report, and disputes

- **Week:** W3
- **Status:** Planned
- **Owner:** Ravi + Penny (split if large; see below)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(admin): sources quality earnings disputes (roadmap step-54)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

Prefer **2–3 small PRs** if this is large. Suggested split (adjust counts with Sid):

| Substep | Slice                      | Owner | Suggested title                                              |
| ------- | -------------------------- | ----- | ------------------------------------------------------------ |
| 54a     | Source kill switches       | Ravi  | `feat(admin): source kill switches (roadmap step-54a)`       |
| 54b     | Job quality dashboard APIs | Ravi  | `feat(admin): job quality dashboard apis (roadmap step-54b)` |
| 54c     | Earnings report            | Penny | `feat(scout): earnings report (roadmap step-54c)`            |
| 54d     | Disputes                   | Penny | `feat(scout): payout disputes queue (roadmap step-54d)`      |

## Goal

Staff can disable a job source, see quality aggregates, pull an earnings report, and work payout disputes. Pixel-perfect dashboards do not block the W3 freeze.

## Context and dependencies

Depends on W2 ingest/quality and W3 hold/payout work:

- Kill switches ([step-26](step-26-kill-switches.md), Done #98): `backend-core/killswitch` names `signup`, `email`, `job_imports`, `acorn_ai`, `scout_submissions`, `checkout`. Admin: `GET /v1/admin/kill-switches`, `PUT /v1/admin/kill-switches/{name}`. Env defaults: `KILLSWITCH_*`. Global `job_imports` is not per-source.
- Job import ([step-25](step-25-job-import-schedule.md), Done #97): `backend-core/jobs/import.go` `AthensSourceID = "athens"`, `import_source.go` `SourceRegistry`. Admin read: `GET /v1/jobs/import-runs`. Env: `JOB_IMPORT_ENABLED`, `JOB_IMPORT_SOURCES`, `JOB_IMPORT_INTERVAL`, …
- Scam hold ([step-42](step-42-scam-job-score.md), Done #110): `backend-core/jobscam`, `JOB_SCAM_HOLD_THRESHOLD` (default 40), `GET /v1/admin/scam-jobs`, `POST /v1/admin/scam-jobs/{id}/review`. No hold-rate dashboard API yet.
- Disputes queue already exists as staff cases: `GET /v1/admin/cases?queue=disputes`, `QueueDisputes = "disputes"` in `backend-core/staff/cases.go`. UI: `admin-frontend` Trust cases. **Payout** dispute path (evidence, clawback unsettled earnings) is not filled.
- Scout earnings today are scout-facing: `GET /v1/scout/earnings`, `/v1/scout/earnings/summary`. No staff export.

Leo UI can follow later. Do not block on screens.

## In scope

- **Sources (Ravi):** per-source enable/disable on top of `backend-core/killswitch` + import registry. Public search stops using a killed source. Admin routes + tests.
- **Quality dashboard APIs (Ravi):** read-only aggregates for recent jobs (hold rate from step-42, dead-link from [step-24](step-24-dead-link-expiry.md) #95, dupes from [step-22](step-22-job-dedupe.md) #88).
- **Earnings report (Penny):** staff-exportable scout earnings summary (period, totals, holds) from `backend-core/scout`.
- **Disputes (Penny):** fill the Scout/payout dispute path on `queue=disputes`: open, evidence, decide, clawback unsettled earnings. Staff approval stays.

## Out of scope

- No product seeker UI. No live payouts. No merge to `main`.
- No pixel-perfect admin dashboards in this step.

## Files and areas to touch

**54a / 54b (Ravi):**

- `backend-core/jobs/import_source.go`, `backend-core/config/job_import.go`
- `backend-core/killswitch/` — only if a per-source name is added; do not overload `job_imports` without a list
- `admin-backend/internal/httpapi/` — source toggle + quality handlers (new)
- Search path that filters killed sources (`joined-backend` search / `backend-core` jobs)

**54c / 54d (Penny):**

- `backend-core/scout/` — report + clawback
- `admin-backend/internal/httpapi/scout_admin.go` — `GET /v1/admin/scout/earnings/report` (new)
- `backend-core/staff/cases.go` — payout dispute decision hooks
- `packages/scout` types if the report JSON is shared

## Implementation notes

**Sources:** store `enabled` per `sourceID` (start with `athens`). `GET /v1/admin/job-sources`, `PUT /v1/admin/job-sources/{id}` `{ enabled, reason }`. Audit like kill switches. Import runner and public search must both skip disabled sources.

**Quality:** `GET /v1/admin/jobs/quality?since=` returning named aggregates (`held`, `dead_link`, `duplicate`, `published`, window). Read-only. Use existing `jobscam` / expiry / dedupe fields; do not recompute scores inline.

**Earnings report:** `GET /v1/admin/scout/earnings/report?from=&to=` — period, totals by status (`held`, `released`, `paid`, `clawed_back`), per-scout optional. CSV is optional; JSON is enough. No PII beyond scout user id.

**Disputes:** opening a case on `queue=disputes` with `subjectType=payout` (or earning id). Decision `uphold` / `clawback` calls scout clawback for **unsettled** earnings only. Do not silently reverse a provider `paid` send (step-47).

## Acceptance criteria

1. `go vet` and `go test` pass for each PR's modules.
2. A killed source disappears from new public results; staff can fetch quality stats, an earnings report, and decide a dispute.
3. Each PR stays in its owner's lane.

## Test and validation

```bash
bun run vet:go
go test ./backend-core/jobs/...
go test ./backend-core/killswitch/...
go test ./backend-core/jobscam/...
go test ./backend-core/scout/...
go test ./admin-backend/...
go test ./joined-backend/...
```

Per PR: registry skip, quality counts on a memory store, report totals, clawback of held vs refusal of paid.

## Risks and soft parks

- Step-42 #110 noted an optional staff-session denial test — add it here if still missing.
- If 54 is too large, split 54a–54d and adjust counts with Sid (already in the W3 README).
- Infra: cancelled CI can look green. Require real green.

## Definition of done

Each sub-PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
