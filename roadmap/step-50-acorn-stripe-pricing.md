# Step 50: Acorn Stripe pricing

- **Week:** W3
- **Status:** Planned
- **Owner:** Penny (billing lane: `backend-core/billing/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(billing): acorn pricing and stripe products (roadmap step-50)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Acorn has Stripe products and prices in test mode, reusing Joined Premium billing patterns, so the website ([step-51](step-51-acorn-billing-legal-delete.md)) can start checkout without live keys.

## Context and dependencies

Depends on [step-08](step-08-stripe-products-test-mode.md) (Done, #66) and [step-29](step-29-premium-checkout-api.md) (Done, #90; mount #93). Website billing page is Leo, step-51. Live keys are [step-59](step-59-stripe-live-config.md) and need explicit user approval.

`backend-core/billing` is Premium-only today. Live keys fail closed unless `STRIPE_ALLOW_LIVE=true` (`config.go`, tests in `config_test.go`). Catalog lookup keys: `joined_premium`, `joined_premium_monthly`, `joined_premium_yearly` (`products.go`). Checkout uses `PriceByLookupKey`, not env price ids. Routes (constants in `handlers.go` / `types.go`), mounted on joined-backend:

- `POST /v1/me/billing/checkout` — `{ plan: "monthly"|"yearly", success_url, cancel_url }` → `{ url }`
- `POST /v1/me/billing/portal` — `{ return_url }` → `{ url }`
- `GET /v1/me/billing/subscription` — `{ premium, status, plan, current_period_end }`
- `POST /v1/webhooks/stripe`

Fake client: `billing.NewFakeClient()`. Docs: `backend-core/billing/README.md`. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ALLOW_LIVE`, `PREMIUM_MONTHLY_PRICE_CENTS` (default 2900), `PREMIUM_YEARLY_PRICE_CENTS` (default 29000), checkout/portal URL defaults.

There is no Acorn product, `IsAcorn`, or Acorn lookup key.

## In scope

- Extend `backend-core/billing` with an Acorn product/price catalog (monthly/yearly or the current Acorn plan list), lookup keys, and env cents (same pattern as Premium).
- Checkout/session helpers the website can call; same webhook skeleton and idempotency as Premium. Distinguish Acorn vs Premium subscriptions in store metadata so `IsPremium` does not treat an Acorn purchase as Joined Premium.
- Tests with `NewFakeClient`; no network.
- Document env vars in `backend-core/billing/README.md`. Do not edit `.env` files.
- If a route must live under Acorn’s API, Elon coordinates the `backend-core/acornapi` mount; Penny still owns billing types. Default: add Acorn plan to the existing `/v1/me/billing/*` contract (new plan enum value) **or** parallel `/v1/me/acorn-billing/*` constants — pick one and document it.

## Out of scope

- No live keys (step-59). No website billing page (Leo, step-51).
- No Scout payout changes (46/47).
- No `acorn*` git branch.

## Files and areas to touch

- `backend-core/billing/products.go` — Acorn `SyncProducts` keys
- `backend-core/billing/config.go` — Acorn cents env
- `backend-core/billing/types.go`, `checkout.go`, `handlers.go` — plan enum / product metadata
- `backend-core/billing/README.md`
- Tests: `products_test.go`, `checkout_test.go`, `config_test.go`, `webhook_apply_test.go`
- Optional mount: `joined-backend/internal/httpapi/server.go` or `backend-core/acornapi` (Elon)
- `packages/scout` — do not touch unless payouts accidentally share types (they should not)

## Implementation notes

**Suggested lookup keys** (name them as constants, do not scatter strings):

- Product metadata: `acorn_pro` (or the agreed Acorn product id)
- Prices: `acorn_pro_monthly`, `acorn_pro_yearly`

**Suggested env:**

| Variable                    | Role                                          |
| --------------------------- | --------------------------------------------- |
| `ACORN_MONTHLY_PRICE_CENTS` | Acorn monthly cents (named default in config) |
| `ACORN_YEARLY_PRICE_CENTS`  | Acorn yearly cents                            |
| existing `STRIPE_*`         | unchanged; live guard still applies           |

Checkout body should name the product (`premium` vs `acorn`) plus plan, or use distinct paths. Webhooks must write the product onto the stored subscription. `IsPremium` stays Premium-only.

Keep `STRIPE_ALLOW_LIVE` fail-closed. Tests never set live keys.

## Acceptance criteria

1. `go vet` and `go test` pass for `backend-core/billing` (and the mount module if touched).
2. Live-key guard still holds. Acorn prices sync in test mode via the fake.
3. An Acorn checkout does not flip `IsPremium` for Joined.
4. Diff stays inside Penny's lane (plus a flagged Elon/acornapi mount if required).

## Test and validation

```bash
bun run vet:go
go test ./backend-core/billing/...
go test ./joined-backend/...   # if mount changes
```

Add fake-client tests: sync Acorn lookup keys twice (idempotent), checkout monthly/yearly, webhook marks Acorn entitlement, live key refused without `STRIPE_ALLOW_LIVE`.

## Risks and soft parks

- Mixing Acorn and Premium on one Stripe customer is fine; mixing entitlements in one boolean is not.
- Step-59 will document live price ids; this step uses lookup keys, same as Premium.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
