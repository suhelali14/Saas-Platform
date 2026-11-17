#!/usr/bin/env bash
#
# Fires clinic-runner.service the moment a job file appears in
# /srv/clinic/jobs/pending/, instead of waiting out the 15-second timer.
#
# The timer (clinic-runner.timer) is still enabled as a safety net: if
# inotifywait exits (restart, package upgrade), the next timer tick
# still picks up any backlog. This file-watch path is purely an
# optimisation -- it does not replace the timer, and processing is still
# serialised by the flock inside clinic-runner.sh.
#
# Needs the inotify-tools package (`apt install inotify-tools`).
set -uo pipefail

ROOT=/srv/clinic
PENDING="$ROOT/jobs/pending"

[ "$(id -u)" = "0" ] || { echo "Must run as root." >&2; exit 1; }
mkdir -p "$PENDING"

command -v inotifywait >/dev/null 2>&1 || {
  echo "inotifywait not installed. apt install inotify-tools." >&2
  exit 1
}

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

log "watching $PENDING for new jobs"

# -m    monitor continuously
# -q    quiet (one line per event, no banner)
# -e    only the events we care about: new files, moves into the dir
# --format just the filename, so we can log it
inotifywait -m -q \
  -e create -e moved_to -e close_write \
  --format '%f' "$PENDING" |
while read -r filename; do
  # Skip dotfiles (temp writes while the API is composing the file).
  # The API does an atomic rename when done; that fires moved_to on the
  # real name.
  case "$filename" in
    .*|*.tmp) continue ;;
    *.json) ;;
    *) continue ;;
  esac
  log "new job: $filename -- triggering runner"
  # systemd starts it as a no-op if it's already running thanks to the
  # oneshot type + the flock inside the script. Either way, back to
  # listening within a few milliseconds.
  systemctl start --no-block clinic-runner.service
done
