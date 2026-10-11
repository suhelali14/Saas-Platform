#!/usr/bin/env bash
#
# Deploys the APIs on this server. Run by CI over SSH, or by hand.
#
#   DEPLOY_REF=<sha|branch|tag> /srv/clinic/repo/deploy/deploy.sh
#
# Releases are atomic. A build happens in a fresh directory and nothing
# live is touched until it has succeeded, so a failed build leaves the
# running version exactly as it was rather than half-replaced.
#
# Layout:
#   /srv/clinic/repo            the git clone this script builds from
#   /srv/clinic/releases/<ts>   one build, immutable once made
#   /srv/clinic/current         symlink -> the serving release
#   /srv/clinic/env/<slug>.env  per-clinic config, incl. its DATABASE_URL
#   /srv/clinic/data/<slug>     per-clinic working dir -- holds uploads/
#
# Patient uploads live under data/, NOT inside a release, because each
# clinic process runs with its data directory as its cwd and the app
# resolves uploads against cwd. Put them in a release and every deploy
# would silently orphan a clinic's X-rays.
set -euo pipefail

ROOT=/srv/clinic
REPO="$ROOT/repo"
RELEASES="$ROOT/releases"
CURRENT="$ROOT/current"
ENV_DIR="$ROOT/env"
DATA_DIR="$ROOT/data"
KEEP_RELEASES=5

REF="${DEPLOY_REF:-main}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
RELEASE="$RELEASES/$STAMP"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

# Any DATABASE_URL that reaches a log is a credential in a log, and CI
# logs are retained and often shared. Everything that might echo one goes
# through this.
redact() { sed -E 's#(postgres(ql)?://)[^@[:space:]]*@#\1***:***@#g'; }

[ -d "$REPO/.git" ] || die "No git clone at $REPO. Run deploy/bootstrap-server.sh first."

# ── 1. Fetch the exact ref ────────────────────────────────────────────
log "Fetching $REF"
git -C "$REPO" fetch --quiet --all --prune --tags
SHA="$(git -C "$REPO" rev-parse --verify "origin/$REF^{commit}" 2>/dev/null \
      || git -C "$REPO" rev-parse --verify "$REF^{commit}")" \
  || die "Ref '$REF' not found"
info "$SHA"

# ── 2. Build into a new release directory ─────────────────────────────
log "Building release $STAMP"
mkdir -p "$RELEASE"
# Export the tree at that exact SHA. A worktree checkout would let an
# earlier failed deploy's stray files ride along into this one.
git -C "$REPO" archive "$SHA" | tar -x -C "$RELEASE"
echo "$SHA" > "$RELEASE/.deployed-sha"

cd "$RELEASE"
# A full install, dev dependencies included, and they are NOT pruned
# afterwards. Three reasons, each learned the hard way:
#
#   - Each API's `postinstall` runs `prisma generate`, and `prisma` is a
#     devDependency. `npm ci --omit=dev` therefore fails during install.
#   - `prisma migrate deploy` is needed by add-clinic.sh and by the
#     migration step below, long after this build finishes.
#   - `tsx` is needed to run the seed scripts when onboarding a clinic.
#
# Pruning would save a couple of hundred MB on a 25 GB disk and break the
# entire per-clinic workflow. Not a trade worth making.
info "npm ci"
npm ci --no-audit --fund=false > "$RELEASE/.build.log" 2>&1 \
  || { tail -30 "$RELEASE/.build.log" | redact; die "npm ci failed"; }

for app in clinic-api provider-api; do
  # postinstall has already done this, but being explicit means a failure
  # names the app instead of surfacing as a confusing type error later.
  info "prisma generate: $app"
  ( cd "apps/$app" && npx prisma generate ) >> "$RELEASE/.build.log" 2>&1 \
    || { tail -30 "$RELEASE/.build.log" | redact; die "prisma generate failed for $app"; }

  info "build: $app"
  npm run --workspace "apps/$app" build >> "$RELEASE/.build.log" 2>&1 \
    || { tail -30 "$RELEASE/.build.log" | redact; die "build failed for $app"; }

  # The build copies the generated Prisma client into dist/. Without it
  # the service dies on boot with ERR_MODULE_NOT_FOUND, which is a much
  # worse place to find out than here.
  [ -f "apps/$app/dist/generated/prisma-client/index.js" ] \
    || die "$app built without its Prisma client in dist/ -- check the build script"
done

# ── 3. Migrate every clinic's database ────────────────────────────────
# Each clinic has its OWN database, so a schema change has to be applied
# to each one. The connection strings live only in these env files on
# this server -- the provider console deliberately never stores them.
#
# All migrations run BEFORE any service is restarted, and one failure
# aborts the whole deploy. Half-migrated estates are how you end up with
# clinic 7 broken and no record of which ones succeeded.
log "Migrating databases"
shopt -s nullglob
ENV_FILES=("$ENV_DIR"/*.env)
shopt -u nullglob
[ ${#ENV_FILES[@]} -gt 0 ] || info "(no env files yet -- nothing to migrate)"

MIGRATED=()
for env_file in "${ENV_FILES[@]}"; do
  slug="$(basename "$env_file" .env)"

  # shellcheck disable=SC1090
  DB_URL="$(set -a; . "$env_file"; set +a; printf '%s' "${DATABASE_URL:-}")"
  [ -n "$DB_URL" ] || die "$slug: no DATABASE_URL in $env_file"

  if [ "$slug" = "provider" ]; then app=provider-api; else app=clinic-api; fi

  info "$slug -> $app"
  if ! ( cd "$RELEASE/apps/$app" && DATABASE_URL="$DB_URL" npx prisma migrate deploy ) \
        > "$RELEASE/.migrate-$slug.log" 2>&1; then
    redact < "$RELEASE/.migrate-$slug.log" | tail -25
    die "migration failed for '$slug' -- nothing was restarted, the old release is still serving"
  fi
  MIGRATED+=("$slug")
done
info "migrated: ${MIGRATED[*]:-none}"

# ── 4. Swap the symlink ───────────────────────────────────────────────
PREVIOUS=""
[ -L "$CURRENT" ] && PREVIOUS="$(readlink -f "$CURRENT")"

log "Activating release $STAMP"
# Replace the symlink atomically: ln -s then mv means there is never a
# moment where `current` does not exist, which a plain rm + ln would
# leave open for a few milliseconds.
ln -sfn "$RELEASE" "$ROOT/.current.tmp"
mv -Tf "$ROOT/.current.tmp" "$CURRENT"
info "current -> $STAMP"

# ── 5. Restart services ───────────────────────────────────────────────
log "Restarting services"
UNITS=()
systemctl list-unit-files 'provider-api.service' --no-legend 2>/dev/null | grep -q . \
  && UNITS+=("provider-api")
for env_file in "${ENV_FILES[@]}"; do
  slug="$(basename "$env_file" .env)"
  [ "$slug" = "provider" ] && continue
  UNITS+=("clinic-api@$slug")
done

for unit in "${UNITS[@]}"; do
  info "restart $unit"
  sudo systemctl restart "$unit" || die "could not restart $unit"
done

# ── 6. Verify, and roll back if the new release will not serve ────────
log "Health checks"
sleep 4
FAILED=()
for unit in "${UNITS[@]}"; do
  if ! systemctl is-active --quiet "$unit"; then
    FAILED+=("$unit")
    info "$unit is NOT running"
    continue
  fi

  slug="${unit#clinic-api@}"
  [ "$unit" = "provider-api" ] && slug=provider
  port="$(set -a; . "$ENV_DIR/$slug.env"; set +a; printf '%s' "${PORT:-}")"

  if [ -n "$port" ]; then
    code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 \
            "http://127.0.0.1:$port/health" 2>/dev/null || echo 000)"
    if [ "$code" = "200" ]; then
      info "$unit health 200"
    else
      FAILED+=("$unit")
      info "$unit health $code"
    fi
  else
    info "$unit running (no PORT in its env, health not checked)"
  fi
done

if [ ${#FAILED[@]} -gt 0 ]; then
  printf '\n\033[31mUnhealthy after deploy: %s\033[0m\n' "${FAILED[*]}" >&2
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    log "Rolling back to $(basename "$PREVIOUS")"
    ln -sfn "$PREVIOUS" "$ROOT/.current.tmp"
    mv -Tf "$ROOT/.current.tmp" "$CURRENT"
    for unit in "${UNITS[@]}"; do sudo systemctl restart "$unit" || true; done
    # Migrations are NOT reversed. Prisma migrations here are additive, so
    # the previous code runs against the newer schema; a migration that
    # dropped or renamed a column would need manual repair, which is why
    # that kind of change deserves a maintenance window.
    die "rolled back to $(basename "$PREVIOUS"). Schema changes were NOT reversed. Logs: journalctl -u ${FAILED[0]} -n 50"
  fi
  die "no previous release to roll back to. Logs: journalctl -u ${FAILED[0]} -n 50"
fi

# ── 7. Prune old releases ─────────────────────────────────────────────
log "Pruning old releases"
cd "$RELEASES"
# Keep the newest N, but never delete whatever `current` points at.
keep_name="$(basename "$(readlink -f "$CURRENT")")"
ls -1dt */ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" | while read -r old; do
  old="${old%/}"
  [ "$old" = "$keep_name" ] && continue
  info "removing $old"
  rm -rf "$RELEASES/$old"
done

log "Deployed $STAMP ($SHA)"
info "services: ${UNITS[*]}"
info "rollback: $ROOT/repo/deploy/rollback.sh"
