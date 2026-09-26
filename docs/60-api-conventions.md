# 60 — API and Event Conventions

## REST

- Base path `/v1`. Breaking changes → `/v2`; additive changes allowed in place.
- JSON, `snake_case` fields, UTF-8. Money: `{ "amount_cents": 400, "currency": "USD" }`. Times: ISO 8601 UTC.
- Auth: `Authorization: Bearer <access_token>`. Mode-scoped endpoints check `user_modes`.
- **Idempotency:** `Idempotency-Key` header required on POSTs that create applications, assignments, charges, payouts, reports. Keys stored 24 h; same key + same body → same response; same key + different body → 409.
- **Pagination:** cursor-based: `?cursor=&limit=` (max 100) → `{ "data": [...], "next_cursor": "…" }`.
- **Filtering/sorting:** explicit query params per endpoint; `sort=-created_at`.
- **Errors:** RFC 9457 problem details:

```json
{
  "type": "https://docs.<domain>/errors/quota_exceeded",
  "title": "Daily quota exceeded",
  "status": 429,
  "code": "quota_exceeded",
  "detail": "Client daily cap of 100 applications reached.",
  "trace_id": "01J…"
}
```

Common codes: `validation_failed` (422), `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409), `quota_exceeded` (429), `verification_required` (403, with `required_tier`), `rate_limited` (429 with `Retry-After`).

- **Rate limits:** per user and per IP; headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
- **OpenAPI:** each service publishes `openapi.yaml`; gateway aggregates; `packages/sdk` generated in CI. Contract tests fail the build on breaking changes.

## Webhooks (inbound)

Stripe, IDV vendor, Google/Microsoft calendar, inbound email. Verify signatures; respond 2xx fast; process asynchronously; dedupe by provider event ID.

## Webhooks (outbound, later: companies/partners)

Signed with HMAC-SHA256 (`X-Signature`, `X-Timestamp`), retries with exponential backoff for 24 h, event types mirror internal events that are safe to expose (`application.received`, `interview.scheduled`).

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
  "data": { }
}
```

- Published via transactional outbox (written in the same DB transaction as the state change).
- Delivery at-least-once; **consumers must be idempotent** (store processed `event.id`).
- Schemas defined with zod in `packages/types/events`; versions are additive; breaking change → new `version`.

### Event catalog (core)

| Event | Producer | Key data |
|---|---|---|
| `user.verified` | identity | user_id, tier |
| `delegation.signed` / `.revoked` | identity | client_user_id, actor |
| `job.published` / `.expired` / `.merged` | jobs | job_id, source, company_id |
| `scout.submission.approved` | jobs | submission_id, job_id, scout_user_id |
| `company.claimed` | jobs | company_id |
| `fit.computed` | matching | client_user_id, job_id, score |
| `route.decided` | matching | job_id, route |
| `assignment.created` | marketplace | assignment_id, engagement_id, count |
| `application.submitted` | marketplace | application_id, actor_type, job_id, client_user_id |
| `application.qa_passed` / `.qa_failed` | marketplace | application_id, reasons |
| `agent.application.prepared` | agent | application_id, payload_id |
| `company.feedback.not_relevant` | jobs | application_id, actor |
| `interview.detected` / `.confirmed` / `.settled` / `.voided` | tracking | interview_id, application_id, job_id, round, source |
| `charge.succeeded` / `payout.released` | payments | amounts, references |
| `report.upheld` / `fraud.flagged` | trust | subject, reason |

## Observability

- Every request and job carries `trace_id` (OpenTelemetry). Logs are structured JSON without raw PII.
- SLO dashboards per service; alerts on error budget burn.
