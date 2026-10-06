# Step 05: Scout share-of-applies earnings backend

- **Week:** W1
- **Status:** Done
- **Owner:** Penny (lane: `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scout): credit scout earnings on applies (roadmap step-05)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#69](https://github.com/sid0709/Joined/pull/69) (`5801d0c`). Follow-up hardening: [#84](https://github.com/sid0709/Joined/pull/84) (`2e427c6`). Soft cleanup: [#87](https://github.com/sid0709/Joined/pull/87)

## Goal

Scouts earn a configurable share when a candidate applies to a job they submitted, and the Scout API can report those earnings as a summary and a ledger. Attribution is idempotent: one candidate applying twice to the same job counts once.

## Context and dependencies

Existing Scout model in `backend-core/scout`: collections `scout_submissions`, `scout_earnings`, `scout_payouts` (`store.go`). Reward table lives in `rewards.go`. Scoutwell already serves session-authenticated `/v1/scout/*` routes in `scoutwell-backend/internal/httpapi/scout.go`. Shared TS types are `@joined/scout` (`packages/scout`).

Do not wire `RecordApply` into the candidate apply flow in this step — that handler is Ravi's lane. Document the hook in `backend-core/scout/APPLY_INTEGRATION.md` and stop.

Leo's step-20 consumes `GET /v1/scout/earnings` and `GET /v1/scout/earnings/summary`. Step-08 (Stripe) is parallel and must stay in `backend-core/billing/**`. Step-27/28 are later intake and notification APIs.

What shipped in #69: `(*Store).RecordApply`, `SCOUT_APPLY_REWARD_CENTS` (default 50), unique partial index on apply earnings, `GET /v1/scout/earnings/summary`, `apply` on `RewardTable` / `@joined/scout` types. #84: credit only the newest **approved** submission for a `jobId` (then highest `_id`); stale rejected / needs-review rows never win.

## In scope

- A configurable share-of-applies rule (fixed credit per qualifying apply). Rate in config, not code: `SCOUT_APPLY_REWARD_CENTS`.
- Idempotent `RecordApply(ctx, jobID, candidateID, appliedAt)` in `backend-core/scout` that credits the right scout if the job came from an approved scout submission.
- Scoutwell read endpoints for a scout's earnings summary and ledger, with matching types in `packages/scout`.
- Go tests for dedupe, idempotency, approved-only attribution, and newest-submission tie-break.
- Integration note for Ravi's apply handler (`APPLY_INTEGRATION.md`).

## Out of scope

- No Stripe, no payouts, no real money movement.
- No wiring into joined-backend candidate apply (Ravi).
- No changes outside Penny's lane.
- No production data writes.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `backend-core/scout/applies.go` — `RecordApply`
- `backend-core/scout/applies_test.go`
- `backend-core/scout/config.go` — `SCOUT_APPLY_REWARD_CENTS`
- `backend-core/scout/rewards.go` — `ApplyReward` on `RewardTable`
- `backend-core/scout/summary.go` — `EarningsSummary`
- `backend-core/scout/earnings.go` — `ListEarnings`
- `backend-core/scout/store.go` — collections and indexes
- `backend-core/scout/APPLY_INTEGRATION.md` (new)
- `scoutwell-backend/internal/httpapi/scout.go` — `scoutEarnings`, `scoutEarningsSummary`, `scoutMeta` rulebook
- `packages/scout/src/types.ts` — `RewardType` `"apply"`, `Earning`, `EarningsSummary`
- `packages/scout/src/labels.ts` — `REWARD_TYPE.apply`

## Implementation notes

### `RecordApply`

```go
func (s *Store) RecordApply(ctx context.Context, jobID, candidateID string, appliedAt time.Time) (*Earning, error)
```

- Idempotent: duplicate `(job, candidate)` → `(nil, nil)`.
- Non-scout jobs → `(nil, nil)` (no error).
- Only `approved` submissions. If several approved rows share `jobId`, pick newest `submittedAt`, then highest `_id` (#84).
- Apply earnings: `type: "apply"`, status `released` immediately (no hold).
- Unique partial index on `(type=apply, submissionId, jobId, candidateId)` in `scout_earnings`.

### Config

| Variable                   | Default | Module                         |
| -------------------------- | ------- | ------------------------------ |
| `SCOUT_APPLY_REWARD_CENTS` | `50`    | `backend-core/scout/config.go` |

`scoutMeta` must read the store rulebook so `apply_reward` matches env.

### Read API (session or API key)

| Method | Path                         | Query                                        | Response                                                                   |
| ------ | ---------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| `GET`  | `/v1/scout/earnings`         | `status`, `submission_id`, `cursor`, `limit` | `scout.List` `{data, next_cursor}`                                         |
| `GET`  | `/v1/scout/earnings/summary` | —                                            | `EarningsSummary` `{by_type, total}` (`Money`: `amount_cents`, `currency`) |

Money and labels come from `@joined/scout`. Do not hard-code dollar strings in the API.

## Acceptance criteria

1. `go vet` and `go test` pass for touched modules; TS typecheck passes for `packages/scout`.
2. Tests prove one credit per unique `(job, candidate)` apply and correct attribution to the newest approved submission.
3. Diff stays inside Penny's lane.
4. `APPLY_INTEGRATION.md` names the joined-backend hook and the env var.

## Test and validation

```bash
go test ./backend-core/scout/...
bun run vet:go
bun --filter @joined/scout typecheck
bun run ci go
```

Cover `TestRecordApply*` (first credit, idempotent retry, non-scout no-op, rejected/needs-review ignored, newest approved wins). Config: `TestApplyRewardConfig`.

Manual: seed an approved submission, call `RecordApply` twice with the same pair, confirm one ledger row and matching summary. The human runs scoutwell-backend; do not start it from this task.

## Risks and soft parks

- `RecordApply` is still not wired into the candidate apply handler. Until Ravi lands that hook, no live apply creates an earning.
- #84 attribution rules must stay in tests; do not credit stale rows.
- #87 is a later soft cleanup (intake/idempotency/docs). Do not expand this PR into that work.
- E2E smoke (step-14 / step-31) is still `continue-on-error: true` in `.github/workflows/e2e-smoke.yml`. That is Quinn's park, not this step's blocker.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #69; hardening #84), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
