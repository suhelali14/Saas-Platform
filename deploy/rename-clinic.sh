#!/usr/bin/env bash
#
# Change a clinic's slug: vadgaonkar -> wadgaonkar, everywhere it appears.
#
# The slug is not a label. It is the hostname patients visit, the name on
# the TLS certificate, the env filename, the container and network names,
# the Redis hostname inside that env file, the CORS origins, and the
# directory holding every scan and lab report the clinic has uploaded.
# Renaming by hand means getting eight things right in order, and the one
# that is quietest when missed is the data directory: the clinic keeps
# working and every historical attachment 404s.
#
# So it is a script, and the dangerous parts are testable without a VPS
# (CLINIC_ROOT override, --dry-run).
#
#   sudo ./rename-clinic.sh vadgaonkar wadgaonkar
#   ./rename-clinic.sh --dry-run vadgaonkar wadgaonkar
#
# What it does NOT do, deliberately:
#   - delete the old certificate. It stays until it expires, costing
#     nothing, and it is what a rollback needs.
#   - update Vercel's custom domains. That is an API call with a token
#     this host does not hold; the command is printed at the end.
#   - update the provider console's record of the slug. Printed too.
set -euo pipefail

ROOT="${CLINIC_ROOT:-/srv/clinic}"
ENV_DIR="$ROOT/env"
DATA_DIR="$ROOT/data"
PLATFORM_DOMAIN="${PLATFORM_DOMAIN:-nayaverse.in}"

DRY=0
if [ "${1:-}" = "--dry-run" ]; then DRY=1; shift; fi

OLD="${1:-}"
NEW="${2:-}"

c()    { printf '\033[36m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[33m    %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }
run()  { if [ "$DRY" = 1 ]; then printf '    [dry-run] %s\n' "$*"; else eval "$@"; fi; }

# ── Preflight ─────────────────────────────────────────────────────────
#
# Everything that can be checked is checked before anything moves. A
# rename that stops halfway leaves a clinic with no env file and no
# container, which is a worse state than not having started.
[ -n "$OLD" ] && [ -n "$NEW" ] || die "usage: $0 [--dry-run] <old-slug> <new-slug>"
[ "$OLD" != "$NEW" ] || die "the two slugs are the same"

# Same rule the provisioning console applies, so a rename cannot produce
# a slug that could never have been created.
printf '%s' "$NEW" | grep -Eq '^[a-z][a-z0-9-]{1,38}[a-z0-9]$' \
  || die "'$NEW' is not a valid slug: lowercase letters, digits and hyphens, starting with a letter"

[ -f "$ENV_DIR/$OLD.env" ] || die "no env file at $ENV_DIR/$OLD.env -- is '$OLD' the right slug?"
[ -e "$ENV_DIR/$NEW.env" ] && die "$ENV_DIR/$NEW.env already exists -- '$NEW' is taken"
[ -e "$DATA_DIR/$NEW" ] && die "$DATA_DIR/$NEW already exists -- refusing to merge into it"

OLD_SITE="$OLD.$PLATFORM_DOMAIN"
OLD_API="$OLD.api.$PLATFORM_DOMAIN"
NEW_SITE="$NEW.$PLATFORM_DOMAIN"
NEW_API="$NEW.api.$PLATFORM_DOMAIN"

c "Renaming $OLD -> $NEW"
info "site : $OLD_SITE  ->  $NEW_SITE"
info "api  : $OLD_API  ->  $NEW_API"
[ "$DRY" = 1 ] && warn "dry run: nothing will be changed"

# The new hostname must already resolve, or certbot cannot prove control
# of it and the whole thing stops after the clinic is already renamed.
if command -v getent > /dev/null 2>&1; then
  getent hosts "$NEW_API" > /dev/null 2>&1 \
    || die "$NEW_API does not resolve. Add the DNS record (or confirm the wildcard) first."
  info "DNS for $NEW_API resolves"
fi

# ── 1. Certificate first, while the old name still serves ─────────────
#
# Before anything is renamed. If certbot fails -- rate limit, DNS not yet
# propagated, port 80 blocked -- the clinic is untouched and still on its
# old name, which is the whole reason this is step one.
c "Issuing a certificate for the new names"
if [ "$DRY" = 1 ]; then
  info "[dry-run] certbot --nginx -d $NEW_API -d $NEW_SITE"
elif command -v certbot > /dev/null 2>&1; then
  # The vhost has to exist before certbot --nginx can attach to it.
  if [ -d /etc/nginx/sites-available ]; then
    sed "s/$OLD_API/$NEW_API/g; s/$OLD_SITE/$NEW_SITE/g" \
      "/etc/nginx/sites-available/$OLD_API" > "/etc/nginx/sites-available/$NEW_API"
    ln -sfn "/etc/nginx/sites-available/$NEW_API" "/etc/nginx/sites-enabled/$NEW_API"
    nginx -t > /dev/null 2>&1 || die "nginx config invalid after adding $NEW_API"
    systemctl reload nginx
    info "nginx now also serves $NEW_API"
  fi
  if certbot --nginx -d "$NEW_API" --non-interactive --agree-tos \
       --register-unsafely-without-email --redirect > "/tmp/certbot-$NEW.log" 2>&1; then
    info "certificate issued for $NEW_API"
  else
    tail -15 "/tmp/certbot-$NEW.log" >&2
    die "certbot failed. Nothing has been renamed; the clinic is still on $OLD."
  fi
else
  warn "certbot not found -- skipping. $NEW_API will not serve TLS until a cert exists."
fi

# ── 2. The env file, with the values that embed the slug ──────────────
#
# CORS_ORIGINS and REDIS_URL both contain it. Copying the file without
# rewriting them gives a clinic whose browser requests are refused by its
# own API and whose container cannot find its session store -- and the
# second one now means nobody can sign in at all.
c "Moving the env file"
if [ "$DRY" = 1 ]; then
  info "[dry-run] cp $ENV_DIR/$OLD.env $ENV_DIR/$NEW.env, rewrite CORS_ORIGINS + REDIS_URL, remove the old"
else
  cp -p "$ENV_DIR/$OLD.env" "$ENV_DIR/$NEW.env"
  # Only the slug as a whole word inside the values we own. A blunt
  # s/$OLD/$NEW/g would also rewrite anything in DATABASE_URL that
  # happened to contain the string.
  sed -i \
    -e "s#^CORS_ORIGINS=.*#CORS_ORIGINS=https://$NEW_SITE,https://$NEW.portal.$PLATFORM_DOMAIN#" \
    -e "s#^REDIS_URL=.*#REDIS_URL=redis://redis-$NEW:6379#" \
    "$ENV_DIR/$NEW.env"
  chmod 600 "$ENV_DIR/$NEW.env"
  info "wrote $ENV_DIR/$NEW.env"
  grep -E '^(CORS_ORIGINS|REDIS_URL)=' "$ENV_DIR/$NEW.env" | sed 's/^/      /'
fi

# ── 3. The data directory: every scan and lab report ──────────────────
#
# The quietest failure available here. render-compose mounts
# $DATA_DIR/<slug>/uploads, so a renamed clinic with an unmoved directory
# starts cleanly, serves patients, and 404s every attachment ever
# uploaded -- X-rays, lab reports, signed consent. Nothing in the UI says
# why.
#
# `mv` on the same filesystem is atomic and instant regardless of size.
c "Moving patient files"
if [ -d "$DATA_DIR/$OLD" ]; then
  n="$(find "$DATA_DIR/$OLD" -type f 2>/dev/null | wc -l)"
  info "$n file(s) in $DATA_DIR/$OLD"
  run "mv '$DATA_DIR/$OLD' '$DATA_DIR/$NEW'"
  [ "$DRY" = 1 ] || info "moved to $DATA_DIR/$NEW"
else
  warn "no $DATA_DIR/$OLD -- nothing to move (unusual; check this is the right slug)"
fi

# ── 4. Retire the old env so the old containers go ────────────────────
#
# Kept rather than deleted. render-compose only reads *.env, so the
# suffix takes it out of service while leaving it on disk for a rollback.
c "Retiring the old configuration"
run "mv '$ENV_DIR/$OLD.env' '$ENV_DIR/$OLD.env.renamed-to-$NEW'"

# ── 5. Re-render and start ────────────────────────────────────────────
#
# Container, network and Redis host names all derive from the env
# filename, so they follow automatically. --remove-orphans is what stops
# the old clinic-<old> container serving from the old image.
c "Starting the renamed clinic"
if [ "$DRY" = 1 ]; then
  info "[dry-run] render-compose.sh && docker compose up -d --remove-orphans"
else
  "$(dirname "$0")/render-compose.sh" || die "could not render compose.yml"
  docker compose -f "$ROOT/compose.yml" up -d --remove-orphans \
    || die "compose up failed. The old env is at $ENV_DIR/$OLD.env.renamed-to-$NEW -- rename it back and re-run render-compose.sh."
fi

# ── 6. Check it actually serves ───────────────────────────────────────
c "Health check"
if [ "$DRY" = 1 ]; then
  info "[dry-run] curl https://$NEW_API/health"
else
  PORT="$(sed -n 's/^PORT=//p' "$ENV_DIR/$NEW.env" | head -1)"
  ok=0
  for _ in 1 2 3 4 5 6 7 8; do
    code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 8 \
            "http://127.0.0.1:$PORT/health" 2>/dev/null || echo 000)"
    [ "$code" = "200" ] && { ok=1; break; }
    sleep 3
  done
  if [ "$ok" = 1 ]; then
    info "clinic-$NEW is serving"
  else
    docker logs --tail 25 "clinic-$NEW" 2>&1 | tail -25 >&2
    die "clinic-$NEW did not come up. Roll back: mv $ENV_DIR/$OLD.env.renamed-to-$NEW $ENV_DIR/$OLD.env && mv $DATA_DIR/$NEW $DATA_DIR/$OLD && $(dirname "$0")/render-compose.sh && docker compose -f $ROOT/compose.yml up -d --remove-orphans"
  fi
fi

# ── 7. Send the old address to the new one ────────────────────────────
#
# Printed prescriptions, WhatsApp forwards and search results all carry
# the old hostname and will for years. A clinic's address should not stop
# working because its slug was tidied.
c "Redirecting the old address"
if [ "$DRY" = 1 ]; then
  info "[dry-run] rewrite $OLD_API vhost as a 301 to $NEW_API"
elif [ -f "/etc/nginx/sites-available/$OLD_API" ]; then
  cat > "/etc/nginx/sites-available/$OLD_API" <<REDIRECT
# $OLD was renamed to $NEW. Kept as a permanent redirect: the old
# hostname is printed on documents the clinic has already handed out.
server {
  listen 443 ssl;
  server_name $OLD_API;
  include /etc/letsencrypt/options-ssl-nginx.conf;
  ssl_certificate     /etc/letsencrypt/live/$OLD_API/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$OLD_API/privkey.pem;
  return 301 https://$NEW_API\$request_uri;
}
server {
  listen 80;
  server_name $OLD_API;
  return 301 https://$NEW_API\$request_uri;
}
REDIRECT
  nginx -t > /dev/null 2>&1 && systemctl reload nginx \
    && info "$OLD_API now redirects to $NEW_API" \
    || warn "the redirect vhost did not validate; $OLD_API is unchanged"
fi

# ── What this cannot reach ────────────────────────────────────────────
c "Still to do by hand"
cat <<MANUAL
    These live outside this host:

    1. Vercel custom domains for the patient site and portal:
         vercel domains add $NEW_SITE        --scope <org>
         vercel domains add $NEW.portal.$PLATFORM_DOMAIN --scope <org>
       and remove the old two once traffic has moved.

    2. The provider console's record of this account's slug, so future
       provisioning and health checks point at the new hostname.

    3. If the clinic's public site uses a custom domain of its own,
       nothing above touched it and nothing needs to.

    The old env file is kept at:
      $ENV_DIR/$OLD.env.renamed-to-$NEW
    Delete it once you are satisfied; it is the fastest rollback.
MANUAL

c "Done"
