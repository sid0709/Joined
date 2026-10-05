# Step 40: Application tracker

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(joined-frontend): application tracker notes and reminders (roadmap step-40)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Independent of steps 34–39.** Use existing applications API; coordinate Ravi only if notes/reminders fields are missing.

## Goal

Seekers can keep a saved stage, notes, and reminders on each application.

## In scope

- `joined-frontend` applications workspace (`app/(seeker)/(candidate)/applications`) already has a board. Add per-card notes and a reminder date/time the seeker owns.
- Persist stage moves, notes, and reminders through the existing candidate applications API. If the API has no notes/reminder fields, Elon coordinates a small Ravi follow-up; do not invent local-only storage.
- Use `@joined/design-system` for the note editor and reminder control. Respect existing stage list; do not add company pipeline stages here.

## Out of scope

- No company ATS board. No email reminder worker unless it already exists; UI can store the reminder even if send comes later.
- No Scout changes.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. Stage, notes, and reminder survive refresh for the signed-in seeker.
3. Diff stays in Leo's lane (plus a flagged Ravi PR only if fields were missing).
