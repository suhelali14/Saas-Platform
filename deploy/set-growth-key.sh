#!/usr/bin/env bash
#
# Pairs this console with Nayaverse Growth, once: puts Growth's public key
# in provider.env and restarts the console so it is used.
#
#   sudo /srv/clinic/repo/deploy/set-growth-key.sh <growth-public-key>
#
# The key is the one the console's Growth page shows under "Growth can't
# reach the console" (Copy). It is public: safe to paste anywhere.
#
# Why a script: the console runs in a container (compose service
# provider-api) that reads provider.env only when it is created. Editing
# the file and running `systemctl restart provider-api` (the old advice)
# leaves the running container on the old key, so the warning came back
# every time. A value pasted with quotes, or a second GROWTH_PUBLIC_KEY
# line, also reaches the container wrong. This writes the line once,
# unquoted, recreates the container, and checks the console now holds it.
# Run it again only if Growth's own signing key is ever changed.
set -uo pipefail

ROOT=/srv/clinic
ENV_FILE="$ROOT/env/provider.env"
COMPOSE="$ROOT/compose.yml"

log()  { printf '\n=== %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# Spaces, quotes and a stray "GROWTH_PUBLIC_KEY=" from the paste are dropped.
KEY="$(printf '%s' "${1:-}" | sed -e 's/^GROWTH_PUBLIC_KEY=//' -e "s/[\"' ]//g")"
[ -n "$KEY" ] || die "usage: set-growth-key.sh <growth-public-key>   (copy it from the console's Growth page)"

# An Ed25519 public key in this form is always 60 characters starting
# MCowBQYDK2VwAyEA. Anything else is a copy that went wrong.
printf '%s' "$KEY" | grep -qE '^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$' \
  || die "that is not Growth's public key: it should be 60 characters starting MCowBQYDK2VwAyEA. Copy it again from the console's Growth page."

[ -f "$ENV_FILE" ] || die "$ENV_FILE does not exist"
[ -f "$COMPOSE" ]  || die "$COMPOSE does not exist -- is the console deployed here?"

log "Writing the key"
TMP="$(mktemp "$ENV_FILE.XXXXXX")" || die "could not write next to $ENV_FILE"
trap 'rm -f "$TMP"' EXIT
# Every old GROWTH_PUBLIC_KEY line goes; one new line, unquoted.
grep -v '^GROWTH_PUBLIC_KEY=' "$ENV_FILE" > "$TMP"
printf 'GROWTH_PUBLIC_KEY=%s\n' "$KEY" >> "$TMP"
chown --reference="$ENV_FILE" "$TMP" 2>/dev/null || true
chmod --reference="$ENV_FILE" "$TMP" 2>/dev/null || chmod 600 "$TMP"
mv -f "$TMP" "$ENV_FILE"
trap - EXIT
info "provider.env updated"
grep -q '^GROWTH_URL=.\+' "$ENV_FILE" || info "note: GROWTH_URL is not set in provider.env; set it to Growth's address too"

log "Restarting the console"
# --force-recreate: the environment is what changed, and compose would
# otherwise leave the running container alone. Only provider-api is named,
# so the clinics on this server are not touched.
docker compose -f "$COMPOSE" up -d --force-recreate provider-api || die "docker compose could not recreate provider-api"

PORT="$(sed -n 's/^PORT=//p' "$ENV_FILE" | head -1)"
PORT="${PORT:-4200}"
UP=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then UP=1; break; fi
  sleep 2
done
[ "$UP" = "1" ] || die "the console did not come back -- check: docker logs provider-api"
info "the console is answering again"

log "Checking"
# The point of the exercise, so it is checked rather than assumed.
[ "$(docker exec provider-api printenv GROWTH_PUBLIC_KEY 2>/dev/null)" = "$KEY" ] \
  || die "the console is running without the new key -- check: docker inspect provider-api"
info "the console now trusts Growth's key"
info "Open the console's Growth page and press Check again: it should say Growth is connected."
