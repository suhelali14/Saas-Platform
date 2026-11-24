#!/usr/bin/env bash
#
# deploy/set-plan.sh copies the assistant's two keys into a clinic's env
# file when the assistant is switched on. This runs the real script
# against a made-up /srv/clinic in a temp directory, with a stand-in
# `docker`, and checks the four things that matter:
#
#   - switched on, no keys yet     -> both copied, clinic restarted
#   - switched on, has its own key -> its own key kept, not overwritten
#   - switched off                 -> nothing copied
#   - the key's value never appears in the script's output
#
#   bash scripts/test-set-plan-keys.sh

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail=0
check() { if [ "$1" = "$2" ]; then printf '  ok    %s\n' "$3"; else printf '  FAIL  %s\n        expected: %s\n        got:      %s\n' "$3" "$2" "$1"; fail=1; fi; }

# The script with its root pointed at the temp directory, and a `docker`
# that only notes it was called.
sed "s#^ROOT=/srv/clinic\$#ROOT=$WORK/clinic#" "$REPO/deploy/set-plan.sh" > "$WORK/set-plan.sh"
grep -q "^ROOT=$WORK/clinic\$" "$WORK/set-plan.sh" || { echo "could not repoint ROOT"; exit 1; }
mkdir -p "$WORK/bin" "$WORK/clinic/env"
cat > "$WORK/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
echo "docker $*" >> "$DOCKER_LOG"
DOCKER
chmod +x "$WORK/bin/docker"
export PATH="$WORK/bin:$PATH"
export DOCKER_LOG="$WORK/docker.log"
: > "$WORK/clinic/compose.yml"

SPEECH="sk_test_speech_value_0001"
MODEL="sk-test-model-value-0002"
printf 'NEON_API_KEY=x\nSARVAM_API_KEY=%s\nANTHROPIC_API_KEY=%s\n' "$SPEECH" "$MODEL" > "$WORK/clinic/env/provider.env"

fresh() { printf 'DATABASE_URL=postgres://x\nCLINIC_PLAN=BASIC\n' > "$WORK/clinic/env/$1.env"; : > "$DOCKER_LOG"; }
value() { grep -E "^$2=" "$WORK/clinic/env/$1.env" | tail -n 1 | cut -d= -f2-; }

echo "switched on, no keys yet"
fresh acme
out="$(bash "$WORK/set-plan.sh" acme BASIC staff,billing,scribe 0 2>&1)"
check "$(value acme SARVAM_API_KEY)" "$SPEECH" "speech key copied"
check "$(value acme ANTHROPIC_API_KEY)" "$MODEL" "model key copied"
check "$(value acme CLINIC_FEATURES)" "staff,billing,scribe" "modules written"
check "$(grep -c 'force-recreate clinic-acme' "$DOCKER_LOG")" "1" "clinic restarted"
check "$(printf '%s' "$out" | grep -c -e "$SPEECH" -e "$MODEL")" "0" "no key value in the output"

echo "run again, nothing changed"
: > "$DOCKER_LOG"
bash "$WORK/set-plan.sh" acme BASIC staff,billing,scribe 0 > /dev/null 2>&1
check "$(grep -c 'force-recreate' "$DOCKER_LOG")" "0" "not restarted a second time"
check "$(grep -c '^SARVAM_API_KEY=' "$WORK/clinic/env/acme.env")" "1" "key not written twice"

echo "switched on, clinic has its own speech key"
fresh bright
printf 'SARVAM_API_KEY=the-clinics-own\n' >> "$WORK/clinic/env/bright.env"
bash "$WORK/set-plan.sh" bright STANDARD staff,scribe 0 > /dev/null 2>&1
check "$(value bright SARVAM_API_KEY)" "the-clinics-own" "its own key kept"
check "$(value bright ANTHROPIC_API_KEY)" "$MODEL" "the missing one copied"

echo "switched off"
fresh plain
bash "$WORK/set-plan.sh" plain BASIC staff,billing 0 > /dev/null 2>&1
check "$(grep -c -E '^(SARVAM|ANTHROPIC)_API_KEY=' "$WORK/clinic/env/plain.env")" "0" "no key copied"

echo "switched on, provider has no keys"
printf 'NEON_API_KEY=x\n' > "$WORK/clinic/env/provider.env"
fresh bare
out="$(bash "$WORK/set-plan.sh" bare BASIC staff,scribe 0 2>&1)"
check "$(grep -c -E '^(SARVAM|ANTHROPIC)_API_KEY=' "$WORK/clinic/env/bare.env")" "0" "nothing invented"
check "$(printf '%s' "$out" | grep -c 'is not set for bare')" "2" "said so, once for each key"
check "$(value bare CLINIC_FEATURES)" "staff,scribe" "modules still written"

[ "$fail" = 0 ] && echo "all passed" || { echo "FAILED"; exit 1; }
