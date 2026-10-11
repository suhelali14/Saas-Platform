#!/usr/bin/env bash
# Regression tests for subdomain addressing.
#
# These cover three things that fail OPEN if they regress, which is why
# they are worth keeping rather than having been run once:
#
#   1. resolveTenant  -- a hostname reading as the wrong clinic would point
#      one clinic's staff at another clinic's database.
#   2. isPlatformSubdomain -- the CORS origin check. `evil-yourco.in` and
#      `yourco.in.evil.com` are how a hand-rolled suffix match usually
#      fails open.
#   3. validateSlug -- a slug becomes a hostname, so a clinic named `api`
#      would claim the platform's own API hostname.
#
# The real modules are bundled with esbuild and exercised directly, rather
# than reimplemented here: a test that restates the logic it is checking
# passes for the wrong reason.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

npx esbuild apps/clinic-web/src/lib/tenant.ts --bundle --format=esm --platform=neutral \
  --define:import.meta.env.VITE_PLATFORM_DOMAIN='"yourco.in"' \
  --define:import.meta.env.VITE_PROVIDER_API_URL='"https://console.yourco.in"' \
  --outfile="$OUT/tenant.build.mjs" --log-level=error

npx esbuild apps/provider-api/src/lib/subdomain.ts --bundle --format=esm \
  --platform=neutral --outfile="$OUT/slug.build.mjs" --log-level=error

cp scripts/subdomain-tests/*.test.mjs "$OUT/"
node "$OUT/tenant.test.mjs"
node "$OUT/origin-and-slug.test.mjs"
