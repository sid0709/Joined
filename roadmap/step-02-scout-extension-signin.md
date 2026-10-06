# Step 02: Scout extension sign-in state

- **Week:** W1
- **Status:** Done
- **Owner:** Maya (lane: `scout-extension/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scout-extension): sign-in state (roadmap step-02)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#68](https://github.com/sid0709/Joined/pull/68) (`353c426`)

## Goal

The Scout extension knows whether the scout is signed in to Scoutwell and shows that in the side panel: loading, signed out, signed in (name or email), or error. A signed-out scout can open the Scout website sign-in page in a new tab.

## Context and dependencies

Depends on step-01 (#63, merged). Uses the existing Scoutwell session, not a new auth system. Scoutwell already exposes `GET /v1/scout/me` in `scoutwell-backend/internal/httpapi/scout.go` (`scoutMe`) and sets cookie `scoutwell_session` (`SCOUTWELL_SESSION_COOKIE`, default `scoutwell_session`). Leo's step-19 adds the `/extension` landing copy ("You can close this tab and return to the extension"); this step can open `/sign-in` or `/extension` on the Scoutwell origin.

Do not change Penny's backend. If `/v1/scout/me` were missing, stub behind the client interface and stop. On this branch the endpoint exists and returns `backend-core/scout.Profile`.

Related later steps: step-16 (submit requires this session), step-18 (badge uses signed-out/error states), step-19 (website sign-in landing).

What shipped in #68: typed `ScoutApiClient.getMe()`, cookie → `Authorization: Bearer`, build-time hosts (`VITE_SCOUT_API_HOST`, `VITE_SCOUTWELL_WEB_ORIGIN`), `useAuth` states, sign-in tab watchers, and `cookies` plus dev host permissions.

## In scope

- A small typed API client in `scout-extension/src/api/` that calls `GET /v1/scout/me` on the Scout API (local `http://127.0.0.1:8082`, prod host configurable).
- Read the Scoutwell session cookie on the web origin and send it as Bearer. Cookie name: `scoutwell_session` (match `scout-extension/src/api/config.ts` / backend default).
- Side panel states: loading, signed out (button opens the Scout website sign-in page in a new tab), signed in (scout name or email), error with retry.
- Re-check on panel open and when the sign-in tab closes or updates.
- Host permissions only for the Scout API host(s) and Scoutwell web origin, configurable for dev and prod via build-time env.
- Unit tests for the client and auth state logic.

## Out of scope

- No changes outside `scout-extension/**`. If the backend lacks a usable "me" endpoint, stub it, note it in the PR, and tell Elon (Penny owns the backend).
- No job capture, submit, earnings, or notifications.
- No new root dependencies. If one is truly needed, stop and ask Elon.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `scout-extension/src/api/client.ts` (new) — `ScoutApiClient`, `getMe()`
- `scout-extension/src/api/config.ts` (new) — `getApiHost()`, `getWebOrigin()`, `getSignInUrl()`, `getSessionCookieName()`
- `scout-extension/src/api/hosts.ts` (new) — `DEV_*` / `PRODUCTION_*` defaults and `resolveHost()`
- `scout-extension/src/api/types.ts` (new) — `ScoutProfile`, `AuthState`
- `scout-extension/src/hooks/useAuth.ts` (new)
- `scout-extension/src/auth/signInTab.ts` (new)
- `scout-extension/src/popup/App.tsx` — sign-in / signed-in UI
- `scout-extension/src/background/index.ts` — tab events that trigger an auth recheck
- `scout-extension/manifest.json` — add `cookies` and dev `host_permissions` only
- `scout-extension/vite.config.ts` — production host permissions from env
- Tests: `src/api/client.test.ts`, `src/api/config.test.ts`, `src/hooks/useAuth.test.ts`

## Implementation notes

### Hosts and env

| Variable                    | Purpose                           | Dev default             | Prod default                 |
| --------------------------- | --------------------------------- | ----------------------- | ---------------------------- |
| `VITE_SCOUT_API_HOST`       | Scout API base, no trailing slash | `http://127.0.0.1:8082` | `https://scout.joinedhq.com` |
| `VITE_SCOUTWELL_WEB_ORIGIN` | Sign-in page + cookie origin      | `http://localhost:6003` | `https://scout.joinedhq.com` |

Dev unpacked `host_permissions` (source manifest): `http://127.0.0.1:8082/*`, `http://localhost:8082/*`, `http://localhost:6003/*`. Production builds replace these via `vite.config.ts` (`uniqueHostPermissions([apiHost, webOrigin])`).

### Session contract

- Cookie: `scoutwell_session` on the Scoutwell web origin.
- `chrome.cookies.get({ url: webOrigin, name: "scoutwell_session" })` then `Authorization: Bearer <value>` on `GET /v1/scout/me`.
- 401 → signed-out. Network / 5xx → error state with retry.
- Response fields mirror `backend-core/scout.Profile` (id, name, email, and related scout fields). Duplicate the type locally; the extension does not depend on `@joined/scout`.

### Sign-in UX

- Signed-out button opens `getSignInUrl()` (Scoutwell `/sign-in` or `/extension`) in a new tab.
- Recheck auth when that tab closes or its URL updates (`src/auth/signInTab.ts` + background tab listeners).
- Backend CORS for `chrome-extension://…` is Penny's `EXTENSION_ORIGINS` on scoutwell-backend; do not edit that here.

## Acceptance criteria

1. `bun --filter scout-extension build`, `typecheck`, repo lint and format pass.
2. Loaded unpacked, the panel shows signed-out state with no backend running, and signed-in state against a local Scoutwell session.
3. Diff touches only `scout-extension/**` (plus `bun.lock` only if unavoidable, flagged in the PR).
4. Host permissions are limited to the configured API and web origins.

## Test and validation

```bash
bun --filter scout-extension typecheck
bun --filter scout-extension test
bun --filter scout-extension build
bun run ci lint
bun run ci format
```

Tests to add (and that shipped): client 401 vs success, host resolution for dev/prod, `useAuth` loading / signed-out / signed-in / error.

Manual: with scoutwell-backend on `127.0.0.1:8082` and scoutwell-frontend on `localhost:6003`, sign in on the website, open the side panel, confirm name/email. With backends down, confirm signed-out or error, not a crash.

## Risks and soft parks

- Extension types are duplicated from `packages/scout` / `backend-core/scout.Profile`. Keep them aligned when the Profile shape changes.
- Server profile flags `notify_decisions` / `notify_rewards` are unused until step-18 and are still not wired to the desktop-notification toggle.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #68), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
