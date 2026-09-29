# 02 — System Architecture

## Goals

- Three products (**Jobs**, **Hire**, **Scout**) on one account system, deployed as separate apps so a failure in one cannot take down the job site.
- Shared domain services (identity, jobs, tracking, payments, trust) owned in one place.
- Event-driven side effects: one business event ("interview confirmed") triggers billing, payouts, rewards, and notifications independently.
- Money and identity data isolated with stricter access than everything else.

## Recommended stack (default for new code)

Adapt to the existing job site's stack where it already exists. If there is no strong reason otherwise, use:

| Layer                 | Choice                                                                                        | Notes                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Language              | TypeScript (Node 22) for web + API; Python 3.12 allowed for AI interview assistant workers    | Shared types via `packages/types`                                           |
| Monorepo              | pnpm workspaces + Turborepo                                                                   | Build/test only what changed                                                |
| Web apps              | Next.js (App Router), React, Tailwind                                                         | SSR for SEO pages on the job platform                                       |
| API                   | NestJS or Fastify, REST + OpenAPI 3.1                                                         | See [60-api-conventions.md](60-api-conventions.md)                          |
| Database              | PostgreSQL 16                                                                                 | One logical DB per service (separate schemas at minimum)                    |
| ORM / migrations      | Drizzle or Prisma                                                                             | Migrations are code-reviewed, forward-only                                  |
| Cache / rate limits   | Redis                                                                                         | Sessions, quotas, idempotency keys                                          |
| Queues                | BullMQ on Redis                                                                               | Background jobs, retries, schedules                                         |
| Events                | Transactional outbox in Postgres → publisher → BullMQ topics (upgrade to NATS/Kafka at scale) | At-least-once; consumers are idempotent                                     |
| Search                | OpenSearch or Meilisearch                                                                     | Job search, facets, geo                                                     |
| Object storage        | S3-compatible                                                                                 | Resumes, evidence, exports; server-side encryption                          |
| Speech-to-text        | Provider-agnostic interface                                                                   | AI interview assistant transcripts                                          |
| LLM                   | Provider-agnostic interface                                                                   | Interview analysis, HR notes, resume parsing                                |
| Payments              | Stripe (Billing, Connect for payouts)                                                         | Ledger is ours; Stripe is the rail                                          |
| Identity verification | Usage-based vendor (Stripe Identity / Persona / Sumsub)                                       | Store vendor reference, not raw documents                                   |
| Email                 | Transactional provider with inbound parse (SES / Postmark)                                    | Also used for interview email forwarding                                    |
| Calendar              | Google Calendar API, Microsoft Graph                                                          | Required for every user; read scope, write only for scheduling with consent |
| Auth                  | OIDC-based (self-hosted or managed), passkeys + email OTP                                     | Short-lived JWT access tokens                                               |
| Observability         | OpenTelemetry, structured JSON logs, Sentry                                                   | Trace ID on every request and job                                           |
| Infra                 | Containers on Kubernetes or ECS; Terraform                                                    | Separate prod/staging/dev accounts                                          |

## Repository layout

```
repo/
├── apps/
│   ├── jobs-web/            # Jobs: candidate mode + public SEO pages (today: opened-frontend)
│   ├── hire-web/            # Hire: company mode, ATS, AI interview notes
│   ├── scout-web/           # Scout mode (today: scoutwell-frontend)
│   ├── admin-web/           # Internal admin console (today: opened-admin)
│   └── api-gateway/         # Public REST gateway: auth, routing, rate limits
├── services/
│   ├── identity/            # accounts, roles, verification, risk, bot detection
│   ├── jobs/                # job pool, ingestion, scout submissions, quality checks, search indexing
│   ├── matching/            # fit scoring and recommendations for candidates
│   ├── ats/                 # applications, source stamps, pipelines, stages, scorecards, offers, career pages
│   ├── assistant/           # AI interview assistant: recordings, transcripts, analysis, HR notes (may be Python)
│   ├── tracking/            # calendar/email ingestion, interview detection, classification, scheduling
│   ├── payments/            # ledger, wallet, escrow, billing, payouts (restricted)
│   ├── trust/               # reports, fraud rules, moderation, link analysis
│   └── notify/              # email, push, in-app notifications, messaging
├── packages/
│   ├── types/               # shared domain types and event schemas (zod)
│   ├── ui/                  # design system components
│   ├── sdk/                 # typed API client generated from OpenAPI
│   └── config/              # lint, tsconfig, env schema
├── infra/                   # Terraform, Helm/manifests, CI pipelines
└── docs/                    # this folder
```

### Boundary rules

- A service **owns its tables**. Other services never read them directly; they call the owning service's API or consume its events.
- Apps talk only to `api-gateway`. Services talk to each other over internal HTTP or events.
- `payments` and `identity` have restricted code ownership (CODEOWNERS) and separate database credentials.
- Enforce import boundaries with lint rules (e.g. `eslint-plugin-boundaries`).

## Service responsibilities

| Service   | Owns                                                                     | Emits (examples)                                                                                                         | Consumes (examples)                                                                 |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| identity  | users, roles, sessions, verification, risk scores, automation signals    | `user.created`, `user.verified`, `risk.changed`, `automation.detected`                                                   | `report.upheld`                                                                     |
| jobs      | jobs, companies, scout submissions, hidden-job status, claims            | `job.published`, `job.expired`, `job.hidden_ended`, `scout.submission.approved`, `company.claimed`, `company.registered` | `interview.confirmed` (job stats)                                                   |
| matching  | fit scores, recommendations                                              | `fit.computed`                                                                                                           | `job.published`, `profile.updated`                                                  |
| ats       | applications, source stamps, pipelines, stages, scorecards, offers       | `application.submitted`, `application.stage_changed`, `offer.accepted`                                                   | `interview.fee_authorized`, `interview.settled`, `automation.detected`              |
| assistant | recordings, transcripts, analyses, HR notes                              | `assistant.notes.ready`                                                                                                  | `interview.confirmed`                                                               |
| tracking  | calendar/email connections, interview events, classifications, schedules | `interview.detected`, `interview.classified`, `interview.confirmed`, `interview.disputed`, `interview.settled`           | `application.submitted`                                                             |
| payments  | ledger, wallets, credits, subscriptions, invoices, payouts, prices       | `interview.fee_authorized`, `charge.succeeded`, `payout.released`                                                        | `interview.confirmed`, `interview.settled`, `dispute.resolved`, `subscription.paid` |
| trust     | reports, fraud flags, moderation cases, link graph                       | `report.upheld`, `fraud.flagged`, `account.suspended`                                                                    | nearly everything (for rules)                                                       |
| notify    | notification preferences, message threads, delivery logs                 | `notification.sent`                                                                                                      | nearly everything                                                                   |

## Key flows

### Interview confirmed → money moves

```mermaid
sequenceDiagram
  participant T as tracking
  participant O as outbox/event bus
  participant P as payments
  participant A as ats
  participant X as assistant
  participant J as jobs
  participant N as notify
  T->>O: interview.confirmed {interviewId, candidateId, companyId, jobId, applicationId, number, classification}
  O->>P: authorize company fee ($5 internal / $20 external, numbers 1–3, registered companies only)
  O->>P: consume seeker credit or accrue $2 fee (internal only)
  O->>P: accrue $1 scout bonus (held; external, first interview, scouted job)
  P->>O: interview.fee_authorized (or fee_failed)
  O->>A: unlock next stage (or keep stage lock)
  O->>X: attach transcript and HR notes
  O->>J: update job and company-page interview counts
  O->>N: notify candidate, company, scout
  Note over P: after the interview date passes with no dispute → interview.settled → capture fees, release payouts
```

## Non-functional requirements

| Area                  | Requirement                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Availability          | Jobs web and job search 99.9%. Hire (ATS) 99.9%. AI assistant 99.5%. Payments writes 99.9%.                                  |
| Latency               | Job search p95 < 400 ms. Page TTFB p95 < 800 ms (SSR). API p95 < 300 ms for reads.                                           |
| Scale (year 1 target) | 1M jobs in pool, 200k monthly active candidates, 3k Premium seekers, 50 paying companies, ~6.4k interviews/year (base plan). |
| Idempotency           | All POSTs that create money or applications require `Idempotency-Key`. Event consumers dedupe by event ID.                   |
| Bot resistance        | Apply endpoints accept only first-party, human-session requests; no public apply API ([22](22-no-bot-applications.md)).      |
| Data durability       | Point-in-time recovery for Postgres (≥ 14 days). Ledger is append-only.                                                      |
| Security              | See [90-compliance-privacy-security.md](90-compliance-privacy-security.md).                                                  |
| Accessibility         | WCAG 2.2 AA for all user-facing pages.                                                                                       |
| i18n                  | All user-facing strings externalized; currency and time zone per user.                                                       |

## Environments

`dev` (per-developer, seeded data), `staging` (production-like, fake payments, test IDV), `prod`. Feature flags control rollout of every new mode or pricing change.
