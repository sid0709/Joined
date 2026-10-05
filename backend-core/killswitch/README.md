# killswitch

Runtime kill switches so staff can turn off risky features without a deploy.

Env is the default. A document in `kill_switches` overrides it. Each process caches Mongo for `KILLSWITCH_CACHE_MS` (default 5s). A Mongo blip keeps the last cache, or env if nothing has been read yet — it does not take features down.

Switches default **on**. `off`, `false`, `0`, `no`, or `disabled` turns one off.

| Name                | Env                            | Wired here                                                  | Penny                                                                |
| ------------------- | ------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `signup`            | `KILLSWITCH_SIGNUP`            | `authapi` email sign-up and new Google accounts             | Scoutwell uses the same `authapi` handlers; pass `Handlers.Switches` |
| `email`             | `KILLSWITCH_EMAIL`             | `authapi` outbound mail                                     | same                                                                 |
| `job_imports`       | `KILLSWITCH_JOB_IMPORTS`       | admin migration copy steps and `copyjobs` / `copycompanies` | —                                                                    |
| `acorn_ai`          | `KILLSWITCH_ACORN_AI`          | `acornapi` model routes                                     | —                                                                    |
| `scout_submissions` | `KILLSWITCH_SCOUT_SUBMISSIONS` | staff flip only                                             | Scoutwell `POST /v1/scout/submissions`, `/batch`, `/extension`       |
| `checkout`          | `KILLSWITCH_CHECKOUT`          | staff flip only                                             | `billing.Handlers` checkout when mounted in joined-backend           |

Staff (admin-backend, already behind the admin token and staff session):

- `GET /v1/admin/kill-switches`
- `PUT /v1/admin/kill-switches/{name}` body `{ "enabled": false, "note": "…" }` → `{ "switch": {}, "auditId": "" }`

Flips write `admin_audit` (`action` `kill_switch.enable` / `kill_switch.disable`, `subjectType` `kill_switch`). No production flips in this step. No admin UI.

## Penny

Do not edit `scoutwell-backend` or `backend-core/billing` in the Ravi PR. Wiring is:

Scoutwell, after `platform.Open`, pass `p.KillSwitches` into `httpapi.New`, then at the top of `scoutSubmit`, `scoutSubmitBatch`, and `scoutSubmitExtension`:

```go
if err := killswitch.Check(r.Context(), s.switches, killswitch.ScoutSubmissions); err != nil {
    killswitch.WriteDisabled(w, killswitch.ScoutSubmissions)
    return
}
```

Billing checkout, when `billing.Handlers.Register` is mounted on joined-backend, wrap the checkout handler (or check inside `postCheckout` before `CreateCheckoutSession`):

```go
if err := killswitch.Check(r.Context(), switches, killswitch.Checkout); err != nil {
    killswitch.WriteDisabled(w, killswitch.Checkout)
    return
}
```

Tests use `killswitch.NewMemory`. Live Mongo tests skip unless `MONGODB_TEST_URI` is set.
