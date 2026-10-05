# Step 35: Saved searches UI and email alert preferences

- **Week:** W3
- **Status:** Planned
- **Owner:** Leo (web frontends lane: `joined-frontend/**`, `scoutwell-frontend/**`, `admin-frontend/**`, `connected-frontend/**`, `packages/google-signin/**`; UI from the external catalog package `sid-ui` — in-repo `packages/design-system` and `joined-theme` are gone after #115)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(joined-frontend): saved searches and alert preferences (roadmap step-35)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)

## Goal

Seekers can save a search from the job browse UI, manage the list, and choose email alert preferences for each saved search. Save, apply, update alerts, and delete work against the step-34 API.

## Context and dependencies

**Starts after step-34 merges.** Step-34 is Done (#106) on `stage-roadmap-w34`. API:

| Method | Path |
| --- | --- |
| GET/POST | `/v1/me/saved-searches` |
| GET/PATCH/DELETE | `/v1/me/saved-searches/{id}` |

`SavedSearch`: `id`, `userId`, `name`, `query`, `filters`, `alertFrequency` (`off`\|`daily`\|`weekly`), timestamps. `filters` match `/v1/search/jobs` (`location`, `workplace`, `employment`, `seniority`, `company`, `salaryMin`, `salaryMax`, `currency`, `postedDays`, `remote`, `sort`, `source`). Cap **20** (`MaxPerUser`). No `instant` cadence.

Browse today: `joined-frontend/app/(seeker)/(candidate)/(browse)/page.tsx`, `components/jobs/job-search.tsx`, `job-search-bar.tsx`, `job-filters-panel.tsx`, `use-job-search.ts`. Local-only "saved query" / `RECENT_SEARCHES` in `lib/jobs/index.ts`. Alert toggle in `job-search-bar.tsx` (`alertOn` / `onToggleAlert`) is UI-only.

Settings already has an alerts section: `joined-frontend/lib/settings.ts`, `components/settings/alert-settings.tsx`. `ALERT_FREQUENCIES` includes `instant` — do not send `instant` to this API.

Proxy pattern: `joined-frontend/app/api/me/[...path]/route.ts` + `lib/me/pipeline.ts` / `lib/me/load.ts`. Call `/api/me/saved-searches` so the session cookie forwards to joined-backend.

Email sending is step-11 (already merged). This UI only stores cadence.

## In scope

- Screens in `joined-frontend`: save current filters as a named search, list/rename/delete saved searches, apply a saved search back onto browse.
- Alert preference controls (on/off and cadence) calling the step-34 fields. Wire saved-search alerts in settings or next to the list, using `sid-ui`.
- Empty, loading, and error states. No account enumeration.
- Map `JobFilters` ↔ API `filters` in one module; do not invent a second search type.

## Out of scope

- No backend changes (Ravi). Do not "fix" the 20-cap race or `MarkAlerted` in this PR.
- No real email sending UI beyond storing `alertFrequency`.
- No Scoutwell or admin UI.
- No fit score UI (step-37).
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `joined-frontend/components/jobs/job-search.tsx`, `job-search-bar.tsx`, `job-filters-panel.tsx`, `use-job-search.ts`
- `joined-frontend/lib/jobs/search.ts` — `JobFilters` mapping
- `joined-frontend/lib/jobs/index.ts` — decide how `RECENT_SEARCHES` coexists
- `joined-frontend/lib/me/pipeline.ts`, `joined-frontend/app/api/me/[...path]/route.ts` — extend if the proxy already covers `/v1/me/*`
- `joined-frontend/lib/settings.ts`, `joined-frontend/components/settings/alert-settings.tsx`, `settings-workspace.tsx`
- New: `joined-frontend/lib/saved-searches.ts` (or similar) — client + mapping + named constants (`MAX_SAVED_SEARCHES` must match 20, or read from API errors)
- New tests: `joined-frontend/lib/saved-searches.test.ts`

Do not copy `sid-ui` primitives into the app. Do not edit Go. Do not reintroduce `packages/design-system`.

## Implementation notes

**Mapping (required):**

| Browse `JobFilters` | API `filters` / `query` |
| --- | --- |
| `q` | `query` |
| `where` | `location` |
| workplace / employment / seniority arrays | single string (first selected, or join only if the API later allows it — today: **one value**) |
| `minPay` | `salaryMin` |
| `posted` enum | `postedDays` |
| `visa` | **not on API** — keep as browse-only; do not drop it from local filters when applying a saved search that lacks it |
| toolbar hidden | `source: "hidden"` |

**Cadence:** UI may show Off / Daily / Weekly. If settings still lists Instant, either hide it for saved-search alerts or map Instant → `daily` and say so in the PR. Never POST `instant`.

**Cap:** 20. Show the API error when create fails. Do not silently drop rows.

**Auth:** signed-out save sends the user to sign-in. Empty list is an empty state, not an error.

**Components:** Button, TextField, Dialog, Toast, Select/Radio from `sid-ui`. Tokens only — no hex, no local buttons.

**Constants:** name max 80, query max 200 — match `backend-core/savedsearch/types.go`. Hosts from `joined-frontend/lib/config.ts`.

## Acceptance criteria

1. `bun --filter joined-frontend typecheck`, lint, and `bun --filter joined-frontend build` pass. Repo `bun run format:check` passes.
2. Save, apply, update alerts, and delete work locally against the step-34 API.
3. Applying a saved search restores browse filters (including `source=hidden` when set).
4. Guests cannot list another user's searches. Errors do not enumerate accounts.
5. Diff stays in Leo's lane.

## Test and validation

```bash
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun --filter joined-frontend build
bun test joined-frontend/lib/saved-searches.test.ts
bun run ci lint
bun run ci typecheck
bun run format:check
```

Add unit tests for filter mapping both directions, cadence enum, and cap/error handling. Do not start Next or click through localhost (repo rule). Human-run: browse → save → refresh → apply → change cadence → delete.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- Step-34 cap race and ID-only `MarkAlerted` are backend follow-ups, not this UI.
- `instant` in settings vs API `off|daily|weekly` will confuse users if both appear.
- Local recent-searches must not be presented as server-saved.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34`. CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
