# Step 39: Resume builder gaps

- **Week:** W3
- **Status:** In review
- **Owner:** Leo (web frontends lane: `joined-frontend/**`, `scoutwell-frontend/**`, `admin-frontend/**`, `connected-frontend/**`, `packages/google-signin/**`; UI from the external catalog package `sid-ui` — in-repo `packages/design-system` and `joined-theme` are gone after #115)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(joined-frontend): close resume builder gaps (roadmap step-39)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** not merged. Open PR #109 (`cursor/resume-builder-gaps-40a6`, commit `d71fb2e` as of the W3 review). Product work on this step is paused pending Quinn/Elon.

## Goal

The seeker résumé library on joinedhq.com is a real builder, not demo upload cards. Upload (or create), set default, rename, delete, and reload still show the résumé after refresh.

## Context and dependencies

Independent of steps 34–38. On `stage-roadmap-w34` today, `joined-frontend/lib/resumes.ts` still has in-memory `RESUMES`, `MAX_RESUME_BYTES`, `RESUME_ACCEPT`, and demo `PARSE_DELAY_MS`. UI: `joined-frontend/components/resumes/*`, `app/(seeker)/(candidate)/resumes/page.tsx`.

There is no dedicated resumes Mongo collection. Profile has a `resume` string on `GET/PATCH /v1/me/profile` (`backend-core/candidate`, `joined-frontend/lib/me/pipeline.ts` `saveProfile`). #109 rewrites the library against that profile contract (`PROFILE_RESUME_ID`, `profileResume`, `readyResumes`) rather than inventing a second store. If a richer API is missing, Elon coordinates Ravi for a thin store; this step still ships the UI against that contract.

Acorn résumé library is step-49 on `acorn-frontend` (out of scope). Stay on `sid-ui` (`FileUploader`, cards, dialogs).

## In scope

- Investigate `joined-frontend/components/resumes/` and `joined-frontend/lib/resumes`. Replace demo upload/progress and in-memory `RESUMES` with the real candidate résumé API if one exists; if the API is missing, Elon coordinates Ravi for a thin store and this step still ships the UI against that contract.
- Create, rename, set default, delete, and preview. Persist parsed insights when the backend returns them.
- Honor `MAX_RESUME_BYTES` / accept types already in `lib/resumes`.
- Empty, error, and size-limit states.

## Out of scope

- No Acorn résumé library (step-49).
- No backend rewrite beyond a coordinated thin API if missing (flag that PR separately).
- No AI rewrite of the résumé in this step.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

On #109 / to land:

- `joined-frontend/lib/resumes.ts`, `joined-frontend/lib/resumes.test.ts`
- `joined-frontend/components/resumes/resume-builder.tsx`, `resumes-workspace.tsx`, `resume-document.tsx`, `resume-identity.tsx`, `resume-card.tsx`
- `joined-frontend/components/resumes/apply-dialog.tsx` (or apply entry that picks a résumé)
- `joined-frontend/app/(seeker)/(candidate)/resumes/page.tsx`
- `joined-frontend/lib/me/pipeline.ts` — profile GET/PATCH only

Do not edit `acorn-frontend/**`, `acorn-backend/**`, or `backend-core/candidate` unless Elon splits a follow-up PR.

## Implementation notes

**Contract:** `GET/PATCH /v1/me/profile` via `/api/me/...`. Persist the résumé the profile actually stores. Demo `RESUMES` must not survive a refresh as the source of truth.

**Limits:** keep `MAX_RESUME_BYTES` and `RESUME_ACCEPT` as named constants. #109 uses `RESUME_LABEL_MAX_LENGTH = 40` for name / filename slice.

**Design system:** `FileUploader`, Card, Dialog, Button, Toast from `sid-ui`. Tokens only.

**#109 soft parks (record; fix only if still in review and cheap):**

- **Session-file Make default:** `setDefault` in `resumes-workspace.tsx` updates React state only for the profile-backed résumé (not a persisted server "default resume" field).
- **Empty-résumé apply:** `profileResume` is treated as `parse: "parsed"` via `readyResumes`; `apply-dialog.tsx` defaults `resumeId` to `PROFILE_RESUME_ID`; `canSubmit` does not require non-empty profile content.
- **`usedIn` label:** `resume-card.tsx` "Used once" / `Used N×` from `countResumeUses`, not a server field.
- **Name `maxLength`:** 40.
- **`revokeObjectURL` race:** `download()` revokes the blob URL immediately after `downloadUrl()` — can race a slow download start.

**Apply empty résumé:** do not let a seeker submit an empty profile résumé without a visible confirmation. If #109 already shipped that path, document it and add a guard if the PR is still open.

## Acceptance criteria

1. `bun --filter joined-frontend` typecheck, lint, and build pass.
2. Upload (or create), default, rename, delete, and reload still show the résumé after refresh.
3. Oversize / bad-type files show an error and do not persist.
4. Diff stays in Leo's lane (plus a flagged Ravi PR only if Elon split the API).

## Test and validation

```bash
bun test joined-frontend/lib/resumes.test.ts
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun --filter joined-frontend build
bun run ci lint
bun run ci typecheck
bun run format:check
```

#109 adds a large `resumes.test.ts` — keep it. Cover default persistence, empty apply, and download URL lifetime if those stay.

Human-run: create, refresh, rename, default, delete. Agent does not drive the UI.

Repo CI: `bun run ci`. Require real green, not cancelled jobs. Do not merge #109 from this docs task.

## Risks and soft parks

- Session-file Make default, empty-résumé apply, `usedIn` label, name maxLength, `revokeObjectURL` race (see Implementation notes).
- Profile-as-store is thinner than a real library; step-49 / a later Ravi store may replace it.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (#109 already open). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch. Do not merge from a docs-only agent.
