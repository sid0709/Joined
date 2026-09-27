# 11 — Job Platform: Job Hunter Mode

**App:** `platform-web` · **Services:** `jobs`, `matching`, `marketplace` (self applications), `tracking`, `notify`

## Purpose

A free, verified job search experience with jobs other boards don't have, a clear application tracker, and a natural upgrade path to Connect.

## Pages (v1 navigation)

```
Job Search | My Applications | Interviews | Messages | My Resumes | Profile | Settings
```

| Page                | Must do                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Job Search**      | Full-text + faceted search (title, location, remote, salary, seniority, employment type, posted date, visa sponsorship, source: "hidden jobs only"). Match score per job when a profile exists. Tabs: _All_, _Recommended_, _Saved_. Job detail drawer with summary, requirements, salary, company card, official apply link, "Apply" and "Save". |
| **My Applications** | Every application (self and assisted) with status: Saved → Applied → Viewed → Interview → Offer / Rejected / No response. Filters and a simple stats header (applications, interviews, interview rate).                                                                                                                                           |
| **Interviews**      | Upcoming and past interviews from calendar/email/on-platform; prep notes; confirm/correct detected interviews.                                                                                                                                                                                                                                    |
| **Messages**        | Threads with companies (on-platform scheduling), bidders (if a client), and system.                                                                                                                                                                                                                                                               |
| **My Resumes**      | Upload (PDF/DOCX), parse, multiple labeled versions, set default. Owner approval required for any version created by a bidder/agent.                                                                                                                                                                                                              |
| **Profile**         | Headline, target roles, locations, remote preference, salary floor, work authorization, verification badge, public visibility settings.                                                                                                                                                                                                           |
| **Settings**        | Account, notifications, connected calendar/email, privacy (data export/delete), billing (if client).                                                                                                                                                                                                                                              |

**Later:** Analytics page (application funnel over time), browser extension to track applications made on other sites.

## Business rules

- Searching and applying are **free forever**.
- Applying to a **direct job** happens on-platform (profile + resume + screening questions) and goes straight to the company.
- Applying to an **aggregated or scouted job** opens the official apply link; the application is recorded as `self` with status `applied` when the user confirms ("Did you apply?" prompt on return, or extension capture).
- Duplicate protection: a user cannot apply twice to the same job through us; if a bidder already applied for them, "Apply" is replaced with "Already applied via Connect".
- "Hidden job" badge on scouted jobs not found on major boards.
- **Upgrade prompts** (Connect entry points), shown sparingly (max once per 7 days per trigger):
  - after 20 self applications with no interview,
  - on a job the user saved but did not apply to for 3 days,
  - on the Applications page header.

## Data used

`jobs`, `fit_scores`, `applications (actor_type=self)`, `resume_versions`, `job_hunter_profiles`, `interview_events`.

## API

```
GET    /v1/jobs/search?q=&loc=&remote=&salary_min=&seniority=&type=&posted_within=&source=&page_cursor=
GET    /v1/jobs/{id}
POST   /v1/jobs/{id}/save            DELETE /v1/jobs/{id}/save
GET    /v1/me/saved-jobs
POST   /v1/jobs/{id}/apply           {resume_version_id, answers[]}   (direct jobs)
POST   /v1/jobs/{id}/applied-external {applied_at}                    (aggregated/scouted)
GET    /v1/me/applications?status=&cursor=
PATCH  /v1/me/applications/{id}      {status}                         (manual update)
GET    /v1/me/interviews?range=
POST   /v1/me/resumes (multipart)    GET /v1/me/resumes   PATCH/DELETE /v1/me/resumes/{id}
GET    /v1/me/profile                PATCH /v1/me/profile
GET    /v1/me/recommendations?cursor=
```

## SEO pages (server-rendered, public)

- `/jobs/{slug}-{id}` job page with **JobPosting structured data**; `validThrough` set; expired jobs return 410 or noindex with "closed" state.
- `/jobs/{role}-in-{city}`, `/companies/{slug}`, `/salaries/{role}-{city}`.
- Canonical URLs, sitemap index split by type, `lastmod` from `updated_at`.
- Never publish copied full descriptions from other sites — use our summary.

## Events

Emits: `application.self.created`, `job.saved`, `profile.updated`. Consumes: `interview.detected` (to prompt confirmation), `job.expired` (update saved/applications).

## Edge cases

- Job expires while saved → show "Closed" and suggest similar jobs.
- Resume upload fails parsing → keep file, mark `parsed = null`, allow manual entry.
- User in a country where a job is not open to applicants → show eligibility warning from `requirements.locations_allowed`.

## Acceptance criteria

- Search returns results in < 400 ms p95 with facets and correct counts.
- A job page passes Google's Rich Results test for JobPosting.
- Applying to a direct job creates exactly one application visible to both the job hunter and the company.
- Upgrade prompt appears after the 20th self application without interview and not again for 7 days.
