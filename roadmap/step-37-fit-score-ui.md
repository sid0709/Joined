# Step 37: Fit score UI

- **Week:** W3
- **Status:** Planned
- **Owner:** Leo (web frontends lane: `joined-frontend/**`, `scoutwell-frontend/**`, `admin-frontend/**`, `connected-frontend/**`, `packages/google-signin/**`; UI from the external catalog package `sid-ui` — in-repo `packages/design-system` and `joined-theme` are gone after #115)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(joined-frontend): show fit score in search (roadmap step-37)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)

## Goal

Signed-in seekers see a fit score and the short reason on search results and the job page. Guests and responses that omit the score show nothing — no public negative score, no invented meter.

## Context and dependencies

**Starts after step-36 merges.** Step-36 is **In review** (#108), not on `stage-roadmap-w34` yet. Do not start product work until #108 lands (or Elon says to build against the PR contract).

#108 API (treat as the contract unless Elon redirects to search-payload fields):

- `GET /v1/me/fit/{jobId}`
- `POST /v1/me/fit` body `{ "jobIds": string[] }` (max 100)

Result: `score` 0–100, `reason`, `confidence`, `modelVersion` (`fitscore-v1`), `criteria[]` (`id`, `label`, `detail`, `level`), `needsVisa`. Criterion id is **`title`**, not the frontend's current **`role`**.

Today the UI already shows a client score: `joined-frontend/components/jobs/match-badge.tsx`, `job-match-card.tsx`, `lib/jobs/my-match.ts` → `matchJob` / `scoreFor` in `use-job-search.ts` and `job-results.tsx`. `job-result-card.tsx` takes a `score` prop. Job page: `app/(seeker)/jobs/[id]/page.tsx`, `job-page-view.tsx`, `job-detail-pane.tsx`. Types live in `lib/jobs/match.ts` and `lib/jobs/types.ts`.

Guests currently still get a client score from an empty profile. This step must hide the score when signed out or when the API omits it.

Soft parks from #108: weights differ from `docs/14` and `match.ts`; FitReasoner not wired; `"title"` vs `"role"`. Map ids in the UI; do not fork a second score shape.

## In scope

- `joined-frontend` search cards and `app/(seeker)/jobs/[id]` show the score and reason from step-36.
- Use `sid-ui` (badge/hint), not a custom meter.
- Hide the score for guests and when the API omits it.
- Types stay in the frontend job catalog / match module; do not invent a second score shape. Prefer extending `lib/jobs/match.ts` with an API-backed result that can still render `MatchBadge`.

## Out of scope

- No backend changes (do not "fix" weights or Reasoner).
- No company applicant fit UI.
- No public negative scores, no "this is a scam" badge (step-41 / docs/32).
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `joined-frontend/components/jobs/job-result-card.tsx`, `job-results.tsx`, `use-job-search.ts`
- `joined-frontend/components/jobs/match-badge.tsx`, `job-match-card.tsx`
- `joined-frontend/lib/jobs/match.ts`, `my-match.ts`, `types.ts`
- `joined-frontend/app/(seeker)/jobs/[id]/page.tsx`, `components/jobs/job-page-view.tsx`, `job-detail-pane.tsx`
- `joined-frontend/lib/me/pipeline.ts`, `app/api/me/[...path]/route.ts` — proxy `/v1/me/fit`
- New: `joined-frontend/lib/jobs/fit.ts` (client + constants) and `joined-frontend/lib/jobs/fit.test.ts`

Do not edit `backend-core/fitscore/` or search handlers.

## Implementation notes

**When to fetch:** signed-in browse — batch `POST /v1/me/fit` for the visible page of ids (≤100). Job page — `GET /v1/me/fit/{jobId}`. Do not call fit for guests.

**When API fails:** omit the badge and log; do not fall back to a guest-looking client score that contradicts the server. If Elon wants a client fallback while #108 is mid-review, gate it behind a named constant and hide it for guests.

**Id mapping:** API `criteria[].id === "title"` displays as the existing role/title label. Do not rename backend ids from the frontend.

**Thresholds:** `STRONG_MATCH` is 75 in `match.ts` and 80 in `applications.ts`. Use the job-catalog constant; do not introduce a third number.

**Design system:** Badge / Text / Tooltip from `sid-ui`. No hex, no custom circular meter.

**Hosts:** `JOINED_API_URL` via `lib/config.ts` only.

## Acceptance criteria

1. `bun --filter joined-frontend` typecheck, lint, and build pass.
2. Signed-in search shows score + reason from the API; signed-out search does not.
3. Job page matches search (same score/reason for the same job).
4. Missing/failed fit omits the badge rather than showing 0 or a guest client score.
5. Diff stays in Leo's lane.

## Test and validation

```bash
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun --filter joined-frontend build
bun test joined-frontend/lib/jobs/fit.test.ts
bun test joined-frontend/lib/jobs/search.test.ts
bun run ci lint
bun run ci typecheck
bun run format:check
```

Add tests for guest vs signed-in rendering helpers, title/role id mapping, and omitted-score behavior.

Human-run after #108 is on the branch: sign in, search, open a job, sign out, confirm the badge disappears.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- Blocked on step-36 merge. Building against client `matchJob` only is not this step.
- Weight and id mismatches will look "wrong" next to old client scores — replace or gate the client path.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34`. CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
