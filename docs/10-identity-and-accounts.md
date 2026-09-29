# 10 — Identity, Accounts, Modes and Verification

**Owning service:** `identity`

## Purpose

One account per real person, with one role, and identity assurance that rises only when the person is about to earn, spend, or be interviewed.

## Scope

- Sign-up, sign-in, sessions
- One role per account: job hunter, recruiter, or scout
- Verification tiers and ID checks
- Device, network, and bot risk scoring, including automation detection on apply ([22](22-no-bot-applications.md))
- Calendar connection at onboarding (every user)
- Company accounts and membership (company verification lives here; company _data_ lives in `jobs`)

## Sign-up and sign-in

- Methods: email + one-time code, passkeys, Google, Microsoft. Password login MAY exist for legacy users of the current job site.
- Single sign-on across Jobs, Hire, Scout and admin apps (shared auth domain, e.g. `auth.<domain>`).
- Access token: JWT, 15 min. Refresh token: rotating, 30 days, bound to device.
- Existing job-site accounts MUST migrate without re-registration: map old user IDs to new UUIDs; keep a `legacy_user_id` column.

## Roles

An account is one person and one role. The role is chosen at signup and is not added to later. A candidate who wants to recruit, or a recruiter who wants to scout, creates a separate account.

| Role       | Chosen when                             | Extra record          |
| ---------- | --------------------------------------- | --------------------- |
| job_hunter | Sign-up as a candidate (Candidate mode) | `job_hunter_profiles` |
| recruiter  | Sign-up that creates or joins a company | `company_members`     |
| scout      | Sign-up on Scoutwell                    | `scout_profiles`      |
| admin      | Staff SSO only, hardware key MFA        | staff record          |

There are no client, bidder or agent roles: nobody may act for a candidate (see [ADR 0002](ADRs/0002-interview-currency-and-no-bot-applications.md)). Anti-collusion rules between scouts, candidates and companies are in [32-trust-and-safety.md](32-trust-and-safety.md).

## Calendar connection

Every user connects Google or Outlook during onboarding; it is what makes an interview verifiable from both sides ([30](30-interview-tracking.md)).

- Candidates: required before their first interview can be scheduled or confirmed. Browsing and applying work without it; the product explains that interviews it cannot see cannot use free credits or $0 external pricing.
- Company interviewers: required for every team member who interviews.
- Scouts: not required.

## Verification tiers

| Tier | Checks                                                                 | Unlocks                                                          |
| ---- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 0    | Email verified                                                         | Browse, save jobs                                                |
| 1    | + phone verified (no VoIP/disposable), device fingerprint, human check | Apply yourself, scout submissions (probation)                    |
| 2    | + government ID + liveness selfie                                      | "Verified" badge, on-platform interviews, Premium, scout payouts |

- Company verification is separate: **work email on company domain** (or DNS TXT), domain age > 90 days, business registry lookup where available, payment method before first paid interview. Small companies without a domain: poster ID (tier 2) + manual review.
- Verification is done by an external vendor. Store `vendor_ref`, status, and timestamps. **Do not store raw ID images** unless legally required; if required, encrypt and set retention.
- Candidates re-verify with a quick selfie when an automation signal or account-sharing signal fires on their account.

## Risk scoring

Score 0–100, recomputed on sign-in, sensitive actions, and daily.

| Signal                                                        | Example weight           |
| ------------------------------------------------------------- | ------------------------ |
| VPN / hosting ASN / Tor                                       | +15 / +20 / +40          |
| Headless browser or automation fingerprint                    | +40 (and blocks apply)   |
| Device shared with other accounts                             | +10 per account (cap 40) |
| Disposable email / VoIP phone                                 | +25                      |
| Velocity (sign-ups, applications, submissions) above baseline | +10–30                   |
| Upheld reports                                                | +20 each                 |
| Tier 2+ verified                                              | −20                      |
| Account age > 90 days with clean history                      | −10                      |

Actions by score: **< 30** normal; **30–59** step-up (OTP, CAPTCHA on sensitive actions); **60–79** require re-verification, limit apply rate; **≥ 80** restrict and open a moderation case. **Never hard-block solely for VPN use.** Automation signals on an apply attempt are handled by the bot-application policy regardless of score ([22](22-no-bot-applications.md)).

## API

```
POST   /v1/auth/otp/start                 {email}
POST   /v1/auth/otp/verify                {email, code} -> tokens
POST   /v1/auth/passkey/...               (WebAuthn register/login)
POST   /v1/auth/refresh
POST   /v1/auth/logout
GET    /v1/me                             -> user, role, tier, flags
PATCH  /v1/me                             {display_name, time_zone, locale}
POST   /v1/me/phone/start | /verify
POST   /v1/verifications                  {type} -> vendor session url
GET    /v1/verifications/{id}
POST   /v1/webhooks/idv/{vendor}          (vendor callback, signed)
POST   /v1/companies/{id}/verify          {method: domain_email|dns_txt}
```

## Events

`user.created`, `user.verified {tier}`, `user.verification.failed`, `risk.changed {from,to}`, `automation.detected {surface, action}`, `calendar.connected`, `account.restricted`, `account.suspended`.

## UI pages

- Sign in / sign up
- Calendar connection step (Google / Outlook)
- "Get verified" flow (vendor embed) with clear explanation of why and what is stored
- Settings → Account, Security (passkeys, sessions), Verification status, Connected apps

## Edge cases

- Verification vendor outage: queue the request, allow retry, do not grant tier.
- Name mismatch between ID and profile: allow a legal name field; display name may differ.
- Person with an upheld fraud or bot-application finding tries to create a new account: face-duplicate check at tier 2 blocks and flags.
- Minor detected (age < 18 on ID): candidate mode only with age-appropriate restrictions per local law; cannot be a scout.

## Acceptance criteria

- A legacy job-site user signs in with existing credentials and lands in Candidate mode with profile intact.
- A second candidate account with the same face is blocked and a fraud flag is created.
- An apply request from a headless or webdriver session is rejected and writes an `automation_detections` row.
- Risk score ≥ 60 forces re-verification before the next money-related action.
- All verification decisions write to `audit_log`.
