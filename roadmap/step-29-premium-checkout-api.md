# Step 29: Premium checkout API (Stripe test mode)

- **Week:** W2
- **Status:** Done
- **Owner:** Penny (money and Scout backend lane: `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(billing): premium checkout and portal in test mode (roadmap step-29)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #90 (`6abce29`). Follow-up mount: #93 (`7505ec5` `feat(joined-backend): mount premium billing routes (roadmap step-29 wiring)`)

## Goal

Joined Premium can be bought and managed through Stripe Checkout and the customer portal, in test mode only. Replaying the same webhook event updates the subscription once. Other services can call `IsPremium(userID)`.

## Context and dependencies

Starts after step-08 (Stripe products in test mode) merges — builds on the billing package and webhook router. Step-21 is Leo's Premium billing page (frontend); this step is the API only. Live keys stay blocked by the step-08 guard (`STRIPE_ALLOW_LIVE`, default false).

`backend-core/billing/README.md` is the operator doc. `docs/31-payments-wallet-escrow.md` mentions `POST /v1/webhooks/stripe`. `KILLSWITCH_CHECKOUT` (step-26) is documented for wrapping checkout and is **not** implemented in `billing/handlers.go` today.

Route wiring in joined-backend is a thin mount (`openBilling()` when `STRIPE_SECRET_KEY` is set). The original Ravi-facing note is satisfied by #93; do not expand into Leo's frontend or Scoutwell.

## In scope

- In `backend-core/billing`: create a Checkout session for the monthly or yearly price, create a customer-portal session, and map Stripe customers to Joined user ids.
- Webhook handlers for checkout completed and subscription created, updated, and deleted that keep a `subscriptions` record (status, plan, period end) idempotently.
- A small `IsPremium(userID)` read for other services.
- Note (or land, if Elon split it) the route wiring point in joined-backend.
- Fake Stripe client in tests; no network in tests.

## Out of scope

- No live keys or real charges (the step-08 live-key guard stays).
- No frontend (step-21).
- No route wiring outside Penny's lane except the flagged joined-backend mount Elon already coordinated as #93.
- No production data writes. No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `backend-core/billing/handlers.go` — route constants + HTTP handlers
- `backend-core/billing/checkout.go` — `CreateCheckoutSession`, `CreatePortalSession`, `IsPremium`
- `backend-core/billing/webhook.go` — signed router, subscription events
- `backend-core/billing/mongo.go` — `billing_customers`, `subscriptions`
- `backend-core/billing/config.go` — env + live-key guard
- `backend-core/billing/README.md`
- `backend-core/billing/*_test.go` — fake client
- `joined-backend/cmd/server/main.go` — `openBilling()` (mount if `STRIPE_SECRET_KEY` set)
- `joined-backend/internal/httpapi/server.go` — register on candidate mux + webhook
- `joined-backend/internal/httpapi/session.go` — `billingCurrentUser`
- `joined-backend/internal/httpapi/billing_routes_test.go`
- `joined-backend/.env.example` — Stripe + kill-switch notes

A `go.mod` / `go.sum` change only if Elon approved it. Do not edit `scoutwell-backend/**` or Leo's apps.

## Implementation notes

**Mounted only when `STRIPE_SECRET_KEY` is non-empty.** Otherwise billing routes 404.

| Method | Path | Auth | Body / response |
| --- | --- | --- | --- |
| `POST` | `/v1/me/billing/checkout` | Candidate session | `{ "plan": "monthly"\|"yearly", "success_url", "cancel_url" }` → `{ "url" }` |
| `POST` | `/v1/me/billing/portal` | Candidate | `{ "return_url" }` → `{ "url" }` |
| `GET` | `/v1/me/billing/subscription` | Candidate | `{ "premium", "status?", "plan?", "current_period_end?" }` |
| `POST` | `/v1/webhooks/stripe` | Stripe signature | webhook events |

Constants: `billing.CheckoutPath`, `PortalPath`, `SubscriptionPath`, `WebhookPath = "/v1/webhooks/stripe"`. Plans: `PlanMonthly`, `PlanYearly`. Employee role → 403 on `/v1/me/billing/*`.

**Webhook events:** `checkout.session.completed`, `customer.subscription.created|updated|deleted`. Idempotency: `billing.NewMemoryIdempotencyStore()` in joined-backend `main` (in-process, not Mongo). Replay of the same event must change the subscription once.

**Mongo (DEST_DB):** `billing_customers`, `subscriptions`.

**Env:**

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Required to mount billing |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification |
| `STRIPE_ALLOW_LIVE` | Default false; live keys blocked without `true` |
| `PREMIUM_MONTHLY_PRICE_CENTS` | Default 2900 |
| `PREMIUM_YEARLY_PRICE_CENTS` | Default 29000 |
| `BILLING_CHECKOUT_SUCCESS_URL` | Default if request omits |
| `BILLING_CHECKOUT_CANCEL_URL` | Default cancel |
| `BILLING_PORTAL_RETURN_URL` | Default portal return |

**`SyncProducts`** is not called at joined-backend startup — only in tests/README (ops before real Checkout).

**Kill switch:** wrap checkout with `killswitch.Checkout` in a Penny follow-up; not required to land in #90.

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass for `backend-core/billing` and the joined-backend mount tests.
2. Replaying the same webhook event twice changes the subscription once.
3. Live keys without `STRIPE_ALLOW_LIVE=true` fail config load.
4. Tests use `billing.NewFakeClient()` — no network.
5. Diff stays inside Penny's lane (plus the flagged joined-backend mount / `go.mod` only if Elon approved it).

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/billing/... -count=1
go test ./joined-backend/internal/httpapi/... -count=1 -run Billing
```

Keep tests for checkout/portal session creation, plan validation, webhook create/update/delete, idempotent replay, `IsPremium`, employee 403, and unmounted 404 when the secret is empty.

Manual (human-run, test mode only): create a Checkout session with Stripe test keys, complete it, confirm `GET /v1/me/billing/subscription` shows premium. Do not use live keys.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- `KILLSWITCH_CHECKOUT` is not wired in handlers.
- Webhook idempotency is in-process memory — a multi-instance deploy can double-apply until a Mongo store exists.
- Unset `STRIPE_SECRET_KEY` unmounts the entire billing surface.
- Follow-up #87 (Penny soft follow-ups) and #93 (billing mount) are related; do not reopen them here.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (this step originally landed on retired `stage-roadmap` as #90). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
