#!/usr/bin/env bash
# Runs the workflow's bundle check against real builds of both apps,
# with and without their configuration. Four cases, each with a known
# right answer -- a guard that has not been tried against a correct
# build is just as likely to block a good deploy as catch a bad one.
set -uo pipefail
REPO="C:/Users/Suhelali/OneDrive/Desktop/Marketing"

check() {   # check <app> <PLATFORM_DOMAIN> <PROVIDER_API_URL>
  local app="$1" PLATFORM_DOMAIN="$2" PROVIDER_API_URL="$3"
  cd "$REPO/apps/$app" || return 1
  local fail=0

  if [ "$app" = "provider-console" ]; then
    if grep -rqE 'localhost:(4100|4200)' dist/ 2>/dev/null; then
      echo "        rejected: contains a localhost dev URL"; fail=1
    fi
    if [ -n "$PROVIDER_API_URL" ] && ! grep -rqF "$PROVIDER_API_URL" dist/ 2>/dev/null; then
      echo "        rejected: missing $PROVIDER_API_URL"; fail=1
    fi
  else
    for needle in "$PLATFORM_DOMAIN" "$PROVIDER_API_URL"; do
      [ -z "$needle" ] && continue
      if ! grep -rqF "$needle" dist/ 2>/dev/null; then
        echo "        rejected: missing '$needle'"; fail=1
      fi
    done
    if [ -z "$PLATFORM_DOMAIN" ] || [ -z "$PROVIDER_API_URL" ]; then
      echo "        rejected: PLATFORM_DOMAIN or PROVIDER_API_URL unset"; fail=1
    fi
  fi
  return $fail
}

build() {   # build <app> <with-env?>
  local app="$1" withenv="$2"
  cd "$REPO/apps/$app" || return 1
  rm -rf dist .env.production
  if [ "$withenv" = "yes" ]; then
    {
      echo 'VITE_PLATFORM_DOMAIN=nayaverse.in'
      echo 'VITE_PROVIDER_API_URL=https://api.nayaverse.in'
      [ "$app" = "provider-console" ] && echo 'VITE_API_URL=https://api.nayaverse.in/api/provider'
    } > .env.production
  fi
  npm run build > /dev/null 2>&1
  rm -f .env.production
}

bad=0
expect() {  # expect <label> <pass|fail>
  local label="$1" want="$2"
  if check "$APP" "$PD" "$PU"; then got=pass; else got=fail; fi
  if [ "$got" = "$want" ]; then
    echo "    ok   $label -> $got"
  else
    echo "    WRONG $label -> $got (wanted $want)"; bad=1
  fi
}

echo "=== provider-console ==="
APP=provider-console
build "$APP" yes
PD=nayaverse.in; PU=https://api.nayaverse.in
expect "built with config" pass
build "$APP" no
expect "built without config" fail

echo
echo "=== clinic-web ==="
APP=clinic-web
build "$APP" yes
PD=nayaverse.in; PU=https://api.nayaverse.in
expect "built with config (localhost fallback present, must still pass)" pass
build "$APP" no
expect "built without config" fail

cd "$REPO"
echo
[ "$bad" = "0" ] && echo "all four cases correct" || echo "SOME CASES WRONG"
exit $bad
