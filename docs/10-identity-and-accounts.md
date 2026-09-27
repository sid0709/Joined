# 10 — Identity, Accounts, Modes and Verification

**Owning service:** `identity`

## Purpose

One account per real person, usable across both services, with identity assurance that rises only when the person is about to earn, spend, or be interviewed.

## Scope

- Sign-up, sign-in, sessions
- Modes and mode switching
- Verification tiers and ID checks
- Device, network, and bot risk scoring
- Delegation agreements (client ↔ bidder/agent)
- Company accounts and membership (company verification lives here; company _data_ lives in `jobs`)

## Sign-up and sign-in

- Methods: email + one-time code, passkeys, Google, Microsoft. Password login MAY exist for legacy users of the current job site.
- Single sign-on across `platform-web`, `connect-web`, `admin-web` (shared auth domain, e.g. `auth.<domain>`).
- Access token: JWT, 15 min. Refresh token: rotating, 30 days, bound to device.
- Existing job-site accounts MUST migrate without re-registration: map old user IDs to new UUIDs; keep a `legacy_user_id` column.

## Modes

| Mode       | Activation requirement                                         |
| ---------- | -------------------------------------------------------------- |
| job_hunter | Default on sign-up                                             |
| company    | Create or join a company (see company verification)            |
| scout      | Accept scout terms; verified email + phone                     |
| client     | Tier 2 verification + payment method + signed delegation terms |
| bidder     | Tier 3 verification + skills test + tax info + bidder terms    |
| admin      | Staff SSO only, hardware key MFA                               |

- Mode switch is a header control. The current mode is stored in `users.last_active_mode` and determines navigation.
- A user can be both bidder and job hunter, but **a bidder can never be assigned to themselves as client**, and anti-collusion rules apply (see [32-trust-and-safety.md](32-trust-and-safety.md)).

## Verification tiers

| Tier | Checks                                                                           | Unlocks                                                                                              |
| ---- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 0    | Email verified                                                                   | Browse, save jobs                                                                                    |
| 1    | + phone verified (no VoIP/disposable), device fingerprint                        | Apply yourself, scout submissions (probation)                                                        |
| 2    | + government ID + liveness selfie                                                | "Verified" badge, being interviewed through on-platform scheduling, becoming a client, scout payouts |
| 3    | + face-duplicate check (one person, one bidder account) + skills test + tax form | Bidder mode                                                                                          |

- Company verification is separate: **work email on company domain** (or DNS TXT), domain age > 90 days, business registry lookup where available, payment method before first paid interview. Small companies without a domain: poster ID (tier 2) + manual review.
- Verification is done by an external vendor. Store `vendor_ref`, status, and timestamps. **Do not store raw ID images** unless legally required; if required, encrypt and set retention.
- Bidders re-verify with a quick selfie every 30 days and when risk rises (prevents account sharing/selling).

## Risk scoring

Score 0–100, recomputed on sign-in, sensitive actions, and daily.

| Signal                                                        | Example weight           |
| ------------------------------------------------------------- | ------------------------ |
| VPN / hosting ASN / Tor                                       | +15 / +20 / +40          |
| Headless browser or automation fingerprint                    | +40                      |
| Device shared with other accounts                             | +10 per account (cap 40) |
| Disposable email / VoIP phone                                 | +25                      |
| Velocity (sign-ups, applications, submissions) above baseline | +10–30                   |
| Upheld reports                                                | +20 each                 |
| Tier 2+ verified                                              | −20                      |
| Account age > 90 days with clean history                      | −10                      |

Actions by score: **< 30** normal; **30–59** step-up (OTP, CAPTCHA on sensitive actions); **60–79** require re-verification, limit quotas; **≥ 80** restrict and open a moderation case. **Never hard-block solely for VPN use.**

## Delegation agreements

Before any bidder or the agent acts for a client, the client signs a delegation agreement recording:

- who may act (specific bidder or "platform AI agent"),
- allowed actions (search, prepare, submit with/without approval, answer standard questions),
- forbidden actions (fabrication, attending interviews, accepting offers, sharing credentials),
- document version and timestamp.

Revoking the agreement immediately pauses all open assignments for that provider.

## API

```
POST   /v1/auth/otp/start                 {email}
POST   /v1/auth/otp/verify                {email, code} -> tokens
POST   /v1/auth/passkey/...               (WebAuthn register/login)
POST   /v1/auth/refresh
POST   /v1/auth/logout
GET    /v1/me                             -> user, modes, tier, flags
PATCH  /v1/me                             {display_name, time_zone, locale}
POST   /v1/me/modes/{mode}/activate       -> requirements checklist or active
POST   /v1/me/mode                        {mode} (switch)
POST   /v1/me/phone/start | /verify
POST   /v1/verifications                  {type} -> vendor session url
GET    /v1/verifications/{id}
POST   /v1/webhooks/idv/{vendor}          (vendor callback, signed)
POST   /v1/delegations                    {engagement_id, actor_type, actor_user_id?, scope}
DELETE /v1/delegations/{id}               (revoke)
POST   /v1/companies/{id}/verify          {method: domain_email|dns_txt}
```

## Events

`user.created`, `user.mode.activated`, `user.verified {tier}`, `user.verification.failed`, `risk.changed {from,to}`, `delegation.signed`, `delegation.revoked`, `account.restricted`, `account.suspended`.

## UI pages

- Sign in / sign up
- Mode switcher (header)
- "Get verified" flow (vendor embed) with clear explanation of why and what is stored
- Settings → Account, Security (passkeys, sessions), Verification status, Connected apps
- Mode activation checklists (e.g. "Become a bidder": verify ID → skills test → tax info → terms)

## Edge cases

- Verification vendor outage: queue the request, allow retry, do not grant tier.
- Name mismatch between ID and profile: allow a legal name field; display name may differ.
- Person with an upheld fraud finding tries to create a new account: face-duplicate check at tier 2/3 blocks and flags.
- Minor detected (age < 18 on ID): cannot become client or bidder; job hunter mode only with age-appropriate restrictions per local law.

## Acceptance criteria

- A legacy job-site user signs in with existing credentials and lands in job hunter mode with profile intact.
- Activating client mode shows exactly the missing requirements and cannot be completed without tier 2 + payment method + delegation terms.
- A second bidder account with the same face is blocked and a fraud flag is created.
- Risk score ≥ 60 forces re-verification before the next money-related action.
- All verification decisions write to `audit_log`.
