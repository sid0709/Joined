# Step 36: Fit score API

- **Week:** W3
- **Status:** In review
- **Owner:** Ravi (platform backend lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(jobs): fit score and short reason (roadmap step-36)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** not merged. Open PR #108 (`cursor/fit-score-api-45cd`, commit `76dee07` as of the W3 review). Product work on this step is paused pending Quinn/Elon.

## Goal

Authenticated job search (or a dedicated fit read) returns a 0–100 fit score and a short reason so seekers can see why a job matches them. Guests get no score. Scoring must stay deterministic and must not fail the search request.

## Context and dependencies

Runs in parallel with step-34. Keep out of saved-search CRUD files if they would conflict.

Read `docs/14-job-pool-and-matching.md` (weights: role 30, skills 25, seniority 15, location 10, salary 10, visa 10) and current `/v1/search/jobs` plus profile/resume fields. Frontend already has a **client** scorer in `joined-frontend/lib/jobs/match.ts` (criterion id **`role`**, weights 35/35/15/15, no seniority) used by `use-job-search.ts`. Step-37 will consume this API; do not edit the frontend here.

**#108 as implemented (not on `stage-roadmap-w34` until merge):** new package `backend-core/fitscore/` and dedicated endpoints — **not** fields on `/v1/search/jobs`:

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/v1/me/fit/{jobId}` | Candidate session |
| POST | `/v1/me/fit` | Candidate; body `{ "jobIds": string[] }` max 100 |

`fitscore.Result`: `score` (0–100), `reason`, `confidence` (`high`\|`low`), `modelVersion` (`fitscore-v1`), `criteria[]` (`id`, `label`, `detail`, `level`), `needsVisa`.

Weights in PR `types.go`: title 30, skills 25, seniority 15, location **15**, salary **15** (re-normalized when dimensions are missing). Optional `fitscore.Reasoner` + `killswitch.AcornAI` exists; **`FitReasoner` is not set in `joined-backend/cmd/server/main.go`**. Criterion id is **`title`**, not frontend `role`.

If finishing #108, keep that contract unless Elon asks to move scores onto search/detail responses (the original step text). Document the gap either way.

## In scope

- A 0–100 fit score plus a short reason (top matching or missing factor) for a signed-in seeker. Guests get no score.
- Deterministic, testable scoring from existing profile/resume/job fields (role/skills/seniority/location/salary). Weights in named constants or config. Version the model (`model_version` / `modelVersion`).
- Do not block search if scoring fails; omit the fields and log (or return a partial batch and skip missing jobs).
- Go tests for scoring, guest vs signed-in, and response shape compatibility.

## Out of scope

- No frontend (Leo, step-37).
- No ML training, no embeddings unless already in-repo and cheap.
- No company-side applicant fit UI.
- No edits to `backend-core/scout/` or `backend-core/billing/`.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

On #108 / to land:

- `backend-core/fitscore/score.go`, `types.go`, `reason.go`, `memory.go`, `score_test.go` (new)
- `joined-backend/internal/httpapi/fit.go`, `fit_test.go` (new)
- `joined-backend/internal/httpapi/server.go` — `FitJobs`, `FitProfiles`, `FitReasoner` options
- `joined-backend/cmd/server/main.go` — wire stores; do **not** require Reasoner

If instead embedding on search (original spec, only if Elon redirects):

- `backend-core/jobs/search_query.go`, `catalog.go`
- `joined-backend/internal/httpapi/search.go`

Read only: `docs/14-job-pool-and-matching.md`, `docs/03-data-model.md` (`fit_scores` collection is a separate idea; #108 scores inline), `joined-frontend/lib/jobs/match.ts`.

## Implementation notes

**Auth:** candidate session. Guests / missing session → no score (404/401 on `/v1/me/fit/*`, or omitted fields if on search).

**Determinism:** same profile + job → same score and reason. Put weights in `fitscore` constants, not handler literals.

**Failure:** missing job in a batch is skipped (current PR). Search must not 500 because scoring failed.

**AI rewrite:** `Reasoner` stays optional and behind `KILLSWITCH_ACORN_AI`. Do not call OpenAI from tests.

**Alignment debt (record, do not silently "fix" unless the PR is still open and Elon agrees):**

- Weights differ from `docs/14` and from `match.ts`.
- Backend criterion id `"title"` vs frontend `"role"`.
- FitReasoner not wired.

Prefer documenting those in the PR over a surprise weight change that breaks step-37.

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass for touched modules.
2. Signed-in fit read includes a 0–100 score and a short reason; guest search / unauthenticated fit does not leak a score.
3. Scoring is deterministic in tests. A scoring failure does not fail the surrounding request.
4. Diff stays inside Ravi's lane.

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/fitscore/...
go test ./joined-backend/internal/httpapi/... -run Fit
```

Cover: high/low confidence, missing dimensions, guest vs signed-in, batch cap 100, missing job ids skipped, Reasoner injected in tests only.

Repo CI: `bun run ci`. Require real green, not cancelled jobs. Do not merge #108 from this docs task.

## Risks and soft parks

- **Weights differ from `docs/14` and `joined-frontend/lib/jobs/match.ts`.**
- **FitReasoner is not wired** in server `main`.
- **Backend id `"title"` vs frontend `"role"`.**
- Original acceptance said signed-in **search** includes `fit_score`; #108 uses dedicated endpoints. Step-37 must call those endpoints (or Elon must redirect).
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (#108 already open). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch. Do not merge from a docs-only agent.
