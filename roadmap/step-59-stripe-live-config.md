# Step 59: Stripe live config

- **Week:** W4
- **Status:** Planned
- **Owner:** Penny (billing lane)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(billing): stripe live keys wiring (roadmap step-59)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Production can use Stripe live keys **only after explicit user approval**. Code paths already refuse `sk_live_` unless `STRIPE_ALLOW_LIVE=true`. This step makes wiring and the runbook ready; it does not turn live mode on.

## Context and dependencies

Depends on Premium billing ([step-08](step-08-stripe-products-test-mode.md) #66, [step-29](step-29-premium-checkout-api.md) #90) and Acorn prices ([step-50](step-50-acorn-stripe-pricing.md)). Payout live mode is a **different** flag (`PAYOUT_ALLOW_LIVE` on [step-47](step-47-global-payout-provider.md) #113) and also needs this step’s user-approval rule before anyone sends real money.

Guard already exists: `backend-core/billing/config.go` `LoadConfig()` errors `live key detected but STRIPE_ALLOW_LIVE is not true`. Tests: `backend-core/billing/config_test.go`, `joined-backend/cmd/server/main_test.go`. README: `backend-core/billing/README.md`. Env today: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ALLOW_LIVE` (default false), Premium cents, checkout/portal URLs. Prices are lookup keys, not env price ids. Deploy secrets live in GitHub `production` (`deploy/README.md`).

## In scope

- Document and wire env: live secret, webhook secret, live price ids for Premium and Acorn **if** lookup keys are not enough in live, `STRIPE_ALLOW_LIVE`. Keep test mode the default.
- Confirm the live-key guard still fails closed. Add a runbook in `backend-core/billing/README.md`: who flips the flag, where GitHub production secrets live, how to roll back to test.
- **Do not put live keys in the repo.** Do not set production secrets in this PR. The PR only makes wiring + docs ready.
- Quote the user’s written approval in the PR before anyone sets `STRIPE_ALLOW_LIVE=true` in production. Without that quote, ship docs + tests only.

## Out of scope

- No charging real cards in CI. No deploy from `stage-roadmap-w34`.
- Do not enable live mode without a written user approval quoted in the PR.
- No Scout payout provider live keys unless the same approval names them.

## Files and areas to touch

- `backend-core/billing/config.go` — optional live price-id fields; guard stays
- `backend-core/billing/README.md` — runbook (new section)
- `backend-core/billing/config_test.go` — refuse-by-default stays
- `joined-backend/.env.example`, `backend-core/.env.example` — names only, test placeholders
- `deploy/README.md` — Elon if production secret names are listed
- Do not edit `.env` files that could hold secrets

## Implementation notes

Keep lookup keys (`joined_premium_monthly`, Acorn keys from step-50) as the default live resolution path. If live accounts need explicit price ids, name them:

| Variable                          | Role                                          |
| --------------------------------- | --------------------------------------------- |
| `STRIPE_SECRET_KEY`               | `sk_test_` default; `sk_live_` only with flag |
| `STRIPE_WEBHOOK_SECRET`           | matching mode                                 |
| `STRIPE_ALLOW_LIVE`               | `true` required for live keys                 |
| `STRIPE_PREMIUM_MONTHLY_PRICE_ID` | optional live override (only if implemented)  |
| `STRIPE_PREMIUM_YEARLY_PRICE_ID`  | optional                                      |
| `STRIPE_ACORN_MONTHLY_PRICE_ID`   | optional                                      |
| `STRIPE_ACORN_YEARLY_PRICE_ID`    | optional                                      |

Runbook must say: default is test; rollback is unset `STRIPE_ALLOW_LIVE` and restore `sk_test_`; GitHub Environment `production` is the only place live secrets belong; this branch never deploys.

Payout: document that `PAYOUT_ALLOW_LIVE` is a separate fail-closed switch and also requires this approval.

## Acceptance criteria

1. `go vet` and `go test` pass; live-key guard tests still cover refuse-by-default.
2. PR lists the exact env names and states that live secrets were **not** written.
3. Diff stays inside Penny's lane plus docs Elon approves.

## Test and validation

```bash
bun run vet:go
go test ./backend-core/billing/...
go test ./joined-backend/cmd/server/...
```

No Playwright against live Stripe. No `sk_live_` in the diff (`git grep`).

## Risks and soft parks

- Step-47: sandbox only; FakeProvider by default; live payouts need `PAYOUT_ALLOW_LIVE` plus this approval.
- Accidental commit of a live key is a launch blocker — run `git grep sk_live` / `rk_live` before push.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`. Live mode is **not** on unless the PR quotes user approval.
