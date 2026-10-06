# Step 38: SEO job pages

- **Week:** W3
- **Status:** Done
- **Owner:** Leo (web frontends lane: `joined-frontend/**`, `scoutwell-frontend/**`, `admin-frontend/**`, `connected-frontend/**`, `packages/google-signin/**`; UI from the external catalog package `sid-ui` — in-repo `packages/design-system` and `joined-theme` are gone after #115)
- **Target branch:** `stage-roadmap-w34`
- **PR title:** `feat(joined-frontend): seo job pages sitemap robots (roadmap step-38)` (every commit must be lowercase `type(scope): subject` or commitlint fails CI)
- **Merged PR:** #107 (`56d98ec`)

## Goal

Public job pages are crawlable: SSR, useful titles, JobPosting JSON-LD, sitemap, and robots. A public job URL returns HTML with a title and JobPosting JSON-LD; `/sitemap.xml` and `/robots.txt` exist.

## Context and dependencies

Independent of steps 34–37. Job pages already load on the server (`joined-frontend/app/(seeker)/jobs/[id]/page.tsx`). Catalog comes from `GET /v1/search/jobs` via `loadSearchCatalog()` (`lib/jobs/catalog.ts`). Public origin for canonical/OG/JSON-LD/sitemap is `JOINED_WEB_URL` (`lib/config.ts` `joinedWebUrl()`).

Shipped modules: `joined-frontend/lib/seo/job-metadata.ts`, `job-posting.ts`, `constants.ts`, `robots.ts`, `sitemap.ts`; `app/sitemap.ts`, `app/robots.ts`; `components/jobs/job-posting-json-ld.tsx`. Auth and company layouts noindex (`app/(auth)/layout.tsx`, `app/company/layout.tsx`).

`docs/11-platform-job-hunter.md` is product context. No backend schema change.

## In scope

- Tighten `generateMetadata` (title, description, canonical, Open Graph) from the job record.
- JSON-LD `JobPosting` on the public job page (title, company, location, description, url). Match schema.org fields the job record actually has; do not invent salary.
- `sitemap.ts` / `robots.ts` so `/sitemap.xml` lists public job URLs with a documented cap, and robots allows those pages.
- Noindex for signed-in-only surfaces (applications, settings, resumes).

## Out of scope

- No backend schema changes.
- No marketing blog.
- No paid SEO tools.
- No merge to `main`. Never an `acorn*` branch.

## Files and areas to touch

- `joined-frontend/app/(seeker)/jobs/[id]/page.tsx` — SSR, `generateMetadata`, `JobPostingJsonLd`
- `joined-frontend/lib/seo/job-metadata.ts`, `job-posting.ts`, `constants.ts`, `robots.ts`, `sitemap.ts`
- `joined-frontend/app/sitemap.ts`, `joined-frontend/app/robots.ts`
- `joined-frontend/components/jobs/job-posting-json-ld.tsx`
- `joined-frontend/app/(auth)/layout.tsx`, `joined-frontend/app/company/layout.tsx` — noindex
- `joined-frontend/lib/config.ts`, `joined-frontend/.env.example` — `JOINED_WEB_URL`
- Tests: `joined-frontend/lib/seo/job-posting.test.ts`, `job-metadata.test.ts`, `sitemap.test.ts`, `robots.test.ts`, `lib/config.test.ts`

Do not edit Go search handlers or job schema packages unless Elon splits a backend gap.

## Implementation notes

**`JOINED_WEB_URL`:** required for production SEO. Empty → `joinedWebUrl()` is `""`; `publicSitemapEntries` returns `[]`; `absoluteJobPageUrl` is undefined; robots omits the sitemap line. Document this in `.env.example`.

**JSON-LD location (shipped):** `addressLocality: job.location.trim() || job.workplace` — **locality-only**, no region/country fields. Do not invent `addressRegion` from a free-text location.

**Salary:** omit `baseSalary` unless the job record has a published range you already expose. Do not estimate.

**Sitemap:** `GET /v1/search/jobs` catalog; cap `SITEMAP_JOB_LIMIT = 2000` in `lib/seo/constants.ts` (matches `maxSearchCatalog`). Pagination strategy: one sitemap of the catalog cap, documented — do not silently crawl Mongo.

**Robots:** allow `/`, `/jobs/`, `/companies/`, `/pricing`; disallow applications, settings, resumes, `/company/`, and other signed-in surfaces (`lib/seo/robots.ts`).

**Canonical / OG:** absolute URLs only when `JOINED_WEB_URL` is set.

## Acceptance criteria

1. `bun --filter joined-frontend` typecheck, lint, and build pass.
2. A public job URL returns HTML with title + JobPosting JSON-LD; `/sitemap.xml` and `/robots.txt` exist.
3. Salary is omitted unless present on the job. Noindex on applications/settings/resumes.
4. Diff stays in Leo's lane.

## Test and validation

```bash
bun test joined-frontend/lib/seo/job-posting.test.ts
bun test joined-frontend/lib/seo/job-metadata.test.ts
bun test joined-frontend/lib/seo/sitemap.test.ts
bun test joined-frontend/lib/seo/robots.test.ts
bun test joined-frontend/lib/config.test.ts
bun --filter joined-frontend typecheck
bun --filter joined-frontend lint
bun --filter joined-frontend build
bun run ci
```

Human-run: with `JOINED_WEB_URL` set, curl a job page, `/sitemap.xml`, `/robots.txt`. Agent does not start Next.

## Risks and soft parks

- **`JOINED_WEB_URL` is required.** Unset origin yields crawlable HTML but empty sitemap and weak absolute URLs.
- **Location is locality-only.** Multi-part locations stay thin in JSON-LD.
- Catalog jobs may lack `validThrough`.
- Infra: GitHub Actions runner starvation can cancel jobs. Require real green.

## Definition of done

PR into `stage-roadmap-w34` (#107 already merged). CI green (not cancelled). Quinn PASS. Elon merges. Never `main`. Never an `acorn*` branch.
