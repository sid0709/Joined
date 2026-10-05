# E2E Smoke Tests

End-to-end smoke suite that proves main pages load and key APIs respond.

## Local usage

1. **Start all services:**
   ```bash
   bun run dev
   ```

2. **Run the smoke tests:**
   ```bash
   bun run test:e2e
   ```

   Or with Playwright directly:
   ```bash
   bunx playwright test --config tests/e2e/playwright.config.ts
   ```

## What's tested

- **joined-frontend**: home page, search page
- **scoutwell-frontend**: home page
- **joined-backend**: `/health`, `/v1/search/jobs`

## Skipped tests

- `/company` redirect: Skipped until step-04 (company mode toggle) merges.

## CI

The smoke suite runs on PRs into `stage-roadmap` via `.github/workflows/e2e-smoke.yml`.
The job is currently **non-blocking** because starting all services in CI is resource-intensive.
