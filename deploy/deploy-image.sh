#!/usr/bin/env bash
#
# Deploys a prebuilt image. Run by CI over SSH, or by hand:
#
#   IMAGE_TAG=ghcr.io/you/repo:abc1234 /srv/clinic/repo/deploy/deploy-image.sh
#
# Nothing is built here. CI built and pushed the image, so what runs in
# production is the exact artifact that passed the tests -- not a second
# build from the same source that could differ because of a dependency
# that moved or a toolchain version on this box.
#
# Steps: pull, migrate every clinic's database, restart onto the new tag,
# health-check, and roll back to the previous tag if anything fails.
set -euo pipefail

ROOT=/srv/clinic
ENV_DIR="$ROOT/env"
REPO="$ROOT/repo"
IMAGE_FILE="$ROOT/.image"
PREV_FILE="$ROOT/.image.previous"

TAG="${IMAGE_TAG:-}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

# A DATABASE_URL in a log is a credential in a log, and CI logs are kept.
redact() { sed -E 's#(postgres(ql)?://)[^@[:space:]]*@#\1***:***@#g'; }

compose() { docker compose -f "$ROOT/compose.yml" "$@"; }

[ -n "$TAG" ] || die "IMAGE_TAG is not set"
command -v docker > /dev/null || die "docker is not installed -- re-run bootstrap-server.sh"

PREVIOUS="$(cat "$IMAGE_FILE" 2>/dev/null || true)"

# ── 1. Pull ───────────────────────────────────────────────────────────
log "Pulling $TAG"
# Show what docker actually said. Swallowing it and substituting a guess
# ("is the login still valid?") sent a missing `packages: read` scope
# looking like an expired credential -- the real message names the
# permission.
if ! docker pull "$TAG" > /tmp/pull.log 2>&1; then
  redact < /tmp/pull.log | tail -15
  echo
  echo "Common causes:" >&2
  echo "  - the deploy job is missing 'permissions: packages: read', so its" >&2
  echo "    token can log in but not read the package" >&2
  echo "  - the package is private and owned by a different account" >&2
  echo "  - the tag does not exist (did the build job actually push?)" >&2
  die "could not pull $TAG"
fi
info "$(docker image inspect "$TAG" --format '{{.Id}}' | cut -c1-19)"
info "size $(docker image inspect "$TAG" --format '{{.Size}}' | awk '{printf "%.0f MB", $1/1024/1024}')"

# ── 2. Migrate every clinic's database ────────────────────────────────
# Each clinic has its own database, so a schema change applies to each.
# The connection strings exist only in these env files -- the provider
# console stores a Neon project id and never a password, so it cannot
# tell us what to migrate.
#
# Migrations run inside the NEW image, so they are the migrations that
# shipped with this code. All of them run before anything restarts, and
# one failure aborts: a half-migrated estate with no record of which
# clinics succeeded is the worst outcome available here.
log "Migrating databases"
shopt -s nullglob
ENV_FILES=("$ENV_DIR"/*.env)
shopt -u nullglob
[ ${#ENV_FILES[@]} -gt 0 ] || die "no env files in $ENV_DIR -- nothing to deploy"

# Quoted values break `docker run --env-file`, which takes KEY=VALUE
# literally and keeps the quotes. Sourcing the same file in a shell
# strips them, so the file looks fine when tested by hand and fails
# inside the container -- as a Prisma protocol error that never mentions
# quoting. Caught here, by name, before anything is migrated.
for env_file in "${ENV_FILES[@]}"; do
  # Print the line number and the KEY ONLY. The first version of this
  # printed the matched line, which put a JWT secret straight into a CI
  # log -- a check for a misconfiguration must not leak the value it is
  # complaining about.
  # Line number and KEY ONLY -- never the value. The first version
  # printed the whole matching line, which put a JWT secret into a
  # CI log; a check for a misconfiguration must not leak what it is
  # complaining about.
  #
  # awk, not sed: this ran through a sed backreference twice and the
  # \1 was eaten both times. Fields are positional and cannot be.
  quoted="$(grep -nE '^[A-Za-z_][A-Za-z0-9_]*=["'"'"']' "$env_file" \
            | awk -F'[:=]' '{ printf "    line %s: %s\n", $1, $2 }' || true)"
  if [ -n "$quoted" ]; then
    echo "Quoted values in $(basename "$env_file"):" >&2
    printf '%s
' "$quoted" | sed 's/^/    /' >&2
    echo >&2
    echo "  docker --env-file keeps the quotes, so the value arrives wrong." >&2
    echo "  Remove them:  DATABASE_URL=postgresql://...   not   DATABASE_URL=\"postgresql://...\"" >&2
    echo "  Fix in place: sed -i 's/=\"\(.*\)\"$/=\1/' $env_file" >&2
    die "env file has quoted values"
  fi
done

for env_file in "${ENV_FILES[@]}"; do
  slug="$(basename "$env_file" .env)"
  if [ "$slug" = "provider" ]; then app=provider-api; else app=clinic-api; fi

  info "$slug -> $app"
  if ! docker run --rm \
        --env-file "$env_file" \
        -w "/app/apps/$app" \
        "$TAG" \
        npx prisma migrate deploy > "/tmp/migrate-$slug.log" 2>&1; then
    redact < "/tmp/migrate-$slug.log" | tail -25
    die "migration failed for '$slug'. Nothing was restarted -- the previous image is still serving."
  fi
done
info "all databases migrated"

# ── 3. Switch to the new tag ──────────────────────────────────────────
log "Activating $TAG"
[ -n "$PREVIOUS" ] && printf '%s' "$PREVIOUS" > "$PREV_FILE"
printf '%s' "$TAG" > "$IMAGE_FILE"

"$REPO/deploy/render-compose.sh" || die "could not render compose.yml"

# --remove-orphans cleans up a clinic whose env file was deleted, so a
# removed clinic's container does not keep serving from an old image.
compose up -d --remove-orphans || die "compose up failed"

# ── 4. Verify ─────────────────────────────────────────────────────────
log "Health checks"
sleep 6
FAILED=()
for env_file in "${ENV_FILES[@]}"; do
  slug="$(basename "$env_file" .env)"
  if [ "$slug" = "provider" ]; then service=provider-api; else service="clinic-$slug"; fi
  port="$(set -a; . "$env_file" >/dev/null 2>&1; set +a; printf '%s' "${PORT:-}")"

  state="$(docker inspect -f '{{.State.Status}}' "$service" 2>/dev/null || echo missing)"
  if [ "$state" != "running" ]; then
    FAILED+=("$service"); info "$service is $state"; continue
  fi

  code=000
  for _ in 1 2 3 4 5; do
    code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 8 \
            "http://127.0.0.1:$port/health" 2>/dev/null || echo 000)"
    [ "$code" = "200" ] && break
    sleep 3
  done

  if [ "$code" = "200" ]; then
    info "$service health 200"
  else
    FAILED+=("$service"); info "$service health $code"
  fi
done

# ── 5. Roll back if it will not serve ─────────────────────────────────
if [ ${#FAILED[@]} -gt 0 ]; then
  printf '\n\033[31mUnhealthy: %s\033[0m\n' "${FAILED[*]}" >&2
  docker logs --tail 30 "${FAILED[0]}" 2>&1 | redact || true

  if [ -n "$PREVIOUS" ]; then
    log "Rolling back to $PREVIOUS"
    printf '%s' "$PREVIOUS" > "$IMAGE_FILE"
    "$REPO/deploy/render-compose.sh" && compose up -d || true
    # Schema changes are NOT reversed. Prisma migrations here are
    # additive, so the previous image runs against the newer schema; a
    # dropped or renamed column needs a restore from $ROOT/backups.
    die "rolled back to $PREVIOUS. Schema changes were NOT reversed. Logs: docker logs ${FAILED[0]}"
  fi
  die "no previous image to roll back to. Logs: docker logs ${FAILED[0]}"
fi

# ── 6. Reclaim disk ───────────────────────────────────────────────────
# Old image layers accumulate fast and a full 25 GB disk fails in
# confusing ways. The previous tag is kept so rollback still works.
log "Pruning unused images"
docker image prune -f --filter "until=168h" > /dev/null 2>&1 || true
info "disk: $(df -h / | awk 'NR==2 {print $4" free of "$2}')"

log "Deployed $TAG"
compose ps --format '    {{.Name}}  {{.Status}}' 2>/dev/null || compose ps
info "rollback: IMAGE_TAG=$PREVIOUS $REPO/deploy/deploy-image.sh"
