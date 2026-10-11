#!/usr/bin/env bash
#
# Adds one clinic to this server. Run as root:
#
#   sudo /srv/clinic/repo/deploy/add-clinic.sh <slug> [--plan STANDARD]
#
# Picks a free port, writes the clinic's env file with a FRESH JWT secret,
# creates its data directory, runs its migrations and seed, configures
# nginx with TLS, and starts the service.
#
# What it does NOT do: create the Neon database. You paste that connection
# string in when asked, because it is the one secret this script should not
# be able to mint on its own.
set -euo pipefail

ROOT=/srv/clinic
ENV_DIR="$ROOT/env"
DATA_DIR="$ROOT/data"
PORT_BASE=4101

SLUG="${1:-}"
PLAN=STANDARD
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --plan) PLAN="${2:-STANDARD}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "Run as root (sudo $0 <slug>)"
[ -n "$SLUG" ] || die "Usage: sudo $0 <slug> [--plan BASIC|STANDARD|PREMIUM]"
[ -d "$ROOT/repo" ] || die "Run deploy/bootstrap-server.sh first"

# ── Validate the slug as a hostname ───────────────────────────────────
# The slug becomes <slug>.yourco.in, so the same rules the provider API
# enforces have to hold here. A clinic called "api" would claim the
# platform's own hostname.
RESERVED="www app api console admin portal dashboard staff provider status docs help support cdn assets static mail smtp ns1 ns2 dev test staging demo sandbox clinic doctor patient book queue live"
case "$SLUG" in
  *[!a-z0-9-]*) die "Slug must be lowercase letters, numbers and hyphens only." ;;
  -*|*-)        die "Slug cannot start or end with a hyphen." ;;
  xn--*)        die "Slug cannot start with 'xn--'." ;;
esac
[ "${#SLUG}" -ge 2 ] || die "Slug must be at least 2 characters."
[ "${#SLUG}" -le 63 ] || die "Slug must be 63 characters or fewer (DNS label limit)."
for r in $RESERVED; do
  [ "$SLUG" = "$r" ] && die "'$SLUG' is reserved by the platform. Try '${SLUG}-clinic'."
done
[ -f "$ENV_DIR/$SLUG.env" ] && die "'$SLUG' already exists at $ENV_DIR/$SLUG.env"

# ── Pick a free port ──────────────────────────────────────────────────
# Reads the ports already assigned rather than counting files, so removing
# a clinic does not cause the next one to collide with a live service.
log "Assigning a port"
USED="$(grep -hoP '^PORT=\K[0-9]+' "$ENV_DIR"/*.env 2>/dev/null | sort -n || true)"
PORT=$PORT_BASE
while printf '%s\n' "$USED" | grep -qx "$PORT" || ss -ltn "sport = :$PORT" 2>/dev/null | grep -q LISTEN; do
  PORT=$((PORT + 1))
  [ "$PORT" -gt 4999 ] && die "No free port below 5000 -- something is wrong"
done
info "port $PORT"

# ── Platform domain ───────────────────────────────────────────────────
PLATFORM_DOMAIN="$(grep -hoP '^PLATFORM_DOMAIN=\K.*' "$ENV_DIR/provider.env" 2>/dev/null | tr -d '"' || true)"
[ -n "$PLATFORM_DOMAIN" ] || die "PLATFORM_DOMAIN is not set in $ENV_DIR/provider.env -- set it first"
API_HOST="$SLUG-api.$PLATFORM_DOMAIN"
info "api hostname: $API_HOST"

# ── The database ──────────────────────────────────────────────────────
log "This clinic's database"
cat <<PROMPT
    Create a NEW Neon project (region ap-south-1 / Mumbai) for this
    clinic and paste its connection string below.

    Each clinic has its own database. Do NOT reuse another clinic's --
    there is no clinicId anywhere in the schema, so two clinics sharing a
    database would see each other's patients.

PROMPT
read -rsp "    DATABASE_URL: " DB_URL
echo
[ -n "$DB_URL" ] || die "No connection string given"
case "$DB_URL" in
  postgres://*|postgresql://*) ;;
  *) die "That does not look like a Postgres connection string" ;;
esac

# Refuse a URL already in use. This is the single most damaging mistake
# available here, and it is a silent one: the clinic would appear to work
# while reading another clinic's records.
for existing in "$ENV_DIR"/*.env; do
  [ -f "$existing" ] || continue
  if grep -qF -- "$DB_URL" "$existing" 2>/dev/null; then
    die "That database is already used by $(basename "$existing" .env). Create a separate one."
  fi
done

# ── Write the env file ────────────────────────────────────────────────
log "Writing $ENV_DIR/$SLUG.env"
JWT="$(openssl rand -base64 32)"
install -o deploy -g deploy -m 600 /dev/null "$ENV_DIR/$SLUG.env"
cat > "$ENV_DIR/$SLUG.env" <<ENVFILE
# $SLUG -- generated $(date -u +%Y-%m-%dT%H:%M:%SZ) by add-clinic.sh
NODE_ENV=production
PORT=$PORT

# This clinic's database, and nothing else's.
DATABASE_URL="$DB_URL"

# Freshly generated for this clinic. Never shared: a token minted at one
# clinic must not be valid at another.
JWT_SECRET="$JWT"

CLINIC_PLAN=$PLAN
CORS_ORIGINS=https://$SLUG.$PLATFORM_DOMAIN,https://$SLUG.portal.$PLATFORM_DOMAIN
ENVFILE
chmod 600 "$ENV_DIR/$SLUG.env"
chown deploy:deploy "$ENV_DIR/$SLUG.env"
info "plan $PLAN, own JWT secret, 0600"

# ── Data directory ────────────────────────────────────────────────────
log "Creating $DATA_DIR/$SLUG"
install -d -o deploy -g deploy -m 750 "$DATA_DIR/$SLUG"
install -d -o deploy -g deploy -m 750 "$DATA_DIR/$SLUG/uploads"
info "uploads/ lives here, outside releases, so deploys never touch it"

# ── Migrate and seed ──────────────────────────────────────────────────
log "Migrating"
sudo -u deploy bash -c "cd '$ROOT/current/apps/clinic-api' && DATABASE_URL='$DB_URL' npx prisma migrate deploy" \
  || die "migration failed -- $ENV_DIR/$SLUG.env was written, so fix and re-run just this step"

log "Seeding the clinic record and first login"
read -rp "    Clinic name (e.g. Acme Clinic): " CLINIC_NAME
# Printed at the top of every prescription and certificate, so it wants
# the honorific the clinic actually uses. The app adds "Dr." only when it
# is absent, so either form is safe.
read -rp "    Doctor's name as it should print (e.g. Dr. Asif Khan): " DOCTOR_NAME
read -rp "    Doctor's login email: " DOCTOR_EMAIL
DOCTOR_PASS="$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-14)"

sudo -u deploy bash -c "cd '$ROOT/current/apps/clinic-api' && \
  DATABASE_URL='$DB_URL' \
  CLINIC_SEED_NAME='$CLINIC_NAME' \
  CLINIC_SEED_DOCTOR_NAME='$DOCTOR_NAME' \
  CLINIC_SEED_EMAIL='$DOCTOR_EMAIL' \
  CLINIC_SEED_PASSWORD='$DOCTOR_PASS' \
  CLINIC_PLAN='$PLAN' \
  npx tsx prisma/seed-clinic.ts" || die "seed failed"

# ── nginx + TLS ───────────────────────────────────────────────────────
log "Configuring nginx for $API_HOST"
cat > "/etc/nginx/sites-available/$API_HOST" <<NGINX
server {
  listen 80;
  server_name $API_HOST;

  # Patient scans and lab reports. The app caps uploads itself; this is
  # the matching limit at the edge, and nginx's default of 1m would
  # reject a chest X-ray before the app ever saw it.
  client_max_body_size 12m;

  location / {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    # PDF generation on a slow box can take a while.
    proxy_read_timeout 120s;
  }
}
NGINX
ln -sfn "/etc/nginx/sites-available/$API_HOST" "/etc/nginx/sites-enabled/$API_HOST"
nginx -t > /dev/null 2>&1 || die "nginx config is invalid"
systemctl reload nginx
info "proxying to 127.0.0.1:$PORT"

log "Requesting a certificate"
if certbot --nginx -d "$API_HOST" --non-interactive --agree-tos \
     --register-unsafely-without-email --redirect > /tmp/certbot-$SLUG.log 2>&1; then
  info "TLS active"
else
  info "certbot failed -- check /tmp/certbot-$SLUG.log and that $API_HOST resolves to this server"
fi

# ── Start ─────────────────────────────────────────────────────────────
log "Starting clinic-api@$SLUG"
systemctl enable --now "clinic-api@$SLUG"
sleep 4
systemctl is-active --quiet "clinic-api@$SLUG" \
  || die "service did not start. journalctl -u clinic-api@$SLUG -n 40"
CODE="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:$PORT/health" || echo 000)"
[ "$CODE" = "200" ] || die "health check returned $CODE. journalctl -u clinic-api@$SLUG -n 40"
info "health 200"

# ── Done ──────────────────────────────────────────────────────────────
cat <<DONE

$(printf '\033[1m')$CLINIC_NAME is live.$(printf '\033[0m')

  Patient site   https://$SLUG.$PLATFORM_DOMAIN
  Staff portal   https://$SLUG.portal.$PLATFORM_DOMAIN
  API            https://$API_HOST

  Login          $DOCTOR_EMAIL
  Password       $DOCTOR_PASS

  $(printf '\033[33m')Write that password down now -- it is not stored anywhere.$(printf '\033[0m')
  Have them change it at first login.

Last step, in your provider console: create the account with slug
'$SLUG', set apiDomain to '$API_HOST', and set status to LIVE. The two
patient-facing URLs above will not resolve a clinic until you do.

DONE
