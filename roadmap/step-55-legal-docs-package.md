# Step 55: Legal docs package

- **Week:** W4
- **Status:** Done
- **Owner:** Leo / Elon (Leo drafts pages; Elon owns `docs/**` and root legal files)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `docs(legal): terms privacy cookie premium scout drafts (roadmap step-55)`

Every commit must be a lowercase conventional commit (`type(scope): subject`) or commitlint fails CI.

## Goal

Terms, privacy, cookie notice, Joined Premium terms, and Scout independent-contractor drafts live in the repo and are linked from the apps. Every page still shows a draft banner until counsel removes it.

## Context and dependencies

Builds on [step-45](step-45-legal-drafts-pages.md) (Joined draft routes) and [step-51](step-51-acorn-billing-legal-delete.md) (Acorn legal placeholders). Counsel review is required before launch (`docs/90-compliance-privacy-security.md`, ⚖️). There is **no** `docs/legal/` directory today.

Existing adjacent files (not user-facing ToS):

- `docs/90-compliance-privacy-security.md` — internal checklist
- `acorn/policy-acorn.md` — engineering policy
- `scout-extension/store/privacy-practices.md` — Chrome Web Store questionnaire, not a Privacy Policy

Scoutwell marketing footer (`app/(marketing)/layout.tsx`) is `BrandFooter` only; `scoutwell-frontend/lib/routes.ts` has no terms/privacy keys. Scout in-product terms are `POST /me/terms` in onboarding (`onboarding-form.tsx`), not a public page.

## In scope

- Repo copies under `docs/legal/` (new) for: Terms of Service, Privacy Policy, cookie notice, Joined Premium terms, Scout independent-contractor terms. Mark every file ⚖️ draft until counsel signs off.
- Wire `joined-frontend` (step-45 routes) and Scoutwell footer to these documents. Acorn legal stays on step-51 unless a shared markdown source is easier; do not fork conflicting terms.
- Replace step-45 placeholder bodies with this package’s text, still labeled draft if counsel has not signed.
- Elon owns `docs/**`; Leo owns frontend wiring.

## Out of scope

- No pretending the copy is approved. No production domain/DNS. No live-payments language that contradicts Stripe test-mode defaults.
- No `main` merge. No live counsel letter in the repo.

## Files and areas to touch

- `docs/legal/` (new) — `terms.md`, `privacy.md`, `cookies.md`, `premium-terms.md`, `scout-contractor.md` (names can vary; keep one index `docs/legal/README.md`)
- `docs/90-compliance-privacy-security.md` — link the new folder
- `joined-frontend` legal pages from step-45 — swap body source
- `scoutwell-frontend/lib/routes.ts`, marketing layout, optional `/terms` `/privacy`
- `sid-ui` `BrandFooter` — legal links slot if step-45 did not add it (sid-ui repo + catalog pin, not `packages/`)
- Acorn: only if sharing the markdown source; otherwise leave step-51 placeholders pointing at the same `docs/legal` text

## Implementation notes

- Single source of truth: markdown in `docs/legal/`. Apps either import a copied constant or render `Markdown` from a build-time import. Do not maintain three prose forks.
- Draft banner stays until counsel deletes it in a later PR. Title every file with “Draft — not legal advice”.
- Premium terms must not claim live charges while `STRIPE_ALLOW_LIVE` defaults false.
- Scout contractor terms: piece-rate / independent contractor framing from `docs/90` (worker classification ⚖️). No tax advice.
- Cookie notice matches the consent categories shipped in step-45 (`necessary` vs `analytics`).

## Acceptance criteria

1. Each named document is in git and linked from the relevant app footer/settings.
2. Every page still shows a draft/not-legal-advice banner until counsel removes it.
3. Diff stays in Leo's lane plus `docs/**` / root files Elon owns.

## Test and validation

```bash
bun --filter joined-frontend typecheck
bun --filter scoutwell-frontend typecheck
bun run ci format
bun run ci lint
```

Manual (human): open Joined `/terms` `/privacy` `/cookies`, Scoutwell footer links, Premium terms from billing/settings, Scout contractor from Scoutwell account/onboarding. Confirm Acorn does not contradict Joined terms.

## Risks and soft parks

- Counsel has not signed. Shipping this package does not unblock launch by itself.
- `docs/90` still lists many ⚖️ items (FCRA, AI hiring, 1099) that this markdown will not settle.
- Infra: cancelled CI can look green. Require real green.

## Definition of done

PR into `stage-roadmap-w34`, CI green (not cancelled), Quinn PASS, Elon merges. Never `main`.
