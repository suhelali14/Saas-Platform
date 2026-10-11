#!/usr/bin/env bash
# Runs the real render-compose.sh against a throwaway directory and checks
# the YAML it produces actually parses and has the right shape.
#
# A malformed compose.yml breaks every deploy, and the only place it was
# previously exercised was in production.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/env" "$WORK/data"
printf '%s' 'ghcr.io/suhelali14/saas-platform/api:abc123' > "$WORK/.image"

cat > "$WORK/env/provider.env" <<'EOF'
NODE_ENV=production
PORT=4200
DATABASE_URL="postgresql://u:p@host/db"
JWT_SECRET="x"
EOF

cat > "$WORK/env/acme.env" <<'EOF'
NODE_ENV=production
PORT=4101
DATABASE_URL="postgresql://u:p@host/acme"
JWT_SECRET="y"
EOF

cat > "$WORK/env/bright.env" <<'EOF'
NODE_ENV=production
PORT=4102
DATABASE_URL="postgresql://u:p@host/bright"
JWT_SECRET="z"
EOF

fail=0

run_case() {   # run_case <label> <CLINIC_MEMORY_LIMIT or empty>
  local label="$1" limit="${2:-}"
  echo
  echo "--- $label ---"
  rm -f "$WORK/compose.yml"
  if [ -n "$limit" ]; then
    CLINIC_ROOT="$WORK" CLINIC_MEMORY_LIMIT="$limit" bash "$REPO/deploy/render-compose.sh"
  else
    CLINIC_ROOT="$WORK" bash "$REPO/deploy/render-compose.sh"
  fi
  local rc=$?
  if [ "$rc" != "0" ]; then echo "   script exited $rc"; fail=1; return; fi

  python - "$WORK/compose.yml" <<'PY'
import sys, io
try:
    import yaml
except ImportError:
    print('   (pyyaml missing, skipping parse)'); sys.exit(0)
d = yaml.safe_load(io.open(sys.argv[1], encoding='utf-8'))
svc = d.get('services') or {}
print('   parsed ok; services: %s' % ', '.join(sorted(svc)))
problems = []
expected = {'provider-api', 'clinic-acme', 'clinic-bright'}
if set(svc) != expected:
    problems.append('expected %s' % sorted(expected))
for name, c in svc.items():
    if not c.get('image'):         problems.append('%s has no image' % name)
    if not c.get('command'):       problems.append('%s has no command' % name)
    if not c.get('env_file'):      problems.append('%s has no env_file' % name)
    if not c.get('ports'):         problems.append('%s has no ports' % name)
    for p in c.get('ports', []):
        if not str(p).startswith('127.0.0.1:'):
            problems.append('%s port %s is not bound to loopback' % (name, p))
    if name.startswith('clinic-') and not c.get('volumes'):
        problems.append('%s has no uploads volume -- patient files would die with the container' % name)
    lim = (c.get('deploy') or {}).get('resources', {}).get('limits', {}).get('memory')
    print('      %-16s port=%-18s mem=%s' % (name, c['ports'][0], lim or '(uncapped)'))
if problems:
    print('   PROBLEMS:'); [print('     - ' + p) for p in problems]; sys.exit(1)
print('   shape ok')
PY
  [ "$?" != "0" ] && fail=1
}

run_case "auto-sized on this machine's RAM" ""
run_case "explicit CLINIC_MEMORY_LIMIT=300M" "300M"

echo
echo "--- no env files at all (must fail cleanly, not emit broken YAML) ---"
EMPTY="$(mktemp -d)"
mkdir -p "$EMPTY/env"
printf '%s' 'img:tag' > "$EMPTY/.image"
# Capture first, then grep. Piping straight into grep under `pipefail`
# returns the SCRIPT's exit code (1, by design here), so the check fails
# even when grep matched -- the same trap as `cmd | head` masking status.
OUT_EMPTY="$(CLINIC_ROOT="$EMPTY" bash "$REPO/deploy/render-compose.sh" 2>&1 || true)"
if printf '%s' "$OUT_EMPTY" | grep -q "nothing to render"; then
  echo "   refused with a clear message"
else
  echo "   *** did not refuse cleanly: $OUT_EMPTY ***"; fail=1
fi
[ -f "$EMPTY/compose.yml" ] && { echo "   *** left a compose.yml behind ***"; fail=1; }
rm -rf "$EMPTY"

echo
echo "--- no .image recorded (must refuse) ---"
NOIMG="$(mktemp -d)"
mkdir -p "$NOIMG/env"
cp "$WORK/env/acme.env" "$NOIMG/env/"
OUT_NOIMG="$(CLINIC_ROOT="$NOIMG" bash "$REPO/deploy/render-compose.sh" 2>&1 || true)"
if printf '%s' "$OUT_NOIMG" | grep -q "No image recorded"; then
  echo "   refused with a clear message"
else
  echo "   *** did not refuse: $OUT_NOIMG ***"; fail=1
fi
rm -rf "$NOIMG"

echo
[ "$fail" = "0" ] && echo "all cases correct" || echo "SOME CASES FAILED"
exit $fail
