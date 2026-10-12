#!/usr/bin/env bash
# Runs the CI secret scan against the real bundles, then against the
# same bundles with a credential planted in each shape it should catch.
#
# A scanner only ever tried against clean input tells you nothing about
# whether it catches anything -- and one only tried against a planted
# secret is how the last version came to fail on documentation.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 1

scan() {   # scan <dir>
  local dir="$1" fail=0
  local patterns='
    napi_[A-Za-z0-9]{24,}
    vcp_[A-Za-z0-9]{24,}
    (ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}
    github_pat_[A-Za-z0-9_]{30,}
    postgres(ql)?://[^:/@[:space:]]+:[^@[:space:]]+@
    -----BEGIN.{0,24}PRIVATE
  '
  for pattern in $patterns; do
    if grep -rqE -e "$pattern" "$dir" 2>/dev/null; then
      echo "        caught: /$pattern/"
      fail=1
    fi
  done
  for name in JWT_SECRET NEON_API_KEY VERCEL_TOKEN DATABASE_URL; do
    if grep -rqE -e "$name[\"']?[:=][\"']?[A-Za-z0-9+/_-]{16,}" "$dir" 2>/dev/null; then
      echo "        caught: $name with a value attached"
      fail=1
    fi
  done
  return $fail
}

bad=0
expect() {  # expect <label> <dir> <pass|fail>
  local label="$1" dir="$2" want="$3"
  if scan "$dir"; then got=pass; else got=fail; fi
  if [ "$got" = "$want" ]; then
    echo "    ok    $label -> $got"
  else
    echo "    WRONG $label -> $got (wanted $want)"; bad=1
  fi
}

echo "=== the real bundles, as they are now ==="
for app in clinic-web provider-console; do
  [ -d "apps/$app/dist" ] || npm run --workspace "apps/$app" build > /dev/null 2>&1
  expect "$app (contains the literal text NEON_API_KEY)" "apps/$app/dist" pass
done

echo
echo "=== with a real credential planted, each shape ==="
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

plant() {  # plant <label> <content>
  rm -rf "$WORK/dist"; mkdir -p "$WORK/dist"
  cp apps/provider-console/dist/assets/*.js "$WORK/dist/app.js" 2>/dev/null || echo "x" > "$WORK/dist/app.js"
  printf '%s' "$2" >> "$WORK/dist/app.js"
  expect "$1" "$WORK/dist" fail
}

plant "Neon API key"        'const k="napi_34w4k25xebdtus8nr6sm35glbl64uskzv0gh"'
plant "Vercel token"        'const t="vcp_461PVQEL2h3H1WrjlpANywp3YK1mwnplao1su3LS"'
plant "GitHub token"        'const g="ghp_abcdefghijklmnopqrstuvwxyz0123456789"'
plant "Postgres URL w/ pw"  'const d="postgresql://neondb_owner:npg_1vmde9SsJxVc@ep-x.neon.tech/db"'
plant "private key"         'const p="-----BEGIN OPENSSH PRIVATE KEY-----"'
plant "inlined assignment"  'JWT_SECRET=U6Mdn6wdmLCrwGiQLnXwdMIahMGipRId'

echo
echo "=== a URL with no password must NOT fire (that is just a host) ==="
plant_ok() {
  rm -rf "$WORK/ok"; mkdir -p "$WORK/ok"
  printf '%s' 'const u="postgresql://ep-cool-name.neon.tech/neondb"' > "$WORK/ok/app.js"
  expect "connection string without credentials" "$WORK/ok" pass
}
plant_ok

echo
[ "$bad" = "0" ] && echo "all cases correct" || echo "SOME CASES WRONG"
exit $bad
