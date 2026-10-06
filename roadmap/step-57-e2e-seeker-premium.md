# Step 57: E2E seeker and Premium journeys

- **Week:** W4
- **Status:** Done
- **Owner:** Quinn (lane: `tests/**`, `.github/workflows/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `test(e2e): seeker and premium journeys (roadmap step-57)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Playwright covers the main seeker path and Premium checkout in **Stripe test mode**, not only smoke page loads.

## Context and dependencies

Extends [step-14](step-14-e2e-smoke-harness.md) (Done, #67) and [step-31](step-31-e2e-email-auth-journey.md) (Done, #101). CI for the W3/W4 branch: [step-33](step-33-ci-for-stage-roadmap-w34.md) (Done, #104). Scout/Acorn journeys are [step-58](step-58-e2e-scout-acorn.md). Live Stripe is [step-59](step-59-stripe-live-config.md) and is forbidden here.

Current suite (`tests/e2e/`):

- Specs: `joined-frontend.e2e.ts`, `joined-backend.e2e.ts`, `scoutwell-frontend.e2e.ts`, `email-auth.e2e.ts`
- Helpers: `origins.ts`, `routes.ts`, `timeouts.ts`, `accounts.ts`, `copy.ts`, `dev-email-log.ts`, `email-auth.ts`
- Command: `bunx playwright test --config tests/e2e/playwright.config.ts`
- Origins: `JOINED_FRONTEND_ORIGIN` (default `http://localhost:6002`), `JOINED_API_ORIGIN` (`http://127.0.0.1:8080`), `SCOUTWELL_FRONTEND_ORIGIN` (`http://localhost:6003`), `JOINED_BACKEND_LOG` (`/tmp/joined-backend-e2e.log`)

`.github/workflows/e2e-smoke.yml` runs on PRs into `stage-roadmap` and `stage-roadmap-w34`, sets `EMAIL_PROVIDER: log`, and is **`continue-on-error: true`** (soft park from steps 14/31). README still says “PRs into `stage-roadmap`” only — update it if you touch the workflow comment.

Premium UI: `joined-frontend` `/pricing`, settings billing, `lib/me/billing.ts`. Checkout needs `STRIPE_SECRET_KEY` test mode on joined-backend (step-29). If checkout cannot run in CI, annotate/skip with an explicit reason — never use live keys.

## In scope

- New specs under `tests/e2e/specs/` for: sign-up/log-in (reuse email helpers), search, open a job, save a job or search if those APIs shipped ([step-34](step-34-saved-searches-api.md) #106, [step-40](step-40-application-tracker.md) #112), applications list, settings billing checkout **in Stripe test mode**.
- Keep `EMAIL_PROVIDER=log` and existing origins/timeouts helpers. Do not start services from product code; follow `tests/e2e/README.md`.
- CI: keep or extend `.github/workflows/e2e-smoke.yml`. Jobs may stay non-blocking only if services are still heavy; explain in the PR.

## Out of scope

- No product code. No Scout/Acorn journeys (step-58). No live Stripe.
- Do not flip `continue-on-error` to false unless the suite is stable and Elon agrees (known soft park).
- No merge to `main`.

## Files and areas to touch

- `tests/e2e/specs/` — new `*.e2e.ts` (new)
- `tests/e2e/helpers/` — billing/search helpers if needed
- `tests/e2e/README.md` — document the new journeys
- `.github/workflows/e2e-smoke.yml` — only if job list or env must grow (`STRIPE_SECRET_KEY` **test** fixture, never live)

## Implementation notes

Reuse `email-auth.ts` for a verified session. Search: `ROUTES.search` (`/`) and `GET /v1/search/jobs` (already smoked). Job page: public SSR from [step-38](step-38-seo-job-pages.md) #107 (`/jobs/{id}`).

Checkout: Stripe test card only if a test key is in **CI secrets**, not the repo. Prefer a backend fake/test clock. If `BILLING_CHECKOUT_ENABLED` is false locally, `test.skip` with a named reason.

Do not use `STRIPE_ALLOW_LIVE`. Do not hit production origins.

Named timeouts stay in `helpers/timeouts.ts`.

## Acceptance criteria

1. `bunx playwright test --config tests/e2e/playwright.config.ts` documents and runs the new specs.
2. CI runs them on PRs into `stage-roadmap-w34`.
3. Diff stays in `tests/**` and `.github/workflows/**`.

## Test and validation

```bash
bunx playwright test --config tests/e2e/playwright.config.ts
```

The human runs APIs/frontends (`bun run dev` + tee `JOINED_BACKEND_LOG` per README). This step’s agent does not start those servers.

CI mirror: the `e2e-smoke` workflow. Note `continue-on-error: true` so a red X can still be “required checks passed” — call that out in the PR.

## Risks and soft parks

- e2e-smoke is still `continue-on-error` (step 14/31 area).
- Infra: GitHub Actions runner starvation cancels jobs; require real green on `ci.yml`, not cancelled.
- Saved-search / tracker extras may still be localStorage ([step-40](step-40-application-tracker.md) soft park: notes/remindAt). Specs should not require a backend PATCH that does not exist.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
