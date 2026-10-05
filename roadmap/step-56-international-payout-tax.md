# Step 56: International payout tax

- **Week:** W4, Legal / launch prep
- **Owner:** Penny (money and Scout backend lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(scout): w9 w8ben and sanction screening hooks (roadmap step-56)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Builds on steps 46–47.**

## Goal

Payouts collect W-9 / W-8BEN and run sanction-screening hooks before send.

## In scope

- Tax form type on scout tax info: US W-9 vs non-US W-8BEN (or W-8BEN-E). Store form type, cert timestamps, and last4 only — never a full TIN in logs (`backend-core/scout` already stores last4).
- Sanction-screening hook: interface + `log` implementation + optional HTTP provider behind env. Fail closed on first payout if screening is `pending` or `hit`. Tests fake the provider.
- Block `RequestPayout` when tax form or screening is missing. Types in `packages/scout`. Scoutwell field copy if the payouts page must collect form type (Penny owns scoutwell-backend; Leo follows for UI only if Elon splits).

## Out of scope

- No live screening vendor keys. No legal advice. No Stripe live.

## Acceptance criteria

1. `go vet` and `go test` pass; typecheck `packages/scout` if types changed.
2. Missing W-9/W-8BEN or a screening hit blocks payout; a clear fake-provider result allows it.
3. Diff stays inside Penny's lane.
