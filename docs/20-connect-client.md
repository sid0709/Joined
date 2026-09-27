# 20 — Connect: Client Mode

**App:** `connect-web` · **Services:** `marketplace`, `matching`, `agent`, `tracking`, `payments`, `notify`

## Purpose

Let a job hunter hand off the work of finding and applying to jobs, stay in control of what goes out in their name, and see exactly what happened to every application and interview.

## Pages

| Page                 | Must do                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**        | This week: applications sent, interviews confirmed, pending approvals, pending submits (AI), questions waiting for the client. Progress bar per active assignment ("47 / 80 applied").  |
| **Jobs**             | Live feed from the job pool filtered by the client's preferences, with fit score, route badge (AI / Human), tags (Already applied, Assigned, Closing soon, Hidden job). Bulk selection. |
| **Assignments**      | List of assignments with status, provider, deadline, counts. Detail view per assignment.                                                                                                |
| **Tracker**          | Kanban of all applications: Queued → In progress → Awaiting you → Submitted → Interview → Offer / Rejected / No response.                                                               |
| **Submit queue**     | AI-prepared applications waiting for the client's submit click (see [22-ai-agent.md](22-ai-agent.md#submit-handoff)).                                                                   |
| **Interviews**       | Detected interviews to confirm, upcoming interviews, prep notes.                                                                                                                        |
| **Providers**        | Browse/select human bidders (profiles, levels, published interview rate, reviews) and the AI agent tiers.                                                                               |
| **Messages**         | Threads with bidders; screening questions routed to the client.                                                                                                                         |
| **Billing**          | Plan, per-interview charges, escrow balance, invoices, payment method.                                                                                                                  |
| **Settings / Rules** | Target roles, locations, salary floor, do-not-apply companies, default resume, approval mode, weekly target, connected calendar/email (required for per-interview plans).               |

## Onboarding (client activation)

1. Tier 2 verification (ID + liveness).
2. Profile + at least one resume version.
3. Rules: target roles, locations/remote, salary floor, exclusions, weekly target.
4. Connect calendar (default) and/or email forwarding — **required** for per-interview billing.
5. Choose plan and provider (AI, Human, or both; see [50-pricing-and-revenue.md](50-pricing-and-revenue.md)).
6. Sign delegation agreement; add payment method; fund escrow if plan requires.
7. Install browser extension (needed for AI submit handoff).

## Selecting and assigning jobs

Three methods (all produce an `assignment` with `assignment_items → applications`):

| Method          | UX                                                                                                                  | Default? |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| **Rules-based** | Client sets rules + weekly target (e.g. 80/week, fit ≥ 70). System fills the assignment continuously from the feed. | **Yes**  |
| **Top-N**       | Client types N; the top N by fit (after hard filters) are pre-selected; client unchecks any; clicks _Assign_.       |          |
| **Shortlist**   | Client adds jobs to a queue while browsing ("62 / 80"); sends as a batch or daily.                                  |          |

### Assignment panel (on _Assign_)

- Provider: AI agent / specific bidder / **Auto** (router decides per job: bulk → agent, complex → human bidder)
- Deadline
- Resume version, and "allow tailoring" toggle (tailored versions still need client approval before first use)
- Approval mode: `approve_each` or `auto_within_rules`
- Notes: general + per-job
- Cost preview and escrow amount (if applicable)

### Validation at assignment

- Remove jobs already applied/assigned for this client (idempotent on `(client, job)`).
- Remove jobs with policy `direct_only` or expired.
- Enforce client daily cap (default 100 applications/day across all providers) and per-company cap (default 3 roles per company per 30 days) to avoid looking spammy.
- Respect bidder/agent quotas; overflow is queued, not dropped.

## Approvals and questions

- `approve_each`: each prepared application appears in _Awaiting you_ with job, fit reasons, resume version, answers, and cover letter if any. Approve / Edit / Skip.
- Screening questions the provider cannot answer from the profile (salary expectation, availability, legal attestations, custom questions) are routed to the client (`needs_client_input`). Answers can be saved as reusable defaults.
- The provider **must not** guess answers to legal or eligibility questions.

## Tracker statuses (client-facing mapping)

| Internal status                                                        | Client sees                  |
| ---------------------------------------------------------------------- | ---------------------------- |
| queued                                                                 | Queued                       |
| preparing                                                              | In progress                  |
| awaiting_client_approval, needs_client_input, awaiting_client_submit   | Awaiting you                 |
| submitted, qa_passed                                                   | Submitted                    |
| qa_failed                                                              | Needs fix (provider re-does) |
| interviewing                                                           | Interview                    |
| offer / rejected_by_company / no_response / expired / skipped / failed | Final states                 |

## Replacements

If a job expires or fails before submission, the system offers a replacement from the feed with similar fit so the assignment target still holds (automatic in rules-based mode).

## API

```
GET    /v1/connect/feed?min_fit=&route=&q=&cursor=
POST   /v1/connect/engagements                 {provider_type, bidder_user_id?, plan_code, approval_mode, rules}
PATCH  /v1/connect/engagements/{id}            {rules, approval_mode, status}
POST   /v1/connect/assignments                 {engagement_id, method, job_ids?[], top_n?, deadline_at, resume_version_id, allow_tailoring, notes, per_job_notes{}}
GET    /v1/connect/assignments/{id}
POST   /v1/connect/shortlist/{jobId}           DELETE /v1/connect/shortlist/{jobId}
POST   /v1/connect/shortlist/send              {engagement_id}
GET    /v1/connect/applications?status=&cursor=
POST   /v1/connect/applications/{id}/approve   {edits?}
POST   /v1/connect/applications/{id}/skip      {reason}
POST   /v1/connect/applications/{id}/answers   {answers[]}
GET    /v1/connect/submit-queue
GET    /v1/connect/dashboard
```

## Events

Emits: `engagement.created`, `assignment.created`, `application.approved`, `application.skipped`, `client.answer.provided`, `client.preferences.updated`. Consumes: `agent.application.prepared`, `application.submitted`, `interview.detected`, `job.expired`.

## Notifications (defaults)

Daily digest; immediate for: questions waiting, AI submits waiting > 12 h, interview detected, interview tomorrow.

## Edge cases

- Client pauses engagement → no new work starts; in-progress items finish or return to queue.
- Client disconnects calendar on a per-interview plan → warning, 72 h grace, then assignments pause.
- Client tries to assign 500 jobs on AI Basic (100/month) → cap shown before assign; excess requires plan upgrade.
- Job on the client's do-not-apply list slips into a manual selection → blocked at validation.

## Acceptance criteria

- Top-N with N = 80 selects the 80 highest-fit eligible jobs in < 2 s.
- No client can end up with two applications to the same job.
- In `approve_each`, nothing is submitted without an approval record.
- Every application in the tracker links to its bid log and evidence.
