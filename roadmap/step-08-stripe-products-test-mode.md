# Step 08: Stripe account wiring and products (test mode)

- **Week:** W1
- **Status:** Done
- **Owner:** Penny (lane: `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(billing): stripe products in test mode (roadmap step-08)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#66](https://github.com/sid0709/Joined/pull/66) (`a67bd27`)
- **Runs in parallel with step-05.** Work only in the new `backend-core/billing/` package so it cannot conflict with `backend-core/scout`.

## Goal

Joined has a Stripe billing package ready for Premium, using Stripe test mode only. Live keys cannot start the package unless an explicit allow flag is set. No checkout routes are mounted in this step.

## Context and dependencies

There is no billing package yet at the start of this step. Checkout, customer portal, and Mongo subscription state are W2 step-29. Leo's step-21 pricing page needs those routes. Ravi mounts billing on joined-backend in follow-up [#93](https://github.com/sid0709/Joined/pull/93) (step-29 wiring). Soft cleanup of orphan Stripe prices is [#87](https://github.com/sid0709/Joined/pull/87).

What shipped in #66: new `backend-core/billing/` with env config, live-key guard, a minimal HTTP Stripe client + fake (no official Stripe Go SDK), idempotent `SyncProducts` (lookup keys `joined_premium_monthly` / `joined_premium_yearly`), webhook verifier + event router skeleton, package README. Checkout/store/handlers files arrived later in step-29.

## In scope

- New `backend-core/billing/` package: config from env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price amounts), refuse to start with a live key (`sk_live_` / `rk_live_`) unless `STRIPE_ALLOW_LIVE=true`.
- A product and price catalog for Joined Premium (monthly and yearly, amounts in config) and an idempotent sync function that creates or updates them in Stripe test mode using lookup keys or metadata.
- A webhook verifier and event router skeleton (signature check, idempotency store, handlers stubbed for checkout and subscription events).
- Thin Stripe client interface so tests use a fake; no network calls in tests.
- Document env vars in the package README. Do not edit any `.env` file.

## Out of scope

- No checkout or billing page (W2 steps 21 and 29).
- No wiring into any service's routes (Ravi / #93). Note the integration point in the README.
- No live keys, no real charges.
- Prefer a minimal HTTP client over adding the Stripe Go SDK to `go.mod`. If a module change is required, stop and ask Elon.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `backend-core/billing/` (new package)
- `backend-core/billing/config.go` and `config_test.go`
- `backend-core/billing/client.go`, `fake.go`, `client_test.go`
- `backend-core/billing/products.go` and `products_test.go` — `SyncProducts`
- `backend-core/billing/webhook.go` and `webhook_test.go`
- `backend-core/billing/idempotency.go` and tests
- `backend-core/billing/README.md` — env + "Integration (Ravi)" note
- `backend-core/go.mod` / `go.sum` only if Elon approved a new module (not needed for the HTTP client)

Do not edit `joined-backend/**`, `scoutwell-backend/**`, or `backend-core/scout/**`.

## Implementation notes

### Env (`backend-core/billing/config.go`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes for `LoadConfig()` | API key; test `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | For webhook verify | Signature secret |
| `STRIPE_ALLOW_LIVE` | No (default false) | Allow `sk_live_` / `rk_live_` |
| `PREMIUM_MONTHLY_PRICE_CENTS` | No (default **2900**) | Monthly amount |
| `PREMIUM_YEARLY_PRICE_CENTS` | No (default **29000**) | Yearly amount |
| `BILLING_CHECKOUT_SUCCESS_URL` | No | Reserved for step-29 |
| `BILLING_CHECKOUT_CANCEL_URL` | No | Reserved for step-29 |
| `BILLING_PORTAL_RETURN_URL` | No | Reserved for step-29 |

`LoadConfig()` must error if the key is live and `STRIPE_ALLOW_LIVE` is not true.

### Catalog

- Product metadata: `joined_premium`
- Price lookup keys: `joined_premium_monthly`, `joined_premium_yearly`
- Amounts from `PREMIUM_*_PRICE_CENTS`
- `SyncProducts(ctx, client, cfg)` creates or updates idempotently

### Webhook skeleton

- `NewWebhookRouter(webhookSecret, idempotencyStore)`
- Events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`
- Path constant: `WebhookPath = "/v1/webhooks/stripe"`
- `UseService(*Service)` hook for later persistence (step-29)
- Tests use `NewFakeClient()` — no network

## Acceptance criteria

1. `go vet` and `go test` pass for `backend-core/billing`.
2. Live-key guard is tested.
3. Diff stays inside `backend-core/billing/**` (plus a flagged `go.mod` / `go.sum` change only if Elon approved it).
4. README lists env vars and the joined-backend mount point for Ravi.

## Test and validation

```bash
go test ./backend-core/billing/...
bun run vet:go
bun run ci go
```

Cover live-key rejection, `SyncProducts` create vs update via the fake client, webhook signature failure, idempotent event ids.

Do not call Stripe from CI. Do not start joined-backend.

## Risks and soft parks

- This package is inert until #93 / step-29 mounts `/v1/me/billing/*` and the webhook on joined-backend.
- #87 later cleans orphan active prices in `products.go`. Do not expand this PR into that cleanup.
- Step-59 is the live-key step and needs explicit user approval. Never set `STRIPE_ALLOW_LIVE` here.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #66), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
