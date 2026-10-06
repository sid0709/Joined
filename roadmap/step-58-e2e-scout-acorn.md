# Step 58: E2E scout and Acorn journeys

- **Week:** W4
- **Status:** Done
- **Owner:** Quinn (tests and CI lane)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `test(e2e): scout and acorn journeys (roadmap step-58)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

Acorn landing and sign-in are `test.skip` in `tests/e2e/specs/acorn-frontend.e2e.ts`. The website and API are in the sibling Acorn repo, so this branch does not start them and does not fail the suite. Scoutwell home, sign-in, earnings, and payouts are covered.

## Goal

Playwright covers Scoutwell and Acorn website happy paths so those surfaces cannot silently 500 after W3 work.

## Context and dependencies

Parallel with [step-57](step-57-e2e-seeker-premium.md) if specs do not share files awkwardly. Harness: [step-14](step-14-e2e-smoke-harness.md) #67. Scoutwell smoke already loads the home title (`tests/e2e/specs/scoutwell-frontend.e2e.ts`). Acorn website is not in the suite. Extension MV3 automation is not supported.

Scoutwell routes (`scoutwell-frontend/lib/routes.ts`): `/`, `/sign-in`, `/earnings`, `/payouts`, `/submit`, … Origin helper: `SCOUTWELL_FRONTEND_ORIGIN` default `http://localhost:6003`. API: scoutwell-backend :8082. Session cookie: `scoutwell_session`.

Acorn (`acorn-frontend`): `/`, `/sign-in`, `/sign-up`, `/overview`, `/profile`, `/resume`, `/billing` (`lib/routes.ts`). Port **6005**. Cookie: **`acorn_session`**. API: `acorn-backend` :8083 (`ACORN_API_URL`). No Playwright origin helper yet.

e2e-smoke workflow starts joined-backend :8080, scoutwell-backend :8082, joined-frontend :6002, scoutwell-frontend :6003. It does **not** start `acorn-frontend` or `acorn-backend` (`dev:acorn-api`).

## In scope

- Scoutwell: home, sign-in (email or existing helper), earnings or payouts page render. Submit/capture is **not** required if it needs the extension.
- Acorn: landing, `/sign-in` / `/sign-up`, signed-in `/overview` or `/profile` render (`test.skip` + annotate if auth helpers are missing).
- Reuse `tests/e2e/helpers`. Do not hit Chrome Web Store. Do not start Acorn extension automation unless a documented harness already exists.
- CI: extend `e2e-smoke.yml` or add a job that starts `acorn-frontend` on 6005 when those specs run.

## Out of scope

- No product code. No extension MV3 browser automation unless already supported.
- No `acorn*` git branch.
- No live payouts or live Stripe.

## Files and areas to touch

- `tests/e2e/specs/scoutwell-app.e2e.ts` (new)
- `tests/e2e/specs/acorn-frontend.e2e.ts` (new)
- `tests/e2e/helpers/origins.ts` — `ACORN_FRONTEND_ORIGIN` default `http://localhost:6005`, `ACORN_API_ORIGIN` default `http://127.0.0.1:8083`
- `tests/e2e/README.md`
- `.github/workflows/e2e-smoke.yml` — start `acorn-frontend` and `acorn-backend` if specs require them

## Implementation notes

Scoutwell sign-in: prefer email + `EMAIL_PROVIDER=log` if Scoutwell uses the same log sender; otherwise assert the sign-in page and a 401/redirect on `/earnings` when logged out, plus a render when a helper can mint a session. Do not scrape the extension.

Acorn: assert landing copy and `/sign-in`. Do not require a Joined redirect (`joined_session` is not Acorn auth). Skip paid checkout if step-50 is not merged. Use `acorn_session`, not `joined_session`.

Keep timeouts in `helpers/timeouts.ts`. Do not add host string literals in specs.

## Acceptance criteria

1. New specs run in the existing Playwright config.
2. CI on `stage-roadmap-w34` picks them up.
3. Diff stays in `tests/**` and `.github/workflows/**`.

## Test and validation

```bash
bunx playwright test --config tests/e2e/playwright.config.ts
```

Human starts services. Agent does not. Document any new origin env in `tests/e2e/README.md`.

## Risks and soft parks

- e2e-smoke still `continue-on-error: true`.
- Acorn profile/résumé pages may still be Planned (48/49) — skip, do not fail the suite.
- Infra: cancelled CI can look green. Require real green on `ci.yml`.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
