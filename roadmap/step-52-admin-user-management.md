# Step 52: Admin user management APIs

- **Week:** W3, Scraper onboarding
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(admin): user lookup cancel refund suspend apis (roadmap step-52)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)

## Goal

Staff can look up a user and cancel Premium, refund, or suspend via admin-backend APIs.

## In scope

- Admin-backend staff routes (docs/40 Users): search by email/id, view modes/tier/risk (PII masked by default), timeline of key events.
- Actions, each audited: cancel Premium subscription, issue a refund (call into billing through a narrow interface; if that interface is missing, Elon coordinates Penny and this step still owns the admin route), suspend/unsuspend login.
- Dual-control is not required for suspend; refunds should record actor + reason. Tests for authz, audit, and happy/error paths.
- Do not log full PII. Reveal-PII if needed is a separate guarded endpoint with a reason field.

## Out of scope

- No admin UI (Leo, step-53). No Scout payout approval rewrite.
- No live Stripe refunds in CI (fake billing).

## Acceptance criteria

1. `go vet` and `go test` pass for `admin-backend` and touched `backend-core`.
2. Staff can look up a user, cancel Premium, refund, and suspend; unauthenticated callers get 401.
3. Diff stays inside Ravi's lane (plus a flagged Penny hook only if Elon split billing).
