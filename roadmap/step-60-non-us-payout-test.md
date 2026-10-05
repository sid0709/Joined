# Step 60: Non-US payout test harness

- **Week:** W4, Launch prep
- **Owner:** Penny (money and Scout backend lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `test(scout): non-us payout harness (roadmap step-60)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Builds on steps 47 and 56.**

## Goal

One documented non-US payout path is testable without sending real money.

## In scope

- A harness (Go test or `tests/` script) that: creates a scout with W-8BEN tax type, a non-US payout method (PayPal/Wise-style), passes fake sanction screening, staff-approves, and the log/fake provider records a send.
- Fixture country/currency in config. Do not call live Wise/Payoneer/PayPal.
- Short README section: how to run the harness locally.

## Out of scope

- No real payout. No production beneficiary data.

## Acceptance criteria

1. The harness passes in CI or `go test` for the scout module.
2. A live-provider env is not required.
3. Diff stays inside Penny's lane (`backend-core/scout/**`, `scoutwell-backend/**`, `packages/scout/**`, plus `tests/**` only if Quinn agrees).
