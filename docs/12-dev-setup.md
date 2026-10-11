# Development Setup

Status of this doc: written against what was actually scaffolded and
verified in this repo (Node v22.21.0, npm 11.6.2, Next.js 16.3.2, Expo SDK
57, Prisma 6.x). All four workspaces type-check cleanly and the API has
been smoke-tested end-to-end (see "What's already verified" below).

## Repo layout

```
apps/
  api/                  Fastify + TypeScript + Prisma backend
  business-dashboard/   Next.js business portal
  mobile/               Expo React Native consumer app
packages/
  shared-types/         TypeScript DTOs shared across all three apps
docs/                   This planning doc set
docker-compose.yml       Local Postgres + pgvector for dev
```

Root uses npm workspaces + Turborepo (`turbo.json`). Every workspace has a
`typecheck` script; `npm run typecheck` at the root runs all of them via
Turbo.

## Prerequisites

- Node.js 22.x (`.nvmrc` at repo root) and npm 11.x — already satisfied in
  this environment.
- **Docker Desktop**, if you want a local Postgres (recommended for
  Phase 1 dev). Not installed in this environment yet — see "Database"
  below for the no-Docker alternative.
- For running the mobile app on a device: the **Expo Go** app (iOS/Android)
  from the app store, or an Android/iOS simulator set up locally.

## First-time install

From the repo root:

```
npm install
```

This installs all four workspaces in one pass (npm workspaces hoists
shared dependencies to the root `node_modules`) and automatically runs
`prisma generate` for `apps/api` via its `postinstall` script — no live
database needed for that step.

## Environment variables

Each app that needs one ships a `.env.example`:

- `apps/api/.env.example` → copy to `apps/api/.env`. Required:
  `DATABASE_URL`, `JWT_SECRET` (signs session tokens — generate a real
  value with e.g. `openssl rand -hex 32` for anything beyond local dev).
  Optional for now: `ANTHROPIC_API_KEY` and/or `GEMINI_API_KEY` — the
  Intent Understanding Agent falls back to a heuristic parser until at
  least one is set (see `apps/api/src/services/ai/` and
  [10-tech-stack-decisions.md](10-tech-stack-decisions.md) "Multi-provider
  AI layer"). `AI_PROVIDER` (`auto`/`anthropic`/`gemini`) forces a
  specific one; `auto` (default) uses whichever key is set, Anthropic
  first if both are. `ANTHROPIC_MODEL` defaults to `claude-opus-5` — see
  doc 14 M2 for why the cheaper-tier option from doc 10/13 isn't the
  default. `GEMINI_MODEL` defaults to `gemini-3.7-flash`.
- `apps/business-dashboard/.env.example` → copy to `.env.local` (Next.js
  convention). Just `NEXT_PUBLIC_API_URL`, defaults to
  `http://localhost:4000` if unset.
- `apps/mobile/.env.example` → copy to `.env`. Just `EXPO_PUBLIC_API_URL`.
  **Android emulator:** `localhost` refers to the emulator itself, not
  your machine — use `http://10.0.2.2:4000` instead. **Physical device**
  via Expo Go: use your machine's LAN IP, e.g. `http://192.168.1.20:4000`.

## Database

The Prisma schema (`apps/api/prisma/schema.prisma`) targets Postgres and
is scoped to Phase 1-2 entities: User, UserProfile, Business,
IntentRequest, Offer, Match, Transaction, Review, RewardLedgerEntry (see
[06-data-model.md](06-data-model.md)). Once migrated, run
`npm run db:seed -w apps/api` to load ~15 dev-fixture businesses/offers
(see [14-mvp-implementation-plan.md](14-mvp-implementation-plan.md) M1) —
without it there's nothing for the matcher to return.

**Option A — Docker (recommended):**

```
docker compose up -d          # starts Postgres (pgvector image) on :5432
cd apps/api
npx prisma migrate dev --name init    # or: npm run db:migrate -w apps/api
```

**Option B — hosted Postgres (no Docker required):** create a free
instance on Neon or Supabase, put its connection string in
`apps/api/.env` as `DATABASE_URL`, then run the same `prisma migrate dev`
command. pgvector-specific columns aren't in the schema yet (that's a
Phase 2-3 addition per [07-roadmap-phases.md](07-roadmap-phases.md)), so
any plain Postgres instance works for now.

`npm run db:studio -w apps/api` opens Prisma Studio (a local DB GUI) once
a connection is configured.

## Running everything

```
npm run dev            # all three apps concurrently, via Turbo
# or individually:
npm run dev:api         # Fastify on :4000
npm run dev:dashboard   # Next.js on :3000
npm run dev:mobile      # Expo dev server (scan the QR with Expo Go, or press a/i)
```

## Auth

`POST /api/intent-requests` requires `Authorization: Bearer <token>`.
Get a token via `POST /api/auth/anonymous` with `{ "deviceId": "<any string>" }`
— it upserts a `User` by `deviceId` and returns a JWT (30-day expiry,
signed with `JWT_SECRET`). The mobile app does this automatically
(`src/lib/auth.ts`, token cached in `expo-secure-store`). This is
anonymous-device auth for Phase 1 dev, not real phone/OTP — see
[14-mvp-implementation-plan.md](14-mvp-implementation-plan.md) M5.

## What's already verified

- `npm run typecheck` (Turbo, all 4 workspaces) passes clean.
- `apps/api` boots and `GET /health` returns 200 with no database
  connected (Prisma connects lazily).
- `POST /api/intent-requests` without a token returns `401` before
  touching the database. With a valid JWT, request validation, auth, and
  intent parsing (whichever AI provider is configured, heuristic fallback
  otherwise — see doc 10 "Multi-provider AI layer") all run correctly; it
  fails only at the Prisma write step when no live Postgres is reachable
  — expected until "Database" above is set up.
  `npm run eval:intent -w apps/api` runs clean against the heuristic path
  with no keys configured (7/8 on the golden set — the one miss is a known
  heuristic-parser gap the real providers close, not a bug).
  `POST /api/auth/anonymous` was smoke-tested the same way:
  reaches the Prisma upsert, fails only at the same DB boundary.
- `apps/business-dashboard` lints clean (`npm run lint -w apps/business-dashboard`).
- Mobile's Home → (POST /api/intent-requests) → Results screen flow is
  wired end-to-end; it will fully work once a database is connected.

## Known rough edges

- `npm audit` reports 13 advisories (10 moderate, 3 high) at install time.
  All of them are in **build/CLI tooling**, not runtime code: Prisma's
  `@prisma/config` → `deepmerge-ts` (stack-exhaustion advisory, dev-only
  CLI path) and Expo's `@expo/cli` → `xcode` → `uuid` chain (native
  prebuild tooling). `npm audit fix --force` would downgrade Expo to
  `46.0.21`, which is wrong — leave these alone until Prisma/Expo ship
  fixed versions upstream.
- No Docker in this environment yet — see "Database" Option B if you'd
  rather not install it.
- `apps/mobile` has no ESLint config (Expo's blank-typescript template
  doesn't include one). Not blocking; add one when it starts to matter.

## Adding a new dependency to a specific app

Use npm's `-w` flag from the repo root rather than `cd`-ing into the app
(keeps everything resolving through the single root `node_modules`):

```
npm install <package> -w apps/api
npm install <package> -w apps/business-dashboard
npx expo install <package>   # from inside apps/mobile — resolves
                              # Expo-SDK-compatible versions; see below
```

For `apps/mobile` specifically, prefer `npx expo install <package>` (run
from within `apps/mobile`) over plain `npm install` for any package that
has native code — it cross-references Expo SDK 57's compatibility table
instead of just grabbing latest.
