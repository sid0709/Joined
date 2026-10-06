# Step 41: Job report buttons

- **Week:** W3
- **Status:** Done
- **Owner:** Leo (web frontends lane: `joined-frontend/**`, `scoutwell-frontend/**`, `admin-frontend/**`, `connected-frontend/**`, `packages/google-signin/**`; UI from the external catalog package `sid-ui` — in-repo `packages/design-system` and `joined-theme` are gone after #115)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(joined-frontend): job report buttons and reasons (roadmap step-41)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)

## Goal

Seekers can report a job from search and the job page with objective reason codes. A signed-in seeker files a job report with a valid reason; "not a good fit" is never in the list.

## Context and dependencies

The staff report API already exists on **admin-backend**, not on joined-backend. `docs/32-trust-and-safety.md` and `docs/62-staff-company-api.md` describe `POST /v1/reports`. Admin UI reference: `admin-frontend/components/trust/file-report-form.tsx`. Reason codes: `admin-frontend/lib/cases.ts` `CASE_REASON_CODES` and `backend-core/staff/cases.go` `objectiveReasons`.

`joined-backend/internal/httpapi/server_test.go` asserts `GET /v1/reports` → **404**. There is no seeker mount in `server.go`. `GET /v1/me/reports` is documented in docs/32 and is not implemented.

If `joined-backend` still 404s `/v1/reports` for seekers, Elon coordinates Ravi for a thin mount (session auth, same `staff.FileReport` / reason set, `Idempotency-Key`). This UI uses that route. Do not point the seeker browser at admin-backend or `ADMIN_API_TOKEN`.

Job surfaces: `joined-frontend/components/jobs/job-result-card.tsx`, `job-results.tsx`, `job-page-view.tsx`, `job-detail-pane.tsx`, `use-job-actions.tsx`. Sign-in redirect for guests.

Step-42 scores/holds risky jobs for staff; this step is seeker-facing reports only. No public negative scores (docs/32).

## In scope

- Report control on `joined-frontend` job cards and `JobPageView`.
- Reasons must match `docs/32-trust-and-safety.md` / admin `CASE_REASON_CODES` (`scam_job`, `fake_company`, `payment_request`, `other_with_evidence`, …). Never offer "not a good fit".
- Call the existing `POST /v1/reports` contract via joined-backend once mounted (or the coordinated Ravi route).
- Success/error toasts. Signed-out users go to sign-in. `sid-ui` only.

## Out of scope

- No new reason taxonomy.
- No public negative scores or scam badges.
- No admin queue work (already exists).
- No Scoutwell/admin frontend changes.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `joined-frontend/components/jobs/job-page-view.tsx`, `job-result-card.tsx`, `job-results.tsx`, `job-detail-pane.tsx`, `job-detail-header.tsx`
- `joined-frontend/components/jobs/use-job-actions.tsx`
- New: `joined-frontend/components/jobs/job-report-dialog.tsx` (or similar)
- New: `joined-frontend/lib/reports.ts` — reason list + client (named constants, not a copied admin file)
- New: `joined-frontend/app/api/reports/route.ts` (or extend an existing proxy) — session → joined-backend
- Tests: `joined-frontend/lib/reports.test.ts`

Ravi follow-up (flagged, not this diff): `joined-backend/internal/httpapi/` thin `POST /v1/reports` for candidate session; reuse `backend-core/staff` reason validation.

Read only: `docs/32-trust-and-safety.md`, `admin-frontend/lib/cases.ts`, `backend-core/staff/cases.go`.

## Implementation notes

**Job-relevant reasons (offer these; do not dump the full staff enum):** `scam_job`, `fake_company`, `payment_request`, `other_with_evidence`. Never `not_a_good_fit`. Staff-only codes (`no_show`, `identity_mismatch`, …) stay off the seeker dialog.

**POST body (staff JSON is camelCase today):**

```json
{
  "subjectType": "job",
  "subjectId": "<job id>",
  "reasonCode": "scam_job",
  "details": "",
  "evidenceKeys": []
}
```

Require `Idempotency-Key` (1–255) if the mounted seeker route keeps the staff contract. Generate a per-submit UUID in the client; do not hardcode.

**Auth:** candidate session cookie via the Next proxy. Guests → sign-in, then return to the job. 409 `idempotency_key_reused` → toast the existing report, do not retry blindly.

**Collections (server, already):** `reports`, `moderation_cases`, `report_idempotency`, `admin_audit`.

**Design system:** Button, Dialog, RadioList, TextArea, Toast from `sid-ui`. Tokens only.

**Copy:** success toast, validation toast, generic error. Do not echo another user's report.

## Acceptance criteria

1. `bun --filter joined-frontend` typecheck, lint, and build pass.
2. A signed-in seeker can file a job report with a valid reason; "not a good fit" is not in the list.
3. Signed-out users are sent to sign-in. Toasts cover success and failure.
4. Diff stays in Leo's lane (plus a flagged Ravi PR only if the seeker route was missing).

## Test and validation

```bash
bun test joined-frontend/lib/reports.test.ts
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun --filter joined-frontend build
bun run ci lint
bun run ci typecheck
bun run format:check
```

Unit-test the reason list (includes job codes, excludes `not_a_good_fit`). If Ravi mounts the route in the same week, `go test ./joined-backend/internal/httpapi/...` and `go test ./backend-core/staff/...` stay on that PR.

Human-run: signed-in report from card and job page; guest hits sign-in.

Repo CI: `bun run ci`. Require real green, not cancelled jobs.

## Risks and soft parks

- Seeker route is missing; shipping UI against admin-backend would leak staff auth. Block on the Ravi mount or a same-week split PR.
- `GET /v1/me/reports` is documented and absent — do not build a "my reports" inbox here.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34`. CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
