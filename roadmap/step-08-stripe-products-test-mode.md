# Step 08: Stripe account wiring and products (test mode)

- **Week:** W1, Foundations
- **Owner:** Penny (lane: `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`)
- **Target branch:** `stage-roadmap`
- **PR title:** `roadmap step-08: Stripe products in test mode`
- **Runs in parallel with step-05.** Work only in the new `backend-core/billing/` package, so it cannot conflict with `backend-core/scout`.

## Goal

Joined has a Stripe billing package ready for Premium, using Stripe test mode only.

## In scope

- New `backend-core/billing/` package: config from env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price ids), refuse to start with a live key (`sk_live_`) unless an explicit `STRIPE_ALLOW_LIVE=true` is set.
- A product and price catalog for Joined Premium (monthly and yearly, amounts in config) and an idempotent sync function that creates or updates them in Stripe test mode using lookup keys or metadata.
- A webhook verifier and event router skeleton (signature check, idempotency store, handlers stubbed for checkout and subscription events).
- Thin Stripe client interface so tests use a fake; no network calls in tests.
- Document env vars in the package README. Do not edit any `.env` file.

## Out of scope

- No checkout or billing page (W2), no wiring into any service's routes (that needs Ravi; note the integration point).
- No live keys, no real charges.
- If the Stripe Go SDK must be added to a `go.mod`, stop and ask Elon first; prefer a minimal HTTP client if the module change is awkward.

## Acceptance criteria

1. `go vet` and `go test` pass for `backend-core/billing`.
2. Live-key guard is tested.
3. Diff stays inside `backend-core/billing/**` (plus a flagged `go.mod`/`go.sum` change only if Elon approved it).
