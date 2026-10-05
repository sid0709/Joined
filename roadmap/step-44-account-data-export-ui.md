# Step 44: Account data export UI

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(joined-frontend): data export privacy settings (roadmap step-44)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-43 merges** (needs its API).

## Goal

Settings privacy actually exports data, next to the existing delete-account surface.

## In scope

- `joined-frontend/components/settings/privacy-settings.tsx` already has "Request export" copy. Wire it to the step-43 endpoint (download or "we will email a link" depending on the API).
- Same privacy section: keep visibility toggles; make sure delete-account (danger section) still uses `DELETE /v1/auth/account`.
- Loading, error, and success states. `@joined/design-system` only.

## Out of scope

- No backend changes. No Scoutwell/admin export UI in this step.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. Request export downloads or queues the step-43 payload locally; delete still works.
3. Diff stays in Leo's lane.
