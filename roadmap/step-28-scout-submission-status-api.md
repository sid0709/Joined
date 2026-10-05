# Step 28: Scout submission status and notifications API

Status: Done (merged in W2)

- **Week:** W2, Scout complete
- **Owner:** Penny (money and Scout backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(scout): submission status and notifications api (roadmap step-28)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-27 and step-05 merge** (same routes and earnings events).

## Goal
The extension and the Scout website can ask what changed for a scout's submissions since a cursor: accepted, rejected, published, or earned.

## In scope
- Write a `scout_notifications` entry on submission status changes and on earnings credits (reuse the existing collection).
- A paged `since=<cursor>` endpoint returning notifications plus unread count, and a mark-read endpoint.
- Types in `packages/scout`. Go tests for cursor paging and ordering.

## Out of scope
- No email or push sending, no extension or website code, no production data writes.

## Acceptance criteria
1. `go vet` and `go test` pass; TS typecheck passes for `packages/scout`.
2. A status change produces exactly one notification, returned once per cursor.
3. Diff stays in Penny's lane.
