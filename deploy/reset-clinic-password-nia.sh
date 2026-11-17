#!/usr/bin/env bash
#
# Non-interactive password reset for a clinic's owner account.
#
#   reset-clinic-password-nia.sh <slug> <email>
#
# Same semantics as reset-clinic-password.sh, but generates a strong
# password itself and prints `RESULT_PASSWORD=...` on success -- the
# shape clinic-runner.sh reads the queue's output in.
#
# Used by the runner when the console asks for a reset through a job
# file. The interactive version stays because break-glass recovery from
# an SSH session should never be at the mercy of a working console.
#
# The password is generated here rather than passed in: the HTTP job
# must not carry a plaintext password (it is written to disk on the
# host and could be read by anyone with host access before the runner
# shreds it). Generating here keeps the plaintext in two places only --
# this script's stdout (captured by the runner) and the clinic DB's
# bcrypt hash.
set -euo pipefail

ROOT=/srv/clinic
ENV_DIR="$ROOT/env"
SLUG="${1:-}"
EMAIL="${2:-}"

die() { printf 'FAILED: %s\n' "$*" >&2; exit 1; }

[ -n "$SLUG" ] && [ -n "$EMAIL" ] || die "usage: $0 <slug> <email>"
printf '%s' "$SLUG" | grep -qE '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' || die "'$SLUG' is not a valid clinic slug"
case "$EMAIL" in *@*.*) ;; *) die "'$EMAIL' does not look like an email address" ;; esac

ENV_FILE="$ENV_DIR/$SLUG.env"
[ -f "$ENV_FILE" ] || die "no clinic called $SLUG on this server"

IMAGE="$(cat "$ROOT/.image" 2>/dev/null || true)"
[ -n "$IMAGE" ] || die "no image deployed yet"

SCRIPT="$ROOT/repo/apps/clinic-api/prisma/reset-password.ts"
[ -f "$SCRIPT" ] || die "missing $SCRIPT -- git pull on $ROOT/repo"

# 16 URL-safe characters: enough entropy, short enough to read over the
# phone or paste into a mail client without line-wraps.
PASSWORD="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16)"

# Run the reset in a one-shot container against this clinic's DB. STDERR
# surfaces in the runner's status message on failure; STDOUT is
# discarded because we have the password locally and do not want it
# anywhere else.
docker run --rm \
  --env-file "$ENV_FILE" \
  -e CLINIC_RESET_EMAIL="$EMAIL" \
  -e CLINIC_RESET_PASSWORD="$PASSWORD" \
  -v "$SCRIPT:/app/apps/clinic-api/prisma/reset-password.ts:ro" \
  -w /app/apps/clinic-api \
  "$IMAGE" \
  npx tsx prisma/reset-password.ts >/dev/null \
  || die "reset failed -- check the email against the accounts in $SLUG"

# The ONLY line this script prints, and only on success. The runner
# greps for it; nobody else should see it.
printf 'RESULT_PASSWORD=%s\n' "$PASSWORD"
printf 'RESULT_EMAIL=%s\n' "$EMAIL"
