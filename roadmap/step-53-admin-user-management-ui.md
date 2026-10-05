# Step 53: Admin user management UI

- **Week:** W3
- **Status:** Planned
- **Owner:** Leo (web frontends lane: `admin-frontend/**`; UI from `sid-ui`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(admin-frontend): user management (roadmap step-53)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

The admin console can look up users and run cancel / refund / suspend from the UI, with confirm dialogs and masked PII, against the step-52 APIs.

## Context and dependencies

Starts after [step-52](step-52-admin-user-management.md) merges (needs its API). Product spec: `docs/40-admin-console.md` Users. Sources/quality/earnings UI is [step-54](step-54-admin-sources-quality-earnings-disputes.md) and is out of this PR.

`admin-frontend/lib/nav.ts` `CONSOLE_NAV` has Scouting, Job pool, Trust, Ops, Directory, Migration, Settings — **no Users section**. Proxy: `app/api/admin/[...path]/route.ts` forwards `/api/admin/v1/...` to `ADMIN_API_URL` with bearer + `X-Admin-Actor` and `Idempotency-Key`. Config: `lib/config.ts` `API_PROXY = "/api/admin"`. Env: `ADMIN_API_URL`, `ADMIN_API_TOKEN`, `ADMIN_ACTOR` (`lib/server/env.ts`, `.env.example`).

Staff session lives in `joined_admin_session` (`lib/staff-session.ts`). Confirm pattern: design-system `AlertDialog` / `Dialog`.

## In scope

- New Users section: search, detail, actions, using `sid-ui` and the existing admin proxy.
- Confirm dialogs for cancel, refund, and suspend. Show audit/reason fields the API requires. Mask PII by default.
- Nav entry consistent with `admin-frontend/lib/nav.ts` (`CONSOLE_NAV` + `ROUTES`).
- Empty, 404, and 401 states.

## Out of scope

- No backend changes. No sources/quality/earnings (step-54).
- No reveal-PII UI unless step-52 shipped that endpoint and Elon asks for it in this PR.
- No merge to `main`.

## Files and areas to touch

- `admin-frontend/lib/nav.ts` — `users` routes + nav group
- `admin-frontend/app/(console)/users/` — list + detail (new)
- `admin-frontend/components/` — search, detail, action dialogs (new)
- `admin-frontend/lib/users.ts` (new) — types matching step-52 JSON
- Existing proxy: `app/api/admin/[...path]/route.ts` — reuse, do not fork
- `sid-ui` only if a primitive is missing (add in the sid-ui repo, publish, bump the catalog pin, show in `sid-ui-theme`)

## Implementation notes

Call the step-52 paths through `API_PROXY` (for example `GET /api/admin/v1/admin/users?email=`). Do not talk to admin-backend from the browser.

Reason is required before submit. Disable the action button until the confirm field is filled. Show `auditId` from the response.

Masked fields stay masked; do not render raw email/phone from a “debug” dump.

Tokens only. Match neighboring console tables (`payouts-table.tsx`, `moderation-queue.tsx`).

## Acceptance criteria

1. `bun --filter admin-frontend typecheck`, lint, and format pass.
2. Staff can search a user and complete cancel/refund/suspend against local admin-backend.
3. Unauthenticated console use still hits the existing staff sign-in; actions without a reason cannot fire.
4. Diff stays in Leo's lane.

## Test and validation

```bash
bun --filter admin-frontend typecheck
bun --filter admin-frontend lint
bun run ci format
bun run ci test
```

Add tests for reason-required and proxy path helpers (same style as `admin-frontend` API client tests). Manual (human): search a local user, cancel, refund, suspend, confirm audit on the API.

## Risks and soft parks

- If step-52 path names differ from this doc, the UI follows the merged API, not this sketch.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
