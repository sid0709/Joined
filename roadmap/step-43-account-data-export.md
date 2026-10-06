# Step 43: Account data export

- **Week:** W3
- **Status:** Done
- **Owner:** Ravi (platform backend lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(auth): account data export endpoint (roadmap step-43)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)

## Goal

A signed-in user can download their data. Account delete already exists (`DELETE /v1/auth/account`). The owner receives their bundle; another session cannot. Delete semantics stay the same.

## Context and dependencies

`docs/90-compliance-privacy-security.md` lists export contents: profile, resumes, applications, interviews, messages, transactions. Product copy in `docs/11-platform-job-hunter.md` (settings privacy). UI is Leo, step-44 — `joined-frontend/components/settings/privacy-settings.tsx` currently toasts "We'll email you a download link" with **no API call** and promises a ZIP. Align the wire format (JSON + file URLs, or ZIP) with Leo in the PR description.

Delete path to reuse for placement and auth:

- `backend-core/authapi/authapi.go` — `DELETE /v1/auth/account`
- `backend-core/auth/store.go` — `DeleteAccount`
- `backend-core/platform/account_delete.go` — cascade (scout, scouted jobs, owned company, candidate)
- Proxies: `joined-frontend/app/api/auth/account/route.ts`, `scoutwell-frontend/app/api/auth/account/route.ts`

There is **no** `GET/POST /v1/auth/account/export` today. Register next to delete on the same `authapi.Handlers` so joined-backend and scoutwell both expose it (same pattern as delete). Stay out of `backend-core/scout` internals except read-only listing of what `scout.DeleteUser` already knows the user owns — if Scout rows must appear in the bundle, Elon coordinates Penny for a `ExportUser` helper rather than editing earnings/payouts.

Acorn accounts live in **`AcornDB`** on `acorn-backend` (`ACORN_DB`, not `DEST_DB`). This Joined export must not dump Acorn users. An Acorn export is a later Elon/Leo step on `acorn-backend` / `acorn-frontend`.

## In scope

- Authenticated export endpoint next to the existing auth routes in `backend-core/authapi` / `backend-core/auth` (for example `GET /v1/auth/account/export`, or `POST` that returns a job id if the payload is large).
- Bundle profile, resumes, applications, interviews, messages, and transactions the account owns. JSON (+ file URLs or inline files if small). Do not include other users' PII.
- Rate limit. Do not log the payload.
- Tests for auth, contents, and isolation.

## Out of scope

- No frontend (Leo, step-44).
- No change to delete semantics except documenting that export is separate.
- No production data dumps.
- No Scoutwell/admin UI.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `backend-core/authapi/authapi.go` — register the route beside delete
- `backend-core/auth/` — handler + rate limit (new files as needed)
- `backend-core/platform/` — gather user-owned rows (new export helper; reuse delete's ownership map)
- `backend-core/candidate/store.go` — read profile, saved_jobs, applications, interviews, threads/messages
- `backend-core/savedsearch/` — `saved_searches` (read)
- `backend-core/billing/mongo.go` — `billing_customers`, `subscriptions` (read; no Stripe live calls)
- `joined-backend` / `scoutwell-backend` — pick up the route automatically if they already call `authapi.Handlers.Register`

Do not edit `joined-frontend/**`. Do not rewrite `DeleteAccount`.

## Implementation notes

**Suggested route:** `GET /v1/auth/account/export` with bearer session (same as delete). `200` `application/json` (or `application/zip` if Elon and Leo agree). If the bundle can exceed a named size constant, `POST /v1/auth/account/export` → `{ "exportId" }` and a later `GET` — only if a sync GET is too large in tests.

**Auth:** session required. 401 without. Another user's id in the path is not a thing — export is always "me".

**User-owned collections to include when present:**

| Collection                           | Key                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `users`                              | id (redact password hashes / session secrets)                                                                                        |
| `profiles`                           | userId                                                                                                                               |
| `saved_jobs`                         | userId                                                                                                                               |
| `applications`                       | userId                                                                                                                               |
| `interviews`                         | userId                                                                                                                               |
| `calendar_connections`               | userId (tokens redacted)                                                                                                             |
| `threads` / `messages`               | candidateUserId / authorId — **strip other parties' PII** (keep counterpart as opaque id + display name already visible to the user) |
| `saved_searches`                     | userId                                                                                                                               |
| `billing_customers`, `subscriptions` | userId (no raw Stripe secrets)                                                                                                       |

Resumes: there is no `resumes` collection; include the profile `resume` field and any file URLs the profile stores. Do not invent files from `joined-frontend/lib/resumes.ts` demo data.

**Rate limit:** named constant in the auth/export module (for example 1 export per hour per user). 429 when exceeded. Do not log the bundle (`slog` must not print JSON body).

**Delete:** `DELETE /v1/auth/account` remains 204. Export does not delete. Document that users should export before delete (step-44 copy).

**Env:** `MONGO_URI`, `DEST_DB` only. No new third-party.

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass.
2. Owner receives their data; another session cannot. Delete still works (204, cascade unchanged).
3. Other users' message PII is absent. Secrets (password hash, refresh tokens, Stripe secret keys) are absent.
4. A second export inside the rate window is 429. Payload is not written to logs.
5. Diff stays inside Ravi's lane.

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/authapi/...
go test ./backend-core/auth/...
go test ./backend-core/platform/...
```

Add tests for: 401, owner contents, isolation across two users, redaction, rate limit, delete still 204 after export.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- UI copy says ZIP; this spec allows JSON. Agree with Leo before step-44 wires the button.
- Billing has customer/subscription rows, not a full ledger.
- Scout earnings history may need a Penny helper — do not reach into payout collections from this PR without Elon.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34`. CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
