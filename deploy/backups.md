# Mongo backups

This is a runbook. It does not install a cron job, open a shell on the server, or store credentials. DNS cutover and deploy stay on `main`.

## What is backed up

Two databases on the Mongo instance named by `MONGO_URI`:

| Database | Env        | Default    |
| -------- | ---------- | ---------- |
| Joined   | `DEST_DB`  | `JoinedDB` |
| Acorn    | `ACORN_DB` | `AcornDB`  |

`MONGO_URI` comes from the GitHub `production` environment (or the local shell). Do not copy it into this file, a crontab, or a chat.

Archives land in `BACKUP_DIR`. That directory is local to the machine that runs the dump. This repo does not name an object-storage bucket.

## Frequency

Once a day. `deploy/check-backup.mjs` treats a dump as late after `BACKUP_MAX_AGE_MS` (26 hours), so a daily job has an hour of slack. Override the check with `BACKUP_MAX_AGE` (milliseconds). Leave it unset to use the named default.

## Dump sketch

Run from a shell that already has `MONGO_URI`. `mongodump` must be installed on that machine. Replace `BACKUP_DIR` with the directory you chose.

```bash
set -eu
: "${MONGO_URI:?MONGO_URI is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mongodump --uri="$MONGO_URI" --db="${DEST_DB:-JoinedDB}" \
  --archive="$BACKUP_DIR/joined-$stamp.archive" --gzip
mongodump --uri="$MONGO_URI" --db="${ACORN_DB:-AcornDB}" \
  --archive="$BACKUP_DIR/acorn-$stamp.archive" --gzip
```

A daily crontab can call that sketch. Put `MONGO_URI` in the service environment, not in the crontab line.

## Check

The check looks at `*.archive` mtimes under `BACKUP_DIR`. It exits 0 when the newest archive is within the max age, and exits non-zero when the directory is missing an archive or the newest one is older.

```bash
BACKUP_DIR=/var/backups/joined bun deploy/check-backup.mjs
```

Unit test (no Mongo, no network):

```bash
bun test deploy/check-backup.test.mjs
```
