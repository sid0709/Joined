# 11 — Jobs: Candidate Mode

**App:** Jobs web (today `opened-frontend`) · **Services:** `jobs`, `matching`, `ats`, `tracking`, `notify`, `payments`

## Purpose

A free, verified job search where the candidate applies **personally**, sees every application and interview in one place, and pays only when an interview is real. Premium unlocks hidden jobs found by scouts.

## Pages

```
Job Search | My Applications | Interviews | Messages | My Resumes | Profile | Settings
```

| Page                | Must do                                                                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Job Search**      | Full-text + faceted search (title, location, remote, salary, seniority, employment type, posted date, visa sponsorship, **hidden jobs**). Match score per job when a profile exists. Tabs: _All_, _Recommended_, _Saved_. Job detail drawer with summary, requirements, salary, company card, and **Apply**. |
| **My Applications** | Every application with status: Applied → In review → Interviewing → Offer / Rejected / Withdrawn. Filters and a stats header (applications, interviews, interview rate).                                                                                                                                     |
| **Interviews**      | Upcoming and past interviews from the connected calendar and on-platform scheduling. **Classify** each one as internal or external (see below), confirm/correct detected interviews, prep notes, credits used.                                                                                               |
| **Messages**        | Threads with companies (opened when the candidate applies to a company on OpenSeat) and system.                                                                                                                                                                                                              |
| **My Resumes**      | Upload (PDF/DOCX), parse, multiple labeled versions, set default.                                                                                                                                                                                                                                            |
| **Profile**         | Headline, target roles, locations, remote preference, salary floor, work authorization, verification badge, public visibility settings.                                                                                                                                                                      |
| **Settings**        | Account, notifications, **connected calendar (required for interviews)**, privacy (data export/delete), Premium billing, interview credits.                                                                                                                                                                  |

**Later:** analytics page (application funnel over time).

## Business rules

- Searching and applying are **free**. The seeker pays only: Premium ($20/mo, optional) and **$2 per own-applicant interview after free credits**. External (OpenSeat-found) interviews cost the seeker **$0**.
- **Every application is made by the candidate in person.** No auto-apply, no agents, no third parties ([22-no-bot-applications.md](22-no-bot-applications.md)). Apply endpoints require a first-party human session.
- Applying to a **direct job** happens on-platform (profile + resume + screening questions) and lands in the company's ATS. Applying to an **aggregated or scouted job** opens the official apply link; the application is recorded when the candidate confirms ("Did you apply?" on return).
- **The apply click stamps the source** (`internal` if the candidate arrived through the company's own OpenSeat link or career page; `external` if they found the job via OpenSeat Jobs or Scout) and opens the ATS trail. See [30-interview-tracking.md](30-interview-tracking.md).
- **Hidden jobs** (scouted, not on major boards) are visible to **Premium** seekers first; free seekers see them after the exclusivity window (config) or once the job appears publicly.
- **Interview credits:** 3–5 free per month (config). A credit covers the $2 fee on an own-applicant (internal) interview. Credits do not roll over. External interviews never use a credit.
- **Free from the 4th interview** for the same candidate and job.
- Duplicate protection: one application per candidate per job.
- **Calendar connection is expected.** Without one, OpenSeat cannot see the interview, so it cannot classify it as external ($0). Interviews the candidate reports manually with evidence go to review and are billed as internal until resolved.
- **Classification duty.** After each interview date, the candidate marks the interview `internal`, `external`, or `not an interview`. If the candidate does not answer within the window (config, default 72 h), the source stamp decides.
- **Upgrade prompts** (Premium), shown sparingly (max once per 7 days per trigger): on opening a hidden-job teaser, on a saved job the candidate did not apply to for 3 days.

## Data used

`jobs`, `fit_scores`, `applications`, `source_stamps`, `resume_versions`, `job_hunter_profiles`, `interview_events`, `seeker_credits`, `subscriptions`.

## API

```
GET    /v1/jobs/search?q=&loc=&remote=&salary_min=&seniority=&type=&posted_within=&hidden=&page_cursor=
GET    /v1/jobs/{id}
POST   /v1/jobs/{id}/save            DELETE /v1/jobs/{id}/save
GET    /v1/me/saved-jobs
POST   /v1/jobs/{id}/apply           {resume_version_id, answers[]}   (direct jobs; human session only)
POST   /v1/jobs/{id}/applied-external {applied_at}                    (aggregated/scouted)
GET    /v1/me/applications?status=&cursor=
PATCH  /v1/me/applications/{id}      {status: withdrawn}
GET    /v1/me/interviews?range=&status=
POST   /v1/interviews/{id}/classify  {classification: internal|external|not_interview}
POST   /v1/me/resumes (multipart)    GET /v1/me/resumes   PATCH/DELETE /v1/me/resumes/{id}
GET    /v1/me/profile                PATCH /v1/me/profile
GET    /v1/me/recommendations?cursor=
GET    /v1/me/credits                -> {granted, used, period_month}
POST   /v1/me/premium                (Stripe Checkout)   DELETE /v1/me/premium
```

## SEO pages (server-rendered, public)

- `/jobs/{slug}-{id}` job page with **JobPosting structured data**; `validThrough` set; expired jobs return 410 or noindex with "closed" state. Hidden jobs show a teaser only.
- `/jobs/{role}-in-{city}`, `/companies/{slug}`, `/salaries/{role}-{city}`.
- Canonical URLs, sitemap index split by type, `lastmod` from `updated_at`.
- Never publish copied full descriptions from other sites — use our summary.

## Events

Emits: `application.submitted`, `job.saved`, `profile.updated`, `interview.classified`. Consumes: `interview.detected` (prompt to classify), `job.expired`, `job.hidden_ended`, `interview.fee_authorized`.

## Edge cases

- Job expires while saved → show "Closed" and suggest similar jobs.
- Resume upload fails parsing → keep file, mark `parsed = null`, allow manual entry.
- Candidate applied outside OpenSeat and later gets an interview → the calendar detects it; with no source stamp it is classified by the candidate and company, and a missing stamp defaults to `internal` on conflict.
- Candidate's company is not registered → interview is tracked but nobody is billed.
- Candidate in a country where a job is not open to applicants → eligibility warning from `requirements.locations_allowed`.

## Acceptance criteria

- Search returns results in < 400 ms p95 with facets and correct counts.
- A job page passes Google's Rich Results test for JobPosting.
- Applying to a direct job creates exactly one application visible to both the candidate and the company, with a source stamp.
- An apply request without a human session (or with automation signals) is rejected.
- A free seeker never sees hidden-job details during the Premium window; a Premium seeker does.
- A seeker with credits left is never charged $2; an external interview never charges the seeker.
