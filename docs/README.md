# Project Documentation

This folder is the source of truth for **what the product must do** and **how it is built**. Each file covers one service or module and is written so an engineer (or an AI coding agent) can implement that part without reading the whole set.

> **What OpenSeat is now.** OpenSeat is **Jobs · Hire · Scout**, all running on one currency: the interview. Source: the September 2026 investor deck.
>
> - **Jobs** = free job site; **Candidate mode** for job seekers; Premium ($20/mo) unlocks hidden jobs.
> - **Hire** = **Company mode**: ATS plus AI interview assistant, paid **$5** per own-applicant interview and **$20** per OpenSeat-found interview.
> - **Scout** = people who add hidden jobs and career pages; paid on Premium usage and interviews, never per submission.
> - **Bots are banned from applying.** Applications are human-only ([22-no-bot-applications.md](22-no-bot-applications.md)). The earlier **Connect** service (human bidders and AI agent) is retired ([ADR 0002](ADRs/0002-interview-currency-and-no-bot-applications.md)).
>
> Product names are not final; see [99-open-questions.md](99-open-questions.md).

## How to read these docs

| If you are building…                            | Start with                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Anything                                        | [00-product-overview.md](00-product-overview.md), [01-glossary.md](01-glossary.md)       |
| Repo, infra, service boundaries                 | [02-architecture.md](02-architecture.md), [60-api-conventions.md](60-api-conventions.md) |
| Database schema                                 | [03-data-model.md](03-data-model.md)                                                     |
| Login, accounts, verification                   | [10-identity-and-accounts.md](10-identity-and-accounts.md)                               |
| **Candidate mode** (Jobs)                       | [11-jobs-candidate-mode.md](11-jobs-candidate-mode.md)                                   |
| **Company mode** (Hire)                         | [12-hire-company-mode.md](12-hire-company-mode.md)                                       |
| **Scout mode**                                  | [13-scout-mode.md](13-scout-mode.md)                                                     |
| Job ingestion, search, matching                 | [14-job-pool-and-matching.md](14-job-pool-and-matching.md)                               |
| ATS: pipeline, stages, source stamp, stage lock | [20-hire-ats.md](20-hire-ats.md)                                                         |
| AI interview assistant                          | [21-hire-ai-interview-assistant.md](21-hire-ai-interview-assistant.md)                   |
| **Ban on bot applications**                     | [22-no-bot-applications.md](22-no-bot-applications.md)                                   |
| Interview detection, two-sided classification   | [30-interview-tracking.md](30-interview-tracking.md)                                     |
| Fees, credits, Premium, scout payouts           | [31-payments-wallet-escrow.md](31-payments-wallet-escrow.md)                             |
| Reports, fraud, moderation                      | [32-trust-and-safety.md](32-trust-and-safety.md)                                         |
| Messages and notifications                      | [33-messaging-and-notifications.md](33-messaging-and-notifications.md)                   |
| Internal admin tools                            | [40-admin-console.md](40-admin-console.md)                                               |
| Prices, unit economics, five-year plan          | [50-pricing-and-revenue.md](50-pricing-and-revenue.md)                                   |
| Scout API for partners                          | [61-scout-api.md](61-scout-api.md)                                                       |
| What to build next                              | [70-roadmap.md](70-roadmap.md)                                                           |
| Analytics and KPIs                              | [80-metrics-and-analytics.md](80-metrics-and-analytics.md)                               |
| Privacy, legal, security                        | [90-compliance-privacy-security.md](90-compliance-privacy-security.md)                   |
| Undecided items and decisions                   | [99-open-questions.md](99-open-questions.md)                                             |
| Repo conventions and decisions                  | [CONTRIBUTING.md](CONTRIBUTING.md), [CODING_STYLE.md](CODING_STYLE.md), [ADRs/](ADRs/)   |

## Document conventions

- **MUST / SHOULD / MAY** follow RFC 2119 meaning.
- Every module doc has the same sections where relevant: _Purpose, Users, Scope, Business rules, Data, API, Events, Background jobs, UI pages, Edge cases, Acceptance criteria_.
- Money is always stored as **integer cents** with an ISO currency code. Never floats.
- Times are stored in **UTC** (ISO 8601); displayed in the user's time zone.
- IDs are **UUIDv7** (sortable) unless stated otherwise.
- API paths shown as `METHOD /v1/...` are the public REST surface of the API gateway. Internal service calls use the same shapes.
- Numbers marked **(assumption)** must be tested. Prices and projections come from the September 2026 investor deck and are scenarios, not forecasts.

## Current state (September 2026)

- **Jobs is live**: job search for seekers and job posting for companies, with a large aggregated job pool.
- **Scout is built**: Scoutwell, the scout API and the admin review queue exist ([13](13-scout-mode.md), [61](61-scout-api.md)); public opening is months 4–6.
- **Hire launches in month 3** (2-month build): ATS and AI interview assistant, per-interview fees, calendar tracking.
- These docs describe the **target system**. Where an implementation exists, treat it as a reference and migrate it toward this spec.

## Diagrams

Diagrams are Mermaid blocks inside the docs (product flow in [00](00-product-overview.md), interview lifecycle in [03](03-data-model.md) and [30](30-interview-tracking.md), stage lock in [20](20-hire-ats.md), bot policy in [22](22-no-bot-applications.md), trust stack in [32](32-trust-and-safety.md), roadmap in [70](70-roadmap.md)). They render on GitHub, so there are no binary assets to keep in sync.
