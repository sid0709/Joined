# 01 — Glossary

| Term                    | Meaning                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Job pool**            | All jobs the system knows about: aggregated, company-posted (direct), and scout-submitted.                                                  |
| **Direct job**          | A job posted by a company that has an account and accepted our terms. Company fees apply only to direct jobs.                               |
| **Aggregated job**      | A job ingested from a permitted feed or partner. No company fee.                                                                            |
| **Scouted job**         | A job submitted by a scout with the official apply link, after passing the quality check. No company fee until the company claims its page. |
| **Official link**       | The apply URL on the company's own career site or ATS (Greenhouse, Lever, Ashby, Workday, etc.), never another job board.                   |
| **ATS**                 | Applicant tracking system used by the employer.                                                                                             |
| **Bulk job**            | A job whose application form is simple and standardized (typically Greenhouse, Ashby, Lever). Routed to the AI agent.                       |
| **Complex job**         | A job with a long, custom, or unreliable form (e.g. Workday, custom portals, many screening questions). Routed to a human bidder.           |
| **Client**              | A job hunter who hired help through Connect.                                                                                                |
| **Bidder**              | A verified human who applies on a client's behalf.                                                                                          |
| **Bid**                 | One application prepared/submitted for a client to one job. Internal term; in UI use "application".                                         |
| **Assignment**          | A batch of jobs a client hands to a bidder or the agent, with rules, deadline, and approval mode.                                           |
| **Assignment item**     | One job inside an assignment. Becomes an application.                                                                                       |
| **Approval mode**       | `approve_each` (client approves every application before submission) or `auto_within_rules`.                                                |
| **Submit handoff**      | For AI-prepared applications, the step where the client clicks the final submit button.                                                     |
| **Resume-upload check** | Automated check that the resume actually uploaded matches the assigned resume version.                                                      |
| **Bid log**             | The record a bidder writes for each application: job, resume version, timestamp, confirmation evidence.                                     |
| **Interview event**     | One interview round (phone screen, technical, onsite…) for one candidate and one job.                                                       |
| **Detected interview**  | An interview event found by calendar/email/on-platform signals, not yet confirmed.                                                          |
| **Confirmed interview** | An interview event the client confirmed (or that happened on-platform). The billable unit.                                                  |
| **Hold period**         | Days after confirmation before earnings are released, to allow disputes.                                                                    |
| **Quota**               | Maximum applications per day for a bidder or the agent on behalf of a client. Grows with quality.                                           |
| **Fit score**           | 0–100 score of how well a client matches a job.                                                                                             |
| **Not relevant**        | One-click company feedback on an assisted application. Lowers the sender's quota/rating.                                                    |
| **Take rate**           | The platform's percentage of a bidder's earnings (marketplace model).                                                                       |
| **Piece rate**          | A fixed amount paid per bid (managed-workforce model; Phase 1 used $0.05/bid).                                                              |
| **Claim**               | A company taking ownership of an auto-generated company page.                                                                               |
| **Verification tier**   | Level of identity assurance on an account (see [10-identity-and-accounts.md](10-identity-and-accounts.md)).                                 |
| **Risk score**          | 0–100 score from device, network, behavior, and history signals. Drives friction, not hard blocks.                                          |
