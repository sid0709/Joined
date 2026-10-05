# Step 31: E2E email sign-up and log-in journey

Status: Done (merged in W2)

- **Week:** W2, QA
- **Owner:** Quinn (tests and CI lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `test(e2e): email sign-up and log-in journey (roadmap step-31)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-10 and step-14 merge** (needs the screens and the harness).

## Goal
An end-to-end test proves a job seeker can sign up with email, verify, log in, log out, and reset a password.

## In scope
- A journey under `tests/e2e/` using the step-14 harness against local services with the log email sender; read the verify and reset links from the dev sender output or a test hook, never a real inbox.
- Checks for no account enumeration on sign-up and forgot-password, and that Google sign-in still renders.
- Run it in the step-14 CI job.

## Out of scope
- No real email, no product code changes, no production targets.

## Acceptance criteria
1. The journey passes locally with one documented command and in CI.
2. It fails if verification is skipped.
3. Diff touches only `tests/**` and `.github/workflows/**`.
