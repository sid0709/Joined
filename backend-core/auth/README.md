# Email Authentication

This package provides email-based authentication with verification and password reset flows.

## Email Provider Configuration

The email sender is configured via environment variables. Three providers are supported:

### 1. Log Provider (Development)

Logs email content to the console instead of sending. This is the default.

```bash
EMAIL_PROVIDER=log
```

Or omit `EMAIL_PROVIDER` entirely.

### 2. SMTP Provider

Send email via any SMTP server.

**Required variables:**
- `EMAIL_PROVIDER=smtp`
- `EMAIL_FROM` - The "from" address for all emails
- `EMAIL_SMTP_HOST` - SMTP server hostname
- `EMAIL_SMTP_PORT` - SMTP server port (typically 587 for STARTTLS)
- `EMAIL_SMTP_USER` - SMTP authentication username
- `EMAIL_SMTP_PASSWORD` - SMTP authentication password

**Example:**
```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@example.com
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASSWORD=your-app-password
```

### 3. Resend Provider

Send email via Resend's HTTP API (or compatible services).

**Required variables:**
- `EMAIL_PROVIDER=resend`
- `EMAIL_FROM` - The "from" address for all emails
- `EMAIL_RESEND_API_KEY` - Resend API key

**Example:**
```bash
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@example.com
EMAIL_RESEND_API_KEY=re_your_api_key_here
```

## Template Configuration

**Optional variables** that customize the email content:

- `EMAIL_PRODUCT_NAME` - Product name shown in emails (default: "OpenSeat")
- `EMAIL_APP_BASE_URL` - Base URL for verification and password reset links (default: "http://localhost:3000")

**Example:**
```bash
EMAIL_PRODUCT_NAME=MyApp
EMAIL_APP_BASE_URL=https://app.example.com
```

## Email Types

The system sends three types of transactional email:

1. **Verification Email** - Sent after sign-up with a 24-hour token
2. **Password Reset Email** - Sent on request with a 1-hour token
3. **Duplicate Signup Notice** - Security notification when someone tries to sign up with an existing email

All emails include both plain text and HTML versions.

## Error Handling

At startup, the application validates the email configuration:
- Unknown provider names fail immediately
- Missing required configuration for the selected provider fails immediately
- Invalid credentials are detected at runtime when sending fails

## Testing

In tests, use a fake sender or override the provider's transport:
- `SMTPProvider.DialFunc` - inject a fake SMTP client
- `ResendProvider.HTTPClient` - inject an `httptest` server

See `email_providers_test.go` for examples.
