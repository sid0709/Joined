# Step 54: Admin sources, quality, earnings report, and disputes

- **Week:** W3, Scraper onboarding
- **Owner:** Ravi + Penny (split if large; see below)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(admin): sources quality earnings disputes (roadmap step-54)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

Prefer **2–3 small PRs** if this is large. Suggested split (adjust counts with Sid):

| Substep | Slice                      | Owner | Suggested title                                              |
| ------- | -------------------------- | ----- | ------------------------------------------------------------ |
| 54a     | Source kill switches       | Ravi  | `feat(admin): source kill switches (roadmap step-54a)`       |
| 54b     | Job quality dashboard APIs | Ravi  | `feat(admin): job quality dashboard apis (roadmap step-54b)` |
| 54c     | Earnings report            | Penny | `feat(scout): earnings report (roadmap step-54c)`            |
| 54d     | Disputes                   | Penny | `feat(scout): payout disputes queue (roadmap step-54d)`      |

## Goal

Staff can disable a job source, see quality, pull an earnings report, and work disputes.

## In scope

- **Sources (Ravi):** kill switches / enable-disable for ingest sources on top of `backend-core/killswitch` (job imports already exist). Per-source flags in config/store; admin-backend routes; public search stops using a killed source.
- **Quality dashboard APIs (Ravi):** aggregates for recent jobs (hold rate from step-42, dead-link, dupes if W2 landed). Read-only admin endpoints.
- **Earnings report (Penny):** staff-exportable scout earnings summary (period, totals, holds) from `backend-core/scout`.
- **Disputes (Penny):** admin disputes queue already exists as `queue=disputes` on cases. Fill the Scout/payout dispute path: open, evidence, decide, clawback unsettled earnings. Staff approval stays.

Leo can follow with UI in a later slice if these APIs ship without screens; do not block W3 freeze on pixel-perfect dashboards.

## Out of scope

- No product seeker UI. No live payouts. No merge to `main`.

## Acceptance criteria

1. `go vet` and `go test` pass for each PR's modules.
2. A killed source disappears from new public results; staff can fetch quality stats, an earnings report, and decide a dispute.
3. Each PR stays in its owner's lane.
