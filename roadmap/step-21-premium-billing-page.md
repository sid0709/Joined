# Step 21: Premium pricing and billing page

- **Week:** W2
- **Status:** Done
- **Owner:** Leo (lane: Next.js frontends, `sid-ui`, `packages/google-signin`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(joined-frontend): premium pricing and billing page (roadmap step-21)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#96](https://github.com/sid0709/Joined/pull/96) (`9b495fe`)
- **Starts after step-29 and step-10 merge** (needs the checkout API and the email sign-in screens in the same app).

## Goal

A job seeker can see Premium plans, start Stripe Checkout in test mode, and manage or cancel their plan from a billing page. Local testing uses Stripe test mode and test cards only.

## Context and dependencies

Penny's step-29 (#90) plus mount #93 expose `POST /v1/me/billing/checkout`, `POST /v1/me/billing/portal`, `GET /v1/me/billing/subscription` on joined-backend when `STRIPE_SECRET_KEY` is set. Step-08 defined amounts `PREMIUM_MONTHLY_PRICE_CENTS` (default 2900) and `PREMIUM_YEARLY_PRICE_CENTS` (default 29000). Step-10 provides sign-in. Step-26 adds a backend `checkout` kill switch; this page also has a deploy-time frontend flag.

What shipped in #96: `/pricing`, settings billing section, `/settings/billing/success` and `/cancel`, `startCheckout` / `startPortal` via `/api/me/billing/*`, prices from env (same names as billing config, not a live price GET), `BILLING_CHECKOUT_ENABLED` / `NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED` hide Upgrade and show a Banner.

## In scope

- Pricing section in `joined-frontend` (monthly and yearly). Display amounts from the same env/defaults as step-29, not hard-coded literals in the component. Use `sid-ui` for cards, buttons, and banners.
- "Upgrade" calls the step-29 checkout endpoint and redirects to the returned Stripe Checkout URL; success and cancel return pages.
- Billing page under settings: current plan, renewal date, status, and a "Manage billing" button that opens the step-29 customer-portal link.
- Respect the checkout kill switch if present (hide upgrade and show a notice).

## Out of scope

- No live keys or real charges. Local testing uses Stripe test mode and test cards only.
- No backend changes.
- No Scout, admin, or `acorn-frontend` apps. Use `sid-ui` (catalog); do not add `packages/design-system` back.
- No merge to `main`. Never open a PR into an `acorn*` branch. Live mode is step-59 and needs explicit user approval.

## Files and areas to touch

- `joined-frontend/app/(seeker)/pricing/page.tsx`
- `joined-frontend/app/(seeker)/(candidate)/settings/page.tsx` — billing section
- `joined-frontend/components/settings/billing-settings.tsx`
- `joined-frontend/app/(seeker)/(candidate)/settings/billing/success/page.tsx`
- `joined-frontend/app/(seeker)/(candidate)/settings/billing/cancel/page.tsx`
- `joined-frontend/components/billing/pricing-plans.tsx`
- `joined-frontend/lib/billing.ts` — plan helpers, return URLs
- `joined-frontend/lib/me/billing.ts` — client to `/api/me/billing/*`
- `joined-frontend/app/api/me/[...path]/route.ts` — existing `forwardJoined` + Bearer `joined_session`
- `joined-frontend/lib/config.ts` — `premiumPrices()`, `isBillingCheckoutEnabled()`
- `joined-frontend/.env.example` — Premium cents + `BILLING_CHECKOUT_ENABLED`
- Tests: `lib/billing.test.ts`, `lib/me/billing.test.ts`, `lib/config.test.ts`, `lib/settings.test.ts`

## Implementation notes

### API

Browser → `POST /api/me/billing/checkout`, `GET /api/me/billing/subscription`, `POST /api/me/billing/portal` → joined-backend `/v1/me/billing/*` with `Authorization: Bearer <joined_session>`.

Checkout request includes success/cancel URLs from `ROUTES.billingSuccess` / `ROUTES.billingCancel`. Portal `return_url` → settings billing section.

### Prices

There is no `GET /v1/me/billing/prices` on this branch. Display prices are **env-synced** with `backend-core/billing`:

- `PREMIUM_MONTHLY_PRICE_CENTS` (default 2900)
- `PREMIUM_YEARLY_PRICE_CENTS` (default 29000)
- `PREMIUM_CURRENCY` = `USD` in `lib/config.ts`

Do not hard-code `29` / `$29` in JSX. Stripe charges the backend/catalog amounts.

### Kill switch

Frontend: `BILLING_CHECKOUT_ENABLED` or `NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED` — `"false"` or `"0"` disables Upgrade and shows `BILLING_MESSAGES.checkoutDisabled*`. Backend step-26 `checkout` kill switch can still 503 independently; the page does not read Mongo kill switches. Hide upgrade when the frontend flag is off; surface a notice if checkout returns 503.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. Locally, a test-mode checkout with a Stripe test card returns to the success page and the billing page shows the active plan.
3. Diff stays in Leo's lane.
4. With checkout disabled, Upgrade is hidden and a notice is shown.

## Test and validation

```bash
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun test joined-frontend/lib/billing.test.ts joined-frontend/lib/me/billing.test.ts joined-frontend/lib/config.test.ts
bun --filter joined-frontend build
bun run ci typecheck
```

No Premium E2E yet (step-57). Manual: human-run joined-frontend + joined-backend with `sk_test_` keys, test card `4242…`, confirm success URL and settings billing status. Never use `sk_live_`.

## Risks and soft parks

- Display prices are env mirrors, not a live Stripe fetch. Keep frontend and backend defaults equal.
- Frontend kill switch is deploy-time env; runtime admin kill switch is step-26. They can disagree.
- Step-57 owns the automated Premium journey.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #96), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
