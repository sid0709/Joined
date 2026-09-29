# 60 — API and Event Conventions

## REST

- Base path `/v1`. Breaking changes → `/v2`; additive changes allowed in place.
- JSON, `snake_case` fields, UTF-8. Money: `{ "amount_cents": 400, "currency": "USD" }`. Times: ISO 8601 UTC.
- Auth: `Authorization: Bearer <access_token>`. Role-scoped endpoints check `users.role`. An account has one role.
- **No application-submission API.** Applications are accepted only from first-party human web sessions ([22](22-no-bot-applications.md)). Scout API keys can only create submissions and read scout data ([61](61-scout-api.md)).
- **Idempotency:** `Idempotency-Key` header required on POSTs that create applications, charges, payouts, reports, scout submissions. Keys stored 24 h; same key + same body → same response; same key + different body → 409.
- **Pagination:** cursor-based: `?cursor=&limit=` (max 100) → `{ "data": [...], "next_cursor": "…" }`.
- **Filtering/sorting:** explicit query params per endpoint; `sort=-created_at`.
- **Errors:** RFC 9457 problem details:

```json
{
  "type": "https://docs.<domain>/errors/quota_exceeded",
  "title": "Daily submission limit exceeded",
  "status": 429,
  "code": "quota_exceeded",
  "detail": "Daily scout submission limit of 50 reached.",
  "trace_id": "01J…"
}
```

Common codes: `validation_failed` (422), `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409), `quota_exceeded` (429), `verification_required` (403, with `required_tier`), `rate_limited` (429 with `Retry-After`), `human_required` (403), `automation_detected` (403), `stage_locked` (409).

- **Rate limits:** per user and per IP; headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
- **OpenAPI:** each service publishes `openapi.yaml`; gateway aggregates; `packages/sdk` generated in CI. Contract tests fail the build on breaking changes.

## Webhooks (inbound)

Stripe, IDV vendor, Google/Microsoft calendar, inbound email. Verify signatures; respond 2xx fast; process asynchronously; dedupe by provider event ID.

## Webhooks (outbound, later: companies/partners)

Signed with HMAC-SHA256 (`X-Signature`, `X-Timestamp`), retries with exponential backoff for 24 h, event types mirror internal events that are safe to expose (`application.received`, `interview.scheduled`, `interview.confirmed`).

## Events

Envelope (all events):

```json
{
  "id": "evt_01J…",
  "type": "interview.confirmed",
  "version": 1,
  "occurred_at": "2026-09-26T18:00:00Z",
  "producer": "tracking",
  "trace_id": "…",
  "data": {}
}
```

- Published via transactional outbox (written in the same DB transaction as the state change).
- Delivery at-least-once; **consumers must be idempotent** (store processed `event.id`).
- Schemas defined with zod in `packages/types/events`; versions are additive; breaking change → new `version`.

### Event catalog (core)

| Event                                                                        | Producer  | Key data                                                              |
| ---------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| `user.verified`                                                              | identity  | user_id, tier                                                         |
| `automation.detected`                                                        | identity  | user_id, surface, action                                              |
| `job.published` / `.expired` / `.merged` / `.hidden_ended`                   | jobs      | job_id, source, company_id                                            |
| `scout.submission.approved`                                                  | jobs      | submission_id, job_id, scout_user_id                                  |
| `company.claimed` / `company.registered`                                     | jobs      | company_id                                                            |
| `fit.computed`                                                               | matching  | candidate_user_id, job_id, score                                      |
| `application.submitted`                                                      | ats       | application_id, job_id, candidate_user_id, source (internal/external) |
| `application.stage_changed` / `.stage_locked` / `.stage_unlocked`            | ats       | application_id, stage_id                                              |
| `interview.detected` / `.classified` / `.confirmed` / `.settled` / `.voided` | tracking  | interview_id, application_id, job_id, number, classification          |
| `interview.fee_authorized` / `.fee_failed`                                   | payments  | interview_id, amount, payer                                           |
| `assistant.notes.ready`                                                      | assistant | interview_id, notes_id                                                |
| `subscription.paid`                                                          | payments  | user_id, amount                                                       |
| `charge.succeeded` / `payout.released`                                       | payments  | amounts, references                                                   |
| `report.upheld` / `fraud.flagged`                                            | trust     | subject, reason                                                       |

## Observability

- Every request and job carries `trace_id` (OpenTelemetry). Logs are structured JSON without raw PII.
- SLO dashboards per service; alerts on error budget burn.
