# Step 49: Acorn résumé library

- **Week:** W3
- **Status:** Planned
- **Owner:** Leo (`acorn-frontend/**`; **coordinate Elon** for `acorn-backend/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(acorn-frontend): persist resume library (roadmap step-49)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Résumés uploaded on the Acorn website land in the same library the extension fetches for that Acorn account.

## Context and dependencies

Starts after or in parallel with [step-48](step-48-acorn-profile-editor.md) if files do not overlap. Joined seeker résumé gaps are [step-39](step-39-resume-builder-gaps.md) (In review, #109) — different product.

After #115:

- **UI already exists:** `acorn-frontend/app/(workspace)/resume/library/page.tsx` → `ResumeLibrary` (`components/workspace/resume/resume-library.tsx`) using `FileUploader` from `sid-ui`. Limits: `RESUME_MAX_BYTES = 5 * 1024 * 1024`, `RESUME_ACCEPT` in `acorn-frontend/lib/workspace/resume-file.ts`. State is **local workspace** (`useResumes`, sample library) — not the API.
- **API is still stubs** in `acorn-backend/acornapi/resume.go` (prefix `/acorn` on :8083):
  - `GET /acorn/custom/library-resumes/{resumeId}` → empty (`stack: nil`, no `file`)
  - `GET /acorn/custom/library-resumes/{resumeId}/preview` → `{ html: "" }`
- Extension client: `acorn/extension/src/pipeline/api/custom-library.ts`. Shared file type: `RuntimeAttachedFile` in `acorn/packages/shared/plan-runner/types.ts`. `acorn-backend/acornapi/README.md` says generation/library routes keep the contract and return no file.

`backend-core/acornapi` and `acorn/website` are gone. Do not invent a Joined-frontend library proxy.

## In scope

- Wire the existing `/resume/library` page to real acorn-backend library CRUD (upload, list, preview, delete, set default) once Elon lands the store. Keep `sid-ui` `FileUploader`.
- Reuse extension/shared types (`RuntimeAttachedFile`) rather than a new DTO.
- Size/type limits from `RESUME_MAX_BYTES` / `RESUME_ACCEPT` — do not invent new magic numbers. Enforce on the server too.
- Signed-out users already hit workspace auth; keep redirect to `/sign-in` (`acorn_session`).
- Elon on the PR for `acorn-backend/**`. Do not ship a UI that pretends upload works against stubs.

## Out of scope

- No Joined résumé builder (step-39). No billing. No extension rewrite beyond reading the same library.
- No `acorn*` git branch. No IndexedDB-only library the extension cannot see.

## Files and areas to touch

- `acorn-frontend/app/(workspace)/resume/library/` — keep route
- `acorn-frontend/components/workspace/resume/resume-library.tsx`, `use-resumes.ts`
- `acorn-frontend/lib/workspace/resume-file.ts`, `lib/workspace/model.ts`
- `acorn-frontend/lib/config.ts` — `ACORN_API_URL`
- `acorn-backend/acornapi/resume.go`, `server.go` — implement stubs
- `acorn-backend` store in `AcornDB` (new)
- `acorn/packages/shared` — list/upload DTOs only if the extension must share them

## Implementation notes

**API (align with extension + stubs; fill the gaps):**

| Method      | Path                                               | Notes                                                                    |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET`       | `/acorn/custom/library-resumes`                    | list — **new**                                                           |
| `POST`      | `/acorn/custom/library-resumes`                    | upload — **new**                                                         |
| `GET`       | `/acorn/custom/library-resumes/{resumeId}`         | stub today; must return `{ file: RuntimeAttachedFile, resumeId, stack }` |
| `GET`       | `/acorn/custom/library-resumes/{resumeId}/preview` | stub today; `{ html }`                                                   |
| `DELETE`    | `/acorn/custom/library-resumes/{resumeId}`         | **new**                                                                  |
| set default | `PATCH` or `POST`                                  | **new**; name the path in the PR                                         |

Auth: `acorn_session` / Bearer, same as `/acorn/auth/me`. Constants stay in `resume-file.ts` (frontend) and a named max-bytes in `acornapi`.

## Acceptance criteria

1. `bun --filter acorn-frontend typecheck`, lint, and format pass; `go test ./acorn-backend/...` if the API is in this PR.
2. A résumé uploaded on :6005 appears in the extension library for that Acorn account (real API, not a stub).
3. If the API is still stubbed, this step does not merge a fake-success upload.
4. Diff stays in `acorn-frontend/**` (Leo) and `acorn-backend/**` / `acorn/packages/shared` (Elon).

## Test and validation

```bash
bun --filter acorn-frontend typecheck
bun --filter acorn-frontend lint
bun run ci format
go test ./acorn-backend/...
```

Add tests for size/type reject and list-after-upload against a fake store. Manual (human): upload on `/resume/library`, open the extension library for the same `acorn_session`.

## Risks and soft parks

- Local sample library (`isSampleLibrary`) must not be posted as real files.
- Do not check large binary fixtures into git.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
