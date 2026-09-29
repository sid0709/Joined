# 90 — Compliance, Privacy and Security

> Not legal advice. Every item marked ⚖️ needs review by counsel before launch.

## Legal surfaces ⚖️

| Area                        | Requirement                                                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terms of service (per role) | Candidate, company, scout terms; **no bot or delegated applications**; interview fee, classification and stage-lock clauses; placement clause; no-proxy clause                                     |
| Interview fees              | Per-interview pricing, authorization at booking and capture at settlement, registered-company rule, free from the 4th interview; consumer and B2B disclosures                                      |
| Job data                    | Aggregate only from permitted sources; store summaries + official links; honor takedown requests                                                                                                   |
| Automation                  | Bots and auto-apply banned on OpenSeat ([22](22-no-bot-applications.md)); no bypass of CAPTCHAs/bot protection on third-party sites; respect site terms                                            |
| Reports and scores          | Objective reasons, appeal, no public negative scores; review for consumer-reporting (e.g. FCRA in the US), defamation, and GDPR profiling rules                                                    |
| AI in hiring                | AI interview assistant is advisory, disclosed to candidates and bias-monitored; human decides; review NYC Local Law 144, EU AI Act (employment = high-risk), Colorado/Illinois rules as applicable |
| Recording and transcription | All-party consent by default, visible indicator, opt-out with manual notes, retention limits; wiretap/biometric-privacy laws per state and country ([21](21-hire-ai-interview-assistant.md))       |
| Calendar data               | Read-only scopes, match-only processing, Google OAuth verification and Microsoft publisher verification before launch                                                                              |
| Payments                    | Stripe Connect handles KYC for scout payouts; 1099/tax forms for US scouts; sales tax/VAT on Premium and interview fees                                                                            |
| Seeker fees                 | Regulation of fees charged to job seekers varies by market; review before launch in each ⚖️                                                                                                        |
| Scouts                      | Contractor status, tax, and content rules (own-words summaries, no copied descriptions)                                                                                                            |
| Minors                      | Age-appropriate restrictions for candidates; minors cannot be scouts                                                                                                                               |

## Privacy

- **Data minimization:** collect only what a feature needs; calendar/email processing limited to matched items ([30](30-interview-tracking.md)).
- **Lawful basis / consent:** explicit consent for calendar/email connections, ID verification, and interview recording and AI analysis.
- **User rights:** export (JSON + files) and deletion from Settings; deletion within 30 days, except records required for legal/financial retention (ledger, tax, fraud).
- **Retention:**

| Data                                                | Retention                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| Resumes, profile                                    | Until deleted by user; 24 months after last activity then prompt/delete   |
| Application records, source stamps, classifications | 36 months                                                                 |
| Interview recordings                                | Company-set, default 90 days, max 12 months                               |
| Transcripts, AI notes                               | With the application record (36 months), deletable on request             |
| Calendar/email matched items                        | 24 months; unmatched never stored (hash only)                             |
| ID verification                                     | Vendor reference + status; raw images per vendor policy, not stored by us |
| Ledger, invoices                                    | 7 years                                                                   |
| Audit log                                           | 7 years                                                                   |
| Messages                                            | 24 months after context closes                                            |

- **Processors:** keep a sub-processor list (hosting, IDV, Stripe, email, speech-to-text, LLM provider). Speech and LLM providers must not train on our data (zero-retention/enterprise terms).
- **Cross-border:** EU users → SCCs; data residency option later.

## Security

- **Encryption:** TLS 1.2+ everywhere; at rest with KMS; field-level encryption (envelope, per-tenant data key) for 🔒 columns: phone, work authorization, OAuth tokens, face template refs.
- **Secrets:** managed secret store; no secrets in repo; rotation every 90 days.
- **Access:** least privilege IAM; separate DB credentials per service; production access via break-glass with approval and session recording; admin MFA with hardware keys.
- **App security:** OWASP ASVS L2; CSRF protection, strict CSP, SSRF protection for URL fetchers (scout checks, career-page crawlers) — block private IP ranges and metadata endpoints; file uploads virus-scanned and type-checked.
- **Bot resistance:** apply endpoints accept only first-party sessions with single-use apply tokens; no public apply API ([22](22-no-bot-applications.md)).
- **Assistant workers:** transcription and analysis run in isolated workers with scoped, short-lived credentials; recordings encrypted at rest with per-tenant keys.
- **Supply chain:** dependency scanning, lockfiles, signed container images, SBOM.
- **Testing:** SAST in CI, DAST on staging, annual third-party pentest before public launch.
- **Incident response:** runbook, on-call, 72 h breach notification process (GDPR), status page.

## Acceptance criteria

- Data export for a user contains profile, resumes, applications, interviews, classifications, messages, and transactions.
- Deleting an account removes PII within 30 days while ledger entries remain with pseudonymized references.
- SSRF test suite passes for scout URL checks and career-page crawling.
- A recording is impossible to start without all-participant consent, and deletion removes audio, transcript and analysis within 24 h.
