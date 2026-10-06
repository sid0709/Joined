# Step 26: Kill switches

- **Week:** W2
- **Status:** Done
- **Owner:** Ravi (platform backend lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(killswitch): runtime kill switches (roadmap step-26)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #98 (feature `fbe7187`; merge `6370e90`)

## Goal

Staff can switch off risky features at runtime, without a deploy, if something goes wrong at launch. A flipped switch returns a clear 503 within the cache window and writes an audit entry.

## Context and dependencies

Starts after step-12 (error logging) merges, because this shares service `main.go` wiring and config with the existing platform open path (`backend-core/platform/platform.go`).

Named switches cover sign-up, email sending, job imports, Acorn AI calls, scout submissions, and checkout. Ravi wires the package, staff admin endpoints, and the switches that live in his lane (`signup`, `email`, `job_imports`). After #115 (`split/acorn-backend`), Acorn HTTP is `acorn-backend/acornapi` (Elon). That service already takes `p.KillSwitches` and returns 503 on `acorn_ai`. Scoutwell submissions and Stripe checkout live in Penny's lane; this step documents the one-line wiring and does **not** edit `scoutwell-backend` or `backend-core/billing`.

`backend-core/killswitch/README.md` is the operator doc. `docs/40-admin-console.md` mentions config/flags but has no kill-switch UI yet (Leo, later). `docs/60-api-conventions.md` describes problem+json 503s; today's `WriteDisabled` uses `httpkit.WriteError` with a plain English body, not RFC 9457 `code`.

## In scope

- New `backend-core/killswitch` package: named switches, env defaults, optional Mongo override doc with a short cache.
- Helper that returns 503 with a stable message when a switch is off.
- Wire the switches in joined-backend and admin-backend.
- Staff-only admin-backend endpoints to read and flip switches, with an `admin_audit` entry.
- Note the one-line wiring for scoutwell-backend and billing for Penny.
- Go tests for defaults, override, and cache expiry.

## Out of scope

- No admin UI (Leo, later).
- No Scoutwell or billing edits (Penny). Do not implement `KILLSWITCH_SCOUT_SUBMISSIONS` or `KILLSWITCH_CHECKOUT` enforcement in those services.
- No `acorn-backend/**` edits in the original Ravi PR. `acorn_ai` is already enforced there after #115 (Elon).
- No flips on production data.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `backend-core/killswitch/names.go` — switch names, env keys, messages, collection names
- `backend-core/killswitch/store.go` — Mongo `kill_switches` + audit `admin_audit`
- `backend-core/killswitch/defaults.go` — `LoadDefaults()`, `KILLSWITCH_CACHE_MS`
- `backend-core/killswitch/http.go` — `Check`, `On`, `WriteDisabled` → 503
- `backend-core/killswitch/memory.go` — tests / in-memory store
- `backend-core/killswitch/README.md` — wiring matrix
- `backend-core/platform/platform.go` — `KillSwitches: killswitch.NewStore(...)`
- `admin-backend/internal/httpapi/staff_killswitch.go` — staff GET/PUT
- `backend-core/authapi/*.go` — signup + email
- `acorn-backend/acornapi/server.go` — `AcornAI` routes (moved out of `backend-core/acornapi` in #115; Elon owns `acorn-backend/**`. Ravi still owns the `killswitch` package and staff flip APIs. After #115 this file already calls `killswitch.On(..., AcornAI)` and `acorn-backend/cmd/server/main.go` passes `p.KillSwitches`.)
- `admin-backend/internal/httpapi/migration.go` — job import migration steps
- `admin-backend/cmd/copyjobs/main.go`, `admin-backend/cmd/copycompanies/main.go` — CLI guard
- `admin-backend/cmd/server/main.go` — import runner gate
- `joined-backend/internal/httpapi/server.go` — pass switches into `authapi`
- `joined-backend/.env.example`, `admin-backend/.env.example`, `backend-core/.env.example`

Do not edit `scoutwell-backend/**` or `backend-core/billing/**`. Do not recreate `backend-core/acornapi` — Acorn HTTP lives in `acorn-backend/acornapi`. A follow-up that only retouches Acorn AI enforcement belongs in Elon's `acorn-backend/**`.

## Implementation notes

**Switch names** (`killswitch.Name`):

| Name                | Env                            | Default when unset | Wired in this step                                                                            |
| ------------------- | ------------------------------ | ------------------ | --------------------------------------------------------------------------------------------- |
| `signup`            | `KILLSWITCH_SIGNUP`            | on                 | `authapi` email signup and new Google accounts                                                |
| `email`             | `KILLSWITCH_EMAIL`             | on                 | `authapi` outbound verification / reset mail                                                  |
| `job_imports`       | `KILLSWITCH_JOB_IMPORTS`       | on                 | admin migration copy + `copyjobs` / `copycompanies` + import runner gate                      |
| `acorn_ai`          | `KILLSWITCH_ACORN_AI`          | on                 | `acorn-backend/acornapi` model routes (`server.go`); env also in `acorn-backend/.env.example` |
| `scout_submissions` | `KILLSWITCH_SCOUT_SUBMISSIONS` | on                 | staff flip only; Penny wires Scoutwell                                                        |
| `checkout`          | `KILLSWITCH_CHECKOUT`          | on                 | staff flip only; Penny wires billing                                                          |

Off values: `off`, `false`, `0`, `no`, `disabled` (case-insensitive).

**Cache:** `KILLSWITCH_CACHE_MS` (default 5000). Mongo read failure → last cache or env (fail-open).

**Collections** (in `DEST_DB`):

- `kill_switches` — `_id` = switch name; `enabled`, `updatedAt`, `updatedBy`, `note`
- `admin_audit` — `action` `kill_switch.enable` \| `kill_switch.disable`, `subjectType` `kill_switch`

**Staff APIs** (admin-backend, bearer + staff session):

- `GET /v1/admin/kill-switches` → `{ "switches": [ State, ... ] }`
- `PUT /v1/admin/kill-switches/{name}` body `{ "enabled": bool, "note": string }` → `{ "switch": State, "auditId": string }`
- Actor: `X-Admin-Actor` (or staff email from session)
- Nil store → 503 `"Kill switches are unavailable."`
- Missing `enabled` → 422. Unknown name → 422 `validation_failed`.

**503 body:** `killswitch.WriteDisabled` → `httpkit.WriteError(w, 503, Message(name))` — plain English from `disabledMessages` in `names.go`, not problem+json `code`.

**Penny follow-up (do not do it here):**

Scoutwell, after `platform.Open`, pass `p.KillSwitches` and at the top of `scoutSubmit` / `scoutSubmitBatch` / `scoutSubmitExtension`:

```go
if err := killswitch.Check(r.Context(), s.switches, killswitch.ScoutSubmissions); err != nil {
    killswitch.WriteDisabled(w, killswitch.ScoutSubmissions)
    return
}
```

Billing checkout, wrap `postCheckout` the same way with `killswitch.Checkout`.

**Edge cases:** Fail-open on Mongo blip is intentional. Frontend `BILLING_CHECKOUT_ENABLED` / `NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED` is a separate UI flag, not this switch.

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass.
2. Flipping a switch locally blocks the wired feature with a 503 within the cache window and logs an audit entry.
3. Env defaults apply when no Mongo doc exists; a Mongo override wins until cache expiry.
4. Diff stays in Ravi's lane (no Scoutwell, no billing package edits).

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/killswitch/...
go test ./backend-core/authapi/... -run KillSwitch
go test ./acorn-backend/acornapi/... -run KillSwitch
go test ./admin-backend/internal/httpapi/... -run KillSwitch
go test ./joined-backend/internal/httpapi/... -run SignupKillSwitch
```

Mongo integration (`killswitch/mongo_test.go`) skips unless `MONGODB_TEST_URI` is set. Tests use `killswitch.NewMemory`.

Manual (human-run): PUT `signup` to `enabled: false`, then attempt email sign-up — 503 and an `admin_audit` row. Flip back.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- `scout_submissions` and `checkout` are staff-flippable but not enforced in Penny's services yet. Documented in `backend-core/killswitch/README.md`.
- 503s are plain `WriteError` strings, not RFC 9457 codes.
- Step-54 may add per-source import switches on top of `job_imports`.
- After #115, `acorn-backend` opens platform with `ACORN_DB` (default `AcornDB`). Admin flips write `kill_switches` in Joined `DEST_DB`. A Mongo override for `acorn_ai` on admin may not be visible to Acorn until Elon points both at the same collection or Acorn also reads Joined's switch doc. Env `KILLSWITCH_ACORN_AI` still applies per process.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (this step originally landed on retired `stage-roadmap` as #98). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
