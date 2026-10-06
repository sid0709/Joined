# 90 — Compliance, Privacy and Security

> Not legal advice. Every item marked ⚖️ needs review by counsel before launch.
>
> User-facing drafts live in [legal/](legal/README.md). They stay drafts until counsel removes that title.

## Legal surfaces ⚖️

| Area                        | Requirement                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terms of service (per mode) | Job hunter, company, scout, client, bidder terms; placement fee clause; no-fabrication and no-proxy clauses                                                          |
| Delegation agreement        | Client authorizes bidder/agent actions; scope and prohibitions ([10](10-identity-and-accounts.md))                                                                   |
| Job data                    | Aggregate only from permitted sources; store summaries + official links; honor takedown requests                                                                     |
| Automation                  | No bypass of CAPTCHAs/bot protection; respect site terms; candidate performs final submit                                                                            |
| Reports and scores          | Objective reasons, appeal, no public negative scores; review for consumer-reporting (e.g. FCRA in the US), defamation, and GDPR profiling rules                      |
| AI in hiring                | Label AI-prepared applications; monitor for bias in fit scoring; review NYC Local Law 144, EU AI Act (employment = high-risk), Colorado/Illinois rules as applicable |
| Payments                    | Stripe Connect handles KYC for payouts; 1099/tax forms for US payees; sales tax/VAT on subscriptions                                                                 |
| Worker classification       | If bidders are paid piece rate in a managed model, review contractor vs employee classification per jurisdiction                                                     |
| Minors                      | Age gating for client/bidder modes                                                                                                                                   |

## Privacy

- **Data minimization:** collect only what a feature needs; calendar/email processing limited to matched items ([30](30-interview-tracking.md)).
- **Lawful basis / consent:** explicit consent for calendar/email connections, ID verification, and sharing data with a bidder.
- **User rights:** export (JSON + files) and deletion from Settings; deletion within 30 days, except records required for legal/financial retention (ledger, tax, fraud).
- **Retention:**

| Data                         | Retention                                                                 |
| ---------------------------- | ------------------------------------------------------------------------- |
| Resumes, profile             | Until deleted by user; 24 months after last activity then prompt/delete   |
| Application records          | 36 months                                                                 |
| Calendar/email matched items | 24 months; unmatched never stored (hash only)                             |
| ID verification              | Vendor reference + status; raw images per vendor policy, not stored by us |
| Ledger, invoices             | 7 years                                                                   |
| Audit log                    | 7 years                                                                   |
| Messages                     | 24 months after context closes                                            |

- **Processors:** keep a sub-processor list (hosting, IDV, Stripe, email, LLM provider). LLM provider must not train on our data (zero-retention/enterprise terms).
- **Cross-border:** EU users → SCCs; data residency option later.

## Security

- **Encryption:** TLS 1.2+ everywhere; at rest with KMS; field-level encryption (envelope, per-tenant data key) for 🔒 columns: phone, work authorization, OAuth tokens, face template refs.
- **Secrets:** managed secret store; no secrets in repo; rotation every 90 days.
- **Access:** least privilege IAM; separate DB credentials per service; production access via break-glass with approval and session recording; admin MFA with hardware keys.
- **App security:** OWASP ASVS L2; CSRF protection, strict CSP, SSRF protection for URL fetchers (scout checks, agent form reader) — block private IP ranges and metadata endpoints; file uploads virus-scanned and type-checked.
- **Agent sandbox:** browser workers run in isolated containers without access to internal networks or credentials beyond a scoped job token.
- **Extension:** Manifest V3, minimal host permissions (only when the user starts a submit session), no remote code, payloads fetched with single-use tokens.
- **Supply chain:** dependency scanning, lockfiles, signed container images, SBOM.
- **Testing:** SAST in CI, DAST on staging, annual third-party pentest before public launch.
- **Incident response:** runbook, on-call, 72 h breach notification process (GDPR), status page.

## Acceptance criteria

- Data export for a user contains profile, resumes, applications, interviews, messages, and transactions.
- Deleting an account removes PII within 30 days while ledger entries remain with pseudonymized references.
- SSRF test suite passes for scout URL checks and agent form reads.
