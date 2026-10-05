# Step 55: Legal docs package

- **Week:** W4, Legal / launch prep
- **Owner:** Leo / Elon (Leo drafts pages; Elon owns `roadmap/**` and root legal files)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `docs(legal): terms privacy cookie premium scout drafts (roadmap step-55)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Builds on step-45.** Counsel still must review before launch (`docs/90`).

## Goal

Terms, privacy, cookie, Premium terms, and Scout contractor drafts live in the repo and are linked from the apps.

## In scope

- Repo copies (for example `docs/legal/` or the existing public routes) for: Terms of Service, Privacy Policy, cookie notice, Joined Premium terms, Scout independent-contractor terms. Mark every file ⚖️ draft until counsel signs off.
- Wire joined-frontend (and Scoutwell footer if missing) to these documents. Acorn legal stays on step-51 unless a shared markdown source is easier; do not fork conflicting terms.
- Replace step-45 "draft placeholder" body with this package's text, still labeled draft if counsel has not signed.

## Out of scope

- No pretending the copy is approved. No production domain/DNS. No live payments language that contradicts Stripe.

## Acceptance criteria

1. Each named document is in git and linked from the relevant app footer/settings.
2. Every page still shows a draft/not-legal-advice banner until counsel removes it.
3. Diff stays in Leo's lane plus `docs/**` / root files Elon owns.
