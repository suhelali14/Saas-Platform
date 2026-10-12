#!/usr/bin/env bash
# Exercises the migration retry with a fake "docker run" so the three
# cases can be checked without a database.
#
# The dangerous one is the third: a migration that RAN and then failed
# must never be retried, because the second attempt applies part of it
# on top of the first.
set -uo pipefail

LOG=/tmp/mig.log
CALLS=/tmp/calls

# Mirrors the loop in deploy-image.sh.
run_with_retry() {   # run_with_retry <behaviour>
  local behaviour="$1"
  : > "$CALLS"
  local migrate_rc=0 attempt=1
  while :; do
    echo "call" >> "$CALLS"
    if fake_docker "$behaviour" > "$LOG" 2>&1; then
      migrate_rc=0; break
    fi
    migrate_rc=1
    if [ "$attempt" -lt 3 ] && grep -q 'P1001' "$LOG"; then
      attempt=$((attempt + 1))
      continue          # no sleep in the test
    fi
    break
  done
  return $migrate_rc
}

fake_docker() {
  case "$1" in
    ok)            echo "All migrations applied."; return 0 ;;
    always_p1001)  echo "Error: P1001 Can't reach database server"; return 1 ;;
    p1001_then_ok)
      # Unreachable the first time, awake by the second.
      if [ "$(wc -l < "$CALLS")" -lt 2 ]; then
        echo "Error: P1001 Can't reach database server"; return 1
      fi
      echo "All migrations applied."; return 0 ;;
    real_failure)  echo "Error: P3009 migration failed to apply cleanly"; return 1 ;;
  esac
}

bad=0
check() {   # check <label> <behaviour> <want-rc> <want-calls>
  local label="$1" behaviour="$2" want_rc="$3" want_calls="$4"
  run_with_retry "$behaviour"; local rc=$?
  local calls; calls="$(wc -l < "$CALLS" | tr -d ' ')"
  if [ "$rc" = "$want_rc" ] && [ "$calls" = "$want_calls" ]; then
    echo "    ok    $label -> rc=$rc after $calls attempt(s)"
  else
    echo "    WRONG $label -> rc=$rc after $calls (wanted rc=$want_rc, $want_calls)"
    bad=1
  fi
}

echo "=== migration retry ==="
check "succeeds first time"                   ok            0 1
check "asleep once, then wakes"               p1001_then_ok 0 2
check "unreachable throughout"                always_p1001  1 3
check "migration RAN and failed (no retry!)"  real_failure  1 1

rm -f "$LOG" "$CALLS"
echo
[ "$bad" = "0" ] && echo "all cases correct" || echo "SOME CASES WRONG"
exit $bad
