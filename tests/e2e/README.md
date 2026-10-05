# E2E Smoke Tests

End-to-end smoke suite that proves main pages load, key APIs respond, and the
email sign-up / log-in journey works against the log email sender.

## Local usage

1. **Start services** and capture joined-api logs (the log / `EMAIL_PROVIDER=log`
   sender prints verify and reset links; the email journey reads that file, never
   a real inbox):

   ```bash
   bun run dev 2>&1 | tee "${JOINED_BACKEND_LOG:-/tmp/joined-backend-e2e.log}"
   ```

   If APIs are already running in another terminal, tee only joined-api:

   ```bash
   bun run dev:joined-api 2>&1 | tee "${JOINED_BACKEND_LOG:-/tmp/joined-backend-e2e.log}"
   ```

2. **Run the suite** (same command as CI):

   ```bash
   bunx playwright test --config tests/e2e/playwright.config.ts
   ```

`JOINED_BACKEND_LOG` defaults to `/tmp/joined-backend-e2e.log`. Keep
`EMAIL_PROVIDER=log` (the backend default). Do not point the suite at SMTP or
Resend.

## What's tested

- **joined-frontend**: home page (brand title), search UI on `/` (`ROUTES.search`), `/company` redirect to `/` when company mode is off
- **scoutwell-frontend**: home page
- **joined-backend**: `/health`, `/v1/search/jobs`
- **email journey**: sign-up, check-email, log-in rejected until verify, verify from the log sender, log-in, log-out, password reset from the log sender. Google sign-in/up buttons render; the suite does not complete Google OAuth. Login errors stay generic (no account enumeration).

## CI

The suite runs on PRs into `stage-roadmap` via `.github/workflows/e2e-smoke.yml`.
The job is currently **non-blocking** because starting all services in CI is resource-intensive.
The workflow tees joined-backend stdout to `JOINED_BACKEND_LOG` so the email journey can read DevEmailSender lines.
