# Step 04: Hide company/recruiter mode for launch

- **Week:** W1
- **Status:** Done
- **Owner:** Leo (lane: Next.js frontends, `sid-ui`, `packages/google-signin`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(joined-frontend): hide company mode for launch (roadmap step-04)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#70](https://github.com/sid0709/Joined/pull/70) (`cd362a6`)

## Goal

The launch build of joinedhq.com shows only the job-seeker experience. Company and recruiter mode stays in the tree, hidden behind a flag. With the flag off there is no visible path into company mode and `/company/**` redirects home.

## Context and dependencies

Company/recruiter UI already exists under `joined-frontend/app/company/**`, `lib/company/**`, and employer CTAs in the seeker shell. Launch must not delete that code. Ravi's step-09 adds a matching backend gate (`COMPANY_MODE_ENABLED` + `requireCompanyMode` on `/v1/company/*`). Quinn's step-14 smoke suite asserts `/company` redirects to `/`.

This step can start immediately and only touches `joined-frontend`. Step-10 (email screens) must respect the same flag (no company sign-up path when off).

What shipped in #70: `NEXT_PUBLIC_COMPANY_MODE_ENABLED` (must be the literal `"true"` to enable; default off) in `joined-frontend/lib/config.ts` (`isCompanyModeEnabled()`), documented in `joined-frontend/.env.example`. Next.js middleware lives in `joined-frontend/proxy.ts` (built as `middleware.js`). Flag-off redirects `/company/**` and `/hiring/setup` to `/`. Nav, mode picker, and sign-up hide employer paths. Signed-in employees see `CompanyModeComing` instead of company tools.

## In scope

- A single flag `NEXT_PUBLIC_COMPANY_MODE_ENABLED` in `joined-frontend`, default off.
- With the flag off: hide every nav link, button, switcher, and CTA into company mode; `/company/**` (and `/hiring/setup`) redirect to `/` server-side via middleware; sign-up does not offer a company path.
- With the flag on: today's behavior is unchanged.
- Document the flag in `joined-frontend/.env.example`.
- Unit tests where the app already has a test setup.

## Out of scope

- No backend changes; company APIs stay as they are (Ravi gates them in step-09).
- No deleting company code (`app/company/**`, `lib/company/**`, `app/api/company/**`).
- No other apps (`scoutwell-frontend`, `admin-frontend`, `connected-frontend`, `acorn-frontend`). `joined-theme` and `packages/design-system` are gone; consume `sid-ui` from the catalog.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `joined-frontend/lib/config.ts` — `isCompanyModeEnabled()`
- `joined-frontend/.env.example` — document the flag
- `joined-frontend/proxy.ts` — redirects when flag off
- `joined-frontend/lib/company-mode-redirect.ts` (and tests) — redirect helpers
- `joined-frontend/components/shell/guest-actions.tsx` — hide For-employers nav
- `joined-frontend/components/shell/seeker-header.tsx` — hide mobile employer link
- `joined-frontend/components/onboarding/mode-picker.tsx` — candidate-only when off
- `joined-frontend/components/auth/sign-up-form.tsx` — no company path when off
- `joined-frontend/app/(auth)/sign-up/page.tsx` — ignore `?intent=hiring` unless flag on
- `joined-frontend/app/(seeker)/layout.tsx` and `(candidate)/layout.tsx` — employee-as-guest / coming-soon
- `joined-frontend/components/auth/company-mode-coming.tsx` — employee UX when flag off
- Tests: `lib/config.test.ts`, `lib/company-mode-redirect.test.ts`, `lib/employee-flag-off.test.ts`

## Implementation notes

- Flag reader: `process.env.NEXT_PUBLIC_COMPANY_MODE_ENABLED === "true"`. Any other value is off.
- Session cookie is unchanged: `joined_session` (`lib/auth/constants.ts`).
- Middleware matcher already guards candidate routes (`/applications`, `/settings`). Add company/hiring redirects without weakening auth guards.
- When the flag is off and `MODE_COOKIE` is `company`, do not bounce `/` to company home.
- Employees signed in while the flag is off: show `CompanyModeComing` ("Company accounts coming soon") plus sign out. Treat them as guests on public job pages so candidate APIs are not called.
- Use `sid-ui` tokens and components (`import { … } from "sid-ui"`). Do not introduce hex colors or one-off layout styles. Do not add `packages/design-system` back.
- Company API routes (`app/api/company/[...path]/route.ts`) stay; they are unused from the UI when the flag is off.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. Flag off: no visible path into company mode; `/company` and `/hiring/setup` redirect to `/`.
3. Flag on: company mode works as before.
4. Diff stays inside Leo's lane (`joined-frontend/**` for this step).
5. Flag is documented in `.env.example`.

## Test and validation

```bash
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun test joined-frontend/lib/config.test.ts joined-frontend/lib/company-mode-redirect.test.ts joined-frontend/lib/employee-flag-off.test.ts
bun --filter joined-frontend build
bun run ci lint
bun run ci format
bun run ci typecheck
```

E2E (after step-14): `bunx playwright test --config tests/e2e/playwright.config.ts` — `tests/e2e/specs/joined-frontend.e2e.ts` asserts `/company` → `/` when company mode is off.

Manual: flag unset, visit `/`, `/company`, `/hiring/setup`, sign-up. Confirm no employer CTAs. Set `NEXT_PUBLIC_COMPANY_MODE_ENABLED=true` and confirm company nav and `/company` work.

## Risks and soft parks

- Auth layout tagline may still mention hiring when the flag is off (`app/(auth)/layout.tsx`). Soft follow-up, not blocking.
- No E2E for flag-on company mode; unit tests cover the helpers only.
- Backend `COMPANY_MODE_ENABLED` (step-09) is a separate env. Keep frontend and backend flags aligned in deploy docs.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #70), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
