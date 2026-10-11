#!/usr/bin/env bash
#
# One-time server setup. Run ONCE on a fresh Ubuntu 24.04 box, as root:
#
#   curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/deploy/bootstrap-server.sh | bash -s -- <git-url>
#
# or, having copied the repo across:
#
#   sudo bash deploy/bootstrap-server.sh https://github.com/<you>/<repo>.git
#
# Installs Node, nginx and certbot, creates the deploy user and the
# directory layout, installs the systemd units, and sets up a firewall.
# Idempotent: safe to re-run, and it will tell you what it skipped.
set -euo pipefail

GIT_URL="${1:-}"
ROOT=/srv/clinic
DEPLOY_USER=deploy
NODE_MAJOR=22

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
skip() { printf '    \033[2m%s\033[0m\n' "$*"; }
die()  { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "Run as root (sudo bash $0 <git-url>)"
[ -n "$GIT_URL" ] || die "Usage: sudo bash $0 <git-url>"

# ── Packages ──────────────────────────────────────────────────────────
log "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw jq postgresql-client

if ! command -v node > /dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt "$NODE_MAJOR" ]; then
  info "installing Node $NODE_MAJOR"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - > /dev/null
  apt-get install -y -qq nodejs
else
  skip "Node $(node -v) already present"
fi
info "node $(node -v), npm $(npm -v)"

# ── Unattended security updates ───────────────────────────────────────
# This box holds patient data and nobody is going to remember to patch it
# by hand every week.
log "Enabling automatic security updates"
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades > /dev/null 2>&1 || true
info "enabled"

# ── Deploy user ───────────────────────────────────────────────────────
log "Creating the $DEPLOY_USER user"
if id "$DEPLOY_USER" > /dev/null 2>&1; then
  skip "$DEPLOY_USER already exists"
else
  adduser --system --group --shell /bin/bash --home "/home/$DEPLOY_USER" "$DEPLOY_USER"
  info "created"
fi
mkdir -p "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

# The deploy user restarts services but must not become root wholesale.
# Scoped to exactly the units it manages -- a deploy key stolen from CI
# then gets service restarts, not the machine.
log "Granting scoped sudo for service restarts"
cat > /etc/sudoers.d/clinic-deploy <<'SUDOERS'
deploy ALL=(root) NOPASSWD: /bin/systemctl restart provider-api, \
                            /bin/systemctl restart clinic-api@*, \
                            /bin/systemctl start provider-api, \
                            /bin/systemctl start clinic-api@*, \
                            /bin/systemctl stop provider-api, \
                            /bin/systemctl stop clinic-api@*, \
                            /bin/systemctl enable clinic-api@*, \
                            /bin/systemctl daemon-reload
SUDOERS
chmod 440 /etc/sudoers.d/clinic-deploy
visudo -c -q -f /etc/sudoers.d/clinic-deploy || die "the sudoers snippet is invalid -- not applying"
info "restarts only, not full root"

# ── Directory layout ──────────────────────────────────────────────────
log "Creating $ROOT"
mkdir -p "$ROOT"/{releases,env,data,backups}
# env/ holds every clinic's DATABASE_URL in plain text. 0700 so only the
# deploy user can read it, and it must never be world-readable.
chmod 700 "$ROOT/env"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ROOT"
info "releases/ env/ data/ backups/"

if [ -d "$ROOT/repo/.git" ]; then
  skip "repo already cloned"
else
  log "Cloning the repository"
  sudo -u "$DEPLOY_USER" git clone --quiet "$GIT_URL" "$ROOT/repo"
  info "$GIT_URL"
fi
mkdir -p "$ROOT/data/provider"
chown "$DEPLOY_USER:$DEPLOY_USER" "$ROOT/data/provider"

# ── systemd units ─────────────────────────────────────────────────────
log "Installing systemd units"
install -m 644 "$ROOT/repo/deploy/systemd/clinic-api@.service" /etc/systemd/system/
install -m 644 "$ROOT/repo/deploy/systemd/provider-api.service" /etc/systemd/system/
systemctl daemon-reload
info "clinic-api@.service (template), provider-api.service"

# ── Nightly backups ───────────────────────────────────────────────────
# A database dump alone is NOT a backup here: patient scans live on this
# disk, not in Postgres. This takes both.
log "Installing the nightly backup job"
install -m 755 "$ROOT/repo/deploy/backup.sh" /usr/local/bin/clinic-backup
cat > /etc/cron.d/clinic-backup <<'CRON'
# Nightly at 02:15 server time. Runs as deploy, which can read env/.
15 2 * * * deploy /usr/local/bin/clinic-backup >> /var/log/clinic-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/clinic-backup
touch /var/log/clinic-backup.log
chown "$DEPLOY_USER:$DEPLOY_USER" /var/log/clinic-backup.log
info "02:15 nightly -> $ROOT/backups (databases AND uploads)"

# ── Firewall ──────────────────────────────────────────────────────────
log "Configuring the firewall"
ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow OpenSSH > /dev/null
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
ufw --force enable > /dev/null
# The clinic APIs listen on 4101+ but are NOT opened: nginx reaches them
# over loopback. Exposing them directly would skip TLS and the rate limits
# that nginx applies in front.
info "22, 80, 443 only -- API ports stay on loopback"

# ── Next steps ────────────────────────────────────────────────────────
HOSTKEY="$(ssh-keyscan -H "$(hostname -I | awk '{print $1}')" 2>/dev/null | head -2 || true)"

cat <<NEXT

$(printf '\033[1m')Server ready.$(printf '\033[0m')

1. Add your CI deploy key so GitHub Actions can connect:

     echo '<the PUBLIC key>' >> /home/$DEPLOY_USER/.ssh/authorized_keys

2. Write the provider API's config:

     sudo -u $DEPLOY_USER nano $ROOT/env/provider.env

   It needs: NODE_ENV=production, PORT=4200, DATABASE_URL, JWT_SECRET,
   PLATFORM_DOMAIN, CORS_ORIGINS, NEON_API_KEY.
   Generate a secret with:  openssl rand -base64 32

3. First deploy:

     sudo -u $DEPLOY_USER DEPLOY_REF=main $ROOT/repo/deploy/deploy.sh

4. Add a clinic (repeat per clinic):

     sudo $ROOT/repo/deploy/add-clinic.sh acme

5. Set these GitHub repository secrets:

     DEPLOY_HOST      $(hostname -I | awk '{print $1}')
     DEPLOY_USER      $DEPLOY_USER
     DEPLOY_SSH_KEY   the PRIVATE half of the key from step 1
     DEPLOY_HOST_KEY  (pins this server's identity -- paste the below)

$(printf '%s\n' "$HOSTKEY" | sed 's/^/       /')

NEXT
