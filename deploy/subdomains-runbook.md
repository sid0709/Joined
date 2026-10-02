# Runbook: serve scout.joinedhq.com and admin.joinedhq.com

Hand this to whoever does the work, a person or an agent. Do the steps in order.
Each step ends with a **Check**. Don't move on until it passes.

## Goal

| Domain               | nginx forwards to | Container (in `/srv/joined`) |
| -------------------- | ----------------- | ---------------------------- |
| `scout.joinedhq.com` | `127.0.0.1:6003`  | `scoutwell-frontend`         |
| `admin.joinedhq.com` | `127.0.0.1:6010`  | `admin-frontend`             |

Both get HTTPS from certbot. The backends (`11081`, `11082`) are not made public.
`joinedhq.com` is already live. **Don't change its nginx file**
(`/etc/nginx/sites-available/joinedhq.com`), and leave any other site on the
server alone too.

**Server:** `45.61.176.179` (Ubuntu, nginx, Docker, certbot). Log in as `root`.

## Before you start (the owner does these)

- [ ] GitHub `production` environment is updated: `COMPOSE_PROFILES=scoutwell,admin`,
      `SCOUTWELL_ORIGIN`, `ADMIN_ORIGIN`, `ADMIN_API_TOKEN` and the rest. Then
      **Actions → Deploy** has been run once and passed.
- [ ] You have SSH access to `root@45.61.176.179`. Ask the owner for it, and never
      paste a password into a chat or a ticket. With a key:
      `ssh-copy-id -i ~/.ssh/<your-key>.pub root@45.61.176.179`, which asks for
      the password once.
- [ ] The owner has given you the public IP address(es) allowed to open the admin
      console (see step 4).

---

## 1. DNS records (Hostinger)

The domain's DNS is at Hostinger (nameservers `*.dns-parking.com`).
Go to Hostinger → **Domains → joinedhq.com → DNS / Nameservers → Manage DNS records** and add:

| Type | Name    | Points to       | TTL     |
| ---- | ------- | --------------- | ------- |
| A    | `scout` | `45.61.176.179` | default |
| A    | `admin` | `45.61.176.179` | default |

If an old `scout` or `admin` record already exists (A, AAAA or CNAME), delete it.
Don't add an AAAA record unless the VPS has a working IPv6 address. A wrong AAAA
record breaks certbot.

**Check** from any computer (it can take a few minutes):

```bash
dig +short @1.1.1.1 scout.joinedhq.com
dig +short @1.1.1.1 admin.joinedhq.com
```

Both must print exactly `45.61.176.179`.

## 2. The containers are running

```bash
ssh root@45.61.176.179
cd /srv/joined && docker compose ps
```

**Check:** `scoutwell-frontend`, `scoutwell-backend`, `admin-frontend` and
`admin-backend` are listed as `running` / `Up`. Then:

```bash
curl -sI http://127.0.0.1:6003 | head -1
curl -sI http://127.0.0.1:6010 | head -1
```

Each one must print an `HTTP/1.1` line (200, 307 or 308 are all fine).
If a container is missing, the GitHub settings or the deploy aren't done. Stop and
tell the owner. Don't start containers by hand.

## 3. Look at the existing nginx setup

```bash
ls -l /etc/nginx/sites-enabled/
grep -rn "connection_upgrade_joined" /etc/nginx/
ls /var/www/joinedhq/starting.html
```

**Check:**

- `connection_upgrade_joined` is defined once, in the `joinedhq.com` site. The new
  sites use it. **Don't define it again**, or nginx refuses to start
  (`duplicate "connection_upgrade_joined" variable`).
- `starting.html` exists. It's the page shown while a container restarts.
- No existing site already uses `server_name scout.joinedhq.com` or `admin.joinedhq.com`
  (`grep -rn "scout.joinedhq.com\|admin.joinedhq.com" /etc/nginx/`).

## 4. Write the two sites

### Scout

```bash
cat > /etc/nginx/sites-available/scout.joinedhq.com <<'EOF'
# scout.joinedhq.com → scoutwell-frontend. certbot adds HTTPS to this file.
server {
    listen 80;
    listen [::]:80;
    server_name scout.joinedhq.com;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:6003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade_joined;
    }

    error_page 502 503 504 /starting.html;
    location = /starting.html {
        root /var/www/joinedhq;
        internal;
    }
}
EOF
```

### Admin (only allowed IPs)

The admin console has **no sign-in yet**. Anyone who can open it has full staff
access. Until Google Workspace sign-in ships, only the owner's IP addresses may
reach it. Replace `203.0.113.10` with the real address(es), one `allow` line each.
To find an address, the person opens https://ifconfig.me from their network.

```bash
cat > /etc/nginx/sites-available/admin.joinedhq.com <<'EOF'
# admin.joinedhq.com → admin-frontend. certbot adds HTTPS to this file.
# The console has no sign-in yet, so only these addresses may open it.
server {
    listen 80;
    listen [::]:80;
    server_name admin.joinedhq.com;

    client_max_body_size 10m;

    # certbot must reach this path from anywhere to issue the certificate.
    location /.well-known/acme-challenge/ {
        allow all;
        root /var/www/html;
    }

    location / {
        allow 203.0.113.10;
        deny all;

        proxy_pass http://127.0.0.1:6010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade_joined;
    }

    error_page 502 503 504 /starting.html;
    location = /starting.html {
        root /var/www/joinedhq;
        internal;
    }
}
EOF
mkdir -p /var/www/html
```

### Turn them on

```bash
ln -sfn /etc/nginx/sites-available/scout.joinedhq.com /etc/nginx/sites-enabled/scout.joinedhq.com
ln -sfn /etc/nginx/sites-available/admin.joinedhq.com /etc/nginx/sites-enabled/admin.joinedhq.com
nginx -t && systemctl reload nginx
```

**Check:** `nginx -t` prints `syntax is ok` and `test is successful`. If it fails,
read the error, fix that one file, and run `nginx -t` again. Never reload while
`nginx -t` is failing.

## 5. Check over plain HTTP

From your own computer (not the server):

```bash
curl -sI http://scout.joinedhq.com | head -1
curl -sI http://admin.joinedhq.com | head -1
```

**Check:**

- `scout` returns 200, 307 or 308.
- `admin` returns 200, 307 or 308 from an allowed IP, and **403** from any other IP.
  Test both if you can, for example from a phone on mobile data.

## 6. HTTPS with certbot

On the server:

```bash
certbot --nginx -d scout.joinedhq.com -d admin.joinedhq.com --redirect
```

If certbot asks for an email, use the owner's. Accept the terms only if the owner
agrees.

**Check:**

```bash
certbot certificates
certbot renew --dry-run
```

The certificate lists both domains, and the dry run ends with `succeeded`. Then,
from your own computer:

```bash
curl -sI https://scout.joinedhq.com | head -1
curl -sI http://scout.joinedhq.com | grep -i '^location'
```

HTTPS answers, and plain HTTP redirects to `https://scout.joinedhq.com/`.
Open both sites in a browser and confirm the padlock and that the page loads.

## 7. Google sign-in for Scout (Google Cloud Console)

Go to Google Cloud Console → **APIs & Services → Credentials →** the OAuth client
Scoutwell uses (the same client ID as `GOOGLE_CLIENT_ID` in GitHub) and add:

- **Authorized JavaScript origins:** `https://scout.joinedhq.com`
- **Authorized redirect URIs:** `https://scout.joinedhq.com/api/auth/google/callback`

Save, wait a few minutes, then sign in at https://scout.joinedhq.com with Google.

**Check:** sign-in finishes and ends up back on Scout, logged in.

Admin has no Google sign-in yet. That's separate development work: a dedicated
**Internal** OAuth client in the Workspace org's Google Cloud project, plus a
server-side check of the `hd` claim. Remove the IP allowlist from step 4 only
after that ships.

## 8. Lock down the server

1. **Change root's password**, since it has been shared: run `passwd` on the server,
   or reset it in the Hostinger VPS panel. Give the new one to the owner only.
2. **Turn off password login** only after key login works for everyone who needs it.
   Test it in a **second** terminal while the first stays logged in:

   ```bash
   grep -rn "^PasswordAuthentication\|^PermitRootLogin" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
   ```

   Set `PasswordAuthentication no` (in `/etc/ssh/sshd_config.d/00-no-password.conf`) and
   `PermitRootLogin prohibit-password`, then `sshd -t && systemctl reload ssh`.
   Open a new SSH session with the key before closing the old one.

3. **Only nginx is public.** Check:

   ```bash
   ss -tlnp | grep -E ':(6003|6010|11081|11082)\b'
   ```

   Every line must show `127.0.0.1:`, never `0.0.0.0:` or `*:`. If `ufw` is active
   (`ufw status`), it must allow `22`, `80` and `443`.

## Done when

- [ ] `https://scout.joinedhq.com` loads with a valid certificate, and Google sign-in works.
- [ ] `https://admin.joinedhq.com` loads from the allowed IPs and returns 403 from anywhere else.
- [ ] `https://joinedhq.com` still works exactly as before.
- [ ] `certbot renew --dry-run` succeeds.
- [ ] Root password changed. Password login off, if the owner agreed.

## Troubleshooting

| Symptom                                            | Cause → fix                                                                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dig` prints nothing                               | DNS record missing or not propagated yet. Re-check step 1 and wait.                                                                                 |
| `duplicate "connection_upgrade_joined" variable`   | A `map` block was copied into a new site. Delete it from the new file.                                                                              |
| The "starting" page, or 502                        | The container isn't running. `cd /srv/joined && docker compose ps`, then `docker compose logs --tail=100 scoutwell-frontend` (or `admin-frontend`). |
| certbot: `unauthorized` / `Timeout during connect` | DNS doesn't point here yet, port 80 is blocked (`ufw allow 80,443/tcp`), or an AAAA record points elsewhere.                                        |
| Admin returns 403 for the owner                    | Their IP changed or is wrong. Update the `allow` line, `nginx -t && systemctl reload nginx`.                                                        |
| Google: `redirect_uri_mismatch`                    | The URI in step 7 doesn't match `SCOUTWELL_GOOGLE_SIGNIN_REDIRECT_URL` in GitHub exactly (https, no trailing slash).                                |
