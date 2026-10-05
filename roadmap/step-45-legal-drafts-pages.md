# Step 45: Legal draft pages

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(joined-frontend): terms privacy cookie draft pages (roadmap step-45)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Independent.** Counsel-approved copy is W4 step-55; this step ships draft routes so legal can review in the product.

## Goal

Draft Terms, Privacy, and cookie-consent pages exist on joined-frontend for W4 legal.

## In scope

- Public routes in `joined-frontend` (for example `/terms`, `/privacy`, `/cookies`) using `@joined/design-system` typography/layout. Mark them clearly as drafts, not counsel-approved.
- Cookie consent banner or dialog for first visit: necessary vs analytics, persist choice in a named constant cookie (not a raw string copied in three files). Honor the choice on later visits.
- Footer/links from the marketing/home chrome to these pages.

## Out of scope

- No final legal text (step-55). No Premium terms or Scout contractor agreement in this step.
- No backend. No Acorn legal pages (step-51).

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. `/terms`, `/privacy`, and cookie consent are reachable; a documented draft disclaimer is visible.
3. Diff stays in Leo's lane.
