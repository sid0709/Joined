# Step 10: Email sign-up and log-in screens

- **Week:** W1, Foundations
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(joined-frontend): email sign-up and log-in screens (roadmap step-10)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-03 merges** (needs its API).

## Goal

Job seekers can sign up, verify, log in, log out, and reset a password with email on joinedhq.com, next to Google sign-in.

## In scope

- Screens in `joined-frontend`: sign up, check your email, verify link landing, log in, forgot password, reset password. Use `@joined/design-system`.
- Call the step-03 endpoints through the app's existing server-side API pattern; keep the `joined_session` cookie flow consistent with Google sign-in.
- Inline validation, clear error states, no account enumeration in messages, loading and disabled states.
- Respect the step-04 flag: no company sign-up path when company mode is off.

## Out of scope

- No backend changes, no Scoutwell or admin sign-in screens.

## Acceptance criteria

1. Build, typecheck, lint, format pass for `joined-frontend`.
2. Full email journey works locally against the step-03 backend with the log email sender.
3. Google sign-in still works. Diff stays in Leo's lane.
