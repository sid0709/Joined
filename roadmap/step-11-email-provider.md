# Step 11: Email sending provider

- **Week:** W1, Foundations
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(email): sending provider adapter (roadmap step-11)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-03 merges** (builds on its email sender interface).

## Goal

The backend can send real transactional email through a provider when configured, and stays on the dev log sender otherwise.

## In scope

- A provider adapter behind the step-03 sender interface. Default choice: a generic HTTP provider (Resend-style API) plus plain SMTP, picked by env (`EMAIL_PROVIDER=log|smtp|resend`). The user has not chosen a provider yet, so keep it swappable.
- Templates for verify email and password reset (plain text plus simple HTML), with the product name and links built from config.
- Default is `log`. No real email is sent in CI or tests; tests use a fake transport.
- Document env vars in the service README. Do not edit `.env` files.

## Out of scope

- No marketing email, no real sends, no domain or DNS changes.

## Acceptance criteria

1. `go vet` and `go test` pass.
2. With `EMAIL_PROVIDER=log` nothing leaves the machine; with a provider set, the adapter builds a correct request (tested with a fake).
3. Diff stays in Ravi's lane.
