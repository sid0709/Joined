# Step 42: Scam job score

- **Week:** W3
- **Status:** Done
- **Owner:** Ravi (platform backend lane: `joined-backend/**`, `admin-backend/**`, `backend-core/**` except `scout/` and `billing/`, `packages/job-schema/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(jobs): scam score and admin hold (roadmap step-42)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #110 (`ac6a5f0`)

## Goal

Risky jobs get a scam/fake score and are held out of the public pool for admin review. A fixture listing that trips the threshold is held from public search and visible to staff. Seekers never see a "this is a scam" badge.

## Context and dependencies

Runs in parallel with steps 34 and 36. Investigate scout auto-checks (`backend-core/scout` types include `ReasonScam = "scam_signals"`) and job import/publish paths in `backend-core/jobs` — **read only for scout**; do not edit Penny's lane.

Shipped package: `backend-core/jobscam/`. Publish-time gate: `backend-core/jobs/scam_hold.go` (`applyScamHold`). Platform: `platform.go` `ScamHolds`, `listings.SetScamHolds`. Admin HTTP: `admin-backend/internal/httpapi/scam_holds.go`. Public search already excludes `pending_review` via `ListingPublic` / `publicListingFilter()` (steps 07/23/24).

`docs/32-trust-and-safety.md`: no public negative scores. Seeker report buttons are step-41. Admin frontend has no `/v1/admin/scam-jobs` screen yet; staff can use this API plus existing `GET /v1/admin/jobs?status=pending_review`.

## In scope

- A scam/fake score on the job record from listing signals (payment requests, off-platform chat, crypto, implausible salary, thin company). Thresholds in config.
- Above the hold threshold: job is not returned by public search; staff can see it in admin (existing jobs/review surfaces or a small admin-backend list). Log why it was held.
- Go tests for scoring, hold vs publish, and search exclusion.

## Out of scope

- No seeker-facing "this is a scam" badge (reports are step-41; public scores stay off — `docs/32`).
- No changes in `backend-core/scout` or `backend-core/billing`.
- No admin frontend queue (Leo / step-54).
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `backend-core/jobscam/score.go`, `service.go`, `types.go`, `config.go`, `mongo.go`, `memory.go`
- `backend-core/jobs/scam_hold.go`, `scam_hold_test.go`
- `backend-core/platform/platform.go` — `ScamHolds`
- `admin-backend/internal/httpapi/scam_holds.go`, `scam_holds_test.go`
- `admin-backend/cmd/server/main.go` — `ScamHolds: p.ScamHolds`

Read only: `backend-core/scout/types.go` `ReasonScam`, `admin-frontend/components/trust/direct-job-queue.tsx`, `docs/32-trust-and-safety.md`.

## Implementation notes

**Env:** `JOB_SCAM_HOLD_THRESHOLD` — 0–100; default **40** (`DefaultHoldThreshold` in `jobscam/config.go`). Named config, not a handler literal.

**Mongo:** holds collection `job_scam_holds`. Search rows stay in `jobs` (`listingStatus`).

**Signal reason codes (score metadata, not report codes):** `pay_to_apply`, `off_platform_contact`, `crypto_wire`, `too_good_pay`, `missing_company_domain`, `mismatched_company_domain`, `suspicious_url`, `duplicate_spam`.

**Hold behavior:** at publish, `jobs.Store.applyScamHold` — if `decision.Hold && ListingPublic` → `listingStatus: pending_review`; if `decision.Remove` → `removed`. Public search omits both.

**Admin API** (bearer `ADMIN_API_TOKEN`; `X-Admin-Session` when staff Google is required):

| Method | Path | Response |
| --- | --- | --- |
| GET | `/v1/admin/scam-jobs?status=&page=&pageSize=` | `{ jobs[], total, page, pageSize, next? }` |
| POST | `/v1/admin/scam-jobs/{id}/review` | `{ "job": Hold }` |

Review body: `{ "decision": "approve" | "reject", "reason": "required string" }`. Reject without reason → 422. Nil `ScamHolds` → 503 `"Scam review is unavailable."`

**Inspect:** prior reject stays removed; prior approve with the same fingerprint stays public (`service.go`). Off-platform contact alone may score below threshold (`TestScoreOffPlatformContact`).

No dedicated scam kill switch.

## Acceptance criteria

1. `bun run vet:go` and `bun run test:go` pass for touched modules.
2. A fixture listing that trips the threshold is held from public search and visible to staff via `/v1/admin/scam-jobs` or `pending_review`.
3. Approve/reject with a reason updates the hold; reject without reason is 422.
4. Diff stays inside Ravi's lane (no scout, no billing, no seeker UI).

## Test and validation

```bash
bun run vet:go
bun run test:go
go test ./backend-core/jobscam/...
go test ./backend-core/jobs/... -run Scam
go test ./admin-backend/internal/httpapi/... -run ScamHold
```

Fixtures: pay-to-apply / crypto descriptions in `score_test.go`; list + review in `scam_holds_test.go`; search exclusion via existing listing tests.

Optional follow-up test: staff-session denial for `/v1/admin/scam-jobs` (see Risks).

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- **Optional staff-session denial test.** `TestAdminRouteGroupsRejectUnsignedAndUserTokens` in `staff_auth_test.go` covers many paths but **does not include** `/v1/admin/scam-jobs` (unlike `/v1/reports`, `/v1/admin/jobs`). Add it in a small follow-up if still missing.
- No admin UI for the scam-jobs queue.
- Off-platform contact alone may stay public (below default 40).
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (#110 already merged). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
