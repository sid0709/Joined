# Step 32: Acorn website scaffold

- **Week:** W2
- **Status:** Done
- **Owner:** Elon (integrator lane: root files, `bun.lock`, `go.work`, `deploy/**`, `docker/**`, `tools/**`, `roadmap/**`, `acorn/**`, `acorn-backend/**`, `acorn-frontend/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(acorn): acorn website scaffold (roadmap step-32)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #80 (`5ab373d`). Later tree change: #115 (`8449a55`) replaced `acorn/website` with `acorn-frontend` and added `acorn-backend`.

## Goal

Acorn has a website app that builds and runs locally, ready for profile, resume, and billing pages. After #115 the website is the `acorn-frontend` Next app (port 6005) talking to `acorn-backend` (port 8083). Do not recreate `acorn/website` or `joined-theme`.

## Context and dependencies

#80 originally added workspace `acorn-website` at `acorn/website/` with a landing page and a `joined_session` placeholder. `#115` (`split/acorn-backend`) moved that product into:

- `acorn-frontend/` — workspace name `acorn-frontend`, `next dev --port 6005`, listed in root `package.json` workspaces
- `acorn-backend/` — Go module in `go.work`, `HTTP_ADDR` default `127.0.0.1:8083`, routes under `/acorn`
- `tools/local-services.mjs` — `acorn-frontend` and `acorn-backend` (`acorn-api`)

Auth is **Acorn's own accounts**, not Joined's cookie. `acorn-frontend/lib/auth/constants.ts` uses `acorn_session` (`ACORN_SESSION_COOKIE` from `@acorn/shared/api`). Sign-in/up hit `/acorn/auth/signin`, `/acorn/auth/signup`, `/acorn/auth/me`. Accounts live in `AcornDB` (`ACORN_DB`, default `AcornDB`) — not `JoinedDB`. The extension reads `acorn_session` from this origin (`acorn/README.md`).

UI is the external catalog package **`sid-ui`** (`acorn-frontend/package.json`). In-repo `packages/design-system` and `joined-theme` are gone. Google sign-in uses `@joined/google-signin`. Shared types: `@acorn/shared`.

W3 pages (48/49/51) should edit `acorn-frontend/**` with Elon on the PR. Do not change `acorn/extension` unless that step says so. Never open a PR into an `acorn*` **branch**.

## In scope

- A Next.js app that builds with catalog versions and `sid-ui`, with a landing page and a real Acorn sign-in (email/password and Google) that sets `acorn_session`.
- Workspace entry `acorn-frontend` in root `package.json` and `tools/local-services.mjs` on port 6005; `acorn-backend` on 8083.
- Short `acorn-frontend/README.md`.
- Follow-ups stay on these paths — do not add `acorn/website` back.

## Out of scope

- No deploy/DNS changes in a scaffold follow-up (W4 / step-63; compose already lists both services after #115).
- No Joined/Scout backend edits.
- No changes to `acorn/extension` unless a later step requires them.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

**Current tree (use these, not `acorn/website`):**

- `acorn-frontend/app/page.tsx`, `app/sign-in/page.tsx`, `app/sign-up/page.tsx`, `app/layout.tsx`
- `acorn-frontend/app/(workspace)/**` — overview, profile, resume, gmail, billing, apps (already present after the split; W3 steps refine them)
- `acorn-frontend/components/landing-page.tsx`, `auth-form.tsx`, `site-header.tsx`, `providers.tsx`
- `acorn-frontend/lib/config.ts` — `ACORN_API_URL` (default `http://127.0.0.1:8083`), `ACORN_EXTENSION_INSTALL_URL`, `ACORN_EXTENSION_DOWNLOAD_URL`
- `acorn-frontend/lib/auth/constants.ts`, `session.ts`, `cookie.ts`, `actions.ts`
- `acorn-frontend/lib/routes.ts`
- `acorn-frontend/package.json`, `next.config.ts`, `README.md`
- `acorn-backend/cmd/server/main.go` — `defaultHTTPAddr = "127.0.0.1:8083"`, `ACORN_DB`, `ACORN_SESSION_COOKIE`, `p.KillSwitches`
- `acorn-backend/acornapi/` — `/acorn` HTTP + Google + AI
- `acorn-backend/account/` — Acorn accounts
- Root `package.json` workspaces: `acorn-frontend` (not `acorn/website`)
- `go.work` — `./acorn-backend`
- `tools/local-services.mjs` — `acorn-frontend` / `acorn-backend`

Do not recreate `acorn/website/**`, `packages/design-system/**`, or `joined-theme/**`.

## Implementation notes

**Scripts:**

```bash
bun --filter acorn-frontend dev        # next dev --port 6005
bun --filter acorn-frontend build
bun --filter acorn-frontend typecheck
bun --filter acorn-frontend lint
```

**Env (website):** `ACORN_API_URL` (default `http://127.0.0.1:8083`). Optional `ACORN_EXTENSION_INSTALL_URL` / `ACORN_EXTENSION_DOWNLOAD_URL`. Copy `acorn-frontend/.env.example` when pointing elsewhere.

**Env (API):** `acorn-backend/.env.example` — `MONGO_URI`, `ACORN_DB` (default `AcornDB`; do not use `DEST_DB`/`JoinedDB`), `OPENAI_API_KEY` or staff-saved AI key, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_SIGNIN_REDIRECT_URL` (callback is this site's `/auth/google/callback`), `ACORN_SESSION_COOKIE`, `KILLSWITCH_ACORN_AI`, `SETTINGS_ENCRYPTION_KEY`.

**Auth:** cookie `acorn_session` shared with the extension. Not `joined_session`. Google redirect must be this origin's `/auth/google/callback`.

**Dependencies:** `sid-ui` and Next/React from `catalog:`. `@acorn/shared`, `@joined/google-signin`. No hex colors or local buttons.

**Ports:** 6005 website, 8083 API. Do not collide with joined-frontend 6002 or scoutwell-frontend 6003.

**No dedicated frontend test script.** Coverage is root `bun run ci typecheck` / `lint`. Go: `go test ./acorn-backend/...` via `bun run test:go`.

## Acceptance criteria

1. `bun install`, `bun --filter acorn-frontend build`, `typecheck`, and repo lint/format pass.
2. `bun --filter acorn-frontend dev` serves the landing page on port 6005 against `acorn-backend` at 8083.
3. Sign-in sets `acorn_session`; the extension can read it from this origin. Do not add a second Joined-session auth stack.
4. Diff for a scaffold follow-up stays in `acorn-frontend/**` (plus Elon-owned root/`acorn-backend` only if the split left a hole). Never `acorn/website/**`.

## Test and validation

```bash
bun --filter acorn-frontend typecheck
bun --filter acorn-frontend lint
bun --filter acorn-frontend build
go test ./acorn-backend/...
bun run ci lint
bun run ci typecheck
bun run ci go
bun run format:check
```

Manual (human-run): `bun --filter acorn-frontend dev` and open `http://localhost:6005` with acorn-backend on 8083. Agent does not start servers or CDP.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- Historical docs and W3 steps (48/49/51) may still say `acorn/website` — follow-up agents must use `acorn-frontend` and `acorn-backend/acornapi`.
- `ACORN_DB` vs `DEST_DB`: a shared `.env` that only sets `DEST_DB` would point Acorn at Joined data if `main.go` did not override it. Keep `ACORN_DB=AcornDB`.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (this step originally landed on retired `stage-roadmap` as #80; the current tree is #115). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
