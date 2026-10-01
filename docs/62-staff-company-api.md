# 62 — Staff company verification and direct-job review

**Service:** `admin-backend` · **App:** `admin-frontend` (Roosebelt)

Every `admin-backend` route but `/health` sits behind one guard, `Server.admin()`. When `ADMIN_API_TOKEN` is set, send `Authorization: Bearer <token>`. Every mutation stores the caller from `X-Admin-Actor` (printable, max 80 characters; missing header is recorded as `admin`) on `admin_audit`, with the same BSON field names as scout (`action`, `subjectType`, `subjectId`, `actor`, `note`, `at`). The response `auditId` is that document's hex `_id`. A failed audit insert fails the request.

JSON on these routes is camelCase. Errors use the scout admin problem shape (`application/problem+json`): `422 validation_failed` with `errors[]`, `401`, `404 not_found`, `409 conflict`, `503` when staff review is not configured.

Lists take `page` and `pageSize` (default 25, max 100). `next` is the next page number when `page * pageSize < total`, and is omitted on the last page.

Company verification and direct-job review are below. Cases and reports follow them. There is no separate restore route. Legal retention holds are not a staff route.

## Company verification

`verificationStatus` on the company document is `unclaimed`, `pending`, `approved`, `rejected`, or `suspended`. A missing value is `unclaimed` (scout-created companies, `claimed: false`). A company page created by its owner starts as `pending`, `claimed: true`, `claimMethod: manual`, and opens a `company_verifications` row (SLA 48 hours from `createdAt`).

Public company JSON `verified` is true only when `verificationStatus` is `approved`.

```
GET  /v1/admin/companies/verifications?status=pending|approved|rejected|suspended&page=&pageSize=
GET  /v1/admin/companies/verifications/pending-count
GET  /v1/admin/companies/{id}
POST /v1/admin/companies/{id}/verify
```

`status` filters the queue. Omit it to list every verification record.

List response:

```json
{
  "data": [
    {
      "id": "674c1f0e5b2a4e18d0a1c001",
      "companyId": "co_123",
      "companyName": "Northwind",
      "claimMethod": "manual",
      "requestedBy": "user_123",
      "domains": ["northwind.example"],
      "memberCount": 2,
      "status": "pending",
      "createdAt": "2026-09-29T17:00:00Z",
      "slaAt": "2026-10-01T17:00:00Z"
    }
  ],
  "total": 1,
  "next": 2
}
```

`id` is the verification record. `slaAt` is omitted when it was not set. `domains` is always an array.

Pending count:

```json
{ "pending": 3 }
```

Company detail:

```json
{
  "id": "co_123",
  "companyName": "Northwind",
  "companyUrl": "https://northwind.example",
  "domains": ["northwind.example"],
  "members": [
    {
      "userId": "user_123",
      "name": "Ada Lovelace",
      "email": "ada@northwind.example",
      "role": "owner",
      "hiringRole": "owner"
    }
  ],
  "claimMethod": "manual",
  "claimed": true,
  "verificationStatus": "pending",
  "pendingClaim": {
    "id": "674c1f0e5b2a4e18d0a1c001",
    "claimMethod": "manual",
    "requestedBy": "user_123",
    "domains": ["northwind.example"],
    "status": "pending",
    "createdAt": "2026-09-29T17:00:00Z",
    "slaAt": "2026-10-01T17:00:00Z"
  },
  "verifiedAt": "2026-09-29T18:00:00Z",
  "suspendedAt": "2026-09-29T19:00:00Z",
  "audit": [
    {
      "action": "company.verify.approve",
      "subjectType": "company",
      "subjectId": "co_123",
      "actor": "roosebelt",
      "note": "Work email is on the company domain",
      "at": "2026-09-29T18:00:00Z"
    }
  ]
}
```

`pendingClaim` is present only while `verificationStatus` is `pending`. `verifiedAt`, `suspendedAt`, `companyUrl`, and `audit` are omitted when empty. `claimMethod` is `domain_email`, `dns_txt`, or `manual`.

Verify body. `reason` is required for approve, reject, and suspend.

```json
{ "decision": "approve", "reason": "Work email is on the company domain" }
```

`decision` is `approve`, `reject`, or `suspend`.

| Decision | From                                    | Result                                                                            |
| -------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| approve  | unclaimed, pending, rejected, suspended | `verificationStatus: approved`, `verifiedAt` set, `claimed: true`                 |
| reject   | unclaimed, pending                      | `verificationStatus: rejected`. Already approved, rejected, or suspended is `409` |
| suspend  | unclaimed, pending, approved, rejected  | `verificationStatus: suspended`, `suspendedAt` set. Already suspended is `409`    |

Approving a company that is already approved is `409`. Verify does not publish or hide jobs.

Response:

```json
{
  "company": {},
  "auditId": "674c1f0e5b2a4e18d0a1c0aa"
}
```

`company` is the detail shape above.

## Direct-job pending review

Hiring jobs live on `company_jobs`. Status is `open`, `paused`, `draft`, `closed`, `pending_review`, or `removed`. Employers can set `open`, `paused`, `draft`, `closed`, or `pending_review`. `removed` is staff-only; an employer edit or status change of a removed job is `409`.

An employer request to publish (`open`) calls `UpsertDirectJob` only when `verificationStatus` is `approved`, and the hiring status stays `open`. Otherwise the hiring status becomes `pending_review` and `RemoveDirectJob` drops any public row. Staff approve publishes even when the company is not approved.

```
GET  /v1/admin/jobs?source=direct&status=pending_review&page=&pageSize=
POST /v1/admin/jobs/{id}/review
POST /v1/admin/jobs/{id}/takedown
```

`source` other than `direct` returns an empty list. Omit `status` to list every hiring job.

List response:

```json
{
  "jobs": [
    {
      "id": "job_123",
      "title": "Product Engineer",
      "companyId": "co_123",
      "companyName": "Northwind",
      "source": "direct",
      "status": "pending_review",
      "postedAt": "2026-09-29T17:00:00Z",
      "createdAt": "2026-09-29T16:00:00Z",
      "location": "Chicago, IL"
    }
  ],
  "total": 1,
  "next": 2
}
```

`postedAt` and `location` are omitted when empty.

Review body. `reason` is optional. `rejectDisposition` is optional and defaults to `removed`.

```json
{ "decision": "reject", "reason": "Duplicate of an open role", "rejectDisposition": "draft" }
```

| Decision | From                    | Result                                                                |
| -------- | ----------------------- | --------------------------------------------------------------------- |
| approve  | pending_review, removed | status `open`, `UpsertDirectJob`. Approving `removed` is the restore. |
| reject   | pending_review          | status `removed` or `draft` (`rejectDisposition`), `RemoveDirectJob`  |

Any other status is `409`.

Takedown body. `reason` is required.

```json
{ "reason": "Listing does not match the company" }
```

Takedown from `open` or `pending_review` sets status `removed`, calls `RemoveDirectJob`, and writes an audit row. Other statuses are `409`. A later review `approve` sets the job back to `open` and calls `UpsertDirectJob`.

Review and takedown both respond:

```json
{
  "job": {
    "id": "job_123",
    "title": "Product Engineer",
    "companyId": "co_123",
    "companyName": "Northwind",
    "source": "direct",
    "status": "open",
    "postedAt": "2026-09-29T18:00:00Z",
    "createdAt": "2026-09-29T16:00:00Z",
    "location": "Chicago, IL"
  },
  "auditId": "674c1f0e5b2a4e18d0a1c0bb"
}
```

## Cases and reports

Staff trust cases are the moderation queues the admin console already calls. JSON is camelCase, the same as the other staff routes. docs/32 writes these fields in snake_case; that document is the product contract, and this section is the wire the admin app uses.

Auth is the staff guard above. Mutations write `admin_audit` and return `auditId`. Lists use `page` and `pageSize`. `next` is omitted on the last page.

Queues are `reports`, `disputes`, and `fraud_flags`. Status values the console sends are `open`, `pending`, and `resolved`. A list filter uses whatever string was sent. An empty queue or status lists every value. There is no get-by-id. The console keeps the list row and posts the decision.

`reasonCode` is only `no_show`, `identity_mismatch`, `proxy_interviewer`, `fake_credentials`, `abusive_behavior`, `scam_job`, `fake_company`, `fabricated_application`, `payment_request`, or `other_with_evidence`. `not_a_good_fit` is `422`.

SLA is set on create: 48 hours for reports and fraud flags, 5 business days for disputes. Decision is `uphold` or `dismiss` for every queue, including disputes. Interview settlement (`settled` / `voided`) is not this route.

Reporter weight, link analysis, the enforcement ladder, and domain events are not part of this slice. `GET /v1/me/reports` is the subject's own list in docs/32 and is not a staff route. Staff list filed reports with `GET /v1/reports`.

```
GET  /v1/admin/cases?queue=reports|disputes|fraud_flags&status=&page=&pageSize=
POST /v1/admin/cases
POST /v1/admin/cases/{id}/decision
GET  /v1/reports?status=&page=&pageSize=
POST /v1/reports
POST /v1/reports/{id}/appeal
```

`POST /v1/reports` requires `Idempotency-Key` (1 to 255 characters). The same actor, key, and raw body replays the first response for 24 hours and sets `Idempotent-Replayed: true`. The same key with a different body is `409 idempotency_key_reused`.

Open a case:

```json
{
  "queue": "disputes",
  "reasonCode": "no_show",
  "subjectType": "interview",
  "subjectId": "iv_1",
  "details": "Candidate did not attend",
  "evidenceKeys": []
}
```

`201` response:

```json
{
  "case": {
    "id": "674c1f0e5b2a4e18d0a1c010",
    "queue": "disputes",
    "status": "open",
    "reasonCode": "no_show",
    "subjectType": "interview",
    "subjectId": "iv_1",
    "details": "Candidate did not attend",
    "evidenceKeys": [],
    "createdAt": "2026-09-29T17:00:00Z",
    "slaAt": "2026-10-06T17:00:00Z",
    "decision": ""
  },
  "auditId": "674c1f0e5b2a4e18d0a1c0aa"
}
```

List. `cases` holds the same case object. `next` is present only when another page exists.

```json
{
  "cases": [],
  "total": 0
}
```

`cases` is always an array. `evidenceKeys` is always an array. `decision` is an empty string until a decision is stored. `slaAt` is always set.

Decision body. `reason` is required. `actions` is optional and omitted when empty. Action codes are not a fixed set.

```json
{ "decision": "uphold", "reason": "Screenshot matches", "actions": ["warning"] }
```

`200` response is `{ "case": {}, "auditId": "" }`. The case `status` is `resolved`. `decidedBy` is the `X-Admin-Actor` value, `decisionReason` is the reason, and `decisionEvidenceKeys` is a copy of `evidenceKeys` at decision time. A resolved case is `409`. An unknown id is `404`.

File a report. This also opens a `reports` case. `details` may be empty.

```json
{
  "subjectType": "job",
  "subjectId": "job_1",
  "reasonCode": "scam_job",
  "details": "Asks for a fee",
  "evidenceKeys": ["shot"]
}
```

`201` response:

```json
{
  "report": {
    "id": "674c1f0e5b2a4e18d0a1c020",
    "subjectType": "job",
    "subjectId": "job_1",
    "reasonCode": "scam_job",
    "details": "Asks for a fee",
    "evidenceKeys": ["shot"],
    "status": "open",
    "caseId": "674c1f0e5b2a4e18d0a1c010",
    "createdAt": "2026-09-29T17:00:00Z"
  },
  "auditId": "674c1f0e5b2a4e18d0a1c0bb"
}
```

Staff report list. `reports` holds the same report object.

```json
{
  "reports": [],
  "total": 0
}
```

Appeal within 7 days of `createdAt`. The report and its case become `pending`. The statement is appended to the case `details` so the console's list row shows it. Appeal evidence keys are added to the case. A second appeal, a resolved report, or a late appeal is `409`.

```json
{ "statement": "It was a real job", "evidenceKeys": ["note"] }
```

`200` response is `{ "report": {}, "auditId": "" }`. `report.appeal` is `{ "statement", "evidenceKeys", "at" }`. Deciding the linked case sets the report `status` to `resolved` and `resolution` to `uphold` or `dismiss`.

Audit actions are `case.open`, `case.decision.uphold`, `case.decision.dismiss`, `report.file`, and `report.appeal`. `subjectType` is `case` or `report`.
