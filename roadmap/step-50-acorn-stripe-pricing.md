# Step 50: Acorn Stripe pricing

- **Week:** W3, Scraper onboarding
- **Owner:** Penny (billing lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*` as a git branch)
- **PR title:** `feat(billing): acorn pricing and stripe products (roadmap step-50)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

Acorn has Stripe products/prices in test mode, reusing Joined Premium billing patterns.

## In scope

- Extend `backend-core/billing` (already refuses live keys unless `STRIPE_ALLOW_LIVE=true`) with an Acorn product/price catalog (monthly/yearly or the current Acorn plan list), lookup keys, env price ids.
- Checkout/session helpers the website can call, same webhook skeleton as Premium. Tests with a fake Stripe client; no network.
- Document env vars. Do not edit `.env`. If a route must live under Acorn's API, Elon coordinates the `acorn/**` or `backend-core/acornapi` mount; Penny still owns billing types.

## Out of scope

- No live keys (step-59). No website billing page (Leo, step-51).
- No Scout payout changes.

## Acceptance criteria

1. `go vet` and `go test` pass for `backend-core/billing`.
2. Live-key guard still holds. Acorn prices sync in test mode via the fake.
3. Diff stays inside Penny's lane (plus a flagged Elon/acornapi mount if required).
