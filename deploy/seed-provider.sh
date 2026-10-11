#!/usr/bin/env bash
#
# Creates your provider console login. Run once, after the first deploy:
#
#   sudo /srv/clinic/repo/deploy/seed-provider.sh you@example.com "Your Name"
#
# Runs inside the deployed image, so it uses the seed script that shipped
# with the running code. There is deliberately no /srv/clinic/current
# checkout to run it from -- the Docker deploy keeps no source tree on the
# server at all.
set -euo pipefail

ROOT=/srv/clinic
EMAIL="${1:-}"
NAME="${2:-Provider Owner}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$EMAIL" ] || die "Usage: $0 <email> [\"Full Name\"]"
case "$EMAIL" in *@*.*) ;; *) die "'$EMAIL' does not look like an email address" ;; esac

IMAGE="$(cat "$ROOT/.image" 2>/dev/null || true)"
[ -n "$IMAGE" ] || die "No image deployed yet. Push to master (or run deploy-image.sh) first."
[ -f "$ROOT/env/provider.env" ] || die "Missing $ROOT/env/provider.env -- write it before seeding."

log "Creating the console owner"
info "email: $EMAIL"
info "image: $IMAGE"

# Read it rather than take it as an argument: an argument lands in the
# shell history and in the process list, where other users can see it.
printf '    password: '
read -rs PASSWORD
echo
[ ${#PASSWORD} -ge 12 ] || die "Use at least 12 characters -- this account can create and destroy clinic infrastructure."

# Passed as an env var, not interpolated into a command string, so a
# quote or a $ in the password cannot break or reinterpret anything.
docker run --rm \
  --env-file "$ROOT/env/provider.env" \
  -e PROVIDER_SEED_EMAIL="$EMAIL" \
  -e PROVIDER_SEED_NAME="$NAME" \
  -e PROVIDER_SEED_PASSWORD="$PASSWORD" \
  -w /app/apps/provider-api \
  "$IMAGE" \
  npx tsx prisma/seed-provider.ts \
  || die "Seeding failed. Check that DATABASE_URL in provider.env is correct and that migrations have run."

log "Done"
info "Sign in at your console with $EMAIL"
