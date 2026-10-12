#!/usr/bin/env bash
#
# Tells one clinic's API which websites may call it.
#
#   set-origins.sh <slug> <origin>[,<origin>...]
#
# Why this exists as its own step rather than a database field: CORS on a
# clinic API is a strict allowlist held in that clinic's env file, written
# once when the clinic was provisioned and derived from its slug at that
# moment. Change the slug in the console, or point a custom domain at the
# clinic, and the new address resolves, serves the bundle, and then fails
# every request with a CORS error. The site looks live and does nothing.
#
# Run by clinic-runner.sh as root, in response to a queued job. Safe to run
# by hand.
set -uo pipefail

ROOT=/srv/clinic
ENV_DIR="$ROOT/env"

log()  { printf '\n=== %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

SLUG="${1:-}"
ORIGINS="${2:-}"

[ -n "$SLUG" ]    || die "usage: set-origins.sh <slug> <origins-csv>"
[ -n "$ORIGINS" ] || die "refusing to set an empty origin list -- that would block the clinic's own website"

printf '%s' "$SLUG" | grep -qE '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' \
  || die "slug '$SLUG' is not a valid hostname label"

ENV_FILE="$ENV_DIR/$SLUG.env"
[ -f "$ENV_FILE" ] || die "$ENV_FILE does not exist -- is '$SLUG' provisioned?"

# The clinic's API hostname is derived, not stored: it is a property of
# the platform, and add-clinic.sh builds it the same way.
PLATFORM_DOMAIN="$(grep -hoP '^PLATFORM_DOMAIN=\K.*' "$ENV_DIR/provider.env" 2>/dev/null | tr -d '"' || true)"
[ -n "$PLATFORM_DOMAIN" ] || die "PLATFORM_DOMAIN is not set in $ENV_DIR/provider.env"
API_HOST="$SLUG.api.$PLATFORM_DOMAIN"

# Validate every origin before writing any of them. A half-applied list is
# worse than a rejected one: the clinic would be left trusting some of its
# addresses and not others, with nothing saying which.
#
# Each must be an https origin and nothing more -- no path, no query, no
# trailing slash. @fastify/cors compares the Origin header literally, so
# "https://x.in/" never matches the "https://x.in" a browser actually
# sends, and the mismatch is invisible in the env file.
IFS=',' read -ra LIST <<< "$ORIGINS"
CLEAN=()
for raw in "${LIST[@]}"; do
  o="$(printf '%s' "$raw" | tr -d '[:space:]')"
  [ -n "$o" ] || continue
  printf '%s' "$o" | grep -qE '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+$' \
    || die "'$o' is not a plain https origin (expected https://host, with no path or trailing slash)"
  CLEAN+=("$o")
done
[ ${#CLEAN[@]} -gt 0 ] || die "no usable origins in '$ORIGINS'"

JOINED="$(IFS=','; printf '%s' "${CLEAN[*]}")"
PREVIOUS="$(sed -n 's/^CORS_ORIGINS=//p' "$ENV_FILE" | head -1)"

log "Origins for $SLUG"
info "was: ${PREVIOUS:-<unset>}"
info "now: $JOINED"

if [ "$PREVIOUS" = "$JOINED" ]; then
  info "unchanged -- not restarting the clinic"
  printf 'RESULT_ORIGINS=%s\n' "$JOINED"
  exit 0
fi

# Rewrite in place, preserving every other line. Written to a temp file and
# moved, so an interrupted write cannot leave the clinic with a truncated
# env file -- which would take its API down on the next restart.
TMP="$(mktemp "$ENV_DIR/.$SLUG.env.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
if grep -q '^CORS_ORIGINS=' "$ENV_FILE"; then
  # Replaced with awk rather than sed: an origin list contains no sed
  # metacharacters today, but a slash in a value is all it takes to turn
  # `s#...#...#` into a syntax error, and this runs unattended.
  awk -v v="$JOINED" '
    /^CORS_ORIGINS=/ { print "CORS_ORIGINS=" v; next }
    { print }
  ' "$ENV_FILE" > "$TMP"
else
  cat "$ENV_FILE" > "$TMP"
  printf 'CORS_ORIGINS=%s\n' "$JOINED" >> "$TMP"
fi

# Keep the original's ownership and mode -- this file holds the clinic's
# JWT secret and its database password.
chown --reference="$ENV_FILE" "$TMP" 2>/dev/null || true
chmod --reference="$ENV_FILE" "$TMP" 2>/dev/null || chmod 600 "$TMP"
mv -f "$TMP" "$ENV_FILE"
trap - EXIT
info "env file updated"

log "Restarting the clinic"
# The API reads CORS_ORIGINS once at boot, so the file alone changes
# nothing until the container is recreated with the new environment.
COMPOSE="$ROOT/compose.yml"
[ -f "$COMPOSE" ] || die "$COMPOSE does not exist -- nothing to restart"

# --force-recreate because the environment is what changed. Without it
# compose sees an unchanged image and an unchanged service definition and
# leaves the running container alone, so the file would be updated and the
# clinic would keep enforcing the old list. Only this clinic's service is
# named, so the other clinics on the box are not touched.
docker compose -f "$COMPOSE" up -d --force-recreate "clinic-$SLUG"   || die "docker compose could not recreate clinic-$SLUG"

log "Verifying"
# Wait for the clinic to come back before testing it, or the test fails on
# a container that is merely still starting.
UP=0
for _ in $(seq 1 20); do
  if curl -fsS --max-time 5 "https://$API_HOST/health" > /dev/null 2>&1; then UP=1; break; fi
  sleep 2
done
[ "$UP" = "1" ] || die "$SLUG did not come back after the restart -- check: docker logs clinic-$SLUG"
info "clinic is answering again"

# The point of the whole exercise, so it is checked rather than assumed: a
# preflight from the first origin must come back allowing that exact
# origin. An exit code from docker proves a container started, not that it
# will accept the clinic's website.
FIRST="${CLEAN[0]}"
ALLOW="$(curl -fsS -o /dev/null -D - --max-time 10 \
  -X OPTIONS \
  -H "Origin: $FIRST" \
  -H 'Access-Control-Request-Method: GET' \
  "https://$API_HOST/api/clinic/public/clinic" 2>/dev/null \
  | tr -d '\r' | sed -n 's/^[Aa]ccess-[Cc]ontrol-[Aa]llow-[Oo]rigin: //p' | head -1)"

if [ "$ALLOW" = "$FIRST" ]; then
  info "$API_HOST now accepts $FIRST"
  printf 'RESULT_ORIGINS=%s\n' "$JOINED"
else
  die "restart succeeded but $API_HOST did not accept $FIRST (sent back '${ALLOW:-nothing}'). The clinic is up, but its website would see a CORS error."
fi
