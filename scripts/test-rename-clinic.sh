#!/usr/bin/env bash
#
# Exercises rename-clinic.sh's file handling against a throwaway tree.
#
# The service steps (certbot, nginx, docker) cannot run here and are
# skipped by pointing CLINIC_ROOT at a temp directory and running with
# --dry-run for the service-touching path. What IS tested is the part
# that silently loses data when it goes wrong: the env file, the values
# inside it that embed the slug, and the directory holding every scan the
# clinic has uploaded.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../deploy/rename-clinic.sh"
FAILED=0

ok()   { printf '   \033[32mok\033[0m   %s\n' "$*"; }
bad()  { printf '   \033[31mBAD\033[0m  %s\n' "$*"; FAILED=1; }

mktree() {
  T="$(mktemp -d)"
  mkdir -p "$T/env" "$T/data/vadgaonkar/uploads"
  cat > "$T/env/vadgaonkar.env" <<ENV
NODE_ENV=production
PORT=4101
DATABASE_URL=postgresql://u:p@ep-vadgaonkar-host.neon.tech/neondb?schema=public
JWT_SECRET=secret-value-at-least-16-chars
REDIS_URL=redis://redis-vadgaonkar:6379
CLINIC_PLAN=BASIC
CORS_ORIGINS=https://vadgaonkar.nayaverse.in,https://vadgaonkar.portal.nayaverse.in
ENV
  chmod 600 "$T/env/vadgaonkar.env"
  printf 'xray' > "$T/data/vadgaonkar/uploads/scan-1.jpg"
  printf 'report' > "$T/data/vadgaonkar/uploads/lab-2.pdf"
  printf '%s' "$T"
}

echo "--- refuses an invalid new slug ---"
T="$(mktree)"
out="$(CLINIC_ROOT="$T" bash "$SCRIPT" --dry-run vadgaonkar 'Not A Slug' 2>&1)"
[ $? -ne 0 ] && echo "$out" | grep -q 'not a valid slug' \
  && ok "rejected 'Not A Slug'" || bad "accepted an invalid slug"
rm -rf "$T"

echo "--- refuses when the target already exists ---"
T="$(mktree)"; : > "$T/env/wadgaonkar.env"
out="$(CLINIC_ROOT="$T" bash "$SCRIPT" --dry-run vadgaonkar wadgaonkar 2>&1)"
echo "$out" | grep -q 'already exists' && ok "refused to overwrite an existing clinic" \
  || bad "did not refuse an existing target"
rm -rf "$T"

echo "--- refuses an unknown source ---"
T="$(mktree)"
out="$(CLINIC_ROOT="$T" bash "$SCRIPT" --dry-run nosuchclinic wadgaonkar 2>&1)"
echo "$out" | grep -q 'no env file' && ok "refused an unknown slug" \
  || bad "did not refuse an unknown slug"
rm -rf "$T"

echo "--- refuses identical slugs ---"
T="$(mktree)"
out="$(CLINIC_ROOT="$T" bash "$SCRIPT" --dry-run vadgaonkar vadgaonkar 2>&1)"
echo "$out" | grep -q 'the same' && ok "refused a no-op rename" || bad "allowed old == new"
rm -rf "$T"

echo "--- dry run changes nothing on disk ---"
T="$(mktree)"
before="$(find "$T" | sort | md5sum)"
CLINIC_ROOT="$T" bash "$SCRIPT" --dry-run vadgaonkar wadgaonkar > /dev/null 2>&1
after="$(find "$T" | sort | md5sum)"
[ "$before" = "$after" ] && ok "dry run left the tree untouched" || bad "dry run modified the tree"
rm -rf "$T"

# The real thing, with the service steps absent (no certbot, no docker,
# no nginx on this machine) so only the file handling runs.
echo "--- a real rename moves the env, the values inside it, and the files ---"
T="$(mktree)"
CLINIC_ROOT="$T" bash "$SCRIPT" vadgaonkar wadgaonkar > "$T/out.log" 2>&1

[ -f "$T/env/wadgaonkar.env" ] && ok "new env file exists" || bad "new env file missing"
[ -f "$T/env/vadgaonkar.env" ] && bad "old env still active -- the old container would keep serving" \
  || ok "old env retired"
[ -f "$T/env/vadgaonkar.env.renamed-to-wadgaonkar" ] && ok "old env kept for rollback" \
  || bad "old env not kept -- no fast rollback"

grep -q '^REDIS_URL=redis://redis-wadgaonkar:6379$' "$T/env/wadgaonkar.env" \
  && ok "REDIS_URL points at the new session store" \
  || bad "REDIS_URL still points at the old store -- nobody could sign in"

grep -q '^CORS_ORIGINS=https://wadgaonkar.nayaverse.in,https://wadgaonkar.portal.nayaverse.in$' "$T/env/wadgaonkar.env" \
  && ok "CORS_ORIGINS rewritten" \
  || bad "CORS_ORIGINS stale -- the site's own API would refuse it"

# The one that matters most.
[ -f "$T/data/wadgaonkar/uploads/scan-1.jpg" ] && [ -f "$T/data/wadgaonkar/uploads/lab-2.pdf" ] \
  && ok "patient files moved with the clinic" \
  || bad "PATIENT FILES LOST -- scans and lab reports would 404"
[ -d "$T/data/vadgaonkar" ] && bad "old data directory left behind" || ok "old data directory gone"

# A blunt s/old/new/g would have corrupted this.
grep -q 'ep-vadgaonkar-host.neon.tech' "$T/env/wadgaonkar.env" \
  && ok "DATABASE_URL untouched (a blunt replace would have broken it)" \
  || bad "DATABASE_URL was rewritten -- the clinic would point at the wrong database"

grep -q '^PORT=4101$' "$T/env/wadgaonkar.env" && ok "port preserved" || bad "port changed"
grep -q '^JWT_SECRET=secret-value-at-least-16-chars$' "$T/env/wadgaonkar.env" \
  && ok "JWT secret preserved (sessions and tokens survive)" || bad "JWT secret changed"

# The env file holds the database password and the JWT secret, so its
# mode matters. Verified only where the filesystem actually honours it:
# chmod is a no-op on Windows, and a test that fails for that reason
# teaches people to ignore the suite.
probe="$T/.chmod-probe"; : > "$probe"; chmod 600 "$probe" 2>/dev/null
if [ "$(stat -c '%a' "$probe" 2>/dev/null)" = "600" ]; then
  perms="$(stat -c '%a' "$T/env/wadgaonkar.env" 2>/dev/null || echo '?')"
  [ "$perms" = "600" ] && ok "new env file is 600" || bad "new env file is $perms, not 600"
else
  printf '   [33mskip[0m %s
' "file mode: chmod is a no-op on this filesystem (checked, not assumed)"
fi
rm -rf "$T"

echo
if [ "$FAILED" = 0 ]; then echo "all cases correct"; else echo "SOME CASES FAILED"; exit 1; fi
