# Step 09: Role checks per app

- **Week:** W1
- **Status:** Done
- **Owner:** Ravi (lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(auth): role checks per app (roadmap step-09)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#77](https://github.com/sid0709/Joined/pull/77) (`3f31b34`)
- **Starts after step-03 merges** (same auth files).

## Goal

Each app only lets in the right kind of account: job seekers (`candidate`) on Joined candidate routes, company users (`employee`) only where company mode is enabled, scouts on Scoutwell (helper exposed, wiring left to Penny), and staff on admin via the existing staff session.

## Context and dependencies

Step-03 (#72, plus #78/#81) added email auth on the same `backend-core/auth` / `authapi` files. Roles already exist as `candidate`, `employee`, `scout` (`backend-core/auth/auth.go`). Admin uses Google workspace staff sessions (`X-Admin-Session`), not a user role. Leo's step-04 hides company UI behind `NEXT_PUBLIC_COMPANY_MODE_ENABLED`; this step adds the matching API gate `COMPANY_MODE_ENABLED`.

Scoutwell routes use a custom `sessionToken()` (Bearer or cookie), not `RequireRole`. Expose the helper and document the pattern; do not edit `scoutwell-backend`.

What shipped in #77: `authapi.RequireRole` / `RequireStaff` in `backend-core/authapi/middleware.go`, joined-backend mounts (`/v1/me/*` → candidate, `/v1/company/*` → employee + `requireCompanyMode`), admin `requireStaff` coverage, `joined-backend/.env.example` `COMPANY_MODE_ENABLED`.

## In scope

- Investigate how roles and account types are stored (`users`, staff sessions, scout profiles, company members).
- One shared role middleware in `backend-core/authapi` that routes declare, e.g. `RequireRole(accounts, []string{auth.RoleCandidate}, next)`.
- Apply it to `joined-backend` and `admin-backend` routes. For Scoutwell, expose the helper and note the wiring point for Penny.
- Clear 401 vs 403 responses, and tests for each role on each protected route group.

## Out of scope

- No frontend changes.
- No new roles beyond launch (`candidate`, `employee`, `scout`, plus staff sessions).
- No Scoutwell edits (Penny's lane). No `acorn-backend/**` or `acorn-frontend/**` (Elon).
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `backend-core/authapi/middleware.go` (new) and `middleware_test.go`
- `backend-core/authapi/integration_test.go`
- `backend-core/auth/auth.go` — existing role constants
- `joined-backend/internal/httpapi/server.go` — wrap route groups
- `joined-backend/internal/httpapi/company_mode.go` (new)
- `joined-backend/internal/httpapi/roles_test.go` (new)
- `joined-backend/internal/httpapi/session.go` — session load used by middleware
- `admin-backend/internal/httpapi/staff_auth.go` and `staff_auth_test.go`
- `joined-backend/.env.example` — `COMPANY_MODE_ENABLED`

Stay out of `backend-core/scout/**` and `backend-core/billing/**`.

## Implementation notes

### Role names in code (not the roadmap nicknames)

| Roadmap term | Constant | Value |
| --- | --- | --- |
| Seeker | `auth.RoleCandidate` | `"candidate"` |
| Company / recruiter | `auth.RoleEmployee` | `"employee"` |
| Scout | `auth.RoleScout` | `"scout"` |
| Staff | `auth.Staff` + Google workspace | not a `RequireRole` user role |

### Middleware

- `RequireRole(accounts, roles, next)` loads the session from **Bearer**.
  - No/invalid session → **401** `"sign in required"`.
  - Wrong role → **403** with role-specific copy (`roleMessage`).
  - Sets `authapi.Session(ctx)`.
- `RequireStaff` → **401** if no staff session. Admin production uses the existing `requireStaff` + `X-Admin-Session` path; keep that, do not force user-role staff.
- `accounts == nil` → always 401.

### Joined routes

- `/v1/me/*` → `RequireRole(..., candidate)`.
- `/v1/company/*` → `RequireRole(..., employee)` inside `requireCompanyMode`. Flag off → **403** `"company mode is not enabled"`.
- Public: `/v1/auth/*`, `/v1/search/*`, health, public schedule, Stripe webhook (when mounted).

Env: `COMPANY_MODE_ENABLED` (`true`/`1`). Align with Leo's `NEXT_PUBLIC_COMPANY_MODE_ENABLED` at deploy time.

`httpkit.SetUserID` exists for step-12 logs but was **not** called from `RequireRole` in #77. Wiring it is a follow-up, not required to close this step.

## Acceptance criteria

1. `go vet` and `go test` pass.
2. Wrong-role requests get 403, signed-out requests get 401, right-role requests still work.
3. Company routes return 403 when `COMPANY_MODE_ENABLED` is off, even for an employee session.
4. Diff stays in Ravi's lane.

## Test and validation

```bash
go test ./backend-core/authapi/... -run 'RequireRole|RequireStaff|RoleProtection'
go test ./joined-backend/internal/httpapi/... -run 'JoinedRouteGroups|Role|CompanyMode'
go test ./admin-backend/internal/httpapi/... -run Staff
bun run ci go
```

Manual: call `/v1/me/...` without a cookie (401), with a scout token (403), with a candidate token (200). Call `/v1/company/...` with company mode off (403).

## Risks and soft parks

- Scoutwell is not wrapped in `RequireRole`. Penny must apply the helper (or keep the custom session check) on scout routes.
- `SetUserID` not wired from this middleware — step-12 structured logs may omit `user_id` on protected routes.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #77), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
