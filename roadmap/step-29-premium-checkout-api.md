# Step 29: Premium checkout API (Stripe test mode)

Status: Done (merged in W2)

- **Week:** W2, Premium billing
- **Owner:** Penny (money and Scout backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(billing): premium checkout and portal in test mode (roadmap step-29)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-08 merges** (builds on the billing package and webhook router).

## Goal
Joined Premium can be bought and managed through Stripe Checkout and the customer portal, in test mode only.

## In scope
- In `backend-core/billing`: create a Checkout session for the monthly or yearly price, create a customer-portal session, and map Stripe customers to Joined user ids.
- Webhook handlers for checkout completed and subscription created, updated, and deleted that keep a `subscriptions` record (status, plan, period end) idempotently.
- A small `IsPremium(userID)` read for other services. Note the route wiring point in joined-backend for Ravi.
- Fake Stripe client in tests; no network in tests.

## Out of scope
- No live keys or real charges (the step-08 live-key guard stays), no frontend, no route wiring outside Penny's lane.

## Acceptance criteria
1. `go vet` and `go test` pass for `backend-core/billing`.
2. Replaying the same webhook event twice changes the subscription once.
3. Diff stays inside Penny's lane (plus a flagged `go.mod`/`go.sum` change only if Elon approved it).
