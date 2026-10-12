# 91 — Security pass

> Not a pentest of live users. No secret values are copied here. Date: 2026-10-06. Tree: `stage-roadmap-w34`.

This pass is the step-61 report. It does not change product code. Nothing in this pass is launch-blocking, so there is no follow-up fix PR from this report.

## Checklist

| #   | Check                 | Result         | Severity      | Owner | Follow-up     |
| --- | --------------------- | -------------- | ------------- | ----- | ------------- |
| 1   | Secret scan           | Pass           | —             | Quinn | accepted risk |
| 2   | Session cookies       | Pass           | —             | Leo   | accepted risk |
| 3   | Email-auth CSRF       | Pass           | —             | Leo   | accepted risk |
| 4   | CORS                  | Pass           | —             | Ravi  | accepted risk |
| 5   | SSRF on link fetch    | Pass           | —             | Ravi  | accepted risk |
| 6   | Kill-switch defaults  | Pass with note | accepted risk | Elon  | accepted risk |
| 7   | Live money flags      | Pass           | —             | Penny | accepted risk |
| 8   | Admin bearer          | Pass with note | major         | Ravi  | accepted risk |
| 9   | Extension permissions | Pass           | —             | Maya  | accepted risk |
| 10  | Dependency policy     | Pass with note | accepted risk | Quinn | accepted risk |

## Evidence

1. **Secrets.** `git grep` for `sk_live_`, `rk_live_`, `whsec_`, `AKIA`, and `BEGIN PRIVATE` hits documentation, the live-key prefix check in `backend-core/billing/config.go`, and unit fixtures such as `sk_live_123` in `backend-core/billing/config_test.go`. No live secret is stored in the tree. `STRIPE_ALLOW_LIVE` stays unset (step 59).

2. **Cookies.** `joined_session` (`joined-frontend/lib/auth/cookie.ts`), `scoutwell_session` (`scoutwell-frontend/lib/auth/cookie.ts`), and `joined_admin_session` (`admin-frontend/lib/server/staff-session.ts`) are `httpOnly`, `sameSite: lax`, and `secure` when `NODE_ENV=production`. The Next image sets `NODE_ENV=production` (`docker/next-app.Dockerfile`). `acorn_session` is not in this repo.

3. **CSRF.** `joined-frontend/lib/auth/csrf.ts` rejects email-auth posts that are not JSON or not same-origin (`Sec-Fetch-Site` / `Origin`).

4. **CORS.** `backend-core/httpkit/cors.go` echoes an origin only when it is in the configured list. It does not send `Access-Control-Allow-Origin: *` and it does not send `Access-Control-Allow-Credentials`.

5. **SSRF.** `backend-core/scout/fetch.go` `HTTPFetcher` dials with `Control: refusePrivate`. `PublicAddress` rejects loopback, private, link-local, and reserved ranges including `169.254.169.254`. Redirects are checked on each dial. `rules_test.go` covers those addresses.

6. **Kill switches.** `backend-core/killswitch/defaults.go` leaves a feature on when `KILLSWITCH_*` is unset. Checkout and scout submissions therefore run until an operator turns them off. That is the documented default, not an outage default.

7. **Live money.** `billing.LoadConfig` refuses `sk_live_` and `rk_live_` unless `STRIPE_ALLOW_LIVE=true`. Payout live hosts and tokens refuse unless `PAYOUT_ALLOW_LIVE=true` (`backend-core/scout/provider_config.go`). Neither flag is set by this branch.

8. **Admin authz.** When `ADMIN_API_TOKEN` is set, `admin-backend` compares the bearer with `subtle.ConstantTimeCompare` and writes the actor from `X-Admin-Actor`. When the token is empty, `cmd/server/main.go` logs a warning and staff routes accept unauthenticated calls. The admin compose profile is off unless `COMPOSE_PROFILES` includes `admin`, and `deploy/README.md` lists `ADMIN_API_TOKEN` as required with that profile. Turning the profile on without the token is unsafe. This pass accepts that risk because the default stack does not start admin, and a fail-closed change would break local admin tests that omit the token. It is not a Joined launch blocker.

9. **Extension.** `scout-extension/manifest.json` permissions include `scripting`, and `store/permission-justifications.md` explains it (on-demand extractor, no broad content-script match). The committed manifest lists local dev hosts. Production host permissions are the Scout API and Scoutwell origin, as that justifications file says. Step 66 records the store listing separately.

10. **Dependencies.** `bun run ci dependencies` enforces the catalog and a single `node_modules`. This tree has no OSV or gitleaks job. Adding one is optional and was not part of this report.

## Also noted

`e2e-smoke` stays `continue-on-error: true`. That is an accepted CI risk (Quinn), not an application vulnerability. `SENTRY_DSN` is optional and the reporter no-ops when it is empty, so a missing DSN does not crash the process.
