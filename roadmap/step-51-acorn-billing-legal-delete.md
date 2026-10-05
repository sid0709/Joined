# Step 51: Acorn billing, legal, and delete-my-data

- **Week:** W3
- **Status:** Planned
- **Owner:** Leo (web frontends; **coordinate Elon** for `acorn/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(acorn-website): billing legal delete-my-data (roadmap step-51)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

The Acorn website has a billing page, draft legal pages, and delete-my-data, so a signed-in user can pay (test mode), read draft terms, and delete their account without using Joined’s settings UI.

## Context and dependencies

Billing APIs come from [step-50](step-50-acorn-stripe-pricing.md) (Planned). Legal/delete can land in the same PR if 50 is merged; do not invent a second checkout API. Profile/sign-in scaffold: [step-32](step-32-acorn-website-scaffold.md) (Done, #80), [step-48](step-48-acorn-profile-editor.md). Shared counsel copy is [step-55](step-55-legal-docs-package.md). Joined draft legal pages are [step-45](step-45-legal-drafts-pages.md). Live Stripe is [step-59](step-59-stripe-live-config.md).

`acorn/website/lib/routes.ts` is still `{ home, signIn }`. Cookie: `joined_session`. Account delete already exists: `DELETE /v1/auth/account` in `backend-core/authapi/authapi.go`. Joined BFF: `joined-frontend/app/api/auth/account/route.ts`. Joined UI: `joined-frontend/components/settings/remove-account.tsx` (`AlertDialog`, typed confirmation). Scoutwell has the same BFF. Acorn website has neither.

Joined Premium UX to **match, not copy**: `/pricing`, `settings?section=billing`, `lib/billing.ts`, `lib/me/billing.ts`, `components/billing/*`, design-system `Banner`/`Button`/`MetadataList`. Env on Joined: `BILLING_CHECKOUT_ENABLED`, `NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED`.

## In scope

- Billing page on `acorn/website` using step-50 checkout/portal (same session cookie). Design-system primitives only.
- Draft `/terms` and `/privacy` with Acorn-specific placeholder copy and a visible draft `Banner`. Cookie consent can wait for step-45/55 unless the same `BrandFooter` slot is already available.
- Delete-my-data calls `DELETE /v1/auth/account` (or Acorn’s documented equivalent) through a website BFF, with `AlertDialog` confirm.
- Empty/unauthenticated states send the user through the existing `/sign-in` placeholder.
- Checkout success/cancel routes if step-50 checkout redirects back to the website.

## Out of scope

- No live Stripe. No new billing API (Penny, step-50).
- No `acorn*` git branch.
- Do not copy-paste `joined-frontend/components/billing` or `remove-account.tsx` internals.

## Files and areas to touch

- `acorn/website/app/billing/` (new), `app/terms/`, `app/privacy/`
- `acorn/website/app/api/` — billing forwarder + `auth/account` DELETE (new)
- `acorn/website/lib/routes.ts`, `lib/config.ts`, `.env.example`
- `acorn/website/components/` — billing, legal, delete (new)
- `acorn/website/components/site-header.tsx`, landing/sign-in — nav/footer links
- Reference only: `joined-frontend/components/settings/remove-account.tsx`, `joined-frontend/lib/billing.ts`

## Implementation notes

- Checkout/portal paths: whatever step-50 documented (`/v1/me/billing/*` with an Acorn plan, or `/v1/me/acorn-billing/*`). Website talks only to its BFF.
- Delete: `fetch("/api/auth/account", { method: "DELETE" })` after confirm. On 204/200, clear local UI and send the user to `/`.
- Legal pages: draft disclaimer required. Do not claim counsel approval.
- Hosts and flags from `lib/config.ts`. Feature-flag checkout if `BILLING_CHECKOUT_ENABLED` is false.
- Tokens only. No hex.

## Acceptance criteria

1. `bun --filter acorn-website typecheck`, lint, and format pass.
2. Signed-in user can open billing, read draft legal pages, and trigger delete-my-data against local backend.
3. Signed-out billing/delete lands on `/sign-in`.
4. Diff stays in `acorn/website/**`, with Elon on the PR.

## Test and validation

```bash
bun --filter acorn-website typecheck
bun --filter acorn-website lint
bun run ci format
bun run ci test
```

Add tests for delete confirm-gate (no fetch until confirm) and 401 forward. Manual (human): test-mode checkout redirect, open `/terms` `/privacy`, delete against local API.

## Risks and soft parks

- If step-50 is not merged, ship legal + delete first and keep billing as a “coming next” `Banner` that does not call Stripe — or wait. Do not hardcode a fake checkout URL.
- Delete is account-wide (`DELETE /v1/auth/account`), not Acorn-only. The confirm copy must say the Joined account is removed.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
