#!/usr/bin/env bash
#
# Runs provisioning jobs written by the console.
#
# The console API runs in a container and has no access to this host.
# Rather than give it any -- a Docker socket is root on the machine, and
# that container faces the internet and holds the Neon API key -- it
# writes a job file to a shared directory, and this picks it up.
#
#   /srv/clinic/jobs/pending/<id>.json    written by the API
#   /srv/clinic/jobs/status/<id>.json     written here, read by the API
#
# The API can therefore ask for exactly one thing: "create this clinic".
# It cannot run a command of its own choosing, because nothing here
# takes a command from the job -- only a slug, a name and a connection
# string, each validated before use.
#
# Installed as a systemd timer by bootstrap-server.sh. Safe to run by
# hand; it processes whatever is pending and exits.
set -uo pipefail

ROOT=/srv/clinic
JOBS="$ROOT/jobs"
PENDING="$JOBS/pending"
STATUS="$JOBS/status"
ARCHIVE="$JOBS/done"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
redact() { sed -E 's#(postgres(ql)?://)[^@[:space:]]*@#\1***:***@#g'; }

[ "$(id -u)" = "0" ] || { echo "Must run as root." >&2; exit 1; }
mkdir -p "$PENDING" "$STATUS" "$ARCHIVE"
chmod 700 "$PENDING" "$STATUS" "$ARCHIVE"

# One at a time. Two concurrent runs would race over port assignment and
# could hand two clinics the same port.
exec 9>"$JOBS/.lock"
flock -n 9 || { log "another run is in progress"; exit 0; }

# Proof of life, written on every run whether or not there is work.
#
# Without it the console cannot tell a queue nobody is watching from one
# that is simply idle -- and a job dropped into an unwatched directory
# sits at "Queued" forever while the UI polls a status file that will
# never change. The timestamp is also how the API knows the directory it
# writes to is the same one this reads from: if it were not, the API
# would never see this file at all.
date -u +%s > "$JOBS/.runner-heartbeat"
chmod 644 "$JOBS/.runner-heartbeat" 2>/dev/null || true

shopt -s nullglob
JOB_FILES=("$PENDING"/*.json)
shopt -u nullglob
[ ${#JOB_FILES[@]} -gt 0 ] || exit 0

# Writes a status file the API can read. Never contains the connection
# string; the password is included only on success and only once.
write_status() {  # write_status <id> <state> <message> [extra-json]
  local id="$1" state="$2" message="$3" extra="${4:-}"
  local tmp="$STATUS/.$id.tmp"
  {
    printf '{"id":%s,' "$(json_str "$id")"
    printf '"state":%s,' "$(json_str "$state")"
    printf '"message":%s,' "$(json_str "$message")"
    printf '"updatedAt":%s' "$(json_str "$(date -u +%Y-%m-%dT%H:%M:%SZ)")"
    [ -n "$extra" ] && printf ',%s' "$extra"
    printf '}\n'
  } > "$tmp"
  chmod 600 "$tmp"
  # Owned by whoever owns the queue -- the API container runs as that
  # uid and has to read this back. Written by root and left root-owned,
  # a 0600 status file is unreadable by the API, which then reports the
  # job as missing: the console showed 200s from its own queued status,
  # then 404s the moment this overwrote it.
  #
  # Still 0600, not world-readable: on success this file carries the
  # clinic's one-time password.
  chown --reference="$JOBS" "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$STATUS/$id.json"
}

# Minimal JSON string escaping. jq is installed by the bootstrap, but a
# status write must not fail just because it is missing.
json_str() {
  printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null \
    || printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/ /g' | tr -d '\n\r')"
}

read_json() {  # read_json <file> <key>
  python3 -c '
import json,sys
try:
    d = json.load(open(sys.argv[1], encoding="utf-8"))
    v = d.get(sys.argv[2], "")
    sys.stdout.write("" if v is None else str(v))
except Exception:
    sys.exit(1)
' "$1" "$2" 2>/dev/null
}

for job in "${JOB_FILES[@]}"; do
  id="$(basename "$job" .json)"
  log "job $id"

  slug="$(read_json "$job" slug)"
  name="$(read_json "$job" name)"
  doctor="$(read_json "$job" doctorName)"
  email="$(read_json "$job" doctorEmail)"
  plan="$(read_json "$job" plan)"
  dburl="$(read_json "$job" databaseUrl)"

  # Validate before acting. These values came from an HTTP request, and
  # the slug in particular becomes a hostname, a filename and a
  # container name.
  fault=""
  [ -n "$slug" ] || fault="slug is missing"
  [ -z "$fault" ] && ! printf '%s' "$slug" | grep -qE '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' \
    && fault="slug '$slug' is not a valid hostname label"
  [ -z "$fault" ] && [ -z "$name" ] && fault="clinic name is missing"
  [ -z "$fault" ] && [ -z "$email" ] && fault="doctor email is missing"
  [ -z "$fault" ] && ! printf '%s' "$dburl" | grep -qE '^postgres(ql)?://' \
    && fault="databaseUrl is not a Postgres connection string"
  case "$plan" in BASIC|STANDARD|PREMIUM) ;; *) plan=STANDARD ;; esac

  if [ -n "$fault" ]; then
    log "  rejected: $fault"
    write_status "$id" failed "$fault"
    mv -f "$job" "$ARCHIVE/$id.json"
    continue
  fi

  write_status "$id" running "Provisioning $name"

  out="$JOBS/.out-$id"
  if NON_INTERACTIVE=1 \
     CLINIC_DATABASE_URL="$dburl" \
     CLINIC_NAME="$name" \
     CLINIC_DOCTOR_NAME="$doctor" \
     CLINIC_DOCTOR_EMAIL="$email" \
     "$ROOT/repo/deploy/add-clinic.sh" "$slug" --plan "$plan" > "$out" 2>&1; then

    password="$(grep -m1 '^RESULT_PASSWORD=' "$out" | cut -d= -f2-)"
    apihost="$(grep -m1 '^RESULT_API_HOST=' "$out" | cut -d= -f2-)"
    extra="$(printf '"apiHost":%s,"loginEmail":%s,"password":%s' \
             "$(json_str "$apihost")" "$(json_str "$email")" "$(json_str "$password")")"
    write_status "$id" succeeded "$name is live" "$extra"
    log "  succeeded: $slug -> $apihost"
  else
    # Last few lines only, redacted. A full log would put the connection
    # string into a file the API can read.
    tail="$(redact < "$out" | tail -8 | tr '\n' ' ')"
    write_status "$id" failed "$tail"
    log "  FAILED: $slug"
    redact < "$out" | tail -15 | sed 's/^/      /'
  fi

  # The job file holds a connection string. Remove it rather than
  # archiving it; the status file deliberately never contained one.
  shred -u "$job" 2>/dev/null || rm -f "$job"
  rm -f "$out"
done
