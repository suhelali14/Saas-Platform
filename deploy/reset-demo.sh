#!/usr/bin/env bash
#
# Puts a demo clinic back to a fresh, believable day. Run as root:
#
#   sudo /srv/clinic/repo/deploy/reset-demo.sh <slug>
#   sudo /srv/clinic/repo/deploy/reset-demo.sh --all
#
# Runs prisma/seed-demo.ts inside the deployed image against the clinic's
# own env file. Refuses any clinic whose env file does not say
# CLINIC_DEMO=1, and the seed script refuses again if the database holds
# a single patient it did not make -- two locks, because this empties a
# database.
#
# --all resets every demo on this server; clinic-demo-reset.timer runs
# it every morning so a demo opened at 10 am looks like 10 am.

set -uo pipefail

ROOT=/srv/clinic
ENV_DIR="$ROOT/env"

log()  { printf '\n=== %s\n' "$*"; }
die()  { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

IMAGE="$(cat "$ROOT/.image" 2>/dev/null || true)"
[ -n "$IMAGE" ] || die "No image deployed yet."

reset_one() {
  local slug="$1"
  printf '%s' "$slug" | grep -qE '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' || { echo "skip: '$slug' is not a valid slug" >&2; return 1; }
  local env_file="$ENV_DIR/$slug.env"
  [ -f "$env_file" ] || { echo "skip: $env_file does not exist" >&2; return 1; }
  if ! grep -qE '^CLINIC_DEMO=(1|true)$' "$env_file"; then
    echo "REFUSED: $slug is not a demo (no CLINIC_DEMO=1 in its env file)" >&2
    return 1
  fi
  log "Resetting demo $slug"
  docker run --rm --env-file "$env_file" -w /app/apps/clinic-api "$IMAGE" npx tsx prisma/seed-demo.ts
}

[ "$(id -u)" = "0" ] || die "Run as root"
[ $# -ge 1 ] || die "usage: reset-demo.sh <slug> | --all"

if [ "$1" = "--all" ]; then
  failed=0
  for f in "$ENV_DIR"/*.env; do
    [ -e "$f" ] || continue
    slug="$(basename "$f" .env)"
    [ "$slug" = "provider" ] && continue
    grep -qE '^CLINIC_DEMO=(1|true)$' "$f" || continue
    reset_one "$slug" || failed=1
  done
  exit $failed
fi

reset_one "$1"
