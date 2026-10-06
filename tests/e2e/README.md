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
Resend. joined-api must be the process from this tree: `POST /v1/auth/signup`
has to exist (a stale `go run` from an older checkout returns 404 and the
journey cannot start).

## What's tested

- **joined-frontend**: home page (brand title), search UI on `/` (`ROUTES.search`), `/company` redirect to `/` when company mode is off
- **scoutwell-frontend**: home page
- **joined-backend**: `/health`, `/v1/search/jobs`
- **email journey**: sign-up, check-email, log-in rejected until verify, verify from the log sender, log-in, log-out, password reset from the log sender. Google sign-in/up buttons render; the suite does not complete Google OAuth. Login errors stay generic (no account enumeration).
- **seeker and premium** (`specs/seeker-premium.e2e.ts`): search, a public job page when the catalog has a job, a verified seeker saving a search, the applications list, and billing settings. Premium copy must say Stripe test mode. The spec does not enter a card or follow `checkout.stripe.com`. If checkout is paused, that is recorded and the test continues. If the catalog is empty, the job page is skipped with a note.

## CI

The suite runs on PRs into `stage-roadmap` and `stage-roadmap-w34` via `.github/workflows/e2e-smoke.yml`.
The job is currently **non-blocking** (`continue-on-error: true`) because starting all services in CI is resource-intensive. A red e2e job can still leave required checks green. `ci.yml` is the required signal.
The workflow tees joined-backend stdout to `JOINED_BACKEND_LOG` so the email journey can read DevEmailSender lines.
