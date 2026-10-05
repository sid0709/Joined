# Step 20: Scout earnings dashboard

Status: Done (merged in W2)

- **Week:** W2, Scout complete
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(scoutwell-frontend): earnings dashboard (roadmap step-20)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-05 merges** (needs its earnings summary and ledger endpoints). Runs after step-19 if both touch navigation.

## Goal
A signed-in scout sees what they have earned, from which jobs, and what is pending, on the Scout website.

## In scope
- Earnings page in `scoutwell-frontend`: summary cards (total, pending, paid), ledger table with job, date, and amount, paging, empty state.
- Fetch the step-05 Scoutwell endpoints through the app's existing server-side API pattern, typed with `@joined/scout`.
- Loading, error, and signed-out states.

## Out of scope
- No payouts or payout settings (W3), no backend changes, no other apps.

## Acceptance criteria
1. Build, typecheck, lint, format pass for `scoutwell-frontend`.
2. Against a local Scoutwell with dev test data, the page shows the right totals and ledger rows.
3. Diff stays in Leo's lane.
