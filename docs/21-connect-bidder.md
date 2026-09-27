# 21 — Connect: Human Bidder Mode

**App:** `connect-web` (bidder area) · **Services:** `marketplace`, `identity`, `payments`, `trust`

## Purpose

Give verified human bidders an efficient workspace for **complex** applications (the part the AI agent does badly), with strict quality control and complete audit trails.

## Operating models

The system MUST support both, selectable per bidder (`bidder_profiles.compensation_model`). Which one is primary is an open business decision ([99-open-questions.md](99-open-questions.md)).

| Model                                | Payment                                                                    | Who picks the bidder                      | Phase 1            |
| ------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------- | ------------------ |
| **Managed workforce** (`piece_rate`) | Fixed amount per bid (Phase 1: **$0.05/bid**), paid by the platform        | Platform assigns work from a shared queue | ✅ Used in Phase 1 |
| **Marketplace** (`marketplace`)      | Bidder sets packages (base + per-interview); platform takes a fee by level | Client chooses from profiles              | Planned            |

## Pages

| Page                            | Must do                                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Onboarding**                  | Tier 3 verification, skills test (sample applications graded), tax info, terms, training module on rules (no fabrication, no guessing legal questions).                      |
| **Work queue**                  | Applications assigned to the bidder, sorted by deadline then job closing date. Filters by client, route, status. Claim-next button (managed model).                          |
| **Workspace** (per application) | Left: client rules, profile, resume versions, do-not-apply list, notes, saved answers. Right: job summary, official link, form checklist, bid log controls, evidence upload. |
| **Clients** (marketplace)       | Active clients, engagement terms, messages.                                                                                                                                  |
| **Performance**                 | Apps/day, interviews, interview rate, QA pass rate, "not relevant" rate, level progress.                                                                                     |
| **Earnings**                    | Pending, held, released, paid; per-bid and per-interview breakdown; payout settings.                                                                                         |
| **Profile** (marketplace)       | Specialties, regions, languages, packages, sample (anonymized) work.                                                                                                         |

## Workflow per application

1. **Claim** from queue (lock 30 min; auto-release if idle).
2. **Open** official link (logged).
3. **Fill** the form using the client's data. Use saved answers; unknown required answers → _Ask client_ (status `needs_client_input`).
4. **Upload** the assigned resume version (download from workspace; file carries a hidden watermark/hash).
5. **Submit** (if approval mode allows) or send for approval.
6. **Capture evidence**: confirmation page screenshot and/or confirmation email reference.
7. **Log**: bid log entries are created automatically by the workspace and extension (opened, uploaded, submitted, captured).

## Quality control (validated in Phase 1)

- **Auto resume-upload check:** the extension or confirmation-email parser captures the uploaded file hash/name; must match the assigned `resume_version_id`. Mismatch → `qa_failed`.
- **Bid recording check:** every submitted application must have a complete bid log and evidence. Missing → `qa_failed`.
- **Human QA sampling:** reviewers check a random sample (default 5%, 20% for New level) for correct job, correct answers, no fabrication.
- `qa_failed` items return to the bidder once; second failure → reassigned, counts against the bidder.
- Pay (piece rate) is only earned for `qa_passed` bids.

## Levels, quotas and fees

| Level  | Reach it by                                   | Daily quota (per bidder) | Marketplace fee |
| ------ | --------------------------------------------- | ------------------------ | --------------- |
| New    | Pass onboarding                               | 40                       | 20%             |
| Rising | 10+ confirmed interviews, QA pass ≥ 95%       | 70                       | 17%             |
| Top    | Interview rate top 30%, retention ≥ 60%       | 120                      | 13%             |
| Elite  | Interview rate top 5%, not-relevant rate < 2% | 200                      | 10%             |

Phase 1 benchmark (validated): a human bidder handled **~70 applications/day** and produced **~5 interviews/week** (~1% interview rate on complex jobs).

Levels are recomputed nightly and move both ways. Company "not relevant" feedback and QA failures reduce quota immediately (−10% per event in a rolling 7-day window, floor 50% of level quota).

## Rules (enforced and audited)

- No fabricated experience, employers, dates, degrees, or credentials. Tailoring limited to selecting, ordering, and rephrasing facts present in the client's approved resume.
- No guessing legal/eligibility answers (work authorization, criminal history, age, disability, veteran status).
- No attending interviews, no communicating with employers as the candidate, no accepting offers.
- No sharing client data outside the workspace; no downloading beyond what the task needs.
- One bidder account per person; no account sharing (periodic selfie re-verification).

## API

```
GET    /v1/bidder/queue?status=&client=&cursor=
POST   /v1/bidder/queue/claim-next
POST   /v1/bidder/applications/{id}/claim        POST …/release
GET    /v1/bidder/applications/{id}/workspace
POST   /v1/bidder/applications/{id}/log          {action, payload}
POST   /v1/bidder/applications/{id}/ask-client   {questions[]}
POST   /v1/bidder/applications/{id}/submit       {evidence_keys[], uploaded_resume_sha256}
POST   /v1/bidder/applications/{id}/fail         {reason}
GET    /v1/bidder/performance
GET    /v1/bidder/earnings?cursor=
```

## Events

Emits: `application.claimed`, `application.submitted`, `bidder.level.changed`. Consumes: `application.qa_failed`, `interview.confirmed`, `company.feedback.not_relevant`, `delegation.revoked`.

## Acceptance criteria

- A submission without evidence cannot move past `submitted` and is flagged `qa_failed` by the nightly QA job.
- Uploading a resume whose hash differs from the assigned version sets `resume_check = mismatch`.
- A bidder cannot see or claim work for a client with whom they share a device, IP cluster, or payout account.
- Piece-rate earnings accrue only for `qa_passed` bids.
