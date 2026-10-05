# Step 05: Scout share-of-applies earnings backend

- **Week:** W1, Scout critical path
- **Owner:** Penny (lane: `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`)
- **Target branch:** `stage-roadmap`
- **PR title:** `roadmap step-05: Scout share-of-applies earnings`

## Goal

Scouts earn a share when candidates apply to jobs they submitted, and the Scout API can report those earnings.

## In scope

- Investigate the existing `scout_submissions`, `scout_earnings`, and `scout_payouts` model in `backend-core/scout` and the Scoutwell routes. Read the Notion roadmap and Scout pay-model notes if referenced in the repo.
- A clear, configurable share-of-applies rule (for example a fixed credit per qualifying apply, with dedupe so one candidate applying twice to the same job counts once). Put the rate in config, not code.
- An idempotent `RecordApply(jobID, candidateID, appliedAt)`-style entry point in `backend-core/scout` that credits the right scout if the job came from a scout submission. Do not wire it into the candidate apply flow in this step (that needs Ravi's lane); note the integration point in the PR.
- Scoutwell read endpoints for a scout's earnings summary and ledger, with matching types in `packages/scout`.
- Go tests, including dedupe and idempotency.

## Out of scope

- No Stripe, no payouts, no real money movement.
- No changes outside Penny's lane.
- No production data writes.

## Acceptance criteria

1. `go vet` and `go test` pass for touched modules; TS typecheck passes for `packages/scout`.
2. Tests prove one credit per unique (job, candidate) apply and correct attribution.
3. Diff stays inside Penny's lane.
