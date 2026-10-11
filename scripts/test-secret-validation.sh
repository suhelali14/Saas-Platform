#!/usr/bin/env bash
# Exercises the deploy-api.yml secret-shape checks against the
# placeholder values currently in the repo, and against realistic ones.
# Mirrors the workflow's logic so a change there can be re-tested here.

check() {   # check <HOST> <USER> <KEY> <HOSTKEY>
  local HOST="$1" USER="$2" KEY="$3" HOSTKEY="$4"
  local bad=0
  complain() { echo "      rejected: $1"; bad=1; }

  if [ -z "$HOST" ]; then
    complain "DEPLOY_HOST is not set"
  elif ! printf '%s' "$HOST" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9-]+)+$'; then
    complain "DEPLOY_HOST is not an IP or hostname"
  fi

  if [ -z "$USER" ]; then
    complain "DEPLOY_USER is not set"
  elif [ "$USER" != "deploy" ]; then
    echo "      warning:  DEPLOY_USER is not 'deploy'"
  fi

  if [ -z "$KEY" ]; then
    complain "DEPLOY_SSH_KEY is not set"
  elif printf '%s' "$KEY" | grep -qE '^(ssh-(rsa|ed25519|dss)|ecdsa-sha2)'; then
    complain "DEPLOY_SSH_KEY holds the PUBLIC key"
  elif ! printf '%s' "$KEY" | grep -q 'BEGIN .*PRIVATE KEY'; then
    complain "DEPLOY_SSH_KEY is not a private key"
  fi

  if [ -n "$HOSTKEY" ] && ! printf '%s' "$HOSTKEY" | grep -qE '(ssh-(rsa|ed25519)|ecdsa-sha2)'; then
    complain "DEPLOY_HOST_KEY is not a host key"
  fi

  return $bad
}

REAL_KEY='-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gt
-----END OPENSSH PRIVATE KEY-----'
PUB_KEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIabc123 github-actions'
REAL_HOSTKEY='|1|Xy9c= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI'

fail=0

echo "1. the placeholders currently in your repo (23 / ss / ssss / sss)"
if check "23" "ss" "ssss" "sss"; then
  echo "      *** ACCEPTED -- the check is not working ***"; fail=1
else
  echo "      blocked, as intended"
fi

echo
echo "2. public key pasted instead of private (the common mistake)"
if check "159.89.160.22" "deploy" "$PUB_KEY" "$REAL_HOSTKEY"; then
  echo "      *** ACCEPTED -- would fail later with an auth error ***"; fail=1
else
  echo "      blocked, as intended"
fi

echo
echo "3. realistic values"
if check "159.89.160.22" "deploy" "$REAL_KEY" "$REAL_HOSTKEY"; then
  echo "      accepted, as intended"
else
  echo "      *** REJECTED -- the check is too strict ***"; fail=1
fi

echo
echo "4. a hostname instead of an IP (also valid)"
if check "server.example.in" "deploy" "$REAL_KEY" "$REAL_HOSTKEY"; then
  echo "      accepted, as intended"
else
  echo "      *** REJECTED -- hostnames should be allowed ***"; fail=1
fi

echo
echo "5. DEPLOY_HOST_KEY left unset (allowed, with a warning elsewhere)"
if check "159.89.160.22" "deploy" "$REAL_KEY" ""; then
  echo "      accepted, as intended"
else
  echo "      *** REJECTED -- it is optional ***"; fail=1
fi

echo
if [ "$fail" = "0" ]; then echo "all 5 cases behave correctly"; else echo "SOME CASES WRONG"; fi
exit $fail
