# 62 — Staff company verification and direct-job review

**Service:** `opened-backend` · **App:** `opened-admin` (Roosebelt)

Staff routes use the same guard as scout admin: `Server.admin()`. When `ADMIN_API_TOKEN` is set, send `Authorization: Bearer <token>`. Every mutation stores the caller from `X-Admin-Actor` (printable, max 80 characters; missing header is recorded as `admin`) on `admin_audit`, with the same BSON field names as scout (`action`, `subjectType`, `subjectId`, `actor`, `note`, `at`). The response `auditId` is that document's hex `_id`. A failed audit insert fails the request.

JSON on these routes is camelCase. Errors use the scout admin problem shape (`application/problem+json`): `422 validation_failed` with `errors[]`, `401`, `404 not_found`, `409 conflict`, `503` when staff review is not configured.

Lists take `page` and `pageSize` (default 25, max 100). `next` is the next page number when `page * pageSize < total`, and is omitted on the last page.

This is the staff surface to scaffold. There is no `/v1/admin/cases` route and no separate restore route.

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
