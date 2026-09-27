# 80 — Metrics and Analytics

## North star

**Confirmed interviews per 100 applications** — overall and by channel (agent vs human), niche, seniority, source (direct/aggregated/scouted).

## KPI tree

| Area     | Metric                                | Definition                                                         | Target (initial)                              |
| -------- | ------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| Outcome  | Interview rate                        | confirmed interview events ÷ submitted applications                | Human ≥ 1.0%, Agent ≥ 0.5% (Phase 1 baseline) |
| Outcome  | Interviews per client per week        | confirmed interviews ÷ active clients                              | ≥ 5                                           |
| Client   | 3-month retention                     | clients active at day 90 ÷ clients started                         | ≥ 50%                                         |
| Client   | Tracking connected                    | clients with calendar or email forwarding                          | ≥ 95% on per-interview plans                  |
| Quality  | Not-relevant rate                     | "not relevant" ÷ assisted applications on direct jobs              | ≤ 3%                                          |
| Quality  | QA pass rate                          | qa_passed ÷ submitted                                              | ≥ 97%                                         |
| Quality  | Fabrication flags                     | flagged payloads ÷ prepared                                        | trending down                                 |
| Agent    | Prep success rate                     | prepared ÷ attempted, by adapter                                   | ≥ 90%                                         |
| Agent    | Client submit latency                 | prepared → submitted median                                        | ≤ 24 h                                        |
| Cost     | Cost per interview                    | (labor + compute + IDV + payment fees + QA) ÷ confirmed interviews | ≤ $5                                          |
| Supply   | Scouted jobs with ≥ 1 interview       | within 30 days of approval                                         | ≥ 10%                                         |
| Company  | Claim rate                            | claimed ÷ auto-generated pages contacted                           | measure                                       |
| Company  | Paid interviews per company per month |                                                                    | measure                                       |
| Trust    | Upheld fraud rate                     | upheld fraud cases ÷ active accounts                               | trending down                                 |
| Tracking | Detection precision / recall          | vs. audited sample                                                 | ≥ 95% / ≥ 85%                                 |

## Event tracking

- Product analytics events from web apps (page views, key actions) with `user_id`, `mode`, `session_id`; no raw PII in properties.
- Business metrics computed from the **domain events** (outbox stream) into a warehouse (e.g. BigQuery/Snowflake/Postgres replica), not from client-side analytics.
- dbt models: `fct_applications`, `fct_interviews`, `fct_ledger`, `dim_users`, `dim_jobs`, `dim_companies`.

## Dashboards

1. Executive: north star, revenue by stream, cost per interview, active clients/bidders/companies.
2. Connect ops: backlog by route, throughput, QA, agent success by adapter.
3. Supply: pool size by source, expiry rate, scout funnel.
4. Trust: queue SLAs, fraud flags, dispute outcomes.
5. Finance: ledger balances, reconciliation status, payouts.

## Experimentation

Feature flags + experiment assignment by user or company; primary metric must be interview-based where possible; guardrail metrics: not-relevant rate, complaints, disputes.
