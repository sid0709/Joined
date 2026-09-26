# 12 — Job Platform: Company Mode

**App:** `platform-web` (company area) · **Services:** `jobs`, `identity`, `tracking`, `payments`, `trust`

## Purpose

Let companies post jobs for free, receive verified and pre-filtered candidates (including assisted ones they control), schedule interviews on-platform, and pay only per interview.

## Pages

| Page | Must do |
|---|---|
| **Company Home** | Open jobs, new applicants, upcoming interviews, spend this month vs cap. |
| **Jobs** | Create/edit/pause/close jobs. Per-job assisted-application policy (accept / cap per day / direct only). |
| **Applicants** | Per job: list with fit score, verified badge, "assisted" label (bidder or AI-prepared), resume, answers. Actions: shortlist, reject, **schedule interview**, mark **not relevant** (assisted only), report. |
| **Interviews** | Calendar of scheduled interviews, round numbers, attendance, face-check status, no-show marking. |
| **Company Page** | Public profile (logo, about, locations, open jobs). Claim flow for auto-generated pages. |
| **Team** | Invite recruiters (roles: owner, admin, recruiter, viewer). |
| **Billing** | Plan (Free/Growth/Enterprise), monthly spend cap, invoices, payment method, interview credits. |
| **Settings** | Domains, ATS integration (later), notification preferences. |

## Business rules

- Posting is free and unlimited for **verified** companies. Unverified posts are `pending_review` and shown with limited visibility until verified.
- **Billable event:** an interview scheduled **through the platform** where the candidate attended. See [31-payments-wallet-escrow.md](31-payments-wallet-escrow.md) and [50-pricing-and-revenue.md](50-pricing-and-revenue.md).
- Not billable: candidate no-show, cancellation > 24 h before start, identity mismatch confirmed by face check.
- **Reports never cancel fees**; refunds only for the objective cases above.
- First N interviews free for newly claimed companies (config, default 10).
- Company-set monthly spend cap; when reached, scheduling still works but new interviews queue as "awaiting budget" and the owner is notified.
- Candidate contact details (email/phone) are revealed only after an interview is scheduled.
- Terms include a placement fee if a company hires a candidate it met through us off-platform within 12 months.
- "Not relevant" feedback is available only on assisted applications and feeds the sender's quota/rating. It is not a report and has no effect on the candidate's standing.

## Claiming a company page

Auto-generated pages exist for companies whose jobs are aggregated or scouted. Page shows real activity: "N verified candidates applied through us, M were interviewed."

Claim flow: work email on a company domain → email code, or DNS TXT record → claim approved → company can post direct jobs, convert existing jobs to direct (keeps history), and gets free interviews. Emits `company.claimed` (triggers scout conversion rewards).

## Interview scheduling (on-platform)

1. Recruiter clicks *Schedule* → selects interview type/round, duration, interviewers, proposes slots or shares a scheduling link.
2. Candidate picks a slot (sync with candidate's connected calendar).
3. Video room created (built-in or Zoom/Meet/Teams link). For built-in rooms, **face check** against the candidate's verified ID when joining.
4. After the slot: attendance recorded automatically (built-in) or by recruiter (external link). Status → confirmed/no_show.
5. `interview.confirmed` emitted with `round_number`.

## API

```
POST   /v1/companies                         {name, domain}
GET    /v1/companies/{id}                    PATCH /v1/companies/{id}
POST   /v1/companies/{id}/claim              {method}
POST   /v1/companies/{id}/members            {email, role}
POST   /v1/companies/{id}/jobs               {…job fields}
PATCH  /v1/companies/{id}/jobs/{jobId}       {…, assisted_applications_policy, assisted_daily_cap}
POST   /v1/companies/{id}/jobs/{jobId}/close
GET    /v1/companies/{id}/jobs/{jobId}/applicants?filter=&cursor=
POST   /v1/applications/{appId}/company-feedback   {value: not_relevant|good_fit}
POST   /v1/applications/{appId}/schedule            {round, duration, slots[], interviewers[]}
POST   /v1/interviews/{id}/attendance                {attended: bool}
GET    /v1/companies/{id}/billing                    PATCH {monthly_cap_cents}
```

## Events

Emits: `job.published`, `job.closed`, `company.claimed`, `company.feedback.not_relevant`, `interview.scheduled`, `interview.confirmed`, `interview.no_show`. Consumes: `application.submitted` (applicant list), `payment.failed` (restrict scheduling).

## Edge cases

- Recruiter schedules the same candidate twice for the same round → dedupe by `(candidate, job, round)`.
- Company removes a job with pending interviews → interviews stay; job hidden from search.
- Spend cap hit mid-month → queue as described; never silently bill above cap.
- Company reports a candidate for proxy interview → trust case; fee stays unless face check confirms mismatch.

## Acceptance criteria

- A verified company posts a job and it appears in search within 60 s.
- Setting policy `direct_only` hides the job from Connect assignment and the agent within 5 minutes.
- A no-show interview never creates a company charge.
- The applicant list shows the "assisted" label on 100% of bidder/agent applications.
