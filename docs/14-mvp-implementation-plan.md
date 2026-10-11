# MVP Implementation Plan

This is the granular, file-level breakdown of [07-roadmap-phases.md](07-roadmap-phases.md)
Phase 1 (finishing it) and the start of Phase 2 — concrete enough to work
through milestone by milestone. It picks up exactly where the current repo
state is (see [12-dev-setup.md](12-dev-setup.md) "What's already
verified"): four workspaces scaffolded and type-checking clean, the API
boots and its routes work, but no database is connected, intent parsing
is a heuristic placeholder, there's no auth, and no seed data exists.

Each milestone: **Goal**, **Tasks**, **Depends on**, **Done when**, and
**Blocked on** where something needs a decision or credential only the
user can provide.

## Suggested order

```
M0 (DB online)
  |
  +--> M1 (seed data + matching v0) ---+
  |                                     |
  +--> M2 (real intent agent) ----------+--> M6 (business UI)
  |         |                           |
  |         v                           |
  |    M3 (embedding write-path)        |
  |                                     |
  +--> M4 (user profile v0) ------------+
  |                                     |
  +--> M5 (minimal auth) ---------------+--> M7 (funnel analytics)
                                              |
                                              v
                                        M8 (Phase 1 exit check)
```

M1-M6 can mostly run in parallel once M0 is done; M2 and M5 are the two
with external blockers (API key, SMS provider) so it's worth starting
those decisions early even if the code lands later in the sequence.

## Status

**M1, M2, M4, and M5 are code-complete** and type-check clean across all
four workspaces. Verified up to the same boundary as the rest of the
API: boots, routes execute, fail only at the Prisma DB write with no
Postgres running — see the smoke-test transcript below. Full live
verification (seeding, real matches, a real Claude-parsed intent showing
up in the app) needs M0. **M0, M3, M6, M7 are still open.**

- **M1** (matching-service.ts, seed.ts, the matches array in the API
  response, mobile Results screen rendering real matches).
- **M2** (`apps/api/src/services/ai/` — Claude and Gemini both implement
  a shared `AiProvider` contract against one JSON Schema, not a single
  hardcoded provider; `provider-selector.ts` picks whichever has a key
  configured. Claude calls `client.messages.create` with a forced tool
  call — not `output_config.format`/`zodOutputFormat`, which needs Zod
  v4's internal types and this project is on Zod v3. Gemini calls
  `client.models.generateContent` with `responseSchema` +
  `responseMimeType: "application/json"`. Both paths validate through
  `ParsedIntentSchema.parse()` at runtime either way, so doc 04's
  "structured output validation" guardrail holds regardless of which
  provider ran. Defaults to `claude-opus-5` when Anthropic is selected,
  not the Haiku tier doc 10/13 suggest for routine parsing — deliberately
  not downgraded silently; switch via `ANTHROPIC_MODEL`. Falls back to
  the heuristic parser if no provider is configured or the call fails.
  See [10-tech-stack-decisions.md](10-tech-stack-decisions.md)
  "Multi-provider AI layer" for the full architecture. Golden eval:
  `npm run eval:intent -w apps/api` (7/8 against the heuristic baseline
  with no keys set).
- **M4** (user-profile-service.ts, pure arithmetic on write).
- **M5** (anonymous-device auth: `POST /api/auth/anonymous` issues a JWT
  from a client-generated device id stored in `expo-secure-store`;
  `Authorization: Bearer` required on `/api/intent-requests`, userId now
  comes from the verified token, never the request body).

Smoke test (no live DB, no `ANTHROPIC_API_KEY` — same constraints as
before):
```
GET  /health                        -> 200
POST /api/intent-requests (no auth) -> 401 "Authentication required"
POST /api/auth/anonymous            -> reaches prisma.user.upsert, fails only at the DB connection
POST /api/intent-requests (w/ auth) -> passes auth + heuristic parse, fails only at the DB connection
```

**Mobile app architecture/design pass (beyond the original M1-M8 scope,
requested directly):** design system (`src/theme`, `src/components`),
React Query data layer (`src/hooks`, cache-priming on submit), and three
new screens/endpoints:
- Business Profile (read-only) — new `GET /api/businesses/:id`.
- Activity (request history) — new `GET /api/intent-requests` (list) and
  `GET /api/intent-requests/:id` extended to include persisted matches
  (was intent-only before).
- Profile ("your preferences") — new `GET /api/users/me/profile`,
  surfacing the M4 `UserProfile` data as an actual user-facing feature.

Navigation restructured to bottom tabs (Home / Activity / Profile), each
owning its own stack; Results and BusinessProfile are shared screens
pushed from either tab, not duplicated. See
[05-native-app-spec.md](05-native-app-spec.md) "Current implementation"
for the full breakdown.

**Three real issues found and fixed while building this:**
1. `IntentRequest` and `UserProfile` both have a foreign key to `User`,
   but no `User` row for the mobile app's hardcoded dev placeholder id
   ever existed — the very first request would have failed on a FK
   violation the moment a database was connected. `prisma/seed.ts` now
   creates that user (still useful for direct API testing via curl,
   independent of the real auth flow M5 adds).
2. `userId` was previously taken straight from the request body — trivially
   spoofable, and at any real usage volume every installed app would have
   silently collided into whichever `userId` string was hardcoded
   client-side, corrupting `UserProfile` data across users. M5 fixes this
   at the root: `userId` now only ever comes from a verified JWT.
3. `GET /api/businesses` and `POST /api/businesses` were returning raw
   Prisma rows — same flat-vs-nested mismatch as the `IntentRequest` bug
   from the previous session (`latitude`/`longitude` instead of
   `location`, `verifiedTxnCount` instead of `verifiedTransactionCount`,
   `Date` objects instead of ISO strings). Would have silently broken the
   new Business Profile screen the moment a database was connected.
   Fixed with `toBusinessDTO`/`toBusinessDetailDTO` mappers, same pattern
   as `toIntentRequestDTO`.

**Conversational refinement (beyond the original M1-M8 scope, requested
directly):** the Activity/Results flow became a real chat thread instead
of a one-shot submit — see doc 04's "Conversational refinement" for the
agent-level design and doc 05's "Current implementation" for the mobile
UI. Backend: `IntentMessage` model + migration (live on Neon), `AiProvider`
and `parseIntent` both changed from a single-string input to
`{turns, previousIntent}` so a refinement turn re-parses with full context
and merges into (rather than replaces) the previously understood fields,
a new deterministic `reply-service.ts` (no extra model call for the
confirmation message), and a new `POST /api/intent-requests/:id/messages`
endpoint that re-parses, replaces the request's `Match` rows, and returns
the updated thread. Mobile: `ResultsScreen` rebuilt around a chat UI
(`ChatBubble`, `useSendIntentMessage`). Live-verified end-to-end against
the real Neon database, including a real Gemini call for the refinement
turn (`"under 1500 instead"` correctly kept `category: gym` from the
prior turn and updated only the budget) and a transient Gemini 503 on the
first turn correctly falling back to the heuristic parser rather than
failing the request.

## M0 — Database online

**Goal:** unblock everything else. Nothing below is end-to-end verifiable
without this.

**Tasks:**
- Pick Docker vs. hosted Postgres ([12-dev-setup.md](12-dev-setup.md)
  "Database" Option A/B).
- `docker compose up -d` or set a hosted `DATABASE_URL` in `apps/api/.env`.
- `npm run db:migrate -w apps/api` — creates and applies the first
  migration.
- Re-run the smoke test from last session: `POST /api/intent-requests`
  should return `201` with a persisted row instead of the Prisma
  connection error.

**Depends on:** nothing — this is first.
**Blocked on:** your call on Docker vs. hosted Postgres (raised last
session, still open).
**Done when:** `POST /api/intent-requests` returns `201`.

## M1 — Seed data + Matching Engine v0 (code-complete, pending M0)

**Goal:** [07-roadmap-phases.md](07-roadmap-phases.md) Phase 1 explicitly
calls for "manually curated data... 15-30 businesses per category" — not
done yet. Without it the Results screen has nothing real to show.

**Tasks:**
- `apps/api/prisma/seed.ts` — insert ~15-30 businesses + offers across
  the confirmed initial categories
  ([11-glossary-open-questions.md](11-glossary-open-questions.md)
  default: restaurants/gyms/salons in Bengaluru — confirm before seeding
  real-sounding data for the wrong city).
- Add a `"prisma": { "seed": "tsx prisma/seed.ts" }` block to
  `apps/api/package.json` plus a `db:seed` script.
- `apps/api/src/services/matching-service.ts` — a v0 matcher: filter by
  category (required), budget fit (offer price ≤ budget max), distance if
  lat/lng present, sorted by a simple score. This is plain Prisma
  filtering, **not** the vector-search Matching Agent — doc 07 correctly
  scopes that to Phase 2, don't pull it forward.
- Extend the `POST /api/intent-requests` response (or add
  `GET /api/intent-requests/:id/matches`) to return ranked `Offer[]`.
- `apps/mobile/src/screens/ResultsScreen.tsx` — render the actual matched
  offers (business name, price, distance) below the existing
  structured-intent card, replacing the current "matching engine coming
  in Phase 2" note now that a v0 exists.

**Depends on:** M0.
**Done when:** submitting a real intent in the mobile app shows real,
ranked seeded businesses, not just the echoed structured intent.

## M2 — Real Intent Understanding Agent (code-complete, pending M0 + an AI provider key)

**Goal:** replace `parseIntentHeuristically` with the actual LLM-backed
agent from [04-multi-agent-design.md](04-multi-agent-design.md).

**Tasks:**
- `apps/api/src/services/ai/` — `AiProvider` contract + Claude and Gemini
  implementations behind `provider-selector.ts`, structured output
  validated against a zod schema mirroring `shared-types`'
  `IntentRequest` fields (per doc 04's "structured output validation"
  guardrail — invalid output falls back to the heuristic parser, never
  shows a broken result). See
  [10-tech-stack-decisions.md](10-tech-stack-decisions.md)
  "Multi-provider AI layer".
- Confidence-gated clarification: when category or budget confidence is
  low, return `{ needsClarification: { field, question } }` instead of a
  finished parse.
- Mobile: a lightweight clarification step (doc 05's "Intent
  Clarification" screen — quick-reply chips, not a full chat UI) shown
  when the API asks for one.
- `apps/api/src/services/__fixtures__/intent-eval-set.json` — 10-20
  `raw_text → expected structured intent` pairs, plus a script/test
  asserting the agent's output matches within tolerance. This is the CI
  guardrail doc 04 calls for — build it alongside the agent, not after.

**Depends on:** M0 (needs the DB to persist results). Independent of M1.
**Blocked on:** `ANTHROPIC_API_KEY` and/or `GEMINI_API_KEY` in
`apps/api/.env` — at least one needs to be provided before this is
live-testable (the code can be written and reviewed without it, per the
same pattern used for the DB last session).
**Done when:** the eval fixture passes and real free-text requests get
correctly parsed instead of only keyword-matched.

## M3 — AI cost plumbing: embedding write-path only

**Goal:** start collecting what the semantic cache needs
([13-ai-cost-optimization-personalization.md](13-ai-cost-optimization-personalization.md)
Part 1) — cheap now, valuable later. **Not** the cache read-path yet —
that needs volume to tune against (Phase 2-3, see doc 13's sequencing
table).

**Tasks:**
- Enable Prisma's `postgresqlExtensions` preview feature and the
  `vector` extension; add an `embedding Unsupported("vector(N)")?` column
  to `IntentRequest` — `N` depends on the chosen embedding model's output
  dimension, confirm against current provider docs before writing the
  migration, don't assume a number.
- `apps/api/src/lib/embeddings.ts` — a thin client wrapping whichever
  embeddings API is chosen (doc 13 suggests checking Voyage AI first,
  since Anthropic recommends it as an embeddings partner; a cheap
  alternative works too — this is a small, swappable piece).
- After a successful M2 parse, compute and store the embedding alongside
  the structured result. No lookup logic yet — write path only.

**Depends on:** M2 (embedding heuristic-stub output isn't worth storing).
**Done when:** new `IntentRequest` rows have a populated `embedding`
column.

## M4 — User profile plumbing v0 (code-complete, pending M0)

**Goal:** start the "matrix," cheaply, per
[13-ai-cost-optimization-personalization.md](13-ai-cost-optimization-personalization.md)
Part 2A — structured fields only, pure arithmetic, no ML, no dependency
on volume.

**Tasks:**
- New Prisma model `UserProfile` (1:1 with `User`): `categoryAffinity
  Json`, `avgBudgetByCategory Json`, `preferredTiming Json`, `updatedAt`.
- An incremental-update function called on every `IntentRequest`
  creation — not a batch job, just arithmetic on write.

**Depends on:** M0. Independent of M1-M3.
**Done when:** submitting a few varied intents for the same user visibly
changes their `UserProfile` row.

## M5 — Minimal auth (code-complete, pending M0)

**Goal:** replace the hardcoded `DEV_USER_ID` placeholder in
`apps/mobile/src/screens/HomeScreen.tsx` — needed before more than one
person can meaningfully test this.

**Tasks:**
- Recommend starting with an anonymous-device-user flow (fast, unblocks
  M1-M4 multi-user testing immediately) and upgrading to real phone/OTP
  auth (via Twilio/Gupshup per doc 10) before Phase 1 exit / before any
  external user touches the app.
- `apps/api/src/routes/auth.ts` + session/JWT issuance.
- Mobile onboarding screen per
  [05-native-app-spec.md](05-native-app-spec.md), replacing
  `DEV_USER_ID` with the real session user id.

**Depends on:** M0. Can run in parallel with M2-M4.
**Done when:** two different simulators/phones produce two different,
correctly separated `UserProfile` rows.

## M6 — Business-side minimal usability (code-complete)

**Goal:** `POST /api/businesses` exists but only curl can use it — Phase
2's manual business recruitment
([08-business-model-gtm.md](08-business-model-gtm.md)) needs a real, if
bare-bones, form before that outreach starts.

**Built:**
- `apps/business-dashboard/src/app/businesses/new/page.tsx` — a form
  (name, categories, city, address, one offer) using a React Server
  Action (`actions.ts`, Next 16's `useActionState` pattern), not a client
  fetch — progressive-enhancement-friendly per the framework's own
  guidance.
- `apps/business-dashboard/src/app/businesses/page.tsx` — list view over
  the extended `GET /api/businesses`, now returning `matchCount` per
  business (a real count of `Match` rows joined through its offers, not a
  placeholder) alongside verification status.
- `apps/business-dashboard/src/app/businesses/[id]/page.tsx` — detail
  view (all offers) + an "add another offer" form
  (`POST /api/businesses/:id/offers`, new endpoint) for businesses that
  already exist.
- `POST /api/businesses` extended to optionally create the first `Offer`
  in the same request (atomic, matches the one-form UX) while staying
  backward compatible (offer is optional — curl/seed scripts creating a
  bare business still work).
- Dashboard home page (`app/page.tsx`) gained a real "Platform activity"
  section (`GET /api/stats`, new: total businesses/requests/matches) —
  the original four stat cards (Requests received, Qualified
  opportunities, Conversions, Revenue generated) are left as the
  placeholders they already were, honestly, since those need the
  Transaction Service (still not built) and a business-login concept
  (also not built) to mean anything per-business.

**Depends on:** M0. Not required for M1-M5, but required before
onboarding real (non-seeded) businesses.
**Done when:** a business added through the dashboard UI appears in
mobile app matches (M1) immediately. Verified live: a business + two
offers created through the dashboard forms rendered correctly and were
visible via the API.

**Not built (deliberately, out of M6's scope):** business auth/login
(there's no way to say "which business is this dashboard session for" --
every business is visible/editable by anyone with the dashboard URL,
fine for an internal ops tool recruiting the first businesses by hand,
not fine once real business owners self-serve) and offer editing/deletion.

## M7 — Funnel analytics instrumentation (code-complete)

**Goal:** [05-native-app-spec.md](05-native-app-spec.md) names the funnel
(submitted → shown → opened → compared → booked) as something to
instrument "from day one, not deferred" — untouched so far.

**Built:**
- `FunnelEvent` model (`userId`, `eventType`, `intentRequestId`,
  `metadata`, `createdAt`) + migration, live on Neon. `FunnelEventType`
  enum has all five named stages for a stable, forward-compatible type,
  but only three are ever actually written today — `COMPARED` and
  `BOOKED` have no backing feature yet (no Compare screen, no transaction
  flow), and an unfired enum value isn't fake data the way a hardcoded
  count would be.
- `INTENT_SUBMITTED` and `RESULTS_SHOWN` are recorded server-side, inside
  `apps/api/src/routes/intent-requests.ts`, on every submit *and* every
  refinement turn — the server already knows exactly when these happen,
  so there's no client-side call to forget or drop.
- `RESULT_OPENED` is the one event that genuinely needs a client call
  (`recordFunnelEvent` in `apps/mobile/src/lib/api.ts`, fire-and-forget so
  a dropped analytics call never blocks navigation) — wired into
  `ResultsScreen`'s match-card tap, the only point in the app today where
  opening a business profile is tied to a specific `IntentRequest`.
- No third-party analytics tool, per the original plan.

**Depends on:** M0, M5 (needs a real `userId`).
**Done when:** one full session (submit → view results → open a match)
produces rows for each real event. Verified live end-to-end: one session
produced exactly `INTENT_SUBMITTED`, `RESULTS_SHOWN` (with a real
`matchCount` in its metadata), and `RESULT_OPENED`.

**Not built:** an aggregate viewer/dashboard for this data. The business
dashboard has no admin/founder-only auth concept yet, and funnel data is
platform-wide, not scoped to one business — exposing an aggregate query
endpoint publicly would leak usage metrics to anyone with a token, so it
stays write-only (queryable directly via Prisma/psql for now) until an
admin role exists.

## M8 — Phase 1 exit check

Not a build milestone — a checkpoint. Once M0-M7 are done, re-read
[07-roadmap-phases.md](07-roadmap-phases.md) Phase 1's exit criteria
against real usage: a concrete weekly-active-requests target (needs
[11-glossary-open-questions.md](11-glossary-open-questions.md)'s
city/vertical confirmation to set a real number), a healthy
intent→contacted-business rate, and enough observed usage patterns to
know what Phase 2's real vector-search Matching Engine needs to handle.
That's the signal to move into Phase 2 proper rather than a calendar date.
