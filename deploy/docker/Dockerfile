# One image, both APIs.
#
# clinic-api and provider-api share a monorepo, a lockfile and a release
# cadence, so building them separately would compile the same dependency
# tree twice and give two tags to keep in step. The entrypoint picks which
# app a container runs:
#
#   docker run IMAGE node apps/clinic-api/dist/index.js     # one clinic
#   docker run IMAGE node apps/provider-api/dist/server.js  # the console
#
# Debian slim rather than Alpine: Prisma ships a different query engine
# for musl, and the `native` binary target resolved in the builder has to
# match the runtime. Same base for both stages means it does, with no
# binaryTargets to maintain.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Manifests first, so a source-only change reuses the install layer.
#
# EVERY workspace member has to be listed, not just the two APIs being
# built: `npm ci` resolves the whole workspace graph against the lockfile
# and fails if a member named in it is absent. Add a new app under apps/
# and it must be added here too -- the build will tell you, loudly, at
# `npm ci`.
COPY package.json package-lock.json ./
COPY apps/admin/package.json              apps/admin/
COPY apps/api/package.json                apps/api/
COPY apps/business-dashboard/package.json apps/business-dashboard/
COPY apps/clinic-api/package.json         apps/clinic-api/
COPY apps/clinic-web/package.json         apps/clinic-web/
COPY apps/mobile/package.json             apps/mobile/
COPY apps/nayaverse-web/package.json      apps/nayaverse-web/
COPY apps/provider-api/package.json       apps/provider-api/
COPY apps/provider-console/package.json   apps/provider-console/
COPY packages/shared-types/package.json   packages/shared-types/

# THE RULE: `npm ci` runs postinstall for every workspace member, so
# whatever any member's postinstall READS has to be in the context
# before the install -- not just the two apps this image actually runs.
# One member's missing input fails the whole install.
#
# It has now bitten twice, in two different shapes, so the rule is
# stated once here rather than per-app:
#
#   - a Prisma schema, missing which gives "Could not find Prisma
#     Schema" (died 33s in), and
#   - a script file, missing which gives ERR_MODULE_NOT_FOUND from
#     clinic-web's `node scripts/ensure-shell.mjs` (died 42s in, and is
#     why this image failed to build at all for one commit).
#
# apps/api is not deployed from this image and its client is never used.
# Its schema is copied anyway because that is cheaper and far less
# fragile than --ignore-scripts, which would also skip esbuild's
# postinstall and leave tsx unable to run the clinic seed scripts.
#
# scripts/check-dockerfile.py enforces the rule generally: it reads every
# member's postinstall, works out which local files it needs, and fails
# if one is not copied BEFORE the npm ci below. That check is a second or
# two in CI instead of 42 seconds into a Docker build.
COPY apps/api/prisma/          apps/api/prisma/
COPY apps/clinic-api/prisma/   apps/clinic-api/prisma/
COPY apps/provider-api/prisma/ apps/provider-api/prisma/
COPY apps/clinic-web/scripts/  apps/clinic-web/scripts/

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# `npm ci` runs each API's postinstall, which is `prisma generate`. Dev
# dependencies are required for that: `prisma` is a devDependency, so
# --omit=dev fails during install rather than merely skipping it.
RUN npm ci --no-audit --fund=false

COPY . .

# Regenerate explicitly. The postinstall above ran before the full source
# was copied, and being explicit means a failure names the app.
RUN for app in clinic-api provider-api; do \
      (cd "apps/$app" && npx prisma generate) || exit 1; \
    done

# The build also copies each generated client into dist/, because the
# client is JavaScript and tsc does not emit it, while src/lib/prisma.ts
# imports it by a relative path that resolves inside dist/.
RUN npm run --workspace apps/clinic-api build \
 && npm run --workspace apps/provider-api build

# Fail here rather than at container start, where it surfaces as a crash
# loop with ERR_MODULE_NOT_FOUND and no indication why.
RUN test -f apps/clinic-api/dist/generated/prisma-client/index.js \
 && test -f apps/provider-api/dist/generated/prisma-client/index.js \
 && test -f apps/clinic-api/dist/index.js \
 && test -f apps/provider-api/dist/server.js


# ── Runtime ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# node_modules is copied whole, dev dependencies included, deliberately.
# `prisma migrate deploy` and `tsx` are needed to migrate a clinic and to
# seed a new one, and those run inside this image:
#
#   docker run IMAGE npx prisma migrate deploy
#
# Pruning would save a few hundred MB on a 25 GB disk and break the entire
# per-clinic workflow. Not a trade worth making.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Whole app directories rather than cherry-picked subpaths. In an npm
# workspaces monorepo most dependencies hoist to the root, so
# apps/<app>/node_modules may hold a couple of packages or may not exist
# at all depending on what resolved -- and COPY fails outright on a source
# that is not there. Copying the directory is one line, cannot break that
# way, and the extra few hundred KB of src/ makes stack traces readable.
COPY --from=builder /app/apps/clinic-api   ./apps/clinic-api
COPY --from=builder /app/apps/provider-api ./apps/provider-api

# The app resolves uploads against the working directory, so patient
# scans land in /app/uploads. A host directory is mounted here, one per
# clinic -- without that mount the files live in the container's layer and
# vanish on the next deploy.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
VOLUME ["/app/uploads"]

# Never root. This process handles uploaded files and faces the network.
USER node

# No curl in a slim image, and installing it just for this would widen the
# attack surface. Node 22 has global fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Overridden per container. Defaults to a clinic, the common case.
CMD ["node", "apps/clinic-api/dist/index.js"]
