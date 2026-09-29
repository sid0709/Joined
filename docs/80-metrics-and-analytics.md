# 80 — Metrics and Analytics

## North star

**Confirmed interviews** per month, split **internal vs external**, with the interview rate (confirmed interviews per 100 applications) as the quality check. Every dollar of company revenue is tied to one.

## KPI tree

| Area      | Metric                                | Definition                                                    | Target (initial)                              |
| --------- | ------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| Outcome   | Confirmed interviews                  | interviews with status confirmed, by month and classification | Year 1 plan: ~6.4K (2.4K external)            |
| Outcome   | Interview rate                        | confirmed interviews ÷ submitted applications                 | publish from launch                           |
| Outcome   | Seeker time to first interview        | application → first confirmed interview, median               | measure                                       |
| Revenue   | Company fees                          | settled company fees, internal vs external                    | plan by year                                  |
| Revenue   | Premium seekers                       | active $20/mo subscribers                                     | 3K avg in Year 1, 1,000 by month 18 milestone |
| Company   | Registration rate                     | registered ÷ claimed company pages                            | measure                                       |
| Company   | Paying companies                      | companies with ≥ 1 settled fee in the month                   | 50 avg in Year 1                              |
| Company   | Paid interviews per company per month |                                                               | measure                                       |
| Company   | Own-applicant share                   | internal interviews ÷ all interviews                          | 62% (10 of 16) in base plan                   |
| Integrity | Classification agreement rate         | interviews where candidate and company agree                  | ≥ 95%                                         |
| Integrity | Stamp-resolved rate                   | conflicts settled by the source stamp                         | trending down                                 |
| Integrity | Off-platform leakage                  | flagged hidden interviews ÷ confirmed                         | trending down                                 |
| Integrity | Stage-lock rate / time to unlock      | applications locked, hours to authorization                   | < 2% / < 24 h                                 |
| Integrity | Both-calendar coverage                | confirmed interviews seen on both calendars                   | ≥ 90%                                         |
| Bots      | Blocked automation attempts           | apply attempts rejected for automation ÷ attempts             | tracked; false-positive rate ≤ 0.5%           |
| Bots      | Confirmed bot applications            | applications withdrawn as bot ÷ applications                  | trending to 0                                 |
| Seeker    | Free-credit exhaustion                | seekers who hit the $2 fee ÷ active seekers                   | ~15% of own-applicant interviews billable     |
| Seeker    | Premium conversion                    | Premium ÷ active seekers                                      | 20% in market sizing assumption               |
| Scout     | Scouted jobs with ≥ 1 interview       | within 30 days of approval                                    | ≥ 10%                                         |
| Scout     | Earnings per active hidden job        | scout earnings ÷ active hidden jobs per month                 | ≈ $2.75 (estimate)                            |
| Scout     | Submission quality                    | approval rate, duplicate/expired rate                         | ≥ 90% / ≤ 5%                                  |
| Cost      | AI assistant cost per interview       | model + transcription cost                                    | ≤ $0.60                                       |
| Cost      | Contribution per interview            | revenue less scout, payments/ops and AI costs                 | 83% internal, 90% external                    |
| Trust     | Upheld fraud rate                     | upheld fraud cases ÷ active accounts                          | trending down                                 |
| Tracking  | Detection precision / recall          | vs. audited sample                                            | ≥ 95% / ≥ 85%                                 |

## Event tracking

- Product analytics events from web apps (page views, key actions) with `user_id`, `role`, `session_id`; no raw PII in properties.
- Business metrics computed from the **domain events** (outbox stream) into a warehouse, not from client-side analytics.
- dbt models: `fct_applications`, `fct_interviews`, `fct_ledger`, `dim_users`, `dim_jobs`, `dim_companies`.

## Dashboards

1. Executive: confirmed interviews, revenue by stream, gross margin, Premium seekers, paying companies.
2. Hire: pipeline throughput, source mix, stage locks, AI assistant cost.
3. Integrity: classification agreement, stamp resolutions, off-platform flags, bot detections.
4. Supply: pool size by source, hidden jobs, expiry rate, scout funnel and earnings.
5. Trust: queue SLAs, fraud flags, dispute outcomes.
6. Finance: ledger balances, reconciliation, authorizations vs captures, payouts.

## Experimentation

Feature flags + experiment assignment by user or company; primary metric interview-based where possible; guardrails: classification agreement, complaints, disputes, false-positive bot blocks.
