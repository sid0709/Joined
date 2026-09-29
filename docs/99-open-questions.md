# 99 — Open Questions and Decisions Log

Resolve these before (or during) the build. Record the decision, date, and owner here.

| #   | Question                                 | Options                                                                                                                                              | Impact                                     | Status                     |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------- |
| 1   | **Product names**                        | Deck uses **OpenSeat Jobs / Hire / Scout** (Scout app is built as Scoutwell). Confirm final names; run USPTO + domain checks.                        | Branding, domains, SEO                     | Proposed                   |
| 2   | **Free credits: 3, 4 or 5 a month**      | Deck says 3–5. Fix a default and test the exhaustion rate (~15% billable assumed).                                                                   | Seeker fee revenue, seeker perception      | Open                       |
| 3   | **Premium-first window for hidden jobs** | How long free seekers wait before seeing hidden jobs (or never, until public).                                                                       | Premium conversion, scout earnings         | Open                       |
| 4   | **Scout conversion bonus amount**        | Deck gives the trigger but no amount.                                                                                                                | Scout economics                            | Open                       |
| 5   | **Classification window and default**    | 72 h response window; default to source stamp on silence, `internal` when no stamp exists.                                                           | Fee accuracy, disputes                     | Proposed                   |
| 6   | **Interviews outside calendars**         | How to treat phone screens with no calendar event (email forwarding, manual evidence billed as internal until resolved).                             | Leakage, candidate friction                | Open                       |
| 7   | **Calendar required for seekers?**       | Required at onboarding vs required only before first interview (current spec).                                                                       | Activation vs verifiability                | Proposed: before interview |
| 8   | **AI assistant cost and provider**       | $0.60 per interview is an assumption; measure with real interviews. Choose speech-to-text and LLM providers.                                         | Margin on $5 interviews (83% contribution) | Measure                    |
| 9   | **Recording consent model**              | All-party consent by default; opt-out leaves manual notes only. Counsel review by market.                                                            | Legal risk, adoption                       | ⚖️ Review                  |
| 10  | **Bot detection false positives**        | Signal mix and thresholds; challenge design; appeal path.                                                                                            | Honest-user friction                       | Open                       |
| 11  | **Launch niche**                         | Industry/region with the most existing job-site activity.                                                                                            | GTM focus                                  | Open                       |
| 12  | **Current aggregation sources**          | Confirm every source is permitted (feeds/partners); plan migration to ATS public feeds, scout career pages and direct posts; per-source kill switch. | Legal risk, SEO                            | Audit                      |
| 13  | **Seeker fees legality**                 | Fees charged to job seekers are restricted in some markets; review per launch market.                                                                | Where the $2 fee can launch                | ⚖️ Review                  |
| 14  | **Tech stack**                           | Keep existing job-site stack (Next.js apps, Go API in `opened-backend`) vs defaults in [02](02-architecture.md).                                     | Build speed                                | Open                       |
| 15  | **Placeholders in the investor deck**    | Raise size, use of funds, team, live job-site metrics (monthly visitors, registered seekers, jobs added a day) are bracketed in the deck.            | Fundraising                                | Owner to fill              |

## Competitors to study

- Job boards: Indeed, LinkedIn, ZipRecruiter, Glassdoor (merged into Indeed, July 2026)
- ATS: Greenhouse, iCIMS, Lever, Ashby
- AI interview notetakers: Metaview, Otter
- Auto-apply and apply-for-you tools (banned on OpenSeat; study their spam pressure): JobCopilot, LazyApply, LoopCV, Scale.jobs, ApplyAll

## Decisions made

| Date    | Decision                                                                                                                                                               | Owner |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 2026-09 | Build as one monorepo with separately deployed apps                                                                                                                    | —     |
| 2026-09 | No live interview assistance features for candidates                                                                                                                   | —     |
| 2026-09 | **Product is Jobs + Hire (ATS + AI interview assistant) + Scout; the interview is the currency** ([ADR 0002](ADRs/0002-interview-currency-and-no-bot-applications.md)) | —     |
| 2026-09 | **Bot participation in job applications is banned; applications are human-only** ([22](22-no-bot-applications.md))                                                     | —     |
| 2026-09 | **Connect (human bidders and AI agent applying for clients) is retired**                                                                                               | —     |
| 2026-09 | Pricing: company $5 internal / $20 external per interview; seeker $2 own (after 3–5 free credits) / $0 found; free from 4th interview; Premium $20/mo                  | —     |
| 2026-09 | Scout pay: 20% Premium pool + $1 per external first interview + company conversion bonus; never per submission                                                         | —     |
