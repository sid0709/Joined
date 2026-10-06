# Step 20: Scout earnings dashboard

- **Week:** W2
- **Status:** Done
- **Owner:** Leo (lane: Next.js frontends, `sid-ui`, `packages/google-signin`)
- **Target branch:** `stage-roadmap-w34` for any follow-up (originally merged into the retired `stage-roadmap`)
- **PR title:** `feat(scoutwell-frontend): earnings dashboard (roadmap step-20)` (every commit must follow commitlint `type(scope): subject` or CI fails)
- **Merged PR:** [#86](https://github.com/sid0709/Joined/pull/86) (`62f3e83`)
- **Starts after step-05 merges** (needs its earnings summary and ledger endpoints). Run after step-19 if both touch navigation.

## Goal

A signed-in scout sees what they have earned, from which jobs, and what is pending, on the Scout website: summary cards, a ledger table, paging, and empty / error / signed-out states.

## Context and dependencies

Penny's step-05 (#69, #84) shipped `GET /v1/scout/earnings` (cursor list) and `GET /v1/scout/earnings/summary`, plus `GET /v1/scout/meta` / `GET /v1/scout/stats`. Types live in `@joined/scout` (`Earning`, `EarningsSummary`, `Money`, `List`). Step-19 marketing Earn page can link here. Payout settings are W3 (steps 46/47), not this page.

What shipped in #86: `/earnings` RSC page, KPI cards (Total, Pending, Paid), ledger table (job, date, amount), cursor pager (`PAGE_LIMIT` 20), rules tab `?tab=rules`, loading/error files, `EarningsSignedOut` fallback. Loaders in `lib/scout/load.ts` / `lib/scout/server.ts`.

## In scope

- Earnings page in `scoutwell-frontend`: summary cards (total, pending, paid), ledger table with job, date, and amount, paging, empty state.
- Fetch the step-05 Scoutwell endpoints through the app's existing server-side API pattern, typed with `@joined/scout`.
- Loading, error, and signed-out states.

## Out of scope

- No payouts or payout settings (W3).
- No backend changes.
- No other apps.
- No merge to `main`. Never open a PR into an `acorn*` branch.

## Files and areas to touch

- `scoutwell-frontend/app/(app)/earnings/page.tsx`
- `scoutwell-frontend/app/(app)/earnings/loading.tsx`
- `scoutwell-frontend/app/(app)/earnings/error.tsx`
- `scoutwell-frontend/components/earnings/balance-overview.tsx`
- `scoutwell-frontend/components/earnings/earnings-list.tsx`
- `scoutwell-frontend/components/earnings/reward-rules.tsx`
- `scoutwell-frontend/components/earnings/earnings-signed-out.tsx`
- `scoutwell-frontend/components/cursor-pager.tsx`
- `scoutwell-frontend/lib/earnings.ts` — `earningsCards()`, `earningJobLabel()`
- `scoutwell-frontend/lib/scout/load.ts` — `loadStats`, `loadEarningsSummary`
- `scoutwell-frontend/lib/scout/server.ts` — `scoutGet`
- `scoutwell-frontend/lib/config.ts` — `PAGE_LIMIT`
- `scoutwell-frontend/app/(app)/layout.tsx` / `proxy.ts` — already gate `/earnings`
- Tests: `lib/earnings.test.ts`

Use `sid-ui` (`PageHeader`, `PageTabs`, `KpiWidget`, `Table`, `EmptyState`). Do not copy those components, and do not add `packages/design-system` back.

## Implementation notes

### Data

| Loader                  | Endpoint                                |
| ----------------------- | --------------------------------------- |
| `loadStats()`           | `GET /v1/scout/stats`                   |
| `loadEarningsSummary()` | `GET /v1/scout/earnings/summary`        |
| `loadMeta()`            | `GET /v1/scout/meta`                    |
| page `scoutGet`         | `GET /v1/scout/earnings?limit=&cursor=` |

Auth: Bearer from `scoutwell_session`. App layout redirects unsigned users to sign-in; still render `EarningsSignedOut` if the API returns null.

Ledger query matches step-05: `limit`, `cursor` (optional `status`). Response `scout.List` `{ data, next_cursor }`. Summary: `{ by_type, total }` with `Money.amount_cents`.

Format money with `@joined/scout` helpers, not ad-hoc `$` strings. Card math lives in `lib/earnings.ts` so it can be unit-tested.

### UI

- Default tab: Reward history. Rules: `?tab=rules`.
- Pager: cursor, page size `PAGE_LIMIT` (20).
- Empty ledger: `EmptyState`, not a blank table.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `scoutwell-frontend`.
2. Against a local Scoutwell with dev test data, the page shows the right totals and ledger rows.
3. Diff stays in Leo's lane.
4. Types come from `@joined/scout`, not a second local money type.

## Test and validation

```bash
bun --filter scoutwell-frontend typecheck
bun --filter scoutwell-frontend lint
bun test scoutwell-frontend/lib/earnings.test.ts
bun --filter scoutwell-frontend build
bun --filter @joined/scout typecheck
bun run ci typecheck
```

There is no earnings E2E on this branch. Manual: seed apply earnings via step-05 `RecordApply` (or Mongo fixtures the human already has), open `/earnings`, confirm cards and a ledger row, page with `next_cursor`.

## Risks and soft parks

- `RecordApply` is still not wired into the candidate apply flow, so production-like data may be empty until that hook lands.
- Payouts must not sneak onto this page.
- GitHub Actions runner starvation can cancel jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34` (this step originally merged to `stage-roadmap` as #86), CI green (not cancelled), Quinn PASS, Elon merges. Never main.
