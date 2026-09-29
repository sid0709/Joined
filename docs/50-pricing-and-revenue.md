# 50 — Pricing and Revenue Model

All prices live in `price_books` (see [31-payments-wallet-escrow.md](31-payments-wallet-escrow.md)) so they can change without deploys. Values below are the **v1 defaults** from the September 2026 investor deck. Projections are **scenarios built on stated assumptions, not forecasts.**

## Principle

**We sell interviews, not job posts.** Free to use; paid on interviews (and an optional seeker subscription). No side pays for volume.

## The pricing rule

**Who brought the candidate sets the price.** Free from the 4th interview for the same candidate and job, on both sides. If a company is not registered, nothing is owed.

|                                   | **Internal** — applied via the company's own OpenSeat link or career page | **External** — found the job via OpenSeat Jobs or Scout |
| --------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Company pays** per interview    | **$5** — covers ATS, calendar and AI assistant                            | **$20** — we did the sourcing                           |
| **Job seeker pays** per interview | **$2** — after 3–5 free credits a month                                   | **$0** — OpenSeat found the job                         |

Details:

- Fees are per candidate, per job. **Interview numbers 1–3 are billed;** from the 4th nobody pays.
- Companies get **no** free credits; they pay from the first interview. Only seekers get 3–5 free credits a month (config).
- Fees are authorized when the interview is confirmed and settle after the interview date passes with no dispute.
- **No fee, no next stage:** an unpaid interview locks the candidate's next ATS stage.

## Price list

| Product                       | Who pays        | Price                 | Includes                                 |
| ----------------------------- | --------------- | --------------------- | ---------------------------------------- |
| **Jobs**                      | Nobody          | Free                  | Search, resumes, tracking, free posts    |
| **Jobs Premium**              | Job seekers     | **$20 / month**       | Hidden jobs found by scouts              |
| **Hire: own applicants**      | Companies       | **$5 per interview**  | ATS, calendar, AI interview assistant    |
| **Hire: OpenSeat-found**      | Companies       | **$20 per interview** | Same, for candidates from Jobs and Scout |
| **Interview fee for seekers** | Job seekers     | **$2 own; $0 found**  | 3–5 free credits a month                 |
| **Enterprise and API**        | Large employers | Custom                | From Phase 3                             |

A whole hiring round costs a company **$85–$170 per job** (conservative to base example below), ATS and AI assistant included: **1.6–3.1% of the $5,475** average US cost per hire (SHRM 2025).

## Scouts

| Reward                       | Amount                                                                                                                | Trigger                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Base pay: Premium pool**   | 20% of each Premium payment ($4 of $20), split evenly across the distinct hidden jobs that user applied to that month | Month-end allocation to the scouts who own those jobs          |
| **Interview bonus**          | **$1** paid by OpenSeat                                                                                               | External candidate's **first** interview on a scouted job      |
| **Company conversion bonus** | Price-book amount                                                                                                     | A scouted company claims its page, registers and starts paying |

Worked example (estimate, not a promise): 10,000 Premium users, 20,000 active hidden jobs, about $2.75 earned per active job a month → a scout adding 20 hidden jobs a day can earn about **$1,650 a month**. Scouts are paid on usage and interviews, never per submission.

## Unit economics

Assumptions: AI assistant cost **$0.60 per interview**; scout bonus: 30% of external candidates come from scouted jobs, $1 each, 2 interviews per candidate; seeker fee: 15% of own-applicant interviews exceed free credits; payments and ops **6%** of money collected.

| Line                  | Premium seeker (per month) | Own-applicant interview (internal) | OpenSeat-found interview (external) |
| --------------------- | -------------------------- | ---------------------------------- | ----------------------------------- |
| Revenue               | $20.00                     | Company $5.00 + seeker avg $0.30   | Company $20.00                      |
| Scout pool / bonus    | −$4.00 (20% pool)          | —                                  | −$0.15 (avg bonus)                  |
| Payments and ops (6%) | −$1.20                     | −$0.32                             | −$1.20                              |
| AI assistant          | —                          | −$0.60                             | −$0.60                              |
| **Contribution**      | **$14.80 · 74%**           | **$4.38 · 83%**                    | **$18.05 · 90%**                    |

## One job, end to end (illustrative)

Seeker fees are 15% of own-applicant interviews at $2 (the rest are covered by free credits).

| Per job                             | Conservative | Base        |
| ----------------------------------- | ------------ | ----------- |
| Candidates interviewed              | 5            | 8           |
| of which external (we brought)      | 2            | 3           |
| Interviews held (max 3 billed each) | 8            | 16          |
| internal ($5)                       | 5            | 10          |
| external ($20)                      | 3            | 6           |
| Company fees, internal              | $25          | $50         |
| Company fees, external              | $60          | $120        |
| Seeker fees after credits           | $1.50        | $3.00       |
| **Our revenue per job**             | **$86.50**   | **$173.00** |

A company hiring 8 people a year at the base $170 a job pays about **$1,360 a year**, roughly 5% of a median Greenhouse contract ($26.6K a year).

## Five-year plan (base scenario)

Gross profit is before salaries and marketing. Seeker fees are after free credits.

| Line                         | Year 1     | Year 2    | Year 3     | Year 4     | Year 5      |
| ---------------------------- | ---------- | --------- | ---------- | ---------- | ----------- |
| Premium seekers (avg)        | 3K         | 20K       | 60K        | 150K       | 300K        |
| Paying companies (avg)       | 50         | 600       | 3K         | 10K        | 25K         |
| Interviews held              | 6.4K       | 76.8K     | 384K       | 1.28M      | 3.2M        |
| of which external ($20)      | 2.4K       | 28.8K     | 144K       | 480K       | 1.2M        |
| Premium revenue              | $0.72M     | $4.8M     | $14.4M     | $36.0M     | $72.0M      |
| Company fees, internal ($5)  | $0.02M     | $0.24M    | $1.2M      | $4.0M      | $10.0M      |
| Company fees, external ($20) | $0.05M     | $0.58M    | $2.9M      | $9.6M      | $24.0M      |
| Seeker interview fees ($2)   | <$0.01M    | $0.01M    | $0.07M     | $0.24M     | $0.60M      |
| **Total revenue**            | **$0.79M** | **$5.6M** | **$18.6M** | **$49.8M** | **$106.6M** |
| Gross profit                 | $0.59M     | $4.3M     | $14.3M     | $38.8M     | $83.7M      |
| Gross margin                 | 75%        | 76%       | 77%        | 78%        | 79%         |

Revenue mix: company fees grow to about **32%** of revenue by Year 5 (9% in Year 1, 22% in Year 3); seeker interview fees stay under 1%. Base assumptions: Premium $20/mo; companies hire for 8 jobs a year with 16 interviews a job (10 internal, 6 external); scouts get 20% of Premium plus $0.30 per external candidate; payments and ops 6%.

Scenarios (same prices in each): **Conservative** (half the users) $53M in Year 5; **Base** $107M; **Upside** (1.5× the users) $160M.

## Market sizing (investor deck assumptions)

US serviceable market about **$4.6B**: job seekers **$2.0B** (25M US online seekers × 20% who pay × $400/yr) + companies **$2.6B** (15M knowledge-worker hires × $170 of interview fees per hire). Year-5 base revenue is about 2.3% of it.

## How incumbents charge

Employers pay for access, not interviews (Indeed clicks, LinkedIn seats, ZipRecruiter slots, Greenhouse/iCIMS software contracts; agencies charge 15–25% of first-year salary but only on hire). Seekers pay for volume (LinkedIn Premium $30–$40/mo, auto-apply bots $28–$40/mo, apply-for-you packages $299–$1,099), not outcomes. OpenSeat is the only model paid **only on confirmed interviews**, and it does **not** sell auto-apply ([22](22-no-bot-applications.md)).

Cost per interview for employers: about $500–$1,670 in Indeed ad spend (derived) vs **$20** for an OpenSeat-found candidate and **$5** for an own applicant, **25–83×** cheaper for candidates we bring.

## Revenue streams

| Stream                                   | Phase                 |
| ---------------------------------------- | --------------------- |
| Premium seeker subscription              | 1–2                   |
| Company fees: $5 internal / $20 external | Hire launch (month 3) |
| Seeker fees ($2 own, after credits)      | Hire launch           |
| Enterprise plans and API                 | 3                     |
| Verified interview hosting               | 3+                    |

Retired: client plans, bidder take rate, staffing agency plan, and interview prep add-on tied to the earlier Connect model.

## Metrics that decide pricing

1. Confirmed interviews per month, internal vs external
2. Company registration rate after claim; paid interviews per company per month
3. Classification agreement rate between candidate and company
4. Free-credit exhaustion rate (share of seekers who hit $2)
5. Premium conversion and hidden-job usage
6. AI assistant cost per interview (target ≤ $0.60)
