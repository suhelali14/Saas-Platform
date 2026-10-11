#!/usr/bin/env bash
#
# Nightly backup of every clinic: database AND uploaded files.
#
# Installed by bootstrap-server.sh as /usr/local/bin/clinic-backup and run
# at 02:15 by cron. Also safe to run by hand before a risky migration.
#
# A database dump on its own is NOT a backup of this system. Patient
# scans, X-rays and lab reports live on the disk, not in Postgres, so a
# restore from a dump alone would bring back case sheets that reference
# files that no longer exist.
set -euo pipefail

ROOT=/srv/clinic
ENV_DIR="$ROOT/env"
DATA_DIR="$ROOT/data"
OUT="$ROOT/backups"
KEEP_DAYS=14

STAMP="$(date -u +%Y%m%d-%H%M%S)"
log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
redact() { sed -E 's#(postgres(ql)?://)[^@[:space:]]*@#\1***:***@#g'; }

# Reads one value WITHOUT letting the shell evaluate it.
#
# Sourcing an env file runs it as shell, and a Neon connection string
# contains `&` -- which the shell reads as "run this in the background",
# silently truncating the value to nothing. Docker's --env-file reads
# the same line correctly, so the mismatch is invisible until something
# that sourced the file gets an empty string. Here that was pg_dump,
# which would have failed every night.
read_env() {  # read_env <file> <KEY>
  local raw
  raw="$(sed -n "s/^$2=//p" "$1" | head -1)"
  # Strip one layer of surrounding quotes using parameter expansion.
  # No sed backreference: it is the thing that keeps getting eaten by
  # whichever layer writes this file.
  case "$raw" in
    \"*\") raw="${raw#\"}"; raw="${raw%\"}" ;;
    \'*\') raw="${raw#\'}"; raw="${raw%\'}" ;;
  esac
  printf '%s' "$raw"
}

mkdir -p "$OUT"
FAILED=0

shopt -s nullglob
ENV_FILES=("$ENV_DIR"/*.env)
shopt -u nullglob

if [ ${#ENV_FILES[@]} -eq 0 ]; then
  log "no clinics configured, nothing to back up"
  exit 0
fi

log "starting backup $STAMP"

for env_file in "${ENV_FILES[@]}"; do
  slug="$(basename "$env_file" .env)"
  dest="$OUT/$slug"
  mkdir -p "$dest"

  DB_URL="$(read_env "$env_file" DATABASE_URL)"
  if [ -z "$DB_URL" ]; then
    log "$slug: SKIPPED, no DATABASE_URL"
    FAILED=1
    continue
  fi

  # ── Database ────────────────────────────────────────────────────────
  # Custom format (-Fc) so a single table can be restored without
  # replaying the whole dump, which is what you actually want at 3am.
  dump="$dest/$slug-$STAMP.dump"
  if pg_dump -Fc --no-owner --no-acl -f "$dump" "$DB_URL" 2> "$dest/.dump.err"; then
    size="$(du -h "$dump" | cut -f1)"
    log "$slug: database ok ($size)"
  else
    log "$slug: DATABASE DUMP FAILED"
    redact < "$dest/.dump.err" | tail -5 | sed 's/^/        /'
    rm -f "$dump"
    FAILED=1
  fi

  # ── Uploaded files ──────────────────────────────────────────────────
  if [ -d "$DATA_DIR/$slug/uploads" ]; then
    files="$(find "$DATA_DIR/$slug/uploads" -type f | wc -l)"
    if [ "$files" -gt 0 ]; then
      tarball="$dest/$slug-uploads-$STAMP.tar.gz"
      if tar -czf "$tarball" -C "$DATA_DIR/$slug" uploads 2>/dev/null; then
        log "$slug: uploads ok ($files files, $(du -h "$tarball" | cut -f1))"
      else
        log "$slug: UPLOADS ARCHIVE FAILED"
        rm -f "$tarball"
        FAILED=1
      fi
    else
      log "$slug: no uploads yet"
    fi
  fi

  # Keep the dumps readable only by the owner: they are a complete copy
  # of a clinic's patient records.
  chmod 600 "$dest"/*.dump "$dest"/*.tar.gz 2>/dev/null || true
  chmod 700 "$dest"
  rm -f "$dest/.dump.err"
done

# ── Prune ─────────────────────────────────────────────────────────────
log "pruning backups older than $KEEP_DAYS days"
find "$OUT" -type f \( -name '*.dump' -o -name '*.tar.gz' \) -mtime "+$KEEP_DAYS" -print -delete \
  | sed 's/^/        removed /' || true

TOTAL="$(du -sh "$OUT" 2>/dev/null | cut -f1)"
log "backup set is now $TOTAL"

if [ "$FAILED" = "1" ]; then
  log "COMPLETED WITH ERRORS -- read the lines above"
  exit 1
fi

log "all clinics backed up"

# These backups sit on the same disk as the thing they protect, which
# covers the common case (a bad migration, a mistaken delete) but not the
# one that loses the server. Copy them off-box as well:
#
#   rclone sync /srv/clinic/backups remote:clinic-backups
#
# Cloudflare R2 holds 10 GB free with no egress charge, so restoring
# costs nothing.
