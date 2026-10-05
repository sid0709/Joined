# Step 49: Acorn résumé library

- **Week:** W3
- **Status:** Planned
- **Owner:** Leo (web frontends; **coordinate Elon** for `acorn/**`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(acorn-website): resume upload library (roadmap step-49)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

The Acorn website can upload and manage résumés in the same library the extension expects, so a file uploaded on the site is what the extension fetches for that account.

## Context and dependencies

Starts after or in parallel with [step-48](step-48-acorn-profile-editor.md) if files do not overlap. Website scaffold is [step-32](step-32-acorn-website-scaffold.md) (Done, #80). Joined seeker résumé builder gaps are [step-39](step-39-resume-builder-gaps.md) (In review, #109) — different product.

**Reality check:** `backend-core/acornapi` does **not** yet have full library CRUD. Only GET stubs exist:

- `GET /acorn/custom/library-resumes/{resumeId}` → `noLibraryResume` (`stack: nil`, no `file`)
- `GET /acorn/custom/library-resumes/{resumeId}/preview` → `emptyPreview` (`html: ""`)

Defined in `backend-core/acornapi/server.go` and `resume.go`. Prefix is `/acorn` on backend-core :8083. Extension client: `acorn/extension/src/pipeline/api/custom-library.ts` (`fetchCustomLibraryResume`, `fetchCustomLibraryResumePreview`). Shared file type: `RuntimeAttachedFile` in `acorn/packages/shared/plan-runner/types.ts`. `backend-core/acornapi/README.md` still says the library is empty.

Size/type limits are **not** in Acorn packages. Closest product constants: `MAX_RESUME_BYTES = 10 * 1024 * 1024` and `RESUME_ACCEPT = ".pdf,.docx"` in `joined-frontend/lib/resumes.ts`. Acorn HTTP body cap: `maxBody = 16 << 20` in `acornapi/server.go`. Uploader: `FileUploader` from `@joined/design-system`.

If upload/list/delete/default APIs are still stubs when this step starts, Elon splits a backend PR (Ravi/Acorn API) and Leo lands the website against the new contract. Do not fake a second library on the website.

## In scope

- Résumé library page on `acorn/website` (`/resumes` or `/library`): upload, list, preview, delete, set default — **once the API exists**.
- Reuse extension/shared types (`RuntimeAttachedFile`, library ids) rather than a new DTO.
- `@joined/design-system` `FileUploader` / cards. Size/type limits from named constants (import or move `MAX_RESUME_BYTES` / `RESUME_ACCEPT` to a shared module; do not invent new magic numbers).
- Signed-out empty state through the existing `/sign-in` placeholder (`joined_session`).
- Elon on the PR for `acorn/**`. If backend stubs must become real, that is a coordinated second PR, not a silent Leo backend edit.

## Out of scope

- No Joined résumé builder (step-39). No billing. No extension rewrite beyond reading the same library.
- No `acorn*` git branch.
- Do not implement a local-only IndexedDB library that the extension cannot see.

## Files and areas to touch

- `acorn/website/app/` — library page (new)
- `acorn/website/lib/routes.ts`, `lib/config.ts` — routes + API host (`JOINED_API_URL` or Acorn API origin)
- `acorn/website/components/` — uploader, list, preview (new)
- `acorn/packages/shared` — only if list/upload DTOs must be shared with the extension
- Backend (Elon-coordinated, new if still stubs): `backend-core/acornapi/resume.go`, `server.go`, store
- Reference (do not copy internals): `joined-frontend/components/resumes/resumes-workspace.tsx`, `joined-frontend/lib/resumes.ts`
- `packages/design-system/src/components/FileUploader.tsx` — use, do not fork

## Implementation notes

**Intended API (align with extension + stubs; fill the gaps):**

| Method            | Path                                               | Notes                                                                        |
| ----------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET`             | `/acorn/custom/library-resumes`                    | list — **new**                                                               |
| `POST`            | `/acorn/custom/library-resumes`                    | upload — **new**                                                             |
| `GET`             | `/acorn/custom/library-resumes/{resumeId}`         | exists as stub; must return `{ file: RuntimeAttachedFile, resumeId, stack }` |
| `GET`             | `/acorn/custom/library-resumes/{resumeId}/preview` | exists as stub; must return `{ html }`                                       |
| `DELETE`          | `/acorn/custom/library-resumes/{resumeId}`         | **new**                                                                      |
| `POST` or `PATCH` | set default                                        | **new**; name the path in the PR                                             |

Auth: same session/Bearer the extension already sends to `/acorn/*`. Website BFF should forward `joined_session`.

Constants: `MAX_RESUME_BYTES`, `RESUME_ACCEPT` — one module. Reject oversize and wrong MIME on both client and server.

## Acceptance criteria

1. `bun --filter acorn-website typecheck`, lint, and format pass.
2. A résumé uploaded on the website appears in the extension library for that account (documented against the real API, not a stub).
3. If the API is still stubbed, this step does not merge a UI that pretends upload works; Elon lands API first or in the same coordinated change.
4. Diff stays in `acorn/website/**` (and shared types only if required) for Leo; backend files only with Elon.

## Test and validation

```bash
bun --filter acorn-website typecheck
bun --filter acorn-website lint
bun run ci format
go test ./backend-core/acornapi/...   # only if API is in this PR
```

Add tests for size/type reject and list-after-upload against a fake store. Manual (human): upload on :6005, open the extension library for the same account.

## Risks and soft parks

- The original short doc overstated “already has library-resume routes.” Only GET stubs exist. Plan the backend split before promising a website-only PR.
- Do not check large binary fixtures into git.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
