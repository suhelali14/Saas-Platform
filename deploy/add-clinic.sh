#!/usr/bin/env bash
#
# Adds one clinic to this server. Run as root:
#
#   sudo /srv/clinic/repo/deploy/add-clinic.sh <slug> [--plan STANDARD]
#
# Interactive by default. Every prompt also reads an environment
# variable, so the job runner can drive it without a terminal:
#
#   CLINIC_DATABASE_URL=...  CLINIC_NAME="Acme Clinic"
#   CLINIC_DOCTOR_NAME="Dr. A. Khan"  CLINIC_DOCTOR_EMAIL=a@b.c
#   NON_INTERACTIVE=1 add-clinic.sh acme --plan STANDARD
#
# With NON_INTERACTIVE set, a missing value is an error rather than a
# prompt -- a script that blocks forever on a hidden prompt is worse
# than one that fails.
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
# Something went wrong but the deployment is still usable. Yellow, on
# stderr, and it does NOT exit -- see the catalogue import.
warn() { printf '\033[33m    %s\033[0m\n' "$*" >&2; }

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
# Resume rather than refuse. Everything below checks whether its own
# step is already done, so a run that failed partway can be repeated
# and will only do what is left.
RESUMING=0
if [ -f "$ENV_DIR/$SLUG.env" ]; then
  RESUMING=1
  log "Resuming '$SLUG'"
  info "$ENV_DIR/$SLUG.env already exists -- finishing what is left"
fi

# ── Pick a free port ──────────────────────────────────────────────────
# Reads the ports already assigned rather than counting files, so removing
# a clinic does not cause the next one to collide with a live service.
if [ "$RESUMING" = "1" ]; then
  PORT="$(sed -n 's/^PORT=//p' "$ENV_DIR/$SLUG.env" | head -1)"
  [ -n "$PORT" ] || die "$ENV_DIR/$SLUG.env has no PORT; remove the file and start again"
  log "Port"
  info "reusing $PORT"
else
log "Assigning a port"
USED="$(grep -hoP '^PORT=\K[0-9]+' "$ENV_DIR"/*.env 2>/dev/null | sort -n || true)"
PORT=$PORT_BASE
while printf '%s\n' "$USED" | grep -qx "$PORT" || ss -ltn "sport = :$PORT" 2>/dev/null | grep -q LISTEN; do
  PORT=$((PORT + 1))
  [ "$PORT" -gt 4999 ] && die "No free port below 5000 -- something is wrong"
done
info "port $PORT"
fi

# ── Platform domain ───────────────────────────────────────────────────
PLATFORM_DOMAIN="$(grep -hoP '^PLATFORM_DOMAIN=\K.*' "$ENV_DIR/provider.env" 2>/dev/null | tr -d '"' || true)"
[ -n "$PLATFORM_DOMAIN" ] || die "PLATFORM_DOMAIN is not set in $ENV_DIR/provider.env -- set it first"
# Two labels, deliberately: <slug>.api.<domain>, not <slug>-api.<domain>.
# A DNS wildcard matches exactly one label, so "acme-api.example.in" is
# matched by "*.example.in" -- which points at Vercel -- and the clinic's
# API would resolve to the static site host instead of this server.
# "acme.api.example.in" is two labels, so it misses that wildcard and is
# caught by "*.api.example.in" pointing here.
API_HOST="$SLUG.api.$PLATFORM_DOMAIN"

# Any domain of the clinic's own, recorded before it was provisioned.
# Each is checked against the shape @fastify/cors compares literally --
# scheme, host, nothing else. A trailing slash here would never match the
# Origin a browser actually sends, and the env file would still look right.
EXTRA_ORIGINS=""
if [ -n "${CLINIC_EXTRA_ORIGINS:-}" ]; then
  IFS="," read -ra _origins <<< "$CLINIC_EXTRA_ORIGINS"
  for _o in "${_origins[@]}"; do
    _o="$(printf '%s' "$_o" | tr -d '[:space:]')"
    [ -n "$_o" ] || continue
    printf '%s' "$_o" | grep -qE '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+$' \
      || die "CLINIC_EXTRA_ORIGINS contains '$_o', which is not a plain https origin"
    EXTRA_ORIGINS="$EXTRA_ORIGINS,$_o"
  done
fi
info "api hostname: $API_HOST"

# ── The database ──────────────────────────────────────────────────────
if [ "$RESUMING" = "1" ]; then
  DB_URL="$(sed -n 's/^DATABASE_URL=//p' "$ENV_DIR/$SLUG.env" | head -1)"
  [ -n "$DB_URL" ] || die "$ENV_DIR/$SLUG.env has no DATABASE_URL"
  log "Database"
  info "reusing the database already recorded for this clinic"
else
log "This clinic's database"
cat <<PROMPT
    Create a NEW Neon project (region aws-ap-southeast-1 / Singapore) for this
    clinic and paste its connection string below.

    Each clinic has its own database. Do NOT reuse another clinic's --
    there is no clinicId anywhere in the schema, so two clinics sharing a
    database would see each other's patients.

PROMPT
if [ -n "${CLINIC_DATABASE_URL:-}" ]; then
  DB_URL="$CLINIC_DATABASE_URL"
  info "connection string supplied by the caller"
elif [ -n "${NON_INTERACTIVE:-}" ]; then
  die "CLINIC_DATABASE_URL is required when NON_INTERACTIVE is set"
else
  read -rsp "    DATABASE_URL: " DB_URL
  echo
fi
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
fi

if [ "$RESUMING" = "1" ]; then
  log "Configuration"
  # Deliberately untouched. A regenerated JWT_SECRET would sign out
  # every user of this clinic, and a regenerated DATABASE_URL would
  # point the container at an empty database while the patients stayed
  # in the old one.
  info "keeping the existing env file, secrets included"
else
log "Writing $ENV_DIR/$SLUG.env"
JWT="$(openssl rand -base64 32)"
install -o deploy -g deploy -m 600 /dev/null "$ENV_DIR/$SLUG.env"
cat > "$ENV_DIR/$SLUG.env" <<ENVFILE
# $SLUG -- generated $(date -u +%Y-%m-%dT%H:%M:%SZ) by add-clinic.sh
NODE_ENV=production
PORT=$PORT

# This clinic's database, and nothing else's.
#
# UNQUOTED, deliberately. These files are read two ways: the shell
# sources them (which strips quotes) and `docker run --env-file` reads
# them literally (which does not). A quoted value therefore reaches the
# container with the quote characters still attached, and Prisma rejects
# it with "the URL must start with the protocol postgresql://" -- an
# error that says nothing about quoting.
DATABASE_URL=$DB_URL

# Freshly generated for this clinic. Never shared: a token minted at one
# clinic must not be valid at another.
JWT_SECRET=$JWT

CLINIC_PLAN=$PLAN
CORS_ORIGINS=https://$SLUG.$PLATFORM_DOMAIN,https://$SLUG.portal.$PLATFORM_DOMAIN$EXTRA_ORIGINS
ENVFILE
chmod 600 "$ENV_DIR/$SLUG.env"
chown deploy:deploy "$ENV_DIR/$SLUG.env"
info "plan $PLAN, own JWT secret, 0600"
fi

# ── Data directory ────────────────────────────────────────────────────
log "Creating $DATA_DIR/$SLUG"
# Owned by deploy, matching the rest of the data tree. The container is
# run as this uid (render-compose.sh reads it from the directory), so the
# two cannot drift apart.
install -d -o deploy -g deploy -m 750 "$DATA_DIR/$SLUG"
install -d -o deploy -g deploy -m 750 "$DATA_DIR/$SLUG/uploads"
info "uploads/ is bind-mounted into the container, so deploys never touch it"

# ── Migrate and seed ──────────────────────────────────────────────────
# Both run inside the deployed image, so they use exactly the migrations
# and seed script that shipped with the running code rather than whatever
# happens to be checked out on the host.
IMAGE="$(cat "$ROOT/.image" 2>/dev/null || true)"
[ -n "$IMAGE" ] || die "No image deployed yet. Run a deploy first (push to master, or deploy-image.sh)."
info "using $IMAGE"

log "Migrating"
docker run --rm --env-file "$ENV_DIR/$SLUG.env" -w /app/apps/clinic-api \
  "$IMAGE" npx prisma migrate deploy \
  || die "migration failed -- $ENV_DIR/$SLUG.env was written, so fix the connection string and re-run"

log "Seeding the clinic record and first login"
ask() {  # ask <var-name> <env-value> <prompt>
  local __var="$1" __env="$2" __prompt="$3"
  if [ -n "$__env" ]; then
    printf -v "$__var" '%s' "$__env"
  elif [ -n "${NON_INTERACTIVE:-}" ]; then
    die "$__var is required when NON_INTERACTIVE is set"
  else
    read -rp "$__prompt" "$__var"
  fi
}

ask CLINIC_NAME "${CLINIC_NAME:-}" "    Clinic name (e.g. Acme Clinic): "
# Printed at the top of every prescription and certificate, so it wants
# the honorific the clinic actually uses. The app adds "Dr." only when it
# is absent, so either form is safe.
ask DOCTOR_NAME "${CLINIC_DOCTOR_NAME:-}" "    Doctor's name as it should print (e.g. Dr. Asif Khan): "
ask DOCTOR_EMAIL "${CLINIC_DOCTOR_EMAIL:-}" "    Doctor's login email: "
DOCTOR_PASS="$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-14)"

docker run --rm \
  --env-file "$ENV_DIR/$SLUG.env" \
  -e CLINIC_SEED_NAME="$CLINIC_NAME" \
  -e CLINIC_SEED_DOCTOR_NAME="$DOCTOR_NAME" \
  -e CLINIC_SEED_EMAIL="$DOCTOR_EMAIL" \
  -e CLINIC_SEED_PASSWORD="$DOCTOR_PASS" \
  -w /app/apps/clinic-api \
  "$IMAGE" npx tsx prisma/seed-clinic.ts \
  || die "seed failed"

# ── The medicine catalogue ────────────────────────────────────────────
#
# This step did not exist, and its absence is why the first clinic could
# not search for a medicine. seed-clinic.ts creates the clinic, the first
# login and the lab-test list, then prints "Drug table is empty -- run
# npm run seed:drugs" and carries on. Nothing ever ran it. So the
# prescription screen -- the core of the product -- had an autocomplete
# over nothing, on a table the dev database had 246,069 rows in.
#
# It is ~246,000 rows from a 32MB download, inserted in batches of 5,000,
# so it is bound by round trips to the database rather than by CPU. Expect
# SEVERAL MINUTES, and longer the further the database is from the host --
# a run from a laptop to Neon took over ten. From this VPS to a Neon
# project in the same region it is considerably quicker, but do not stand
# over it expecting a minute.
#
# Idempotent: import-drugs.ts replaces only the rows it imported
# (addedManually = false), so a resumed provision does not duplicate
# anything and never touches a medicine a doctor added by hand. Verified:
# a re-import left the one hand-added drug untouched, same id, and the
# script's own count check reported 246,069 against 246,068 imported.
#
# A failure here does NOT abort. Everything above it is already correct
# and the clinic is usable -- a doctor can still type a medicine name
# freely, the field has never required a catalogue match. Losing a
# working deployment over a failed download would be the wrong trade. But
# it is reported loudly, with the exact command to re-run, because a
# clinic that silently has no medicines is what started this.
log "Importing the medicine catalogue (~246k rows -- several minutes)"
if docker run --rm --env-file "$ENV_DIR/$SLUG.env" -w /app/apps/clinic-api \
     "$IMAGE" npx tsx prisma/seed-data/import-drugs.ts; then
  info "medicine catalogue imported"
else
  warn "MEDICINE CATALOGUE NOT IMPORTED."
  warn "  The clinic works, but the prescription autocomplete will find nothing"
  warn "  until this is run. Re-run it any time with:"
  warn "    docker run --rm --env-file $ENV_DIR/$SLUG.env -w /app/apps/clinic-api \\"
  warn "      \$(cat $ROOT/.image) npx tsx prisma/seed-data/import-drugs.ts"
fi

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

# Let's Encrypt rate-limits certificates per hostname per week, so a
# resumed run must not ask again for one it already has.
if [ -d "/etc/letsencrypt/live/$API_HOST" ]; then
  log "Certificate"
  info "already issued for $API_HOST -- not requesting another"
  # On disk is not the same as being served. This clinic spent an hour
  # with a valid certificate sitting in /etc/letsencrypt while nginx
  # served a different one, so the resume path must check the handshake
  # rather than trust the directory's existence.
  if curl -fsS --max-time 15 "https://$API_HOST/health" > /dev/null 2>&1; then
    info "and it is being served correctly"
  else
    TLS_FAILED=1
    info "BUT IT IS NOT BEING SERVED -- https://$API_HOST does not validate"
    info "  the certificate exists but nginx is not using it. Fix with:"
    info "    sudo certbot --nginx -d $API_HOST"
  fi
else
  log "Requesting a certificate"
  if certbot --nginx -d "$API_HOST" --non-interactive --agree-tos \
       --register-unsafely-without-email --redirect > /tmp/certbot-$SLUG.log 2>&1; then
    # certbot exiting 0 means it OBTAINED a certificate, not that nginx
    # is serving it. Here it did exactly that: the certificate was
    # written to /etc/letsencrypt/live but never installed, the log had
    # no "Deploying certificate" line, and nginx went on serving the one
    # certificate it already had -- which the browser rejected with
    # ERR_CERT_COMMON_NAME_INVALID.
    #
    # So the test is the handshake, not the exit code: ask the hostname
    # for something over HTTPS and see whether it validates.
    if curl -fsS --max-time 15 "https://$API_HOST/health" > /dev/null 2>&1; then
      info "TLS verified -- https://$API_HOST validates"
    else
      TLS_FAILED=1
      info "CERTIFICATE OBTAINED BUT NOT SERVED"
      info "  certbot reported success, but https://$API_HOST does not validate."
      info "  Usually it did not install into nginx. Fix with:"
      info "    sudo certbot --nginx -d $API_HOST"
    fi
  else
    # Recorded, not swallowed. Without a certificate for this hostname
    # nginx serves whichever one it has, the browser rejects it with
    # ERR_CERT_COMMON_NAME_INVALID, and nobody can sign in -- so a run
    # reporting "live" after this failed is reporting a clinic that
    # does not work.
    TLS_FAILED=1
    info "CERTIFICATE FAILED -- the clinic cannot be used until this is fixed"
    info "  log: /tmp/certbot-$SLUG.log"
    tail -5 "/tmp/certbot-$SLUG.log" 2>/dev/null | sed 's/^/      /'
  fi
fi

# ── Start ─────────────────────────────────────────────────────────────
log "Starting clinic-$SLUG"
# Regenerate compose so it includes this clinic, then bring up only the
# new service -- `up -d <service>` leaves every other clinic untouched,
# so onboarding one clinic never restarts the others.
"$ROOT/repo/deploy/render-compose.sh" || die "could not render compose.yml"
docker compose -f "$ROOT/compose.yml" up -d "clinic-$SLUG" \
  || die "could not start clinic-$SLUG"

CODE=000
for _ in 1 2 3 4 5 6; do
  CODE="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 8 "http://127.0.0.1:$PORT/health" 2>/dev/null || echo 000)"
  [ "$CODE" = "200" ] && break
  sleep 3
done
[ "$CODE" = "200" ] || die "health check returned $CODE. Logs: docker logs clinic-$SLUG"
info "health 200"

# ── Done ──────────────────────────────────────────────────────────────
# A line the job runner can parse. The password is generated here and
# stored nowhere, so this is the only chance to hand it back; the runner
# writes it to a root-only status file and the console shows it once.
if [ -n "${NON_INTERACTIVE:-}" ]; then
  printf 'RESULT_EMAIL=%s\n' "$DOCTOR_EMAIL"
  printf 'RESULT_PASSWORD=%s\n' "$DOCTOR_PASS"
  printf 'RESULT_API_HOST=%s\n' "$API_HOST"
  printf 'RESULT_PORT=%s\n' "$PORT"
  printf 'RESULT_TLS=%s\n' "$([ "${TLS_FAILED:-0}" = "1" ] && echo failed || echo ok)"
fi

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
