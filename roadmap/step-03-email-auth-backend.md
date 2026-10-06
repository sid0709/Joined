# Step 03: Email sign-up and log-in backend

- **Week:** W1
- **Status:** Done
- **Owner:** Ravi (lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(auth): email sign-up and log-in backend (roadmap step-03)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#72](https://github.com/sid0709/Joined/pull/72) (`11c4543`). Follow-ups: [#78](https://github.com/sid0709/Joined/pull/78) (in-memory fake tests), [#81](https://github.com/sid0709/Joined/pull/81) (real store logic on `AccountRecords`)

## Goal

Joined users can create an account and sign in with email, alongside the existing Google sign-in, using the same session cookie. Verification and password reset work end to end against a local log email sender (no real mail in this step).

## Context and dependencies

Investigate existing Google sign-in, sessions, and users in `backend-core/auth`, `backend-core/authapi`, and `joined-backend`. Google already issues `auth.Session` tokens consumed as Bearer and stored by `joined-frontend` as `joined_session`. Email auth must share that session model.

Leo's step-10 builds the screens against these endpoints. Step-11 replaces the log sender with SMTP/Resend. Step-09 adds `RequireRole` on the same auth files — merge this first or stay out of middleware. Step-31 is Quinn's email E2E journey.

What shipped in #72: `POST /v1/auth/signup|verify|signin|signout|password/reset-request|password/reset`, Argon2id hashes, per-email lockout, `DevEmailSender`, and `EmailAuth` mounted on joined-backend only. #78/#81 split persistence so unit tests use an in-memory `AccountRecords` repo while crypto and lockout still run the real store logic. Scoutwell still mounts Google only (no email handlers).

## In scope

- Endpoints under the existing `/v1/auth/*` group: email sign-up, email verification, log-in, log-out, password reset request and confirm. Choice shipped: **email + password with verification** (not magic links).
- Secure password hashing (**argon2id**), lockout on failed log-in, constant-time compares, no user enumeration in responses.
- An email sender interface with a dev implementation that logs the message (no real sending in this step).
- Go tests for the handlers and store, including Mongo integration where the suite already talks to Mongo.
- Follow-up quality: keep handler tests off a live Mongo when a fake/`AccountRecords` repo can exercise the same logic (#81).

## Out of scope

- No frontend screens (Leo, step-10).
- No real email provider wiring and no real emails sent (step-11).
- No changes to Scoutwell, admin, or `acorn-backend` sign-in. `acorn-backend` is a separate Go service (Elon); do not add Joined email routes there.
- No changes to `go.work` / `go.mod` dependencies unless needed; flag any new module in the PR.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `backend-core/auth/email.go` — signup, verify, sign-in, reset, lockout
- `backend-core/auth/account_records.go` and `account_records_mongo.go` (#81)
- `backend-core/auth/authtest/records.go` (#81)
- `backend-core/auth/store.go` — collections and indexes
- `backend-core/auth/auth.go` — roles, audiences, token hashing
- `backend-core/authapi/email.go` — HTTP handlers
- `backend-core/authapi/authapi.go` — `Email` / `Register`
- `joined-backend/internal/httpapi/server.go` — mount `EmailAuth`
- `joined-backend/cmd/server/main.go` — inject sender
- Tests: `backend-core/auth/email_unit_test.go`, `email_mongo_test.go`, `email_hash_test.go`, `backend-core/authapi/email_test.go`

Do not touch `backend-core/scout/**`, `backend-core/billing/**`, or frontend apps.

## Implementation notes

### Endpoints (`authapi.Handlers.Register`)

JSON errors: `{"error":"<message>"}` via `httpkit.WriteError`. Max body: 16 KiB.

| Method | Path                              | Body                             | Success                                                   |
| ------ | --------------------------------- | -------------------------------- | --------------------------------------------------------- |
| `POST` | `/v1/auth/signup`                 | `{email, password, name, role?}` | `200` `{message}` (same text for new and duplicate email) |
| `POST` | `/v1/auth/verify`                 | `{token}`                        | `200` `{message}`                                         |
| `POST` | `/v1/auth/signin`                 | `{email, password}`              | `200` `{token, session}`                                  |
| `POST` | `/v1/auth/signout`                | Bearer                           | `204`                                                     |
| `POST` | `/v1/auth/password/reset-request` | `{email}`                        | `200` `{message}` (always the same)                       |
| `POST` | `/v1/auth/password/reset`         | `{token, newPassword}`           | `200` `{message}`                                         |

Existing Google routes and `GET /v1/auth/session` stay. Paths are `signin` / `signout`, not `login` / `logout`.

`session` is `{ user: {id, name, email, role}, company }`. Roles: `candidate`, `employee`, `scout`. Joined audience allows `candidate` and `employee` only; default signup role on Joined is `candidate`.

### Security

- Passwords: Argon2id (`golang.org/x/crypto/argon2`; time 1, memory 64 MiB, threads 4, key 32, salt 16). No bcrypt.
- Session and email tokens: SHA-256 hex of 32 random bytes. Verification TTL 24h; reset TTL 1h; tokens are single-use (`TakeVerification` / `TakeReset`).
- Lockout: Mongo `login_attempts`, 5 failures → 15 minutes, HTTP 429 `ErrAccountLocked`. Cleared on success. Signup hashes even on duplicate email (timing parity).
- Unverified sign-in → 403 `ErrEmailNotVerified`. Bad credentials → 401. Kill switches `KILLSWITCH_SIGNUP` / `KILLSWITCH_EMAIL` → 503.
- Password reset invalidates all sessions for that user.

### Email sender (this step)

Interface `auth.EmailSender`: `SendVerification`, `SendPasswordReset`, `SendDuplicateSignupNotice`. Default `DevEmailSender` logs via slog. Step-11 adds `EMAIL_PROVIDER=log|smtp|resend`.

### Mongo (`DEST_DB`)

| Collection            | Notes                                                      |
| --------------------- | ---------------------------------------------------------- |
| `users`               | Unique `email`; `passwordHash`, `passwordSalt`, `verified` |
| `sessions`            | Unique `tokenHash`                                         |
| `email_verifications` | Unique `tokenHash`, TTL `expiresAt`                        |
| `password_resets`     | Unique `tokenHash`, TTL `expiresAt`                        |
| `login_attempts`      | Unique `email`                                             |

## Acceptance criteria

1. `go vet` and `go test` pass for touched modules.
2. Sign-up, verify, log-in, log-out, and reset work end to end against local Mongo using the log sender.
3. Existing Google sign-in keeps working.
4. Diff stays inside Ravi's lane.
5. Duplicate-email signup and reset-request do not reveal whether the account exists.

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/auth/...
go test ./backend-core/authapi/...
go test ./joined-backend/internal/httpapi/...
bun run ci go
```

Cover: signup + verify + signin, weak password, lockout after 5 failures, reset consumes token and kills sessions, kill switches, hash unit tests, Mongo integration (`TestMongoEmailSignupIntegration`).

Manual (human-run local stack): sign up, read the verification URL from the backend log, verify, sign in, request reset, confirm. Google sign-in still works.

## Risks and soft parks

- #81 is the persistence follow-up; keep `AccountRecords` so handler tests do not require Mongo.
- Step-10 and step-11 share these files — coordinate or land this first.
- Scoutwell has no email handlers; do not add them here.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #72; follow-ups #78 and #81), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
