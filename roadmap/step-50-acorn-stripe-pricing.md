# Step 50: Acorn Stripe pricing

- **Week:** W3
- **Status:** Done
- **Owner:** Penny (billing lane: `backend-core/billing/**`; **coordinate Elon** for an `acorn-backend` mount)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(billing): acorn pricing and stripe products (roadmap step-50)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Acorn has Stripe products and prices in test mode, reusing Joined Premium billing patterns, so `acorn-frontend` ([step-51](step-51-acorn-billing-legal-delete.md)) can start checkout without live keys.

## Context and dependencies

Depends on [step-08](step-08-stripe-products-test-mode.md) (Done, #66) and [step-29](step-29-premium-checkout-api.md) (Done, #90; mount #93). Website billing page already exists as **sample data** on `acorn-frontend` `/billing` (`lib/billing.ts` — checkout buttons off). Live keys are [step-59](step-59-stripe-live-config.md).

`backend-core/billing` is Premium-only today. Live keys fail closed unless `STRIPE_ALLOW_LIVE=true`. Catalog lookup keys: `joined_premium`, `joined_premium_monthly`, `joined_premium_yearly`. Checkout uses `PriceByLookupKey`. Joined routes on joined-backend:

- `POST /v1/me/billing/checkout`
- `POST /v1/me/billing/portal`
- `GET /v1/me/billing/subscription`
- `POST /v1/webhooks/stripe`

Fake client: `billing.NewFakeClient()`. Docs: `backend-core/billing/README.md`.

Acorn HTTP lives on **`acorn-backend`** (`/acorn/*`, `AcornDB`), not `backend-core/acornapi` (removed in #115). If Acorn checkout is mounted, Elon adds it in `acorn-backend/cmd/server` + `acornapi`. Penny still owns billing types.

`acorn-frontend` uses `acorn_session` and `ACORN_API_URL` — not Joined `/v1/me/billing`.

## In scope

- Extend `backend-core/billing` with an Acorn product/price catalog (align with `acorn-frontend/lib/billing.ts` plans `free` / `pro` / `unlimited` or document why only paid tiers sync to Stripe), lookup keys, and env cents.
- Checkout/session helpers `acorn-frontend` can call; same webhook skeleton and idempotency as Premium. Distinguish Acorn vs Premium so `IsPremium` does not treat an Acorn purchase as Joined Premium.
- Tests with `NewFakeClient`; no network.
- Document env vars in `backend-core/billing/README.md`. Do not edit `.env` files.
- Mount: Elon coordinates `acorn-backend` (suggested `/acorn/billing/*` or reuse handler constants with an Acorn mux). Default is **not** joined-backend `/v1/me/billing` unless the PR explains shared-customer mapping.

## Out of scope

- No live keys (step-59). No website polish (Leo, step-51) except consuming the new contract.
- No Scout payout changes (46/47).
- No `acorn*` git branch.

## Files and areas to touch

- `backend-core/billing/products.go`, `config.go`, `types.go`, `checkout.go`, `handlers.go`, `README.md`
- Tests: `products_test.go`, `checkout_test.go`, `config_test.go`, `webhook_apply_test.go`
- Optional mount: `acorn-backend/cmd/server/routes.go`, `acorn-backend/acornapi/` (Elon)
- `acorn-frontend/lib/billing.ts` — only if Penny/Leo agree to share plan ids (usually step-51)

## Implementation notes

**Suggested lookup keys** (constants, not scattered strings):

- Product metadata: `acorn_pro` (plus unlimited if that plan is paid)
- Prices: `acorn_pro_monthly`, `acorn_pro_yearly`

**Suggested env:**

| Variable                    | Role                                |
| --------------------------- | ----------------------------------- |
| `ACORN_MONTHLY_PRICE_CENTS` | Acorn paid monthly cents            |
| `ACORN_YEARLY_PRICE_CENTS`  | Acorn paid yearly cents             |
| existing `STRIPE_*`         | unchanged; live guard still applies |

Checkout body names the Acorn plan. Webhooks write product metadata onto the stored subscription. `IsPremium` stays Joined Premium-only.

Keep `STRIPE_ALLOW_LIVE` fail-closed. Tests never set live keys. Acorn customers live in `AcornDB` if the mount is on acorn-backend — do not silently write Joined billing rows for Acorn accounts.

## Acceptance criteria

1. `go vet` and `go test` pass for `backend-core/billing` (and `acorn-backend` if mounted).
2. Live-key guard still holds. Acorn prices sync in test mode via the fake.
3. An Acorn checkout does not flip `IsPremium` for Joined.
4. Diff stays inside Penny's lane plus a flagged Elon `acorn-backend` mount.

## Test and validation

```bash
bun run vet:go
go test ./backend-core/billing/...
go test ./acorn-backend/...   # if mount changes
```

Add fake-client tests: sync Acorn lookup keys twice (idempotent), checkout, webhook entitlement, live key refused without `STRIPE_ALLOW_LIVE`.

## Risks and soft parks

- Mixing Acorn and Premium on one Stripe customer is optional; mixing entitlements in one boolean is not.
- `acorn-frontend` plan ids (`free`/`pro`/`unlimited`) must match the catalog or step-51 will drift.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
