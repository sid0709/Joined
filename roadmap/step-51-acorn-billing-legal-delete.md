# Step 51: Acorn billing, legal, and delete-my-data

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends; **coordinate Elon** for `acorn/**`)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*` as a git branch)
- **PR title:** `feat(acorn-website): billing legal delete-my-data (roadmap step-51)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-50** for checkout; legal/delete can land in the same PR if 50 is merged.

## Goal

Acorn website has a billing page, draft legal pages, and delete-my-data.

## In scope

- Billing page on `acorn/website` using step-50 checkout/portal patterns (same session cookie). Match Joined Premium billing UX via `@joined/design-system`, not a copy-paste of joined-frontend internals.
- Draft `/terms` `/privacy` (Acorn-specific copy placeholders). Delete-my-data calls existing `DELETE /v1/auth/account` (or Acorn's documented equivalent) with a confirm dialog.
- Empty/unauthenticated states that send the user through the existing sign-in placeholder.

## Out of scope

- No live Stripe. No new billing API (Penny, step-50).
- No `acorn*` git branch.

## Acceptance criteria

1. Build, typecheck, lint, and format pass.
2. Signed-in user can open billing, read draft legal pages, and trigger delete-my-data against local backend.
3. Diff stays in `acorn/website/**`, with Elon on the PR.
