# Step 39: Resume builder gaps

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(joined-frontend): close resume builder gaps (roadmap step-39)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Independent of steps 34–38.**

## Goal

The seeker résumé library on joinedhq.com is a real builder, not demo upload cards.

## In scope

- Investigate `joined-frontend/components/resumes/` and `joined-frontend/lib/resumes`. Replace demo upload/progress and in-memory `RESUMES` with the real candidate résumé API if one exists; if the API is missing, Elon coordinates Ravi for a thin store and this step still ships the UI against that contract.
- Create, rename, set default, delete, and preview. Persist parsed insights when the backend returns them.
- Stay on `@joined/design-system` (`FileUploader`, cards, dialogs). Honor `MAX_RESUME_BYTES` / accept types already in `lib/resumes`.
- Empty, error, and size-limit states.

## Out of scope

- No Acorn résumé library (step-49). No backend rewrite beyond a coordinated thin API if missing.
- No AI rewrite of the résumé in this step.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. Upload (or create), default, rename, delete, and reload still show the résumé after refresh.
3. Diff stays in Leo's lane (plus a flagged Ravi PR only if Elon split the API).
