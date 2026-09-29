# 62 — Staff company verification and direct-job review

**Service:** `opened-backend` · **App:** `opened-admin`

Staff routes use the same guard as scout admin. When `ADMIN_API_TOKEN` is set, send `Authorization: Bearer <token>`. Every mutation stores the caller from `X-Admin-Actor` (printable, max 80 characters; missing header is recorded as `admin`) on the `admin_audit` collection.

Errors use the scout admin problem shape (`application/problem+json`): `422 validation_failed` with `errors[]`, `401 unauthorized`, `404 not_found`, `409 conflict`.

Lists use offset pages: `?page=&page_size=` (default 25, max 100) and return `{ "data": [], "total": 0, "page": 1, "page_size": 25 }`.

## Company verification

Trust status on the company document: `unclaimed`, `claimed`, `verified`, `suspended`. A new company page created by its owner starts as `claimed` / `claim_status: pending` / `claim_method: manual` and opens a `company_verification` case (SLA 48h).

`verified` is true only when `trust_status` is `verified`. Public company JSON gains an optional `verified` boolean. Older rows with no trust status are `unclaimed`.

```
GET  /v1/admin/companies?status=&q=&page=&page_size=
GET  /v1/admin/companies/{id}
POST /v1/admin/companies/{id}/decision
```

`status` is `unclaimed`, `claimed`, `verified`, or `suspended`. Omit it to list every company.

Decision body:

```json
{
  "decision": "approve",
  "reason": "Work email is on the company domain",
  "claim_method": "domain_email"
}
```

`decision` is `approve`, `reject`, or `suspend`. `reason` is required for reject and suspend. `claim_method` is optional: `domain_email`, `dns_txt`, or `manual`.

| Decision | From                          | Result                                                                                                                                       |
| -------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| approve  | unclaimed, claimed, suspended | `trust_status: verified`, `claim_status: approved`, `claimed: true`. Pending direct jobs become `active`. Suspension takedowns are restored. |
| reject   | unclaimed, claimed            | `trust_status: unclaimed`, `claim_status: rejected`, `claimed: false`.                                                                       |
| suspend  | unclaimed, claimed, verified  | `trust_status: suspended`. Live direct jobs are hidden (`listing_status: removed`) until a later approve.                                    |

Rejecting a verified or suspended company is `409`. Approving a company that is already verified, or suspending one that is already suspended, is idempotent: the side effects run again and the response is the company.

`GET /v1/admin/companies/{id}`:

```json
{
  "id": "9c0e1a55-2b7d-4f3a-9d11-6a4c8e2b7d30",
  "name": "Acme",
  "url": "https://acme.com",
  "verified": true,
  "trust_status": "verified",
  "claimed": true,
  "claim_method": "domain_email",
  "claim_status": "approved",
  "claimed_by": "user id",
  "domains": [{ "name": "acme.com", "verified": true }],
  "note": "Work email is on the company domain",
  "verified_at": "2026-09-29T17:00:00Z",
  "updated_at": "2026-09-29T17:00:00Z",
  "members": [
    {
      "user_id": "user id",
      "name": "Ada",
      "email": "ada@acme.com",
      "role": "owner"
    }
  ],
  "cases": [],
  "audit": [
    {
      "action": "company.verification.approve",
      "subject_type": "company",
      "subject_id": "9c0e1a55-2b7d-4f3a-9d11-6a4c8e2b7d30",
      "actor": "admin console",
      "note": "Work email is on the company domain",
      "at": "2026-09-29T17:00:00Z"
    }
  ]
}
```

List rows are the same company fields without `logo`, `claimed_by`, `note`, `verified_at`, `members`, `cases`, and `audit`. Domain `verified` is true only when the company itself is verified.

## Cases

```
GET  /v1/admin/cases?queue=company_verification&status=open&page=&page_size=
POST /v1/admin/cases
GET  /v1/admin/cases/{id}
POST /v1/admin/cases/{id}/decision
```

`queue` defaults to `company_verification`. `status` is `open` or `decided`.

Open body:

```json
{
  "company_id": "9c0e1a55-2b7d-4f3a-9d11-6a4c8e2b7d30",
  "method": "dns_txt",
  "domains": ["acme.com"],
  "note": "TXT record seen",
  "requested_by": "user id"
}
```

`method` defaults to `manual`. If an open case already exists for that company, the response is `200` and that case. A new case is `201`.

Decision body matches the company decision. It updates the company, closes the open case, and audits both `company.verification.<decision>` and `case.decision.<decision>`.

```json
{
  "id": "66f0c2e5a1b2c3d4e5f60718",
  "queue": "company_verification",
  "status": "open",
  "company_id": "9c0e1a55-2b7d-4f3a-9d11-6a4c8e2b7d30",
  "company_name": "Acme",
  "method": "dns_txt",
  "domains": ["acme.com"],
  "note": "TXT record seen",
  "requested_by": "user id",
  "sla_due_at": "2026-10-01T17:00:00Z",
  "created_at": "2026-09-29T17:00:00Z"
}
```

Empty strings and zero timestamps are omitted. After a decision the case adds `decision`, `reason`, `decided_by`, and `decided_at`.

## Direct jobs in review

Unverified companies still publish from the hiring workspace (`status: open`). The search listing is `pending_review` and is left out of public search and the public company page. Verified companies publish `active`. A staff takedown stays hidden if the employer edits the job, until staff restore it.

The hiring job gains an optional `reviewStatus` (`pending_review`, `active`, `removed`, `draft`). Existing clients that only read `status` are unchanged.

```
GET  /v1/admin/jobs?source=direct&status=pending_review&q=&page=&page_size=
GET  /v1/admin/jobs/{id}
POST /v1/admin/jobs/{id}/review
POST /v1/admin/jobs/{id}/takedown
POST /v1/admin/jobs/{id}/restore
```

`source` must be `direct` (the default). `status` defaults to `pending_review`. Use `active`, `removed`, `draft`, or `all`. `active` includes older direct rows that have no listing status.

Review body:

```json
{ "decision": "approve", "reason": "Company is verified" }
```

```json
{ "decision": "reject", "status": "draft", "reason": "Salary looks fraudulent" }
```

| Call             | From                                      | To                                                                                                                                                          |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| review `approve` | `pending_review`                          | `active` (hiring job `open`)                                                                                                                                |
| review `reject`  | `pending_review`                          | `removed` or `draft` (`status` is required). `draft` returns the hiring job to draft so they can edit and submit again. `removed` stays down until restore. |
| takedown         | `active` (or a legacy row with no status) | `removed`. Body: `{ "reason": "..." }` (required).                                                                                                          |
| restore          | `removed`                                 | the previous status, or `active` when there is none. Body: `{ "reason": "..." }` (optional).                                                                |

```json
{
  "id": "public job id",
  "source": "direct",
  "listing_status": "pending_review",
  "title": "Product designer",
  "company": "Acme",
  "company_id": "9c0e1a55-2b7d-4f3a-9d11-6a4c8e2b7d30",
  "location": "Chicago, IL",
  "workplace": "hybrid",
  "summary": "Shape the product.",
  "reviewed_by": "admin console",
  "reviewed_at": "2026-09-29T17:00:00Z",
  "posted_at": "2026-09-29T17:00:00Z",
  "audit": []
}
```

`audit` is present on `GET /v1/admin/jobs/{id}` only. `takedown_cause` is `staff` or `suspend`.

Audit actions: `company.verification.approve|reject|suspend`, `company.case.opened`, `case.opened`, `case.decision.approve|reject|suspend`, `job.review.approve|reject`, `job.takedown`, `job.restore`.
