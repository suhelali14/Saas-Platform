#!/usr/bin/env bash
#
# Resets one staff member's password in one clinic.
#
#   reset-clinic-password.sh <slug> <email>
#
# The password handed over at provisioning was generated, shown once in
# the console, and never stored -- it is bcrypt-hashed in that clinic's
# own database. Nothing on this server holds it.
#
# Why not just re-run add-clinic.sh: it would work, and it would also
# re-render nginx, re-check the certificate, recreate the container and
# rewrite the clinic's name and UHID prefix from whatever env vars are
# set. That is a lot of collateral for a forgotten password.
#
# Reads the password from a prompt, never an argument: an argument lands
# in the shell history and is visible in `ps` to every user on the box.
set -euo pipefail

ROOT=/srv/clinic
ENV_DIR="$ROOT/env"
SLUG="${1:-}"
EMAIL="${2:-}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$SLUG" ] && [ -n "$EMAIL" ] || die "Usage: $0 <slug> <email>"
printf '%s' "$SLUG" | grep -qE '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' \
  || die "'$SLUG' is not a valid clinic slug"
case "$EMAIL" in *@*.*) ;; *) die "'$EMAIL' does not look like an email address" ;; esac

ENV_FILE="$ENV_DIR/$SLUG.env"
[ -f "$ENV_FILE" ] || {
  printf '\n\033[31mNo clinic called %s.\033[0m\n' "$SLUG" >&2
  printf 'Clinics on this server:\n' >&2
  for f in "$ENV_DIR"/*.env; do
    name="$(basename "$f" .env)"
    [ "$name" = "provider" ] || printf '  %s\n' "$name" >&2
  done
  exit 1
}

IMAGE="$(cat "$ROOT/.image" 2>/dev/null || true)"
[ -n "$IMAGE" ] || die "No image deployed yet."

log "Resetting a password in $SLUG"
info "account: $EMAIL"

printf '    new password: '
read -rs PASSWORD
echo
printf '    again:        '
read -rs CONFIRM
echo

[ "$PASSWORD" = "$CONFIRM" ] || die "They do not match."
[ ${#PASSWORD} -ge 10 ] || die "Use at least 10 characters -- this account can read patient records."

# Against this clinic's own database, and no other. The env file is what
# makes that true: one clinic, one DATABASE_URL.
docker run --rm \
  --env-file "$ENV_FILE" \
  -e CLINIC_RESET_EMAIL="$EMAIL" \
  -e CLINIC_RESET_PASSWORD="$PASSWORD" \
  -w /app/apps/clinic-api \
  "$IMAGE" \
  npx tsx prisma/reset-password.ts \
  || die "Reset failed. Check the email against the accounts listed above."

log "Done"
info "Sign in at https://$SLUG.portal.$(grep -hoP '^PLATFORM_DOMAIN=\K.*' "$ENV_DIR/provider.env" 2>/dev/null | tr -d '"' || echo 'your-domain')"
info "The reset is recorded in that clinic's audit trail."
