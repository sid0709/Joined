# Step 47: Global payout provider

- **Week:** W3, Scraper onboarding
- **Owner:** Penny (money and Scout backend lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(scout): global payout provider adapter (roadmap step-47)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Runs in parallel with step-46** when touching different files; staff approval stays.

## Goal

Payouts can go through a Wise/Payoneer/PayPal-style provider adapter. Staff still approve; no money moves in test without a fake.

## In scope

- Today `PayoutMethodType` is `"bank" | "paypal"` in `packages/scout`. Add a provider interface in `backend-core/scout` (or billing if that is the cleaner home) with config from env (`PAYOUT_PROVIDER=log|paypal|wise|payoneer`). Default `log`.
- Create/list/request payout still requires staff approval on the admin payouts queue. The adapter records an external id when "sent".
- Tests use a fake transport; no network. Document env vars in the package README. Do not edit `.env` files.
- Update `packages/scout` types if method types grow.

## Out of scope

- No live provider keys. No identity/tax rewrite (46/56).
- No Stripe live (step-59). Staff approval stays mandatory.

## Acceptance criteria

1. `go vet` and `go test` pass; TS typecheck for `packages/scout` if types changed.
2. With `PAYOUT_PROVIDER=log` nothing leaves the machine; a fake provider records send after staff approval.
3. Diff stays inside Penny's lane.
