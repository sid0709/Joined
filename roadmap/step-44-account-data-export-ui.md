# Step 44: Account data export UI

- **Week:** W3
- **Status:** Done
- **Owner:** Leo (web frontends lane: `joined-frontend/**`, `scoutwell-frontend/**`, `admin-frontend/**`, `connected-frontend/**`, `packages/google-signin/**`; UI from the external catalog package `sid-ui` — in-repo `packages/design-system` and `joined-theme` are gone after #115)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(joined-frontend): data export privacy settings (roadmap step-44)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)

## Goal

Settings privacy actually exports data, next to the existing delete-account surface. Request export downloads or queues the step-43 payload locally; delete still uses `DELETE /v1/auth/account`.

## Context and dependencies

**Starts after step-43 merges.** Step-43 is Planned — do not fake a download or keep the email-toast-only path once the API exists.

Current UI: `joined-frontend/components/settings/privacy-settings.tsx` — "Export everything" / "Request export" → `toast({ body: "We'll email you a download link within a few minutes." })` with **no fetch**. Copy says profile, resumes, applications, and messages as a **ZIP**. Step-43 may return JSON (or JSON + file URLs). Match the shipped API: download a file if `GET` returns a body; show "we'll email a link" only if the API is async and says so.

Delete (keep working): `components/settings/remove-account.tsx`, `danger-settings.tsx`, confirmation `DELETE` in `lib/settings.ts` `DELETE_CONFIRMATION`. Proxy: `joined-frontend/app/api/auth/account/route.ts` → `DELETE /v1/auth/account`.

Settings shell: `settings-workspace.tsx`, `app/(seeker)/(candidate)/settings/page.tsx`, section ids `privacy` and `danger` in `lib/settings.ts`.

Privacy toggles (audience, salary, activity) are local state only — do not pretend this step persists them unless an existing profile field already does.

## In scope

- Wire `privacy-settings.tsx` "Request export" to the step-43 endpoint (download or queued-email, depending on the API).
- Keep visibility toggles; make sure delete-account (danger section) still uses `DELETE /v1/auth/account`.
- Loading, error, and success states. `sid-ui` only (the privacy page already imports `Button`, `RadioList`, `Stack`, `Switch`, `useToast` from `sid-ui`).

## Out of scope

- No backend changes.
- No Scoutwell/admin export UI.
- No change to delete confirmation copy unless it is wrong after export lands.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `joined-frontend/components/settings/privacy-settings.tsx`
- `joined-frontend/components/settings/remove-account.tsx`, `danger-settings.tsx` — only if export/delete interaction needs a hint
- `joined-frontend/lib/settings.ts` — copy constants if the ZIP vs JSON sentence changes
- New: `joined-frontend/lib/account-export.ts` — fetch helper + named constants
- New: `joined-frontend/app/api/auth/account/export/route.ts` — session proxy to `/v1/auth/account/export` (mirror `app/api/auth/account/route.ts`)
- Tests: `joined-frontend/lib/account-export.test.ts`

Do not edit Go. Hosts from `joined-frontend/lib/config.ts` (`JOINED_API_URL`).

## Implementation notes

**Happy path (sync GET, preferred if step-43 shipped it):**

1. Button → loading.
2. `GET /api/auth/account/export` with credentials.
3. `200` → download the body (`application/json` or `application/zip`) with a named filename constant (for example `joined-account-export.json`).
4. Success toast. Do not put the payload in the toast or in `console.log`.

**Async path (only if step-43 returns a job id):** show the server's message; do not invent an email promise.

**Errors:** 401 → sign-in. 429 → rate-limit copy from the API or a named string. 5xx → generic toast.

**Delete:** unchanged `DELETE /api/auth/account`. Optional one-line hint above danger: export before you delete.

**Design system:** Button, Toast from `sid-ui`, existing `SettingsGroup` / `SettingsRow`. Tokens only. No local buttons.

**Toggles:** audience / salary / activity stay as they are (local) unless you are already on a profile PATCH path — do not expand this PR into a privacy-backend project.

## Acceptance criteria

1. `bun --filter joined-frontend` typecheck, lint, and build pass.
2. Request export downloads or queues the step-43 payload locally; the old email-only toast is gone unless the API is actually async email.
3. Delete still works with the `DELETE` confirmation.
4. Loading, error, and 429 states are visible.
5. Diff stays in Leo's lane.

## Test and validation

```bash
bun test joined-frontend/lib/account-export.test.ts
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun --filter joined-frontend build
bun run ci lint
bun run ci typecheck
bun run format:check
```

Unit-test filename / content-type handling and 429 mapping. Human-run after step-43: settings → privacy → export → file downloads; danger → delete still confirms.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- Blocked on step-43. Shipping another fake toast is a bug.
- ZIP copy vs JSON API — update the settings sentence to match the real file.
- Privacy toggles remain local; do not advertise them as server-saved.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34`. CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
