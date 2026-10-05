# Step 45: Legal draft pages

- **Week:** W3
- **Status:** Done
- **Owner:** Leo (web frontends lane: `joined-frontend/**`; UI from `sid-ui`)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(joined-frontend): terms privacy cookie draft pages (roadmap step-45)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Joined ships public draft Terms, Privacy, and cookie-consent surfaces so counsel can review copy in the product. Pages are clearly drafts, not counsel-approved.

## Context and dependencies

Independent of other W3 APIs. Counsel-approved copy is W4 [step-55](step-55-legal-docs-package.md). Acorn legal pages are [step-51](step-51-acorn-billing-legal-delete.md). Compliance framing already lives in `docs/90-compliance-privacy-security.md` (⚖️ counsel review) but there is no `docs/legal/` package and no user-facing ToS/Privacy/Cookie markdown.

Today no app exposes `/terms`, `/privacy`, or `/cookies`. `joined-frontend/lib/routes.ts` has no legal keys. Site chrome is `joined-frontend/components/shell/seeker-header.tsx` and `employer-header.tsx`; there is no site-wide marketing footer. `BrandFooter` is imported from `sid-ui` (used in `joined-frontend/app/(auth)/layout.tsx` and `app/not-found.tsx`) and is a Joined sign-off only (`lead`, optional `href`) with no Terms/Privacy slots. Cookie consent UI does not exist. Existing cookie names are session/theme, not consent: `SESSION_COOKIE = "joined_session"` in `joined-frontend/lib/auth/constants.ts`, `MODE_COOKIE = "joined_mode"` in `joined-frontend/lib/workspace-preference.ts`. Apply-flow consent (`APPLY_CONSENT_VERSION` in `joined-frontend/lib/intake.ts`) is a different concern.

`sid-ui` pieces to reuse: `Text`, `Heading`, `PageContainer`, `PageHeader`, `SectionCard`, `Banner`, `Dialog`, `AlertDialog`, `BrandFooter`. There is no Cookie primitive. `packages/design-system` and `joined-theme` are gone; missing primitives go to the sid-ui repo, then bump the catalog pin.

Depends on: none. Related: step-51 (Acorn legal), step-55 (shared legal package), step-44 privacy settings (`joined-frontend/components/settings/privacy-settings.tsx`).

## In scope

- Public routes in `joined-frontend` at `/terms`, `/privacy`, and `/cookies` (or a cookies section on privacy if a dedicated page is redundant — still add `ROUTES` keys).
- Long-form layout from `sid-ui` (`PageContainer`, `Heading`, `Text`, `Banner`). Visible draft disclaimer on every page: not counsel-approved, not legal advice.
- First-visit cookie-consent banner or dialog: necessary vs analytics. Persist the choice in one named constant cookie (define once; do not copy a raw cookie string). Honor the stored choice on later visits.
- Footer or header links from seeker chrome (and auth `BrandFooter` if that is the only footer) to these pages. If `BrandFooter` needs a legal-links slot, add it in the sid-ui repo, publish, bump the `sid-ui` catalog pin, and show it in `sid-ui-theme`.
- Named constants for routes, cookie name, consent version, and copy in the owning module (`lib/legal.ts` or similar).

## Out of scope

- No final legal text (step-55). No Premium terms or Scout contractor agreement.
- No backend. No Acorn legal pages (step-51). No Scoutwell legal routes unless a single shared footer primitive requires it — default is joined-frontend only.
- No live analytics vendor. Honor “analytics off” locally (do not load analytics scripts when declined); do not invent a new telemetry stack.
- No merge to `main`. No `acorn*` git branch.

## Files and areas to touch

- `joined-frontend/app/` — new public pages (new), likely outside `(seeker)/(candidate)` so they render without a session
- `joined-frontend/lib/routes.ts` — `terms`, `privacy`, `cookies` keys
- `joined-frontend/lib/legal.ts` or `lib/cookie-consent.ts` (new) — copy, cookie name, consent version
- `joined-frontend/components/` — legal page body + consent banner (new)
- `joined-frontend/components/shell/` — links from seeker/employer chrome
- `joined-frontend/app/(auth)/layout.tsx` — optional footer links next to `BrandFooter`
- sid-ui (external) — only if `BrandFooter` needs a legal-links slot
- No `docs/legal/` yet (step-55)

## Implementation notes

- Mark every page with `Banner` draft copy. Body can be short placeholder sections that step-55 will replace; do not pretend the text is approved.
- Cookie consent: necessary cookies always on (session `joined_session`, mode `joined_mode`). Analytics is opt-in. Persist `{ necessary: true, analytics: boolean, version }` in one cookie, HttpOnly-off so the client can read it, with a named `max-age` constant. Bump `CONSENT_VERSION` when categories change so old cookies re-prompt.
- Do not reuse `APPLY_CONSENT_VERSION` — that is apply-flow copy, not site cookies.
- If analytics scripts do not exist yet, gate a documented hook (`lib/analytics.ts`) so later vendors check the stored choice.
- Tokens only: `var(--color-*)`, `var(--spacing-*)`. No hex. No local button/dialog.

## Acceptance criteria

1. `bun --filter joined-frontend typecheck`, workspace lint, and `bun run ci format` pass.
2. `/terms`, `/privacy`, and cookie consent are reachable without sign-in; a draft disclaimer is visible on each legal page.
3. First visit shows consent UI; a documented choice persists and is honored on reload.
4. Seeker chrome (or the only site footer) links to the pages.
5. Diff stays in Leo's lane (`joined-frontend/**`). A `sid-ui` primitive change is a separate publish + catalog-pin bump, not source under `packages/`.

## Test and validation

```bash
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun run ci format
bun run ci test
```

Add unit tests for cookie parse/serialize and “stale version re-prompts”. Manual (human): load `/`, `/terms`, `/privacy`, accept/reject analytics, reload, confirm the banner stays gone and the cookie matches the named constant.

## Risks and soft parks

- Step-55 will replace placeholder bodies; keep copy in one module so that swap is mechanical.
- Infra: GitHub Actions runner starvation can cancel jobs; “all checks passed” can hide cancelled jobs. Require real green, not cancelled.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
