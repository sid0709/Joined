# Step 38: SEO job pages

- **Week:** W3, Scraper onboarding
- **Owner:** Leo (web frontends lane)
- **Target branch:** `stage-roadmap-w34` (never `main`, never `acorn*`)
- **PR title:** `feat(joined-frontend): seo job pages sitemap robots (roadmap step-38)` (conventional commits: lowercase `type(scope): subject`; every commit message must follow the same format or CI fails)
- **Independent of steps 34–37.**

## Goal

Public job pages are crawlable: SSR, useful titles, JobPosting JSON-LD, sitemap, and robots.

## In scope

- `joined-frontend` job pages already load on the server (`app/(seeker)/jobs/[id]/page.tsx`). Tighten `generateMetadata` (title, description, canonical, Open Graph) from the job record.
- JSON-LD `JobPosting` on the public job page (title, company, location, description, url). Match schema.org fields the job record actually has; do not invent salary.
- `sitemap.ts` / `robots.ts` (or the App Router equivalent in this Next version) so `/sitemap.xml` lists public job URLs with a documented cap/pagination strategy, and robots allows those pages.
- Noindex for signed-in-only surfaces (applications, settings, resumes).

## Out of scope

- No backend schema changes. No marketing blog. No paid SEO tools.

## Acceptance criteria

1. Build, typecheck, lint, and format pass for `joined-frontend`.
2. A public job URL returns HTML with title + JobPosting JSON-LD; `/sitemap.xml` and `/robots.txt` exist.
3. Diff stays in Leo's lane.
