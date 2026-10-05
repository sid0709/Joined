# Step 03: Email sign-up and log-in backend

- **Week:** W1, Foundations
- **Owner:** Ravi (lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`)
- **Target branch:** `stage-roadmap`
- **PR title:** `roadmap step-03: email sign-up and log-in backend`

## Goal

Joined users can create an account and sign in with email, alongside the existing Google sign-in, using the same session cookie.

## In scope

- Investigate the current Google sign-in, session, and users model in `backend-core/auth`, `backend-core/authapi`, and `joined-backend`.
- Endpoints under the existing `/v1/auth/*` group: email sign-up, email verification, log-in, log-out, password reset request and confirm. Pick email+password with verification unless the code strongly favors magic links; explain the choice in the PR.
- Secure password hashing (argon2id or bcrypt), rate limiting or lockout on log-in, constant-time compares, no user enumeration in responses.
- An email sender interface with a dev implementation that logs the message (no real sending in this step) so verification and reset links can be tested locally.
- Go tests for the handlers and store.

## Out of scope

- No frontend screens (Leo does those next).
- No real email provider wiring and no real emails sent.
- No changes to Scoutwell or admin sign-in.
- No changes to `go.work`/`go.mod` dependencies unless needed; flag any new module in the PR.

## Acceptance criteria

1. `go vet` and `go test` pass for touched modules.
2. Sign-up, verify, log-in, log-out, reset work end to end against local Mongo using the log sender.
3. Existing Google sign-in keeps working.
4. Diff stays inside Ravi's lane.
