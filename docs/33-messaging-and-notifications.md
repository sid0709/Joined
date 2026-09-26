# 33 — Messaging and Notifications

**Service:** `notify`

## Messaging

- Threads are always attached to a context: `engagement` (client ↔ bidder), `application` (company ↔ candidate, direct jobs), `case` (user ↔ support/moderation).
- No free-form DMs between strangers. Company ↔ candidate messaging opens when the candidate applies to a direct job.
- Attachments: PDF, DOCX, PNG, JPG ≤ 10 MB, virus-scanned before delivery.
- Safety: scan messages for off-platform payment/contact requests (Telegram, WhatsApp, crypto, "pay for training") → warning banner + trust flag; block sending of links to known scam domains.
- Retention: 2 years after context closes, then deleted (configurable per law).

## Notifications

| Type | Default channels | Timing |
|---|---|---|
| Client: question waiting | push, email | immediate |
| Client: AI submits waiting | push | after 12 h |
| Client: interview detected — confirm | push, email | after event end + 1 h |
| Client: weekly summary | email | Monday |
| Company: new applicants | email digest | daily |
| Company: interview tomorrow | email | 24 h before |
| Company: spend cap 80% / 100% | email | on threshold |
| Bidder: new work / QA failed | push | immediate |
| Scout: submission decision | in-app, email | immediate |
| Everyone: payout sent | email | on payout |
| Everyone: report about you | email | immediate |

- Users control channels per type (except security and legal notices).
- Quiet hours respected per user time zone for push.
- Templates are versioned and localized; every send logged in `notifications` with provider message ID.

## API

```
GET   /v1/threads?context_type=&context_id=
GET   /v1/threads/{id}/messages?cursor=
POST  /v1/threads/{id}/messages        {body, attachment_keys[]}
GET   /v1/notifications?cursor=        POST /v1/notifications/read {ids[]}
GET   /v1/me/notification-preferences  PUT /v1/me/notification-preferences
```

Real-time: WebSocket or SSE channel `/v1/stream` for new messages and notification counts.

## Acceptance criteria

- A message containing a Telegram handle and a payment request is delivered with a warning banner and creates a trust flag.
- Turning off email for "weekly summary" stops it from the next cycle.
