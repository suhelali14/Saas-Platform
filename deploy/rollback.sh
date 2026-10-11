#!/usr/bin/env bash
#
# Points `current` back at an earlier release and restarts everything.
#
#   /srv/clinic/repo/deploy/rollback.sh            # the previous release
#   /srv/clinic/repo/deploy/rollback.sh 20261011-184500
#   /srv/clinic/repo/deploy/rollback.sh --list
#
# IMPORTANT: this rolls back CODE, not the database. Prisma migrations are
# not reversed, so this recovers from a bad build but not from a migration
# that dropped or renamed a column. Those need a restore from backup,
# which is why they deserve a maintenance window and a fresh dump first.
set -euo pipefail

ROOT=/srv/clinic
RELEASES="$ROOT/releases"
CURRENT="$ROOT/current"
ENV_DIR="$ROOT/env"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

ACTIVE="$(basename "$(readlink -f "$CURRENT" 2>/dev/null || echo none)")"

if [ "${1:-}" = "--list" ]; then
  log "Releases"
  for d in $(ls -1dt "$RELEASES"/*/ 2>/dev/null); do
    name="$(basename "${d%/}")"
    sha="$(cat "$d/.deployed-sha" 2>/dev/null | cut -c1-8 || echo '????????')"
    marker=""
    [ "$name" = "$ACTIVE" ] && marker="  <- serving now"
    printf '    %s  %s%s\n' "$name" "$sha" "$marker"
  done
  exit 0
fi

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  # The newest release that is not the one currently serving.
  for d in $(ls -1dt "$RELEASES"/*/ 2>/dev/null); do
    name="$(basename "${d%/}")"
    [ "$name" != "$ACTIVE" ] && { TARGET="$name"; break; }
  done
  [ -n "$TARGET" ] || die "No earlier release to roll back to. Try --list."
fi

[ -d "$RELEASES/$TARGET" ] || die "No such release: $TARGET. Try --list."
[ "$TARGET" = "$ACTIVE" ] && die "$TARGET is already serving."

log "Rolling back: $ACTIVE -> $TARGET"
info "$(cat "$RELEASES/$TARGET/.deployed-sha" 2>/dev/null || echo 'unknown sha')"

ln -sfn "$RELEASES/$TARGET" "$ROOT/.current.tmp"
mv -Tf "$ROOT/.current.tmp" "$CURRENT"

log "Restarting services"
shopt -s nullglob
UNITS=()
systemctl list-unit-files 'provider-api.service' --no-legend 2>/dev/null | grep -q . && UNITS+=("provider-api")
for env_file in "$ENV_DIR"/*.env; do
  slug="$(basename "$env_file" .env)"
  [ "$slug" = "provider" ] && continue
  UNITS+=("clinic-api@$slug")
done
shopt -u nullglob

for unit in "${UNITS[@]}"; do
  info "restart $unit"
  sudo systemctl restart "$unit" || info "WARNING: $unit did not restart"
done

sleep 4
log "Health"
BAD=0
for unit in "${UNITS[@]}"; do
  slug="${unit#clinic-api@}"; [ "$unit" = "provider-api" ] && slug=provider
  port="$(set -a; . "$ENV_DIR/$slug.env" 2>/dev/null; set +a; printf '%s' "${PORT:-}")"
  if [ -n "$port" ]; then
    code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:$port/health" || echo 000)"
    printf '    %-28s %s\n' "$unit" "$code"
    [ "$code" = "200" ] || BAD=1
  fi
done

if [ "$BAD" = "1" ]; then
  die "Some services are still unhealthy after rolling back. If the problem is a schema change, code rollback will not fix it -- restore from $ROOT/backups."
fi

log "Rolled back to $TARGET"
info "Schema changes were NOT reversed."
