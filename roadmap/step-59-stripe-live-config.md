# Step 59: Stripe live config

- **Week:** W4, Launch prep
- **Owner:** Penny (billing lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(billing): stripe live keys wiring (roadmap step-59)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

Production can use Stripe live keys **only after explicit user approval**. Code paths already refuse `sk_live_` unless `STRIPE_ALLOW_LIVE=true`.

## In scope

- Document and wire env: live secret, webhook secret, live price ids for Premium and Acorn, `STRIPE_ALLOW_LIVE`. Keep test mode the default.
- Confirm the live-key guard in `backend-core/billing` still fails closed. Add a runbook in the billing README: who flips the flag, where GitHub production secrets live, how to roll back to test.
- **Do not put live keys in the repo.** Do not set production secrets in this PR. The PR only makes wiring + docs ready.

## Out of scope

- No charging real cards in CI. No deploy from this branch.
- Do not enable live mode without a written user approval quoted in the PR.

## Acceptance criteria

1. `go vet` and `go test` pass; live-key guard tests still cover refuse-by-default.
2. PR lists the exact env names and states that live secrets were **not** written.
3. Diff stays inside Penny's lane plus docs Elon approves.
