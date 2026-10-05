# Step 48: Acorn profile editor

- **Week:** W3
- **Status:** Planned
- **Owner:** Leo (web frontends; **coordinate Elon** — Elon owns `acorn/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(acorn-website): profile editor (roadmap step-48)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

The Acorn website has a signed-in profile editor that loads and saves the same candidate profile document the Acorn extension and Acorn AI already read. One store, one account.

## Context and dependencies

Depends on [step-32](step-32-acorn-website-scaffold.md) (Done, #80): `acorn/website` is a two-route scaffold (`/`, `/sign-in`) on port 6005. Session cookie is `joined_session` (`acorn/website/lib/auth/constants.ts`); `hasJoinedSession()` only checks cookie presence. Sign-in placeholder sends the user to Joined when `JOINED_WEB_URL` is set (`lib/config.ts`, `.env.example`).

There is **no** profile CRUD under `backend-core/acornapi`. Profile is Joined candidate data:

- `GET` / `PATCH` `/v1/me/profile` — `joined-backend/internal/httpapi/me.go`
- Go types: `backend-core/candidate.Profile`, `ProfilePatch`
- TS reference: `joined-frontend/lib/profile.ts` (`Profile`, `Personal`, `HomeAddress`, `Disclosures`, `ProfileLinks`)

Acorn AI already renders that store via `backend-core/acorn/profile.go` → `ApplicantProfileText` (identity, contact, work authorization / sponsorship). `@acorn/shared` has **no** `Profile` type.

Related: [step-49](step-49-acorn-resume-library.md) résumé library, [step-50](step-50-acorn-stripe-pricing.md) / [step-51](step-51-acorn-billing-legal-delete.md) billing. Do not invent a second profile store.

## In scope

- Signed-in `/profile` page on `acorn/website`. Unauthenticated users go through the existing `/sign-in` placeholder.
- Load/save via `GET`/`PATCH /v1/me/profile` on joined-backend (same `joined_session`). Add a BFF proxy on the website (mirror `joined-frontend/app/api/me/[...path]/route.ts` + `lib/me/forward.ts`) and `JOINED_API_URL` in `acorn/website/lib/config.ts`.
- Fields the extension/AI already consume: identity (`name`, `personal.*`), contact (`email`, `phone`, `headline`, `location`, `homeAddress`, `links`), work authorization (`authorization`, sponsorship/citizenship as already modeled). Do not add a parallel schema.
- `@joined/design-system` form controls (`TextField`, `Button`, `Banner`, `PageContainer`). Elon is on the PR for `acorn/**` ownership.
- Expand `acorn/website/lib/routes.ts` with `profile`.

## Out of scope

- No résumé library (step-49). No billing (50/51). No extension UI rewrite.
- No new profile collection in Mongo. No `backend-core/acornapi` profile routes unless Elon explicitly splits a mount — default is joined-backend `/v1/me/profile`.
- No new git branch named `acorn*`. Open the PR into `stage-roadmap-w34`.

## Files and areas to touch

- `acorn/website/app/profile/page.tsx` (new)
- `acorn/website/components/` — profile form (new)
- `acorn/website/app/api/me/[...path]/route.ts` (new) — proxy to joined-backend
- `acorn/website/lib/routes.ts`, `lib/config.ts`, `.env.example` — `JOINED_API_URL`
- `acorn/website/lib/auth/session.ts` — optionally fail closed when cookie is missing
- `acorn/packages/shared` — only if a shared `Profile` type is truly required; prefer importing the existing candidate contract
- Do not copy `joined-frontend/components` internals

## Implementation notes

- Cookie name stays `joined_session` (Joined, Acorn website, Acorn extension `JOINED_SESSION_COOKIE`).
- `JOINED_API_URL` pattern: `joined-frontend` uses `http://127.0.0.1:8080`. Website server routes forward the session cookie; the browser does not call :8080 directly.
- Patch body matches `candidate.ProfilePatch` / `joined-frontend/lib/profile.ts`. Empty strings vs omit: follow Joined’s existing patch semantics.
- Hosts from `lib/config.ts` only. No hardcoded `localhost` in components.
- Elon coordinates path ownership; Leo implements.

## Acceptance criteria

1. `bun --filter acorn-website typecheck`, lint, and format pass (and shared types if touched).
2. Saving profile on the website is what `GET /v1/me/profile` returns for the same session, and what Acorn AI reads via `ApplicantProfileText`.
3. Signed-out visit to `/profile` lands on `/sign-in`.
4. Diff stays in `acorn/website/**` (and shared types only if required), with Elon on the PR.

## Test and validation

```bash
bun --filter acorn-website typecheck
bun --filter acorn-website lint
bun run ci format
bun run ci test
```

Add tests for the BFF forwarder (cookie forwarded, 401 without session). Manual (human): sign in on joined-frontend, open Acorn `/profile` on :6005, save a field, confirm Joined `/profile` shows it.

## Risks and soft parks

- Cross-origin `joined_session` only works if local hosts share the cookie domain the way step-32 documented. If the cookie is host-only, document the local setup in `acorn/website/README.md` rather than inventing a second login.
- Do not duplicate `joined-frontend/lib/profile.ts` field lists in three files; extract a constant or import the type.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
