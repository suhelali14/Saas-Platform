#!/usr/bin/env bash
#
# Resets a console account's password.
#
#   reset-console-password.sh <email>
#
# The console password is bcrypt-hashed and was typed into
# seed-provider.sh interactively, so nothing on this server or in the
# repository holds it -- not provider.env, not the image, not a log. An
# owner who forgot it had no way back into the console that provisions
# every clinic, and seed-provider.sh deliberately refuses to touch an
# account that already exists.
#
# Reads the password from a prompt, never an argument: an argument lands
# in the shell history and is visible in `ps` to every user on the box.
set -euo pipefail

ROOT=/srv/clinic
EMAIL="${1:-}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$EMAIL" ] || die "Usage: $0 <email>"
case "$EMAIL" in *@*.*) ;; *) die "'$EMAIL' does not look like an email address" ;; esac

IMAGE="$(cat "$ROOT/.image" 2>/dev/null || true)"
[ -n "$IMAGE" ] || die "No image deployed yet."
[ -f "$ROOT/env/provider.env" ] || die "Missing $ROOT/env/provider.env"

log "Resetting the console password"
info "account: $EMAIL"

printf '    new password: '
read -rs PASSWORD
echo
printf '    again:        '
read -rs CONFIRM
echo

[ "$PASSWORD" = "$CONFIRM" ] || die "They do not match."
# Twelve, not the seed's ten. This account can create and destroy clinic
# infrastructure, and a reset is the moment somebody reaches for
# something short and memorable.
[ ${#PASSWORD} -ge 12 ] || die "Use at least 12 characters -- this account can provision and delete clinic infrastructure."

docker run --rm \
  --env-file "$ROOT/env/provider.env" \
  -e PROVIDER_RESET_EMAIL="$EMAIL" \
  -e PROVIDER_RESET_PASSWORD="$PASSWORD" \
  -w /app/apps/provider-api \
  "$IMAGE" \
  npx tsx prisma/reset-password.ts \
  || die "Reset failed. Check DATABASE_URL in provider.env, and that the email is right."

log "Done"
info "Sign in at your console with $EMAIL and the new password."
info "The change is recorded in the activity log."
