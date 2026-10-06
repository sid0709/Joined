# Step 60: Non-US payout test harness

- **Week:** W4
- **Status:** Done
- **Owner:** Penny (money and Scout backend lane)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `test(scout): non-us payout harness (roadmap step-60)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

One documented non-US payout path is testable without sending real money.

## Context and dependencies

Builds on [step-47](step-47-global-payout-provider.md) (In review, #113) and [step-56](step-56-international-payout-tax.md) (Planned). Identity: [step-46](step-46-scout-payout-identity.md) #111. Live sends: [step-59](step-59-stripe-live-config.md) approval + `PAYOUT_ALLOW_LIVE`.

On this branch, payout tests already use `memoryScout`, `seedPayoutSetup`, `validIdentity()`, `RequestVerification` + `UpdateScout` + `RequestPayout` + `DecidePayout` (`backend-core/scout/identity_payout_test.go`). After #113: `FakeProvider`, `SetPayoutProvider(NewFakeProvider())`, `payout_provider_test.go`. After step-56: fake screening + `form_type` W-8BEN.

No dedicated non-US script under `tests/` today. Country on the profile is a free string; payout currency is the scout rewards `Currency` constant.

## In scope

- A harness (Go test in `backend-core/scout`, preferred) that: creates a scout with W-8BEN tax type, a non-US payout method (PayPal/Wise-style), passes fake sanction screening, staff-approves, and the fake provider records a send.
- Fixture country/currency in named constants in the owning test module. Do not call live Wise/Payoneer/PayPal.
- Short README section in `backend-core/scout` (or package comment): how to run the harness locally.
- `tests/**` only if Quinn agrees to a script there.

## Out of scope

- No real payout. No production beneficiary data.
- No live provider env required.
- No merge to `main`.

## Files and areas to touch

- `backend-core/scout/payout_non_us_test.go` (new) or extend `payout_provider_test.go`
- `backend-core/scout` README / `payout_docs.go` — how to run
- `packages/scout` — only if fixture types are exported
- `tests/` — only with Quinn

## Implementation notes

Fixture constants (example — name them, do not scatter):

- Country: `GB` (or another non-US ISO code already accepted by identity validation)
- Form: `w8ben`
- Method: PayPal/provider email, `currency` `GBP` if step-47 added currency on `PayoutMethod`
- Screening: fake `clear`
- Provider: `FakeProvider`

Flow: identity (step-46) → tax W-8BEN (step-56) → method → `RequestPayout` → staff approve/send → fake `provider_ref` set. Assert no HTTP client is constructed.

If 47 or 56 is not merged, the harness compiles against fakes shipped in this PR or `t.Skip` with a named reason. Do not hit network on skip.

## Acceptance criteria

1. The harness passes in CI via `go test` for the scout module (or a documented skip if 47/56 are missing).
2. A live-provider env is not required.
3. Diff stays inside Penny's lane (`backend-core/scout/**`, `scoutwell-backend/**`, `packages/scout/**`, plus `tests/**` only if Quinn agrees).

## Test and validation

```bash
go test ./backend-core/scout/ -run NonUS
# or
go test ./backend-core/scout/...
```

Grep the test for `http.Client` / live host strings — should be none.

## Risks and soft parks

- Step-47: FakeProvider default; live needs `PAYOUT_ALLOW_LIVE` + step-59 approval.
- Step-46: names not NFD-normalized — pick ASCII fixture names (`Alex Rivera`, not accented) so the harness is not testing that park.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
