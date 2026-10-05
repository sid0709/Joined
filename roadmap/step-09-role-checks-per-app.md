# Step 09: Role checks per app

- **Week:** W1, Foundations
- **Owner:** Ravi (platform backend lane)
- **Target branch:** `stage-roadmap` (never `main`)
- **PR title:** `feat(auth): role checks per app (roadmap step-09)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Starts after step-03 merges** (same auth files).

## Goal

Each app only lets in the right kind of account: job seekers in Joined, scouts in Scoutwell, staff in admin, and company users only where company mode is enabled.

## In scope

- Investigate how roles and account types are stored today (`users`, staff sessions, scout profiles, company members).
- One shared role model and middleware in `backend-core/authapi` (or the existing auth layer) that routes declare, for example `RequireRole(seeker)`.
- Apply it to `joined-backend` and `admin-backend` routes. For Scoutwell routes, expose the helper and note the wiring point for Penny.
- Clear 401 vs 403 responses, and tests for each role on each protected route group.

## Out of scope

- No frontend changes, no new roles beyond what the product needs for launch, no Scoutwell edits.

## Acceptance criteria

1. `go vet` and `go test` pass.
2. Wrong-role requests get 403, signed-out requests get 401, right-role requests still work.
3. Diff stays in Ravi's lane.
