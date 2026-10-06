# Production deploy

A successful [CI](../.github/workflows/ci.yml) run on `main` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). A failed CI run does not deploy. The workflow builds the commit CI tested:

1. **Images.** [`tools/image-plan.mjs`](../tools/image-plan.mjs) compares the commit with the previous `main` tip. A service whose image inputs changed is built and pushed to Docker Hub as `<DOCKERHUB_USERNAME>/joined:<service>-sha-<commit>` and `<service>-latest`. Each other service gets the new `sha-<commit>` tag pointed at its existing `<service>-latest` image, so Compose can pull one tag for the whole stack without a rebuild. A Go image rebuilds when that service, `backend-core`, or `docker/go-service.Dockerfile` changes. A Next.js image rebuilds when that app, a workspace package it imports, the root lockfile or catalog, or `docker/next-app.Dockerfile` changes. A manual run builds every image.
2. **Deploy.** The workflow writes a `.env` from the GitHub `production` environment, copies it and [`compose.yml`](compose.yml) to `/srv/joined` on the VPS, pulls the new images, restarts the stack, and checks that joined-backend's `/health`, the last published `acorn-backend` image's `/health`, and the homepage answer. Acorn's source is in the Acorn repo; this stack does not build a new Acorn image.

You can also run it by hand: Actions → Deploy → Run workflow (from `main`).

## What runs where

| Service              | Container port | VPS port (127.0.0.1 only) | Runs by default                                |
| -------------------- | -------------- | ------------------------- | ---------------------------------------------- |
| `joined-frontend`    | 3000           | 6002                      | yes — nginx serves it on joinedhq.com          |
| `joined-backend`     | 8080           | 11080                     | yes                                            |
| `acorn-backend`      | 8080           | 11083                     | yes — last image, not built from this repo     |
| `scoutwell-frontend` | 3000           | 6003                      | with `COMPOSE_PROFILES` containing `scoutwell` |
| `scoutwell-backend`  | 8080           | 11082                     | with `scoutwell`                               |
| `admin-frontend`     | 3000           | 6010                      | with `admin`                                   |
| `admin-backend`      | 8080           | 11081                     | with `admin`                                   |
| `connected-frontend` | 3000           | 6004                      | with `connected`                               |

Host ports are the dev ports + 3000, except `connected-frontend`: browsers refuse port 6000.
Nginx sends `joinedhq.com` to port 6002, and only Google's calendar redirect
(`/v1/me/calendar/google/callback`) to the API on 11080. `api.joinedhq.com` goes to
acorn-backend on 11083 (the last image published before Acorn moved to its own repo): the extension calls `https://api.joinedhq.com/acorn/...` and
keeps a Socket.IO connection at `/acorn/socket.io` ([`nginx/api.joinedhq.com.conf`](nginx/api.joinedhq.com.conf)).

## GitHub `production` environment

Settings → Environments → `production`. Deployments are limited to `main`. The workflow reads every
non-secret setting from either a variable or a secret, so either place works; secrets
are hidden in logs, variables are easier to read and edit.

**Variables** (not secret):

| Name                                                                               | Value                                                 | Needed                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------- |
| `VPS_HOST`                                                                         | `45.61.176.179`                                       | yes                     |
| `VPS_USER`                                                                         | `deploy`                                              | yes                     |
| `VPS_SSH_PORT`                                                                     | `22`                                                  | optional (default 22)   |
| `DOCKERHUB_USERNAME`                                                               | your Docker Hub username                              | yes                     |
| `FRONTEND_ORIGIN`                                                                  | `https://joinedhq.com`                                | yes                     |
| `GOOGLE_CLIENT_ID`                                                                 | the OAuth client ID                                   | for Google features     |
| `GOOGLE_REDIRECT_URL`                                                              | `https://joinedhq.com/v1/me/calendar/google/callback` | for the calendar        |
| `GOOGLE_SIGNIN_REDIRECT_URL`                                                       | `https://joinedhq.com/api/auth/google/callback`       | for Sign in with Google |
| `DEST_DB`                                                                          | `JoinedDB`                                            | optional (default)      |
| `ACORN_DB`                                                                         | `AcornDB`                                             | optional (Acorn only)   |
| `ACORN_GOOGLE_SIGNIN_REDIRECT_URL`                                                 | Acorn's `/auth/google/callback`                       | with Google on Acorn    |
| `COMPOSE_PROFILES`                                                                 | e.g. `scoutwell,admin`                                | optional (Joined only)  |
| `SCOUTWELL_ORIGIN`, `SCOUTWELL_GOOGLE_SIGNIN_REDIRECT_URL`, `SCOUT_PUBLIC_API_URL` | Scoutwell's public URLs                               | with `scoutwell`        |
| `ADMIN_ORIGIN`                                                                     | the admin console's URL                               | with `admin`            |
| `SCOUTWELL_GOOGLE_CLIENT_ID`                                                       | Scoutwell's OAuth client ID (project `joined-scout`)  | with `scoutwell`        |
| `ADMIN_GOOGLE_CLIENT_ID`                                                           | the admin OAuth client ID (project `joined-admin`)    | with `admin`            |
| `ADMIN_GOOGLE_SIGNIN_REDIRECT_URL`                                                 | `<ADMIN_ORIGIN>/auth/google/callback`                 | with `admin`            |
| `ADMIN_GOOGLE_DOMAIN`                                                              | the staff Google Workspace domain                     | with `admin`            |

**Secrets** (encrypted, never shown again):

| Name                             | Value                                                                                                                      | Needed                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `VPS_SSH_KEY`                    | the private deploy key (`~/.ssh/joinedhq_deploy_ed25519`)                                                                  | yes                   |
| `VPS_KNOWN_HOSTS`                | the VPS host key line, so the deploy refuses an impostor server                                                            | yes                   |
| `DOCKERHUB_TOKEN`                | a Docker Hub personal access token with Read & Write                                                                       | yes                   |
| `MONGO_URI`                      | the API's MongoDB connection string                                                                                        | for the API to start  |
| `GOOGLE_CLIENT_SECRET`           | the OAuth client secret                                                                                                    | for Google features   |
| `OPENAI_API_KEY`                 | reads job descriptions; fallback for Acorn's AI                                                                            | optional              |
| `SETTINGS_ENCRYPTION_KEY`        | seals API keys staff save in the admin console (`openssl rand -base64 32`); same value for acorn-backend and admin-backend | for saved AI keys     |
| `DEEPSEEK_API_KEY`               | fallback for job analysis and company research when Settings → DeepSeek has no saved key                                   | optional with `admin` |
| `SCOUTWELL_GOOGLE_CLIENT_SECRET` | Scoutwell's OAuth client secret                                                                                            | with `scoutwell`      |
| `ADMIN_GOOGLE_CLIENT_SECRET`     | the admin OAuth client secret                                                                                              | with `admin`          |
| `ADMIN_API_TOKEN`                | the admin API's bearer token                                                                                               | with `admin`          |
| `GEOAPIFY_API_KEY`               | address autocomplete                                                                                                       | optional              |

Inside a container, the VPS itself is `host.docker.internal`, so a MongoDB running on
the VPS is `mongodb://<user>:<password>@host.docker.internal:27017/JoinedDB?authSource=JoinedDB`.

## The VPS

Prepared once by [`bootstrap-vps.sh`](bootstrap-vps.sh), run as root: it creates the
`deploy` user (Docker access, key login only), `/srv/joined`, the nginx site, and the
page nginx shows while the containers are starting. HTTPS comes from certbot:

```bash
certbot --nginx -d joinedhq.com -d www.joinedhq.com
```

### api.joinedhq.com

On a VPS bootstrapped before this site existed, add it once, as root:

1. DNS: an `A` record `api` → the VPS address (Hostinger → joinedhq.com → DNS, as in
   [subdomains-runbook.md](subdomains-runbook.md) step 1).
2. The site: `install -m 644 deploy/nginx/api.joinedhq.com.conf /etc/nginx/sites-available/api.joinedhq.com`,
   `ln -sfn /etc/nginx/sites-available/api.joinedhq.com /etc/nginx/sites-enabled/`, then
   `nginx -t && systemctl reload nginx`. Running `bootstrap-vps.sh` again does the same.
3. HTTPS: `certbot --nginx -d api.joinedhq.com --redirect`.

Check from any computer: `curl -s https://api.joinedhq.com/acorn/health` prints `{"ok":true}`.

Useful on the server, as `deploy`:

```bash
cd /srv/joined && docker compose ps
```

```bash
cd /srv/joined && docker compose logs -f joined-backend
```
