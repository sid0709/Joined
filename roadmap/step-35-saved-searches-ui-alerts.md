# Step 35: Saved searches UI and email alert preferences

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(joined-frontend): saved searches and alert preferences (roadmap step-35)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-34 merges** (needs its API).

## Goal

Seekers can save a search from the job browse UI, manage the list, and choose email alert preferences for each saved search.

## In scope

- Screens in `joined-frontend`: save current filters as a named search, list/rename/delete saved searches, apply a saved search back onto browse.
- Alert preference controls (on/off and cadence) calling the step-34 fields. Settings already has an alerts section in `joined-frontend/lib/settings.ts`; wire saved-search alerts there or next to the list, using `@joined/design-system`.
- Empty, loading, and error states. No account enumeration.

## Out of scope

- No backend changes. No real email sending (provider is step-11).
- No Scoutwell or admin UI.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. Save, apply, update alerts, and delete work locally against the step-34 API.
3. Diff stays in Leo's lane.
