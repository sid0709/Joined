# 12 — Hire: Company Mode

**App:** Hire web (company area; today the employer mode of `opened-frontend`) · **Services:** `jobs`, `ats`, `assistant`, `tracking`, `payments`, `identity`, `trust`

## Purpose

Let companies post jobs for free, run the whole hiring process in an ATS, get AI interview notes, and pay only for interviews that actually happen: **$5** per own-applicant interview, **$20** per OpenSeat-found interview. No seats, no contracts, no minimums.

The pipeline, scorecards and offers are specified in [20-hire-ats.md](20-hire-ats.md); the AI assistant in [21-hire-ai-interview-assistant.md](21-hire-ai-interview-assistant.md).

## Pages

| Page             | Must do                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Company Home** | Open jobs, new applicants, upcoming interviews, interviews awaiting classification, fees this month.                                                       |
| **Jobs**         | Create/edit/pause/close jobs. Company apply link and embeddable career page per job.                                                                       |
| **Pipeline**     | Per job: applicants by stage, source label (internal / external), verified badge, resume, answers. Actions: move stage, schedule interview, reject, offer. |
| **Interviews**   | Calendar of interviews, interview numbers, classification status, attendance, notes and scorecards, face-check status.                                     |
| **Company Page** | Public profile (logo, about, locations, open jobs). Claim flow for auto-generated pages, showing how many OpenSeat candidates the company interviewed.     |
| **Team**         | Invite recruiters and interviewers (roles: owner, admin, recruiter, interviewer, viewer). Every interviewer connects a calendar.                           |
| **Billing**      | Payment method, fees per interview, invoices, monthly summary.                                                                                             |
| **Settings**     | Domains, notification preferences, recording consent defaults, integrations (later).                                                                       |

## Business rules

- **Posting is free** for registered companies. Unverified posts are `pending_review` with limited visibility until verified.
- **Who brought the candidate sets the price.** Internal = applied via the company's own OpenSeat link or career page → **$5**. External = found the job via OpenSeat Jobs or Scout → **$20**.
- **Billable event:** an interview that appears on both calendars (or is held on-platform), is classified by both sides, and has interview number **1–3** for that candidate and job. **From the 4th interview, nobody pays.**
- **Registered companies only.** A company must accept the terms and add a payment method to register. An unregistered company owes nothing; the record starts once it registers (earlier interviews are not back-billed).
- **Companies get no free credits;** they pay from the first interview.
- **Fee authorization at booking, settlement after the date.** The card is authorized when the interview is confirmed; the fee is captured after the interview date passes with no dispute.
- **No fee, no next stage.** If a fee authorization fails or is unpaid, the candidate's next ATS stage is locked until it is paid (the stage lock, [20](20-hire-ats.md)).
- **Classify every interview.** The interviewer or recruiter marks each meeting `internal` or `external`. The company wants "internal"; the candidate wants "external"; disagreements are resolved by the source stamp written at the apply click.
- Not billable: `cancelled` before the start time, candidate no-show, identity mismatch confirmed by face check, interview voided after dispute.
- Candidate contact details are revealed only after the company schedules an interview.
- **Reports never cancel fees**; refunds only for the objective cases above.
- Terms include a placement clause when a company hires someone it met through OpenSeat off-platform (length set by counsel, ⚖️).
- Recordings and AI analysis require the consent flow in [21](21-hire-ai-interview-assistant.md).

## Claiming and registering a company page

Auto-generated pages exist for companies whose jobs are aggregated or scouted. The page shows real activity: "N OpenSeat candidates applied, M were interviewed."

1. Claim: work email on a company domain → email code, or DNS TXT record → claim approved.
2. Register: accept terms + add a payment method → `company.registered`. Interviews from this date are billable.
3. The company can now post direct jobs, convert existing jobs to direct (keeps history), use the ATS, and share its own apply link.

Emits `company.claimed` and `company.registered` (the latter triggers the scout conversion bonus, [13](13-scout-mode.md)).

## Interview scheduling

1. Recruiter clicks _Schedule_ in the ATS → selects interview type, duration, interviewers, proposes slots or shares a scheduling link.
2. Candidate picks a slot; it lands on the candidate's and interviewers' connected calendars.
3. Video room created (built-in or Zoom/Meet/Teams link). For built-in rooms, **face check** against the candidate's verified ID when joining.
4. `interview.detected` → `scheduled`. After the date, both sides classify; then `interview.confirmed` is emitted with `interview_number` and `classification`.

Interviews booked outside OpenSeat are still detected from the calendars ([30](30-interview-tracking.md)).

## API

```
POST   /v1/companies                         {name, domain}
GET    /v1/companies/{id}                    PATCH /v1/companies/{id}
POST   /v1/companies/{id}/claim              {method}
POST   /v1/companies/{id}/register           {terms_version, payment_method_id}
POST   /v1/companies/{id}/members            {email, role}
POST   /v1/companies/{id}/jobs               {…job fields}
PATCH  /v1/companies/{id}/jobs/{jobId}
POST   /v1/companies/{id}/jobs/{jobId}/close
GET    /v1/companies/{id}/jobs/{jobId}/applicants?stage=&source=&cursor=
POST   /v1/applications/{appId}/schedule            {duration, slots[], interviewers[]}
POST   /v1/interviews/{id}/classify                 {classification: internal|external|not_interview}
POST   /v1/interviews/{id}/attendance                {attended: bool}
GET    /v1/companies/{id}/billing
GET    /v1/companies/{id}/invoices
```

## Events

Emits: `job.published`, `job.closed`, `company.claimed`, `company.registered`, `interview.scheduled`, `interview.classified`, `interview.no_show`. Consumes: `application.submitted`, `interview.fee_authorized`, `interview.fee_failed`, `assistant.notes.ready`.

## Edge cases

- Recruiter schedules the same candidate twice for the same interview → dedupe by `(candidate, job, interview_number)`.
- Company removes a job with pending interviews → interviews stay; job hidden from search.
- Company classifies "internal" but the source stamp says `external` → the stamp wins after the dispute window; the mismatch counts against the company ([32](32-trust-and-safety.md)).
- Company reports a candidate for proxy interview → trust case; fee stays unless face check confirms mismatch.
- Company registers mid-process → only interviews dated after registration are billable.

## Acceptance criteria

- A verified company posts a job and it appears in search within 60 s.
- An internal interview authorizes exactly $5 and an external one exactly $20; the 4th interview for the same candidate and job authorizes $0.
- A no-show interview never creates a company charge.
- An unregistered company is never charged and sees no fee prompts.
- A failed authorization locks the candidate's next stage until it is paid.
