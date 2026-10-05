# Step 21: Premium pricing and billing page

Status: Done (merged in W2)

- **Week:** W2, Premium billing
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(joined-frontend): premium pricing and billing page (roadmap step-21)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-29 and step-10 merge** (needs the checkout API and the email sign-in screens in the same app).

## Goal
A job seeker can see Premium plans, start Stripe Checkout in test mode, and manage or cancel their plan from a billing page.

## In scope
- Pricing section in `joined-frontend` (monthly and yearly, prices from the step-29 API, not hard-coded).
- "Upgrade" calls the step-29 checkout endpoint and redirects to the returned Stripe Checkout URL; success and cancel return pages.
- Billing page under settings: current plan, renewal date, status, and a "Manage billing" button that opens the step-29 customer-portal link.
- Respect the step-26 checkout kill switch if present (hide upgrade and show a notice).

## Out of scope
- No live keys or real charges; local testing uses Stripe test mode and test cards only.
- No backend changes, no Scout or admin apps.

## Acceptance criteria
1. Build, typecheck, lint, format pass for `joined-frontend`.
2. Locally, a test-mode checkout with a Stripe test card returns to the success page and the billing page shows the active plan.
3. Diff stays in Leo's lane.
