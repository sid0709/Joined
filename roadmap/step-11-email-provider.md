# Step 11: Email sending provider

- **Week:** W1
- **Status:** Done
- **Owner:** Ravi (lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(email): sending provider adapter (roadmap step-11)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#76](https://github.com/sid0709/Joined/pull/76) (`8863185`)
- **Starts after step-03 merges** (builds on its email sender interface).

## Goal

The backend can send real transactional email through a provider when configured, and stays on the dev log sender otherwise. CI and local default send nothing off the machine.

## Context and dependencies

Step-03 (#72) introduced `auth.EmailSender` (`SendVerification`, `SendPasswordReset`, `SendDuplicateSignupNotice`) and `DevEmailSender`. Step-10 screens live at `/verify`, `/reset-password`, `/forgot-password`. Kill switch `KILLSWITCH_EMAIL` already blocks send/reset at the handler layer.

The user has not chosen a production provider. Keep the adapter swappable: `EMAIL_PROVIDER=log|smtp|resend`.

What shipped in #76: `backend-core/auth/email_providers.go`, `email_sender.go`, `email_templates.go`, `backend-core/config/email.go`, joined-backend `LoadEmail` + `NewEmailSender`, env documented in `joined-backend/README.md`. Invalid provider fails startup.

## In scope

- A provider adapter behind the step-03 sender interface. Default choice: generic HTTP provider (Resend-style API) plus plain SMTP, picked by env (`EMAIL_PROVIDER=log|smtp|resend`).
- Templates for verify email and password reset (plain text plus simple HTML), with the product name and links built from config.
- Default is `log`. No real email is sent in CI or tests; tests use a fake transport.
- Document env vars in the service README. Do not edit `.env` files.

## Out of scope

- No marketing email.
- No real sends in this step, no domain or DNS changes.
- No Scoutwell email (Scoutwell has no EmailAuth mount).
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `backend-core/auth/email_sender.go` and `email_sender_test.go`
- `backend-core/auth/email_providers.go` and `email_providers_test.go`
- `backend-core/auth/email_templates.go` and `email_templates_test.go`
- `backend-core/config/email.go` and `email_test.go`
- `joined-backend/cmd/server/main.go` — `LoadEmail` + `NewEmailSender`
- `joined-backend/README.md` — env table
- `joined-backend/internal/httpapi/server.go` — already accepts a sender; keep `emailSenderOrDev` fallback

Do not edit `.env` or frontend files. Stay out of `backend-core/scout/**` and `billing/**`.

## Implementation notes

### Providers (`auth.NewEmailSender`)

| `EMAIL_PROVIDER` | Implementation                                       |
| ---------------- | ---------------------------------------------------- |
| `log` or `""`    | `DevEmailSender` (slog only)                         |
| `smtp`           | `SMTPProvider` (STARTTLS; port **465** implicit TLS) |
| `resend`         | `ResendProvider` → `https://api.resend.com/emails`   |

Invalid value → startup error. `ValidateProviderConfig` enforces required fields per provider.

### Env (`config.LoadEmail`, documented in `joined-backend/README.md`)

`EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, `EMAIL_SMTP_INSECURE`, `EMAIL_RESEND_API_KEY`, `EMAIL_PRODUCT_NAME` (default `Joined`), `EMAIL_APP_BASE_URL` (default `FRONTEND_ORIGIN`).

### Templates

- Paths under `AppBaseURL`: `/verify`, `/reset-password`, `/forgot-password` (must match step-10).
- HTML + plain text for verification, reset, and duplicate-signup notice.
- Product name from `EMAIL_PRODUCT_NAME`, not a hard-coded string in the template body beyond the config default.

### Safety

- Default `log` so CI never leaves the machine.
- Tests inject a fake HTTP/SMTP transport; do not hit Resend or a real SMTP host.
- `KILLSWITCH_EMAIL` still wins at the auth handler (step-03).

## Acceptance criteria

1. `go vet` and `go test` pass.
2. With `EMAIL_PROVIDER=log` nothing leaves the machine; with a provider set, the adapter builds a correct request (tested with a fake).
3. Diff stays in Ravi's lane.
4. README documents every email env var.

## Test and validation

```bash
go test ./backend-core/auth/... -run 'Email|SMTP|Resend|Render'
go test ./backend-core/config/... -run LoadEmail
bun run ci go
```

Cover template link construction, Resend JSON body against a fake HTTP client, SMTP auth/TLS branch, reject unknown provider, empty provider → log.

Manual: `EMAIL_PROVIDER=log`, sign up via step-10, confirm the verify URL only appears in the joined-backend log. Do not send real mail.

## Risks and soft parks

- Production domain/DNS and a chosen vendor are still open. Do not bake a single vendor into call sites.
- `emailSenderOrDev(nil)` still falls back to `DevEmailSender` if main fails to inject.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #76), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
