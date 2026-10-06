# Step 31: E2E email sign-up and log-in journey

- **Week:** W2
- **Status:** Done
- **Owner:** Quinn (tests and CI lane: `tests/**`, `.github/workflows/**`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `test(e2e): email sign-up and log-in journey (roadmap step-31)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #101 (`a048881` / `901223f`)

## Goal

An end-to-end test proves a job seeker can sign up with email, verify, log in, log out, and reset a password. The journey fails if verification is skipped. It never opens a real inbox.

## Context and dependencies

Starts after step-10 (email auth screens) and step-14 (e2e smoke harness) merge. Uses the step-14 Playwright harness under `tests/e2e/` against local services with the log email sender (`EMAIL_PROVIDER=log`). Verify and reset links are parsed from joined-backend stdout (`JOINED_BACKEND_LOG`), never a real mailbox.

CI job: `.github/workflows/e2e-smoke.yml` (job `e2e-smoke`, display name `E2E smoke suite`). It already runs on PRs into `stage-roadmap` and, after step-33, `stage-roadmap-w34`. **`continue-on-error: true`** is still set — the suite is exploratory and does not block merge. Call that out; do not silently treat a cancelled or failed smoke as green.

No product code. No production targets. No real email provider.

## In scope

- A journey under `tests/e2e/` using the step-14 harness against local services with the log email sender.
- Read verify and reset links from the dev sender output or a test hook, never a real inbox.
- Checks for no account enumeration on sign-up and forgot-password, and that Google sign-in still renders.
- Run it in the step-14 CI job.

## Out of scope

- No real email (`EMAIL_PROVIDER` stays `log`).
- No product code changes (frontends, Go services).
- No production targets.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `tests/e2e/specs/email-auth.e2e.ts` — main journey + Google button smoke
- `tests/e2e/helpers/email-auth.ts` — UI helpers, generic login failure
- `tests/e2e/helpers/dev-email-log.ts` — parse `JOINED_BACKEND_LOG` for verify/reset URLs
- `tests/e2e/helpers/accounts.ts` — `uniqueSeekerEmail()`
- `tests/e2e/helpers/routes.ts` — `AUTH_PATHS`
- `tests/e2e/helpers/copy.ts` — `EMAIL_AUTH_COPY`
- `tests/e2e/helpers/timeouts.ts`
- `tests/e2e/playwright.config.ts` — `testMatch: **/*.e2e.ts`
- `tests/e2e/README.md` — local + CI instructions
- `.github/workflows/e2e-smoke.yml` — only if the new spec needs a hook; prefer zero workflow edits
- `tests/e2e/helpers/dev-email-log.test.js` — unit test for log parsing (optional)

Do not edit `joined-frontend/**` or `joined-backend/**` except as read-only contract.

## Implementation notes

**Run command (local = CI):**

```bash
bunx playwright test --config tests/e2e/playwright.config.ts
```

**Required env:**

- `EMAIL_PROVIDER=log`
- `JOINED_BACKEND_LOG` — default `/tmp/joined-backend-e2e.log`; tee joined-api stdout
- Origins (`tests/e2e/helpers/origins.ts`): `JOINED_FRONTEND_ORIGIN` default `http://localhost:6002`, `JOINED_API_ORIGIN` default `http://127.0.0.1:8080`, `SCOUTWELL_FRONTEND_ORIGIN` default `http://localhost:6003`

**Journey** (`email-auth.e2e.ts`):

1. Google sign-in/up buttons visible on auth screens (do not complete OAuth).
2. Sign-up → check-email → login fails before verify → verify via log link → login → logout → forgot password → reset via log link → login with new password.
3. Sign-up and forgot-password must not enumerate existing accounts (generic copy).
4. The journey must fail if the tester skips the verify link and still reaches an authenticated surface.

**API:** `POST /v1/auth/signup` and the existing verify/reset routes from step-03 / step-10 / step-11.

**CI (`e2e-smoke.yml`):** Mongo docker → `go run` joined-backend `:8080` + scoutwell-backend `:8082` → `bun --filter joined-frontend dev` + `scoutwell-frontend dev` → Playwright → upload `playwright-report/` + joined-backend log. Playwright: `retries: 2`, `workers: 1`, `forbidOnly: true`.

Local config expects services already running (`webServer` is a no-op echo unless CI). The agent does not start those servers.

## Acceptance criteria

1. The journey passes locally with the documented Playwright command and runs in the step-14 CI job.
2. It fails if verification is skipped.
3. Google sign-in still renders. Sign-up and forgot-password do not enumerate accounts.
4. Diff touches only `tests/**` and `.github/workflows/**`.

## Test and validation

```bash
bunx playwright test --config tests/e2e/playwright.config.ts
bun test tests/e2e/helpers/dev-email-log.test.js
bun run ci
```

Human-run local: services up with `EMAIL_PROVIDER=log`, tee joined-backend logs, run the Playwright command. Confirm a skipped-verify variant fails.

After push, open the Actions run: **E2E smoke suite** executed. Because it is `continue-on-error`, still attach the report artifact and say whether it actually passed.

## Risks and soft parks

- **e2e-smoke is still `continue-on-error`.** A failed or cancelled smoke job does not fail the PR. Call this out; do not claim "all checks passed" if smoke was cancelled.
- Infra: GitHub Actions runner starvation cancels jobs. Require real green on required checks (`bun run ci` jobs).
- Local Playwright expects services the human already started.

## Definition of done

PR into `stage-roadmap-w34` (this step originally landed on retired `stage-roadmap` as #101). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
