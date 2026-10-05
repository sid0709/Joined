# Step 56: International payout tax

- **Week:** W4
- **Status:** Planned
- **Owner:** Penny (money and Scout backend lane)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(scout): w9 w8ben and sanction screening hooks (roadmap step-56)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Payouts collect W-9 / W-8BEN and run sanction-screening hooks before send. Missing forms or a screening hit block `RequestPayout`.

## Context and dependencies

Builds on [step-46](step-46-scout-payout-identity.md) (Done, #111) and [step-47](step-47-global-payout-provider.md) (In review, #113). Harness: [step-60](step-60-non-us-payout-test.md). Live vendors: step-59 approval rules. Legal docs: [step-55](step-55-legal-docs-package.md) does not replace this.

Today `TaxInfo` (`backend-core/scout/types.go`) is `{ legal_name, country, tax_id_last4, completed_at }`. `SaveTaxInfo` / `PUT /v1/scout/me/tax` store last4 only. No `form_type`, cert timestamp, or screening status. `RequestPayout` blockers: step-46 identity + `CheckPayout` (tax/method/min balance). No sanction hook.

`docs/90-compliance-privacy-security.md` asks for 1099/tax forms for US payees and IDV vendor references — this step is the hook, not counsel advice.

## In scope

- Tax form type on scout tax info: US W-9 vs non-US W-8BEN (or W-8BEN-E). Store form type, cert timestamps, and last4 only — never a full TIN in logs (`backend-core/scout` already stores last4).
- Sanction-screening hook: interface + `log`/`fake` implementation + optional HTTP provider behind env. Fail closed on first payout if screening is `pending` or `hit`. Tests fake the provider.
- Block `RequestPayout` (and staff approve/send from step-47) when tax form or screening is missing.
- Types in `packages/scout`. Scoutwell field copy if the payouts page must collect form type (Penny owns scoutwell-backend; Leo follows for UI only if Elon splits).

## Out of scope

- No live screening vendor keys. No legal advice. No Stripe live.
- No NFD rename of step-46 `NamesMatch` unless it is a one-line fix in this lane.
- No merge to `main`.

## Files and areas to touch

- `backend-core/scout/types.go` — `TaxInfo.form_type`, cert time, screening fields
- `backend-core/scout/profile.go` — `SaveTaxInfo` validation
- `backend-core/scout/earnings.go` / `rewards.go` — `CheckPayout` / `RequestPayout`
- `backend-core/scout/screening.go` (new) — interface + fake
- `packages/scout/src/types.ts`
- `scoutwell-backend/internal/httpapi/scout.go` — tax body
- `scoutwell-frontend` — only if Elon splits Leo for form-type fields
- Tests: extend `identity_payout_test.go` / new `tax_screening_test.go`

## Implementation notes

**Tax PUT body** (extend existing; keep last4-only):

```json
{ "legal_name": "", "country": "", "tax_id_last4": "", "form_type": "w9"|"w8ben"|"w8ben_e" }
```

Store `certified_at`. Never log `tax_id_last4` with the full request body at info level.

**Screening:**

| Variable                    | Role                       |
| --------------------------- | -------------------------- |
| `PAYOUT_SCREENING_PROVIDER` | `fake` (default) or `http` |
| `PAYOUT_SCREENING_URL`      | optional HTTP endpoint     |
| `PAYOUT_SCREENING_TOKEN`    | optional                   |

Statuses: `clear` | `pending` | `hit`. Fail closed on `pending`/`hit` and on provider error for a first payout. Later payouts: re-screen if env says so, or reuse `clear` until staff revoke (document the choice).

Reuse step-46 identity codes style for new problems (`tax_form_required`, `screening_blocked`) via `packages/scout` constants. Do not put full TIN in problem `detail`.

## Acceptance criteria

1. `go vet` and `go test` pass; typecheck `packages/scout` if types changed.
2. Missing W-9/W-8BEN or a screening hit blocks payout; a clear fake-provider result allows it.
3. Logs never contain a full TIN.
4. Diff stays inside Penny's lane.

## Test and validation

```bash
bun run vet:go
go test ./backend-core/scout/...
bun --filter @joined/scout typecheck
bun --filter @joined/scout test
```

Tests: W-9 US allows, missing form_type blocks, fake hit blocks, fake clear allows, HTTP provider unused in CI.

## Risks and soft parks

- Step-46: names still not NFD-normalized; admin still wraps identity as `ErrPayoutBlocked`.
- Step-47: sandbox only; live payouts need `PAYOUT_ALLOW_LIVE` + step-59 approval.
- Do not call a real sanctions vendor from CI.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
