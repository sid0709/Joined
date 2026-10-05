# Step 63: Production domains, backups, and monitoring

- **Week:** W4, Launch prep
- **Owner:** Ravi (platform backend; Elon coordinates `deploy/**` if hooks live there)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(ops): domains backups monitoring hooks (roadmap step-63)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

Hooks exist for production domains, backups, and monitoring. DNS cutover still waits for launch on `main`.

## In scope

- Document intended production hosts for Joined, Scoutwell, admin, and Acorn in deploy/config comments or `deploy/README.md` (Elon owns `deploy/**` — coordinate). No live DNS edits from this PR.
- Backup hook: what is backed up (Mongo), frequency, and a check command or cron sketch. Do not write production credentials.
- Monitoring: health endpoints already exist; add error-tracker/uptime env hooks if step-12 landed (`SENTRY_DSN` or equivalent). Structured log fields stay in `httpkit`.
- Config from env only.

## Out of scope

- No merge to `main`, no VPS SSH, no flipping production DNS.
- No new SaaS that requires a paid account unless the user already approved it.

## Acceptance criteria

1. README/runbook lists domains, backup, and monitoring env names.
2. Health checks remain 200 in tests; missing optional DSN does not crash.
3. Diff stays in Ravi's lane plus `deploy/**` / `docs/**` only with Elon.
