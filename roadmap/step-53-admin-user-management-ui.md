# Step 53: Admin user management UI

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(admin-frontend): user management (roadmap step-53)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-52 merges** (needs its API).

## Goal

Admin console can look up users and run cancel / refund / suspend from the UI.

## In scope

- New `admin-frontend` users section (search, detail, actions) using `@joined/design-system` and the existing admin proxy pattern (`app/api/admin/[...path]`).
- Confirm dialogs for cancel, refund, and suspend. Show audit/reason fields the API requires. Mask PII by default.
- Nav entry consistent with `admin-frontend/lib/nav`.

## Out of scope

- No backend changes. No sources/quality/earnings (step-54).

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `admin-frontend`.
2. Staff can search a user and complete cancel/refund/suspend against local admin-backend.
3. Diff stays in Leo's lane.
