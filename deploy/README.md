# Production deploy

Every merge to `main` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. **Images.** Each service is built into a Docker image and pushed to Docker Hub as `<DOCKERHUB_USERNAME>/joined:<service>-sha-<commit>` (and `<service>-latest`). The Go APIs use [`docker/go-service.Dockerfile`](../docker/go-service.Dockerfile); the Next.js apps use [`docker/next-app.Dockerfile`](../docker/next-app.Dockerfile).
2. **Deploy.** The workflow writes a `.env` from the GitHub `production` environment, copies it and [`compose.yml`](compose.yml) to `/srv/joined` on the VPS, pulls the new images, restarts the stack, and checks that the API's `/health` and the homepage answer.

You can also run it by hand: Actions → Deploy → Run workflow (from `main`).

## What runs where

| Service              | Container port | VPS port (127.0.0.1 only) | Runs by default                                |
| -------------------- | -------------- | ------------------------- | ---------------------------------------------- |
| `joined-frontend`    | 3000           | 6002                      | yes — nginx serves it on joinedhq.com          |
| `joined-backend`     | 8080           | 11080                     | yes                                            |
| `scoutwell-frontend` | 3000           | 6003                      | with `COMPOSE_PROFILES` containing `scoutwell` |
| `scoutwell-backend`  | 8080           | 11082                     | with `scoutwell`                               |
| `admin-frontend`     | 3000           | 6010                      | with `admin`                                   |
| `admin-backend`      | 8080           | 11081                     | with `admin`                                   |
| `connected-frontend` | 3000           | 6004                      | with `connected`                               |
| `joined-theme`       | 3000           | 6001                      | with `theme`                                   |

Host ports are the dev ports + 3000, except `connected-frontend`: browsers refuse port 6000.
Nginx sends `joinedhq.com` to port 6002, and only Google's calendar redirect
(`/v1/me/calendar/google/callback`) to the API on 11080.

## GitHub `production` environment

Settings → Environments → `production`. Deployments are limited to `main`.

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
| `DEST_DB`                                                                          | `OpenedDB`                                            | optional (default)      |
| `COMPOSE_PROFILES`                                                                 | e.g. `scoutwell,admin`                                | optional (Joined only)  |
| `SCOUTWELL_ORIGIN`, `SCOUTWELL_GOOGLE_SIGNIN_REDIRECT_URL`, `SCOUT_PUBLIC_API_URL` | Scoutwell's public URLs                               | with `scoutwell`        |
| `ADMIN_ORIGIN`                                                                     | the admin console's URL                               | with `admin`            |

**Secrets** (encrypted, never shown again):

| Name                   | Value                                                           | Needed               |
| ---------------------- | --------------------------------------------------------------- | -------------------- |
| `VPS_SSH_KEY`          | the private deploy key (`~/.ssh/joinedhq_deploy_ed25519`)       | yes                  |
| `VPS_KNOWN_HOSTS`      | the VPS host key line, so the deploy refuses an impostor server | yes                  |
| `DOCKERHUB_TOKEN`      | a Docker Hub personal access token with Read & Write            | yes                  |
| `MONGO_URI`            | the API's MongoDB connection string                             | for the API to start |
| `GOOGLE_CLIENT_SECRET` | the OAuth client secret                                         | for Google features  |
| `OPENAI_API_KEY`       | reads job descriptions                                          | optional             |
| `ADMIN_API_TOKEN`      | the admin API's bearer token                                    | with `admin`         |
| `GEOAPIFY_API_KEY`     | address autocomplete                                            | optional             |

Inside a container, the VPS itself is `host.docker.internal`, so a MongoDB running on
the VPS is `mongodb://<user>:<password>@host.docker.internal:27017/OpenedDB?authSource=OpenedDB`.

## The VPS

Prepared once by [`bootstrap-vps.sh`](bootstrap-vps.sh), run as root: it creates the
`deploy` user (Docker access, key login only), `/srv/joined`, the nginx site, and the
page nginx shows while the containers are starting. HTTPS comes from certbot:

```bash
certbot --nginx -d joinedhq.com -d www.joinedhq.com
```

Useful on the server, as `deploy`:

```bash
cd /srv/joined && docker compose ps
```

```bash
cd /srv/joined && docker compose logs -f joined-backend
```
