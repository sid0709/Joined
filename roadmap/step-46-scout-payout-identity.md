# Step 46: Scout payout identity check

- **Week:** W3
- **Status:** Done
- **Owner:** Penny (lane: `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up
- **PR title:** `feat(scout): stricter identity check before first payout (roadmap step-46)`
- **Merged PR:** [#111](https://github.com/sid0709/Joined/pull/111) (`3f1f7f0`)

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

A scout cannot receive a first payout until identity is verified more strictly than the old “staff flipped verified” flag. Later payouts reuse the stored check unless staff revoke verification.

## Context and dependencies

Shipped in W3 on `stage-roadmap-w34`. Parallel with [step-47](step-47-global-payout-provider.md) (In review, #113). Tax forms and sanction screening are [step-56](step-56-international-payout-tax.md). Non-US harness is [step-60](step-60-non-us-payout-test.md).

Before this step, `CheckPayout` required `VerificationVerified` plus tax + method. #111 added first-payout identity: legal name, country, date of birth, optional `document_ref`, and a payout-account `holder_name` that must match the legal name. Staff still decide via `UpdateScout`. There is no live IDV vendor.

Related docs: `docs/61-scout-api.md` (does not yet list `/me/identity` or `identity_*` codes). Admin queue: `GET /v1/admin/scout/scouts?verification=`, `PATCH /v1/admin/scout/scouts/{userId}`.

## In scope

What #111 shipped (keep this behavior; follow-ups only if reopened):

- `backend-core/scout/identity.go` — `FirstPayoutIdentityError`, `NamesMatch`, `IdentityFieldsPresent`, `PayoutHolderMatches`, `IdentityProblem`, `wrapPayoutIdentity`, DOB/ref validation
- `RequestVerification` accepts `{ legal_name, country, date_of_birth, document_ref? }`
- `GET /v1/scout/me/identity` and `POST /v1/scout/me/verification` on scoutwell-backend
- `RequestPayout` and admin `DecidePayout` (paid) re-run the first-payout gate
- `packages/scout` types: `Identity`, `IdentityInput`, `IDENTITY_*` codes; `PayoutMethod.holder_name`; profile identity fields
- Go tests in `identity_test.go`, `identity_payout_test.go`, `rules_test.go`

## Out of scope

- No Wise/Payoneer provider (step-47). No W-9/W-8BEN package (step-56).
- No live vendor keys. No `joined-backend` edits.
- No Scoutwell UI rewrite (VerificationCard still POSTs only `{ legal_name, country }`; that is a Leo follow-up unless Elon splits it).
- No merge to `main`.

## Files and areas to touch

Shipped in #111:

- `backend-core/scout/identity.go` (new), `identity_test.go`, `identity_payout_test.go`
- `backend-core/scout/profile.go`, `earnings.go`, `admin.go`, `rewards.go`, `stats.go`, `types.go`, `store.go`, `memory.go`
- `packages/scout/src/types.ts`, `packages/scout/src/problem.test.ts`
- `scoutwell-backend/internal/httpapi/scout.go`, `server_test.go`

Follow-up only if this step is reopened: `docs/61-scout-api.md` (Elon), Scoutwell setup cards (Leo).

## Implementation notes

**Contracts (shipped):**

| Method  | Path                                    | Body / response                                                                                                                                                                 |
| ------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`  | `/v1/scout/me/verification`             | `{ legal_name, country, date_of_birth, document_ref? }`                                                                                                                         |
| `GET`   | `/v1/scout/me/identity`                 | `Identity`: `status`, `legal_name`, `country`, `date_of_birth`, `document_ref`, `payout_holder_name`, `name_matches`, `first_payout_gated`, `note`, `verified_by`, `updated_at` |
| `PUT`   | `/v1/scout/me/payout-method`            | `{ type: "bank"\|"paypal", label, last4, holder_name? }`                                                                                                                        |
| `POST`  | `/v1/scout/payouts`                     | first payout blocked by identity errors                                                                                                                                         |
| `PATCH` | `/v1/admin/scout/scouts/{userId}`       | `{ verification: "verified"\|"rejected", note? }` — `staffCanVerify` on verify                                                                                                  |
| `POST`  | `/v1/admin/scout/payouts/{id}/decision` | `{ decision: "paid"\|"rejected", note? }`                                                                                                                                       |

Scout identity failures map via `IdentityProblem` to **422** codes `identity_unverified`, `identity_rejected`, `identity_incomplete`, `identity_name_mismatch`. Admin `DecidePayout` wraps the same errors as `ErrPayoutBlocked` (`payout_blocked`) through `httpkit.WriteScoutError` — that wrap is intentional on the admin path.

Mongo: fields live on `scout_profiles` (`legal_name`, `country`, `date_of_birth`, `document_ref`, `verified_by`, `verification_updated_at`). No new artifact collection. Indexes unchanged (`userId` unique, `verification`).

Grandfathering: scouts with at least one `paid` payout skip the stricter DOB/holder checks; they still need verified + tax + method + minimum balance.

No env vars. No IDV vendor.

**Edge cases:** DOB must parse `2006-01-02`, age 18–120. `document_ref` max 128, charset `[A-Za-z0-9._:-]+`, reject government-id-shaped values. `NamesMatch` folds case and strips combining marks / punctuation — **not** Unicode NFD.

## Acceptance criteria

1. `go vet` / `go test` pass for `backend-core/scout` and `scoutwell-backend`; `packages/scout` typecheck if types change.
2. Unverified or incomplete identity cannot request the first payout; verified + complete fields + matching holder name can.
3. A later payout after one `paid` payout is not re-blocked by missing DOB/holder.
4. Diff stays inside Penny's lane.

(Shipped by #111. Reopen only for regressions or the soft parks below.)

## Test and validation

```bash
bun run vet:go
go test ./backend-core/scout/...
go test ./scoutwell-backend/...
bun --filter @joined/scout test
bun --filter @joined/scout typecheck
```

Existing tests: `FirstPayoutIdentityError`, `RequestPayout` blocked vs allowed, name mismatch, rejected, `DecidePayout` first paid, grandfathering, `GET /v1/scout/me/identity` 401 without session.

## Risks and soft parks

- Names are not NFD-normalized (`foldPersonName` strips `unicode.Mn` and lowercases; it does not `norm.NFD`).
- Admin wraps identity errors as `ErrPayoutBlocked` (`payout_blocked`), not `identity_*`.
- Scoutwell UI (`setup-cards.tsx`) still omits DOB, `document_ref`, and `holder_name`, and does not call `GET /me/identity`.
- `docs/61-scout-api.md` is stale on identity routes and codes.
- Step-47 #113 must keep `FirstPayoutIdentityError` on the staff approve/send path when it rewrites `DecidePayout`.
- Infra: cancelled CI jobs can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`. (Met by #111.)
