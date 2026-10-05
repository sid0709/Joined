# Joined API

The Joined HTTP API for `joined-frontend`. Run it from the repo root with the rest of the stack; this service listens on `HTTP_ADDR` (default `127.0.0.1:8080`).

## Email sending

Transactional mail (verify, password reset, duplicate-signup notice) goes through `auth.NewEmailSender`. `EMAIL_PROVIDER` selects the adapter. The default is `log`: messages are written to the process log and never leave the machine.

| Variable | Default | Providers | Purpose |
| --- | --- | --- | --- |
| `EMAIL_PROVIDER` | `log` | all | `log`, `smtp`, or `resend`. Any other value fails at startup. |
| `EMAIL_FROM` | unset | `smtp`, `resend` | Envelope From. Required when the provider is `smtp` or `resend`. |
| `EMAIL_SMTP_HOST` | unset | `smtp` | SMTP hostname. Required for `smtp`. |
| `EMAIL_SMTP_PORT` | unset | `smtp` | SMTP port. Required for `smtp`. Use `465` for implicit TLS; other ports use STARTTLS. |
| `EMAIL_SMTP_USER` | unset | `smtp` | SMTP username. Required for `smtp`. |
| `EMAIL_SMTP_PASSWORD` | unset | `smtp` | SMTP password. Required for `smtp`. |
| `EMAIL_SMTP_INSECURE` | unset (false) | `smtp` | If `true` or `1`, continue when STARTTLS fails. Local development only. |
| `EMAIL_RESEND_API_KEY` | unset | `resend` | Bearer token for the Resend-style HTTP API. Required for `resend`. |
| `EMAIL_PRODUCT_NAME` | `Joined` | all | Product name in the templates. |
| `EMAIL_APP_BASE_URL` | `FRONTEND_ORIGIN` (`http://localhost:6002`) | all | Origin for verify, reset, and forgot-password links. Override only when the links should not use the frontend origin. |

Missing required values for the chosen provider fail at startup with a clear error. Tests and CI stay on `log` or inject a fake SMTP dialer / `httptest` server.

Email links use these joined-frontend routes:

- `/verify?token=…` — verify-email landing
- `/reset-password?token=…` — password reset
- `/forgot-password` — forgot-password entry (duplicate-signup notice)
