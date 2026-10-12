# Local load harness

Read-only GETs against a locally running Joined API and the public job page. This command is local-only. CI does not run it, and it refuses `joinedhq.com` and any `*.joinedhq.com` host.

The human starts joined-backend and joined-frontend. This harness does not start them.

## Command

```bash
LOAD_JOB_ID=<local-fixture-id> bun tests/load/search.ts
```

| Variable          | Default                 | Role                                           |
| ----------------- | ----------------------- | ---------------------------------------------- |
| `LOAD_API_ORIGIN` | `http://127.0.0.1:8080` | `GET /v1/search/jobs`                          |
| `LOAD_WEB_ORIGIN` | `http://localhost:6002` | `GET /jobs/{id}`                               |
| `LOAD_JOB_ID`     | required                | Local fixture id. Never a production job slug. |

Named limits live in `thresholds.ts`:

| Constant           | Value |
| ------------------ | ----- |
| `LOAD_VUS`         | 4     |
| `LOAD_DURATION_MS` | 2000  |
| `LOAD_P95_MS`      | 500   |
| `LOAD_ERROR_RATE`  | 0.01  |

The process prints `samples`, `errors`, `error_rate`, and `p95_ms`, then exits 0 on `pass`. It exits 1 when a production host is configured, `LOAD_JOB_ID` is missing, every request fails before an HTTP status (`unreachable`), or p95 / error rate is over the named limit.

No POST, apply, checkout, or import.

Unit tests cover percentile math, the production-host guard, and the exit decision. They do not open a socket:

```bash
bun test tests/load/stats.test.ts
```
