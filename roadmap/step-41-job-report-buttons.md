# Step 41: Job report buttons

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(joined-frontend): job report buttons and reasons (roadmap step-41)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

Seekers can report a job from search and the job page with objective reason codes.

## In scope

- Report control on `joined-frontend` job cards and `JobPageView`. Reasons must match `docs/32-trust-and-safety.md` / admin `REASON_CODES` (`scam_job`, `fake_company`, `payment_request`, `other_with_evidence`, …). Never offer "not a good fit".
- Call the existing `POST /v1/reports` contract. Staff already serve it from `admin-backend`; if `joined-backend` still 404s `/v1/reports` for seekers, Elon coordinates Ravi for a thin mount and this UI uses that route.
- Success/error toasts. Signed-out users go to sign-in. Use `@joined/design-system`.

## Out of scope

- No new reason taxonomy. No public negative scores. No admin queue work (already exists).

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. A signed-in seeker can file a job report with a valid reason; "not a good fit" is not in the list.
3. Diff stays in Leo's lane (plus a flagged Ravi PR only if the seeker route was missing).
