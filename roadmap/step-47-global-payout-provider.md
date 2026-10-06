# Step 47: Global payout provider

- **Week:** W3
- **Status:** Done
- **Owner:** Penny (money and Scout backend lane)
- **Target branch:** `stage-roadmap-w34` for any follow-up
- **PR title:** `feat(scout): global payout provider adapter (roadmap step-47)`
- **Merged PR:** [#113](https://github.com/sid0709/Joined/pull/113) (`35e7aa6`)

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Payouts can go through a Wise/PayPal-style provider adapter after staff approval. Nothing leaves the machine in the default fake mode. No live money without an explicit later flag.

## Context and dependencies

Done (#113). Depends on [step-46](step-46-scout-payout-identity.md) (Done, #111) for the first-payout identity gate. Live provider keys and real sends wait for [step-59](step-59-stripe-live-config.md) user approval plus `PAYOUT_ALLOW_LIVE` (payouts, not Stripe). Tax/sanctions are [step-56](step-56-international-payout-tax.md). Harness is [step-60](step-60-non-us-payout-test.md).

On `stage-roadmap-w34` today: `PayoutMethodType` is `"bank" | "paypal"` in `packages/scout/src/types.ts`. `PayoutStatus` is `"requested" | "paid" | "rejected"`. Staff mark paid via `POST /v1/admin/scout/payouts/{id}/decision` `{ decision: "paid"|"rejected" }` and earnings settle immediately. There is no `Provider` interface and no `PAYOUT_*` env on this branch.

#113 (not merged) adds `backend-core/scout/provider.go` (`CreateRecipient`, `SendPayout`, `GetPayout`), `FakeProvider`, an HTTP adapter, webhook path `/v1/webhooks/payouts`, and a lifecycle `requested → approved → sent → paid|failed|rejected`.

## In scope

- Provider interface in `backend-core/scout` (not a second copy in billing).
- Config from env. On #113 the switch is `PAYOUT_PROVIDER=fake|wise|paypal` with **default `fake`** (the original sketch said `log|paypal|wise|payoneer`; implement what the open PR settled: `fake` default, no Payoneer unless a follow-up adds it).
- Create/list/request payout still requires staff approval. The adapter records an external id when sent.
- Tests use `FakeProvider`; no network. Document env vars in `backend-core/scout` comments / package README. Do not edit `.env` files.
- Update `packages/scout` types if method types or payout statuses grow (`provider`, `approved`, `sent`, `failed`, `provider_ref`, …).
- Keep step-46 `FirstPayoutIdentityError` on the staff approve/send path. #113’s rewrite of `DecidePayout` must not drop that check.

## Out of scope

- No live provider keys in the repo. No identity/tax rewrite (46/56).
- No Stripe live (step-59). Staff approval stays mandatory.
- No Payoneer unless explicitly added; do not block the PR on a third vendor.
- No merge to `main`. Do not enable live mode (`PAYOUT_ALLOW_LIVE`) without the step-59 user-approval rule.

## Files and areas to touch

On #113 (verify against the open diff; add if missing):

- `backend-core/scout/provider.go`, `provider_fake.go`, `provider_http.go`, `provider_config.go` (new)
- `backend-core/scout/payout_send.go`, `provider_webhook.go`, `payout_docs.go` (new)
- `backend-core/scout/admin.go`, `types.go`, `store.go` — approve/send + `providerRef` index on `scout_payouts`
- Tests: `payout_provider_test.go`, `provider_config_test.go`, `provider_http_test.go`, `provider_webhook_test.go`
- `packages/scout/src/types.ts` — method/status/decision fields
- `scoutwell-backend` / `admin-backend` only if webhook mount or decision body must grow
- Admin UI still sends `{ decision: "paid" }`; mapping `paid` → approve+send is acceptable if documented

## Implementation notes

**Env (as on #113):**

| Variable                | Role                                              |
| ----------------------- | ------------------------------------------------- |
| `PAYOUT_PROVIDER`       | `fake` (default), `wise`, `paypal`                |
| `PAYOUT_API_TOKEN`      | required for wise/paypal                          |
| `PAYOUT_WEBHOOK_SECRET` | HMAC for `/v1/webhooks/payouts`                   |
| `PAYOUT_ALLOW_LIVE`     | must be true for live hosts/tokens; default false |
| `PAYOUT_API_BASE_URL`   | override; default sandbox URLs                    |

**Contracts:**

- Scout request: `POST /v1/scout/payouts` still creates `requested` after step-46 identity + `CheckPayout`.
- Staff: `POST /v1/admin/scout/payouts/{id}/decision` with `paid` or `approved` runs `approvePayout` → `SendPayout`. Earnings settle when the provider reports `paid`, not on the click if that is what #113 implements — document the change in the PR.
- Webhook: `POST /v1/webhooks/payouts` (mount on scoutwell-backend if not already). Verify `PAYOUT_WEBHOOK_SECRET`. Idempotent on `provider_event_id`.

**Edge cases:** FakeProvider records send after staff approval and never dials a host. Live tokens/hosts fail closed unless `PAYOUT_ALLOW_LIVE=true`. Sandbox only until step-59 explicit approval. Do not log full account numbers.

## Acceptance criteria

1. `go vet` and `go test` pass; TS typecheck for `packages/scout` if types changed.
2. With `PAYOUT_PROVIDER=fake` (default) nothing leaves the machine; a fake provider records send after staff approval.
3. First-payout identity from step-46 still blocks approve/send.
4. Diff stays inside Penny's lane.

## Test and validation

```bash
bun run vet:go
go test ./backend-core/scout/...
go test ./scoutwell-backend/...
bun --filter @joined/scout typecheck
bun --filter @joined/scout test
```

Add/keep tests: fake send-once after approval, live-key/host refuse without `PAYOUT_ALLOW_LIVE`, webhook signature reject, identity gate on first approve.

## Risks and soft parks

- Sandbox only. `FakeProvider` by default. Live mode needs `PAYOUT_ALLOW_LIVE` plus explicit user approval at step-59.
- #113 must not regress step-46 `DecidePayout` identity (`FirstPayoutIdentityError`).
- Original brief mentioned `PAYOUT_PROVIDER=log` and Payoneer; the open PR uses `fake`/`wise`/`paypal`. Document the actual switch in the PR; do not silently add Payoneer.
- Admin UI still says “Mark paid” — copy may confuse staff once status is `approved`/`sent`.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
