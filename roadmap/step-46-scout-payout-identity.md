# Step 46: Scout payout identity check

- **Week:** W3, Scraper onboarding
- **Owner:** Penny (lane: `backend-core/scout/**`, `backend-core/billing/**`, `scoutwell-backend/**`, `packages/scout/**`)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(scout): stricter identity check before first payout (roadmap step-46)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Runs in parallel with step-47** if files do not overlap; otherwise 46 first.

## Goal

A scout cannot receive a first payout until identity is verified more strictly than today's tier-2 staff flag.

## In scope

- Investigate `CheckPayout` / `RequestVerification` in `backend-core/scout` (already requires `VerificationVerified` and tax + method).
- Stricter first-payout gate: require verified identity **and** a recorded ID-check artifact (vendor reference or staff checklist: legal name match, liveness/selfie decision, sanction-screen pending-or-clear placeholder). Staff still decide; do not call a live IDV vendor unless env is set and tests fake it.
- First payout vs later payouts: later payouts can reuse the stored check unless staff revoke verification.
- Scoutwell error copy when blocked. Types in `packages/scout` if the profile payload grows.
- Go tests for first payout blocked vs allowed.

## Out of scope

- No Wise/Payoneer provider (step-47). No W-9/W-8BEN package (step-56).
- No live vendor keys. No `joined-backend` edits.

## Acceptance criteria

1. `go vet` and `go test` pass for touched modules; `packages/scout` typecheck if types changed.
2. Unverified or incomplete identity cannot request the first payout; verified + artifact can.
3. Diff stays inside Penny's lane.
