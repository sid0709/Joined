# Step 52: Admin user management APIs

- **Week:** W3
- **Status:** Planned
- **Owner:** Ravi (platform backend lane: `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(admin): user lookup cancel refund suspend apis (roadmap step-52)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Staff can look up a user by email or id and cancel Premium, issue a refund, or suspend login through admin-backend APIs. Every mutation is audited.

## Context and dependencies

UI is [step-53](step-53-admin-user-management-ui.md) (Leo, waits on this API). Product spec: `docs/40-admin-console.md` **Users** section (search by email/ID, modes/tier/risk, timeline, restrict / re-verify / quotas). There is no `docs/40 Users` file.

Today admin-backend has **no** `/v1/admin/users` lookup, Premium cancel, refund, or login suspend. Existing “suspend” is company verification (`POST /v1/admin/companies/{id}/verify` `decision: "suspend"`) and scout patch — not end-user accounts.

Patterns to reuse:

- Staff mux + bearer: `admin-backend/internal/httpapi/server.go` `admin()`
- Actor: `X-Admin-Actor` (max 80 chars, default `admin`) — `docs/62-staff-company-api.md`
- Audit: Mongo `admin_audit`; scout `s.audit(...)`; cases return `auditId`
- Premium billing (Penny): `backend-core/billing` `CreatePortalSession`, subscription store, `IsPremium`. If a narrow cancel/refund interface is missing, Elon coordinates Penny; this step still owns the admin route and tests with a fake billing seam.
- Auth accounts: `backend-core/auth` / `authapi` — session + account records used by `DELETE /v1/auth/account`

Related: [step-29](step-29-premium-checkout-api.md) (Done, #90), [step-54](step-54-admin-sources-quality-earnings-disputes.md).

## In scope

- Staff routes: search by email/id, view modes/tier/risk (PII masked by default), timeline of key events.
- Actions, each audited: cancel Premium subscription, issue a refund (billing through a narrow interface), suspend/unsuspend login.
- Dual-control is not required for suspend. Refunds record actor + reason.
- Tests for authz (401/403), audit row written, happy/error paths.
- Do not log full PII. Reveal-PII, if needed, is a separate guarded endpoint with a reason field.

## Out of scope

- No admin UI (Leo, step-53). No Scout payout approval rewrite (Penny).
- No live Stripe refunds in CI (fake billing).
- No merge to `main`.

## Files and areas to touch

- `admin-backend/internal/httpapi/` — `users_admin.go` (new) + tests
- `admin-backend/internal/httpapi/server.go` — register routes
- `backend-core/` — user lookup + suspend flag on the account/session store (new or extend `auth`)
- Billing seam: interface in admin-backend or `backend-core/billing` (coordinate Penny) — **new** if missing
- `docs/62-staff-company-api.md` or `docs/40-admin-console.md` — Elon if the contract is documented
- Do not edit `admin-frontend` (step-53)

## Implementation notes

**Suggested routes** (name constants next to the handler; do not scatter strings):

| Method | Path                                  | Body / query                         |
| ------ | ------------------------------------- | ------------------------------------ |
| `GET`  | `/v1/admin/users`                     | `?email=` or `?id=` — masked profile |
| `GET`  | `/v1/admin/users/{id}`                | detail + timeline                    |
| `POST` | `/v1/admin/users/{id}/premium/cancel` | `{ reason }`                         |
| `POST` | `/v1/admin/users/{id}/premium/refund` | `{ reason, amount_cents? }`          |
| `POST` | `/v1/admin/users/{id}/suspend`        | `{ reason }`                         |
| `POST` | `/v1/admin/users/{id}/unsuspend`      | `{ reason }`                         |
| `POST` | `/v1/admin/users/{id}/reveal`         | `{ reason }` — optional, guarded     |

Auth: existing `ADMIN_API_TOKEN` bearer + optional staff session (`X-Admin-Session`). Actor: `X-Admin-Actor`.

Masked default: email local-part hashed or partially starred, phone hidden, tax ids never. Timeline: signup, verify, premium start/cancel, suspend — from existing collections, not a new event bus unless one exists.

Cancel/refund: call billing fake in tests. Live Stripe must not run in CI. Suspend must reject subsequent session use (document which store field).

## Acceptance criteria

1. `go vet` and `go test` pass for `admin-backend` and touched `backend-core`.
2. Staff can look up a user, cancel Premium, refund, and suspend; unauthenticated callers get 401.
3. Each mutation writes `admin_audit` with actor + reason.
4. Diff stays inside Ravi's lane (plus a flagged Penny hook only if Elon split billing).

## Test and validation

```bash
bun run vet:go
go test ./admin-backend/...
go test ./backend-core/auth/...
go test ./backend-core/billing/...   # only if seam lives there
```

Follow existing `staffCall(..., ADMIN token, X-Admin-Actor)` style in `staff_cases_test.go`. Cover: unknown user 404, missing reason 400, fake refund success, suspend blocks login, no PII in logs.

## Risks and soft parks

- Refunds without a billing seam will stall this step — split early with Elon/Penny.
- `docs/40` also lists restrict / re-verify / quotas; this step is cancel, refund, suspend only.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
