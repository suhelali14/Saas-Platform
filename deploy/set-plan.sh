#!/usr/bin/env bash
#
# Tells one clinic what it is entitled to, and restarts it. Run as root:
#
#   sudo /srv/clinic/repo/deploy/set-plan.sh <slug> <PLAN> <features-csv> <read-only 0|1> [max-users]
#
# Normally run by clinic-runner.sh when the provider console applies a
# plan, suspends or resumes a clinic. It rewrites four lines of the
# clinic's env file and nothing else:
#
#   CLINIC_PLAN       BASIC | STANDARD | PREMIUM | ENTERPRISE
#   CLINIC_FEATURES   the exact modules, comma-separated
#   CLINIC_READ_ONLY  1 when suspended: everything viewable, nothing changed
#   CLINIC_MAX_USERS  only when the deal set one; removed otherwise
#
# Patient records are never touched by this, in any direction. A
# suspended clinic keeps every record readable and exportable.

set -uo pipefail

ROOT=/srv/clinic
ENV_DIR="$ROOT/env"

log()  { printf '\n=== %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

SLUG="${1:-}"
PLAN="${2:-}"
FEATURES="${3-}"
READ_ONLY="${4:-0}"
MAX_USERS="${5:-}"

[ -n "$SLUG" ] || die "usage: set-plan.sh <slug> <PLAN> <features-csv> <0|1> [max-users]"
printf '%s' "$SLUG" | grep -qE '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' \
  || die "slug '$SLUG' is not a valid hostname label"
case "$PLAN" in BASIC|STANDARD|PREMIUM|ENTERPRISE) ;; *) die "plan '$PLAN' is not one of BASIC, STANDARD, PREMIUM, ENTERPRISE" ;; esac
# Module names are lowercase words. Anything else in this value would be
# written into an env file that docker reads, so it is checked strictly.
[ -z "$FEATURES" ] || printf '%s' "$FEATURES" | grep -qE '^[a-z]+(,[a-z]+)*$' \
  || die "features '$FEATURES' must be lowercase module names separated by commas"
case "$READ_ONLY" in 0|1) ;; *) die "read-only must be 0 or 1" ;; esac
[ -z "$MAX_USERS" ] || printf '%s' "$MAX_USERS" | grep -qE '^[0-9]{1,3}$' \
  || die "max users must be a number from 0 to 999"

ENV_FILE="$ENV_DIR/$SLUG.env"
[ -f "$ENV_FILE" ] || die "$ENV_FILE does not exist -- is '$SLUG' provisioned?"

before="$(grep -E '^(CLINIC_PLAN|CLINIC_FEATURES|CLINIC_READ_ONLY|CLINIC_MAX_USERS)=' "$ENV_FILE" | sort | tr '\n' ' ')"

log "Plan for $SLUG"
info "was: ${before:-<none>}"
info "now: CLINIC_PLAN=$PLAN CLINIC_FEATURES=$FEATURES CLINIC_READ_ONLY=$READ_ONLY${MAX_USERS:+ CLINIC_MAX_USERS=$MAX_USERS}"

# Every managed line is dropped and written fresh at the end, so a line
# that should no longer exist (a removed seat override) really goes.
TMP="$(mktemp "$ENV_DIR/.$SLUG.env.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
grep -vE '^(CLINIC_PLAN|CLINIC_FEATURES|CLINIC_READ_ONLY|CLINIC_MAX_USERS)=' "$ENV_FILE" > "$TMP"
{
  printf 'CLINIC_PLAN=%s\n' "$PLAN"
  printf 'CLINIC_FEATURES=%s\n' "$FEATURES"
  printf 'CLINIC_READ_ONLY=%s\n' "$READ_ONLY"
  [ -z "$MAX_USERS" ] || printf 'CLINIC_MAX_USERS=%s\n' "$MAX_USERS"
} >> "$TMP"

after="$(grep -E '^(CLINIC_PLAN|CLINIC_FEATURES|CLINIC_READ_ONLY|CLINIC_MAX_USERS)=' "$TMP" | sort | tr '\n' ' ')"
if [ "$before" = "$after" ]; then
  info "unchanged -- not restarting the clinic"
  printf 'RESULT_PLAN=%s\n' "$PLAN"
  exit 0
fi

chown --reference="$ENV_FILE" "$TMP" 2>/dev/null || true
chmod --reference="$ENV_FILE" "$TMP" 2>/dev/null || chmod 600 "$TMP"
mv -f "$TMP" "$ENV_FILE"
trap - EXIT
info "env file updated"

log "Restarting the clinic"
COMPOSE="$ROOT/compose.yml"
[ -f "$COMPOSE" ] || die "$COMPOSE does not exist -- nothing to restart"
# Recreated, not just restarted: docker reads an env file when it creates
# a container, so a plain restart would keep running the old plan.
docker compose -f "$COMPOSE" up -d --force-recreate "clinic-$SLUG" \
  || die "docker compose could not recreate clinic-$SLUG"

printf 'RESULT_PLAN=%s\n' "$PLAN"
