# Step 51: Acorn billing, legal, and delete-my-data

- **Week:** W3
- **Status:** BLOCKED
- **Owner:** Leo (`acorn-frontend/**`; **coordinate Elon** for `acorn-backend/**` delete/checkout mount)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(acorn-frontend): billing legal delete-my-data (roadmap step-51)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## BLOCKED

Acorn’s website and API were removed from this repo in `1d0aae6` and now live in [sid0709/Acorn](https://github.com/sid0709/Acorn). Step 50 landed the Acorn Pro catalog in `backend-core/billing`, but there is no `acorn-frontend` billing page, terms route, or `acorn-backend` account-delete route here. Wiring checkout or delete inside Joined would target the wrong app. Implement step 51 in the Acorn repo against `billing.ProductAcorn`.

## Goal

A signed-in Acorn user can pay in Stripe test mode, read draft Acorn legal pages, and delete their Acorn account from `acorn-frontend`.

## Context and dependencies

Billing APIs come from [step-50](step-50-acorn-stripe-pricing.md). Joined draft legal pages are [step-45](step-45-legal-drafts-pages.md). Shared counsel copy is [step-55](step-55-legal-docs-package.md). Live Stripe is [step-59](step-59-stripe-live-config.md).

After #115, `acorn/website` is gone. Current `acorn-frontend`:

- `lib/routes.ts`: `/`, `/sign-in`, `/sign-up`, `/overview`, `/profile`, `/resume`, `/resume/library`, `/resume/history`, `/gmail`, `/apps`, `/billing` — **no** `/terms` or `/privacy`
- `/billing` exists (`app/(workspace)/billing/page.tsx`, `components/billing/*`) with **sample** plans/invoices (`lib/billing.ts`); checkout stays off until a provider is connected
- Auth: `acorn_session`, `ACORN_API_URL` → acorn-backend `:8083`
- Account delete: **missing** on acorn-backend (no `DELETE` account route). Joined `DELETE /v1/auth/account` is the **Joined** account in `JoinedDB` — do not call it from Acorn; that would delete the wrong user.

UI: `sid-ui` (`Banner`, `Button`, `AlertDialog`). Match Joined Premium UX patterns, do not copy `joined-frontend/components/billing` internals.

## In scope

- Wire `/billing` to step-50 checkout/portal (same `acorn_session`). Keep `sid-ui` primitives.
- Draft `/terms` and `/privacy` with Acorn-specific placeholder copy and a visible draft `Banner`.
- Delete-my-data: new acorn-backend account-delete (Elon) + confirm `AlertDialog` on the website. Copy must say the **Acorn** account (and `AcornDB` data) is removed, not the Joined seeker account.
- Unauthenticated billing/delete lands on `/sign-in`.
- Checkout success/cancel routes if step-50 redirects back to :6005.

## Out of scope

- No live Stripe. No new billing catalog (Penny, step-50).
- No `acorn*` git branch.
- Do not proxy Joined `DELETE /v1/auth/account`.

## Files and areas to touch

- `acorn-frontend/app/(workspace)/billing/` — wire real checkout
- `acorn-frontend/app/terms/`, `app/privacy/` (new)
- `acorn-frontend/lib/routes.ts`, `lib/billing.ts`, `lib/config.ts`
- `acorn-frontend/components/billing/*`, `components/shell/acorn-header.tsx`
- `acorn-backend/account/` + `acornapi` — delete-account route (new, Elon)
- Do not add `packages/design-system` source

## Implementation notes

- Checkout/portal paths: whatever step-50 documented on **acorn-backend** (e.g. `/acorn/billing/checkout`). The browser talks to `ACORN_API_URL` or a same-origin BFF that forwards `acorn_session`.
- Delete: confirm, then a documented `DELETE /acorn/auth/account` (or equivalent constant). On success, clear `acorn_session` and send the user to `/`.
- Legal pages: draft disclaimer required.
- Tokens from `sid-ui`. Feature-flag checkout if no Stripe session URL is configured.

## Acceptance criteria

1. `bun --filter acorn-frontend typecheck`, lint, and format pass; `go test ./acorn-backend/...` if delete is in this PR.
2. Signed-in user can open billing, read draft legal pages, and trigger delete-my-data against local acorn-backend.
3. Signed-out billing/delete lands on `/sign-in`.
4. Diff stays in `acorn-frontend/**` (Leo) plus `acorn-backend/**` (Elon) for delete/checkout mount.

## Test and validation

```bash
bun --filter acorn-frontend typecheck
bun --filter acorn-frontend lint
bun run ci format
go test ./acorn-backend/...
```

Add tests for delete confirm-gate and 401 without session. Manual (human): test-mode checkout redirect, `/terms` `/privacy`, delete against local acorn-backend.

## Risks and soft parks

- If step-50 is not merged, keep checkout buttons off (`lib/billing.ts`) and ship legal + delete, or wait. Do not hardcode a fake Stripe URL.
- Mixing Joined and Acorn delete is a data-loss bug.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
