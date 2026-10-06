#!/usr/bin/env bash
# One-time setup of the production VPS, run as root. Safe to run again: it only
# adds what is missing and never touches other projects on the server.
#
#   scp -r deploy root@<vps>:/tmp/joined-deploy
#   ssh root@<vps> bash /tmp/joined-deploy/bootstrap-vps.sh "<deploy public key>"
#
# Afterwards, add HTTPS once DNS points here:
#   certbot --nginx -d joinedhq.com -d www.joinedhq.com
#   certbot --nginx -d api.joinedhq.com
set -euo pipefail

DEPLOY_USER=deploy
DEPLOY_DIR=/srv/joined
SITE=joinedhq.com
API_SITE=api.joinedhq.com
HERE="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_KEY="${1:?usage: bootstrap-vps.sh \"<deploy public key>\"}"

# The user GitHub Actions deploys as. It runs Docker, which is root-equivalent,
# but has its own key that can be revoked without touching root's access.
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
  passwd --lock "$DEPLOY_USER" >/dev/null
fi
usermod -aG docker "$DEPLOY_USER"
home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$home/.ssh"
keys="$home/.ssh/authorized_keys"
touch "$keys"
grep -qxF "$DEPLOY_KEY" "$keys" || printf '%s\n' "$DEPLOY_KEY" >> "$keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$keys"
chmod 600 "$keys"

# Where the workflow puts compose.yml and the production .env.
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_DIR"

# The nginx sites: joinedhq.com and the API (joined-backend). An existing one is
# kept: certbot has added HTTPS to it.
install -d -m 755 /var/www/joinedhq
install -m 644 "$HERE/nginx/starting.html" /var/www/joinedhq/starting.html
for site in "$SITE" "$API_SITE"; do
  if [ ! -e "/etc/nginx/sites-available/$site" ]; then
    install -m 644 "$HERE/nginx/$site.conf" "/etc/nginx/sites-available/$site"
  fi
  ln -sfn "/etc/nginx/sites-available/$site" "/etc/nginx/sites-enabled/$site"
done
nginx -t
systemctl reload nginx

echo "Ready: $DEPLOY_USER can deploy to $DEPLOY_DIR, and nginx serves $SITE and $API_SITE."
