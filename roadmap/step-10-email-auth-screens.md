# Step 10: Email sign-up and log-in screens

- **Week:** W1
- **Status:** Done
- **Owner:** Leo (lane: Next.js frontends, `sid-ui`, `packages/google-signin`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(joined-frontend): email sign-up and log-in screens (roadmap step-10)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#79](https://github.com/sid0709/Joined/pull/79) (`3f47f31`)
- **Starts after step-03 merges** (needs its API).

## Goal

Job seekers can sign up, verify, log in, log out, and reset a password with email on joinedhq.com, next to Google sign-in, using the same `joined_session` cookie flow.

## Context and dependencies

Depends on step-03 (#72) `/v1/auth/signup|verify|signin|signout|password/reset-request|password/reset`. Step-11 templates already assume frontend paths `/verify`, `/reset-password`, `/forgot-password` (`backend-core/auth/email_templates.go`). Step-04 flag `NEXT_PUBLIC_COMPANY_MODE_ENABLED` must stay respected: no company email sign-up when company mode is off.

Google sign-in already uses `@joined/google-signin` and `app/api/auth/google/*`. Reuse that cookie writer (`lib/auth/cookie.ts`). Quinn's step-31 adds `tests/e2e/specs/email-auth.e2e.ts` on top of these screens.

What shipped in #79: pages for sign-up, check-email, verify, sign-in, forgot-password, reset-password; Next.js API routes that forward to joined-backend; CSRF on POSTs; no account enumeration in copy; candidate-only email signup.

## In scope

- Screens in `joined-frontend`: sign up, check your email, verify link landing, log in, forgot password, reset password. Use `sid-ui`.
- Call the step-03 endpoints through the app's existing server-side API pattern; keep the `joined_session` cookie flow consistent with Google sign-in.
- Inline validation, clear error states, no account enumeration in messages, loading and disabled states.
- Respect the step-04 flag: no company sign-up path when company mode is off.

## Out of scope

- No backend changes.
- No Scoutwell, admin, or `acorn-frontend` sign-in screens. Use `sid-ui` (not `packages/design-system`, which is gone).
- No real email provider (Ravi, step-11). Local testing uses `EMAIL_PROVIDER=log`.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `joined-frontend/app/(auth)/sign-up/page.tsx`
- `joined-frontend/app/(auth)/check-email/page.tsx` (new)
- `joined-frontend/app/(auth)/verify/page.tsx` (new)
- `joined-frontend/app/(auth)/sign-in/page.tsx`
- `joined-frontend/app/(auth)/forgot-password/page.tsx` (new)
- `joined-frontend/app/(auth)/reset-password/page.tsx` (new)
- `joined-frontend/components/auth/email-sign-up-fields.tsx`, `email-sign-in-form.tsx`, `check-email-card.tsx`, `verify-email-card.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx` (new)
- `joined-frontend/components/auth/sign-in-form.tsx`, `sign-up-form.tsx` (update)
- `joined-frontend/app/api/auth/signup/route.ts`, `signin/route.ts`, `verify/route.ts`, `password/reset-request/route.ts`, `password/reset/route.ts` (new)
- `joined-frontend/lib/auth/email.ts`, `email-api.ts` (new)
- `joined-frontend/lib/auth/cookie.ts`, `csrf.ts` — reuse / extend
- `joined-frontend/lib/routes.ts` — `AUTH_PAGE_PATHS`
- Tests: `lib/auth/email.test.ts`, `email-api.test.ts`, `csrf.test.ts`

Do not edit `packages/google-signin/**` unless a shared helper is broken (it was not).

## Implementation notes

### Browser → Next → joined-backend

| App route                               | Backend                                          |
| --------------------------------------- | ------------------------------------------------ |
| `POST /api/auth/signup`                 | `POST /v1/auth/signup`                           |
| `POST /api/auth/signin`                 | `POST /v1/auth/signin` then `writeSessionCookie` |
| `POST /api/auth/verify`                 | `POST /v1/auth/verify`                           |
| `POST /api/auth/password/reset-request` | `POST /v1/auth/password/reset-request`           |
| `POST /api/auth/password/reset`         | `POST /v1/auth/password/reset`                   |

`JOINED_API_URL` is the server-side API base (`joined-frontend/.env.example`). Cookie name: `joined_session` (httpOnly, 30d), same as Google callback.

Verify landing (`/verify?token=`) may verify on the server in `verify/page.tsx` as well as via the POST route.

CSRF: same-origin + `application/json` on email auth POSTs (`lib/auth/csrf.ts`).

### Copy and enumeration

Signup, check-email, and reset-request always show the same success message whether or not the email exists. Do not echo "account not found" or "email already registered".

### Company mode

When `isCompanyModeEnabled()` is false: no employer step on sign-up, ignore `?intent=hiring`, sign-in copy omits hiring. Shipped behavior is stricter: email signup is candidate-only even when company mode is on (Google remains the employer path). Keep that unless Elon asks to reopen employer email signup.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. Full email journey works locally against the step-03 backend with the log email sender.
3. Google sign-in still works.
4. Diff stays in Leo's lane.
5. No account-enumeration strings in UI messages.

## Test and validation

```bash
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun test joined-frontend/lib/auth/email.test.ts joined-frontend/lib/auth/email-api.test.ts joined-frontend/lib/auth/csrf.test.ts
bun --filter joined-frontend build
bun run ci typecheck
```

After step-31: `bunx playwright test --config tests/e2e/playwright.config.ts tests/e2e/specs/email-auth.e2e.ts` (human-run stack; `EMAIL_PROVIDER=log`).

Manual: sign up, copy the verify URL from the joined-backend log, verify, sign in, sign out, forgot + reset. Confirm Google still works. Confirm company mode off hides employer signup.

## Risks and soft parks

- Verify/reset links in step-11 templates must keep matching `/verify` and `/reset-password`.
- E2E email journey is Quinn step-31, not this PR.
- E2E smoke remains `continue-on-error: true` (step-14/31 area).
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #79), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
