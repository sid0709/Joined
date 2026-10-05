# Step 63: Production domains, backups, and monitoring

- **Week:** W4
- **Status:** Planned
- **Owner:** Ravi (platform backend; Elon coordinates `deploy/**` if hooks live there)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(ops): domains backups monitoring hooks (roadmap step-63)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Hooks and runbooks exist for production domains, Mongo backups, and monitoring. DNS cutover and deploy stay on `main`; this PR does not flip production.

## Context and dependencies

Deploy today: `deploy/README.md` (compose, GitHub `production` env, health on deploy for joined-backend + backend-core `/health` and homepage). Compose: `deploy/compose.yml`. Nginx: `deploy/nginx/*.conf` for `joinedhq.com`, `api.joinedhq.com`. Subdomains runbook: `deploy/subdomains-runbook.md` — `scout.joinedhq.com` → :6003, `admin.joinedhq.com` → :6010. Bootstrap: `deploy/bootstrap-vps.sh`.

Health: `GET /health` on joined-backend, admin-backend, scoutwell-backend, backend-core (`httpkit.Health`), and acorn-backend; `GET /acorn/health` in `acorn-backend/acornapi` (`acorn-backend/cmd/server/routes.go`).

Logging: `backend-core/httpkit/logging.go` (`X-Request-ID`, `SetUserID`). Error reporting: optional `SENTRY_DSN` via `LoadErrorReporting()` — missing DSN must not crash.

No backup cron/runbook in repo yet. Error logging step: [step-12](step-12-error-logging.md) #75.

Acorn (`acorn-frontend` :6005, `acorn-backend` :8083, `AcornDB`) is not in the subdomains runbook yet.

## In scope

- Document intended production hosts for Joined, Scoutwell, admin, and Acorn in `deploy/README.md` or comments (Elon owns `deploy/**` — coordinate). No live DNS edits from this PR.
- Backup hook: what is backed up (Mongo), frequency, and a check command or cron sketch. Do not write production credentials.
- Monitoring: health endpoints already exist; add error-tracker/uptime env hooks if step-12 landed (`SENTRY_DSN` or equivalent). Structured log fields stay in `httpkit`.
- Config from env only.

## Out of scope

- No merge to `main`, no VPS SSH, no flipping production DNS.
- No new SaaS that requires a paid account unless the user already approved it.
- Do not paste the VPS IP/password into new docs beyond what `deploy/subdomains-runbook.md` already contains; prefer env names.

## Files and areas to touch

- `deploy/README.md` — hosts + backup + monitoring index (Elon)
- `deploy/backups.md` or `docs/92-ops-backups-monitoring.md` (new)
- `deploy/subdomains-runbook.md` — Acorn host if agreed
- `backend-core/config` / `httpkit/reporter.go` — only if a new optional DSN must be read
- Service `.env.example` files — `SENTRY_DSN` comments
- Do not edit live nginx on the VPS

## Implementation notes

Document hosts as a table of **intended** names (do not treat DNS as done):

| App        | Intended host                                 | Local port (compose)    |
| ---------- | --------------------------------------------- | ----------------------- |
| Joined web | `joinedhq.com`                                | frontend in compose     |
| Joined API | `api.joinedhq.com`                            | joined-backend          |
| Scoutwell  | `scout.joinedhq.com`                          | 6003                    |
| Admin      | `admin.joinedhq.com`                          | 6010                    |
| Acorn web  | document the agreed host (new)                | 6005 (`acorn-frontend`) |
| Acorn API  | `api.joinedhq.com/acorn` (or documented host) | 8083 (`acorn-backend`)  |

Backup: Mongo `mongodump` against `MONGO_URI` from env for **both** JoinedDB and `AcornDB` (`ACORN_DB`, default `AcornDB` on acorn-backend). Destination from `BACKUP_DIR` or object-storage env names (not credentials). Frequency as a named constant or cron sketch. A `check` script that exits non-zero if the last dump is older than `BACKUP_MAX_AGE`.

Monitoring: `/health` must stay 200 without `SENTRY_DSN`. If you add an uptime ping URL, it is env (`UPTIME_PING_URL`) and no-op when empty.

## Acceptance criteria

1. README/runbook lists domains, backup, and monitoring env names.
2. Health checks remain 200 in tests; missing optional DSN does not crash.
3. Diff stays in Ravi's lane plus `deploy/**` / `docs/**` only with Elon.

## Test and validation

```bash
bun run vet:go
go test ./backend-core/httpkit/...
go test ./joined-backend/...
```

Do not SSH. Do not call production `/health` from this PR’s CI.

## Risks and soft parks

- `deploy/subdomains-runbook.md` already contains a server IP — do not spread it further.
- DNS cutover is launch-on-`main`, not this branch.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
