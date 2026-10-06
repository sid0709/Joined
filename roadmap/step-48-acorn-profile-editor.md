# Step 48: Acorn profile editor

- **Week:** W3
- **Status:** BLOCKED
- **Owner:** Leo (`acorn-frontend/**`; **coordinate Elon** for `acorn-backend/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(acorn-frontend): persist profile editor (roadmap step-48)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## BLOCKED

Acorn’s website and API were removed from this repo in `1d0aae6` (`refactor: remove Acorn references and update deployment process`). `README.md` now says they live in the sibling repository [sid0709/Acorn](https://github.com/sid0709/Acorn). This tree has no `acorn-frontend` or `acorn-backend`, so there is nowhere to persist the profile editor without undoing that split. Implement step 48 in the Acorn repo.

## Goal

The Acorn website profile editor persists the same applicant profile the extension and Acorn AI read. One Acorn account, one store in `AcornDB`.

## Context and dependencies

After PR #115 (`split/acorn-backend`), Acorn is two root workspaces — not `acorn/website` and not `backend-core/acornapi`:

- **`acorn-frontend`** (package `acorn-frontend`, port **6005**): signed-in workspace already has `/profile` (`app/(workspace)/profile/page.tsx` → `ProfilePanel`). Auth is Acorn’s own: `acorn_session` from `@acorn/shared/api` `ACORN_SESSION_COOKIE` (`lib/auth/constants.ts`). Sign-in/up hit `POST /acorn/auth/signin|signup` on acorn-backend (`ACORN_API_URL`, default `http://127.0.0.1:8083`).
- **`acorn-backend`** (`cmd/server`, `go.work` member): `/acorn/*` + `GET /health`, DB **`AcornDB`** (`ACORN_DB`). `acorn-backend/acornapi/README.md`: profile is the account name/email only; education, demographics, and links stay empty until a save API exists. Planner reads that account via `acorn-backend/acorn/profile.go` → `ApplicantProfileText`.

The UI already models a full `ApplicantProfile` in `acorn-frontend/lib/workspace/profile.ts` (identity, contact, work authorization, disclosures, career). That state is **local workspace**, not `GET`/`PATCH` on the API. Do **not** write Joined `GET /v1/me/profile` or reuse `joined_session` — Acorn accounts are not Joined candidate rows.

Related: [step-32](step-32-acorn-website-scaffold.md) (Done, #80; scaffold has been replaced by `acorn-frontend`), [step-49](step-49-acorn-resume-library.md), [step-50](step-50-acorn-stripe-pricing.md) / [step-51](step-51-acorn-billing-legal-delete.md). Shared types: `acorn/packages/shared`. UI: `sid-ui` (already used in `identity-form.tsx`, `logistics-form.tsx`, …).

## In scope

- Persist load/save of the existing `/profile` editor through **acorn-backend** (new profile routes under `/acorn`, named constants next to the handler). Elon lands or reviews the Go side; Leo wires `acorn-frontend`.
- Fields the planner already consumes once stored: identity (`name` / `personal.*`), contact (`email`, `phone`, `location` / address, `links`), work authorization / sponsorship. Match `ApplicantProfile` in `lib/workspace/profile.ts` and `ApplicantProfileText` — do not invent a second schema.
- Signed-out `/profile` already redirects to `/sign-in` via `currentAccount()`. Keep that.
- `sid-ui` form controls only. Missing primitive → sid-ui repo + catalog pin, not a local input.

## Out of scope

- No résumé library (step-49). No billing (50/51). No extension UI rewrite.
- No Joined `/v1/me/profile`. No `joined_session`. No `acorn/website` (removed).
- No new git branch named `acorn*`. Open the PR into `stage-roadmap-w34`.

## Files and areas to touch

- `acorn-frontend/app/(workspace)/profile/page.tsx` — keep
- `acorn-frontend/components/workspace/profile-panel.tsx`, `components/workspace/profile/*`
- `acorn-frontend/lib/workspace/profile.ts` — keep as the client type
- `acorn-frontend/lib/auth/` — `acorn_session`; add a server fetch to acorn-backend
- `acorn-frontend/lib/config.ts` — `ACORN_API_URL` only
- `acorn-backend/acornapi/` — profile GET/PATCH (new)
- `acorn-backend/account/` or a profile store in `AcornDB` (new)
- `acorn-backend/acorn/profile.go` — read persisted fields into `ApplicantProfileText`
- `acorn/packages/shared` — only if the extension must share the DTO
- Do not touch `joined-frontend/lib/profile.ts` except as a field-list reference

## Implementation notes

- Cookie: `acorn_session` (`ACORN_SESSION_COOKIE`). Extension already reads it from the Acorn origin (`acorn-frontend/README.md`).
- Suggested routes: `GET` / `PATCH` `/acorn/me/profile` (name constants in `acornapi`). Auth: same session/Bearer as `/acorn/auth/me`.
- Hosts from `acorn-frontend/lib/config.ts`. No `localhost` in components.
- Empty strings vs omit: document one PATCH semantic and test it.
- Elon owns `acorn-backend/**`; Leo implements `acorn-frontend/**`. One PR or a backend-first split.

## Acceptance criteria

1. `bun --filter acorn-frontend typecheck`, lint, and format pass; `go test ./acorn-backend/...` if the API is in this PR.
2. Saving profile on the website is what Acorn AI reads via `ApplicantProfileText` for that `acorn_session` account.
3. Signed-out visit to `/profile` lands on `/sign-in`.
4. Diff stays in `acorn-frontend/**` (Leo) and `acorn-backend/**` (Elon). No `joined-backend` profile mount.

## Test and validation

```bash
bun --filter acorn-frontend typecheck
bun --filter acorn-frontend lint
bun run ci format
go test ./acorn-backend/...
```

Add tests for the profile store (memory) and 401 without session. Manual (human): sign in on :6005, save a field on `/profile`, confirm `/acorn/auth/me` + profile GET and a planner call see it.

## Risks and soft parks

- Do not fall back to Joined candidate profiles; that mixes `JoinedDB` and `AcornDB`.
- Local workspace samples must not overwrite a saved server profile on refresh.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
