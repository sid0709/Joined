# 01 — Glossary

| Term                          | Meaning                                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jobs**                      | The free job site product: search, resumes, application tracking, free posting. Premium unlocks hidden jobs.                                                                |
| **Hire**                      | The company product: ATS plus AI interview assistant, paid per interview.                                                                                                   |
| **Scout**                     | The product (and role) for people who add hidden jobs and career pages.                                                                                                     |
| **Candidate**                 | A job seeker using Candidate mode (role code `job_hunter`). Also "job seeker" or "seeker".                                                                                  |
| **Registered company**        | A company with an account that accepted our terms and has a payment method. Only registered companies owe interview fees.                                                   |
| **Job pool**                  | All jobs the system knows about: direct, aggregated and scouted.                                                                                                            |
| **Direct job**                | A job posted by a registered company on OpenSeat.                                                                                                                           |
| **Aggregated job**            | A job ingested from a permitted feed (ATS public job-board APIs, partner or employer feeds).                                                                                |
| **Scouted job**               | A job submitted by a scout with the official apply link, after passing the quality check.                                                                                   |
| **Hidden job**                | A scouted job that was not on major boards when submitted. Visible to Premium seekers first. Hidden status ends when it appears publicly. The first approved scout owns it. |
| **Official link**             | The apply URL on the company's own career site or ATS (Greenhouse, Lever, Ashby, Workday, etc.), never another job board.                                                   |
| **Company apply link**        | The company's own OpenSeat link or embedded career page. Applications through it are **internal**.                                                                          |
| **Internal (own applicant)**  | A candidate who applied through the company's own OpenSeat link or career page. The company brought them. Company pays $5; seeker pays $2 after free credits.               |
| **External (OpenSeat-found)** | A candidate who found the job via OpenSeat Jobs or Scout. OpenSeat brought them. Company pays $20; seeker pays $0.                                                          |
| **Source stamp**              | The first-touch record written at the apply click (`internal` or `external`, channel, job, candidate, time). Opens the ATS trail and breaks classification ties.            |
| **Classification**            | Each side's answer (internal or external) for an interview. Candidate and company each classify; disagreements are resolved by the source stamp.                            |
| **Interview event**           | One interview (phone screen, technical, onsite…) for one candidate and one job.                                                                                             |
| **Interview number**          | Position of an interview in the sequence for one `(candidate, job)`. Numbers 1–3 are billable; from the 4th, nobody pays.                                                   |
| **Detected interview**        | An interview event found on a connected calendar, email or on-platform schedule, not yet confirmed.                                                                         |
| **Confirmed interview**       | An interview that appears on both calendars (or was held on-platform) and was classified by both sides. The billable unit.                                                  |
| **Fee authorization**         | The hold placed on the company's payment method when an interview is booked. Settles after the date passes with no dispute.                                                 |
| **Stage lock**                | "No fee, no next stage": the ATS will not advance a candidate past an interview whose company fee is unpaid.                                                                |
| **Settlement**                | Capturing fees and releasing earnings after the interview date passes with no open dispute.                                                                                 |
| **Interview credit**          | A free seeker interview. Seekers get 3–5 per month (config) that cover the $2 own-applicant fee. Companies get none.                                                        |
| **Premium**                   | The $20/month seeker subscription that unlocks hidden jobs.                                                                                                                 |
| **Scout pool**                | 20% of each Premium payment, split evenly across the distinct hidden jobs that Premium user applied to that month; each scout collects the shares for their jobs.           |
| **Scout interview bonus**     | $1 paid by OpenSeat for each external candidate whose **first** interview is scheduled on the scout's job.                                                                  |
| **Company conversion bonus**  | Paid to a scout when a company they scouted claims its page and starts paying.                                                                                              |
| **Claim**                     | A company taking ownership of an auto-generated company page and registering.                                                                                               |
| **AI interview assistant**    | The Hire feature that transcribes an interview, analyzes answers and drafts notes and scorecards for HR.                                                                    |
| **Pipeline / stage**          | The ATS sequence an application moves through (applied → screen → interviews → offer → hired / rejected), configurable per job.                                             |
| **Scorecard**                 | Structured interviewer feedback per interview, optionally pre-filled by the AI assistant and always edited/submitted by a human.                                            |
| **Bot application**           | Any application not made personally by the verified candidate: auto-apply tools, AI agents, scripts, browser automation, or a third person applying for them. Banned.       |
| **Verification tier**         | Level of identity assurance on an account (see [10-identity-and-accounts.md](10-identity-and-accounts.md)).                                                                 |
| **Risk score**                | 0–100 score from device, network, behavior and history signals. Drives friction and, for automation, blocks applying.                                                       |
| **Hold period**               | Time after the interview date before fees settle and earnings are released, to allow disputes.                                                                              |
