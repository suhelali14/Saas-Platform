# Intently x BusinessOS — Unified Platform Master Plan
# FOR: Claude Code (or any AI coding assistant)
# READ THIS ENTIRE FILE BEFORE WRITING ANY CODE.

---

## 1. What This Platform Is

Two products, now one unified platform:

- **Intently** (consumer): A React Native / Expo mobile app + Fastify API where consumers use
  natural language to express what they want ("I need a quiet gym with a pool near Indiranagar,
  budget under Rs.1500/month"). An AI agent parses the intent, embeds it, and vector-matches it
  against indexed business offers.

- **BusinessOS** (supply): A React/Vite web dashboard for business owners to manage their entire
  business — CRM, catalog, orders, inventory, conversations (universal inbox), payments, analytics,
  WhatsApp integration, AI website builder.

**The thesis:** these are two sides of one marketplace. Consumer demand meets business supply
through an AI intelligence layer that gets smarter with every transaction. The unification is DONE.

---

## 2. Current System Architecture (as of this session)

`
apps/
  api/              Fastify, TypeScript, Prisma, port 4000 — UNIFIED backend
    src/
      routes/
        auth.ts              Consumer auth (anonymous device + email/password)
        intent-requests.ts   Core intent submission + v2 vector matching
        businesses.ts        Consumer-facing business directory
        users.ts             Consumer profile
        stats.ts             Public platform stats
        intently-bridge.ts   /api/biz/intently/* — marketplace settings/demand/leads for businesses
        biz/
          biz-auth.ts           Business register/login (BusinessUser)
          biz-business.ts       Business profile, DNA, onboarding
          biz-catalog.ts        Products, services, categories
          biz-customers.ts      CRM — customer records, stats, timeline
          biz-inventory.ts      Inventory levels, adjustments, low-stock
          biz-orders.ts         Orders — create/list/stats/status
          biz-employees.ts      HR roster
          biz-conversations.ts  Universal inbox (WhatsApp + Intently consumer chat)
          biz-payments.ts       Payment records, UPI QR, tax invoices
          biz-dashboard.ts      Overview metrics
          biz-analytics.ts      Revenue/order/channel analytics (real SQL, no fake data)
          biz-growth.ts         Segment counts, broadcast campaigns
          biz-website.ts        AI website builder, GitHub export, public storefront
          biz-whatsapp.ts       Meta webhook (inbound/outbound WhatsApp)
          biz-ai.ts             AI orchestration helper
      services/
        vector/
          embedding.service.ts       Google gemini-embedding-001 wrapper (768-dim)
          intent-cache.service.ts    Semantic cache (cosine search, avoid LLM re-call)
          offer-embedding.service.ts Index business offers; ANN search for matching
          user-taste.service.ts      User taste vector (EMA personalization)
        ai/                    Intent Understanding Agent (Gemini + Claude providers)
        matching-service.ts    v2 vector ANN matching engine
        intent-service.ts      Parse raw intent text → structured ParsedIntent
        reply-service.ts       Generate conversational AI reply after matching
        user-profile-service.ts Update UserProfile on intent
        funnel-service.ts      Funnel event tracking
      lib/
        prisma.ts       Prisma client singleton
        jwt.ts          signToken/verifySessionToken + signBusinessToken/verifyBusinessToken
        analytics-utils.ts  percentageChange helper
        pagination.ts   getPaginationParams / createPaginatedResult
        slug.ts         uniqueSlug generator
        intently-flywheel.ts   Match → CRM Lead bridge (fire-and-forget)
        catalog-offer-sync.ts  Catalog write → Offer embedding bridge
        whatsapp.ts     Meta Graph API outbound calls
        website-ai.ts   Gemini-backed website content generation
        ai-orchestrator.ts  Classify + reply for WhatsApp conversations
      plugins/
        auth.ts                requireAuth (consumer) + requireBizAuth (business)
        biz-response-envelope.ts  Wraps /api/biz/* responses in {success, data, error}
      app.ts            Fastify app, all routes registered
    prisma/
      schema.prisma     UNIFIED schema (Intently + all ~26 BusinessOS models, one file)

  mobile/            React Native / Expo consumer app
    src/
      screens/
        HomeScreen.tsx         Intent box, category shortcuts, recent searches
        ResultsScreen.tsx      Match list (v2 semantic match scores + reasons)
        BusinessProfileScreen.tsx  Business detail, "Contact" (stub — no booking yet)
        ExploreScreen.tsx      Browse by category
        ActivityScreen.tsx     Intent request history
        ProfileScreen.tsx      Consumer account
        PreferencesScreen.tsx  AI taste affinity bars
        InviteFriendsScreen.tsx Referral/promo
      hooks/
        useSubmitIntent.ts   POST /api/intent-requests
        useIntentRequests.ts GET /api/intent-requests
        useBusinesses.ts     GET /api/businesses

  business-dashboard/  Small Next.js app — DEPRIORITIZED, do not touch.
                        BusinessOS's SAAS/frontend is the real dashboard.

SAAS/
  frontend/          React/Vite business dashboard, port 5173
    src/
      pages/         14 pages matching the 14 biz/* route modules
      hooks/
        useApi.ts    fetchWithAuth — reads VITE_API_URL, adds Bearer token,
                     expects {success, data, error} envelope from /api/biz/*
    .env             VITE_API_URL=http://localhost:4000/api/biz

  backend/           OLD Express backend — DEPRECATED. Do not add to it.
                     All 14 modules have been ported to apps/api/src/routes/biz/.
`

---

## 3. Database

**One Neon/Postgres database** used by pps/api. Connection string in pps/api/.env as DATABASE_URL.

Key unified models (abbreviated — see full pps/api/prisma/schema.prisma for complete fields):
- User — consumer accounts (anonymous device + email/password)
- Business — the merged entity (Intently marketplace fields + all BusinessOS operational fields)
- BusinessUser — business owner/staff login (renamed from BusinessOS's User to avoid collision)
- IntentRequest — a consumer's expressed intent
- Match — an intent matched to a specific Offer
- Offer — a specific service/product offered by a business (linked to catalog Product/Service)
- EmbeddingRecord — vector embeddings (768-dim, pgvector); kinds: INTENT_CACHE, USER_TASTE, BUSINESS_OFFER, BIZ_CUSTOMER, UNFULFILLED_DEMAND
- Customer — CRM customer record per business (with leadSource: "INTENTLY" when sourced from a consumer match)
- Order, OrderItem — business orders (consumer bookings will create these via the flywheel)
- Appointment — booking/appointment for time-based services
- Transaction — consumer payment record
- Conversation, Message — universal inbox (WhatsApp + consumer chat)
- Product, Service, Category — business catalog
- InventoryItem, InventoryMovement — stock management
- Employee — HR roster
- Payment, Invoice — business payment records
- WebsiteConfig, ComponentTemplate — AI website builder
- Campaign, CampaignRecipient — broadcast campaigns (WhatsApp)
- GenreProduct, GenreProductRequest — industry-starter templates (future phase)

**pgvector** extension is enabled. EmbeddingRecord.vector is a raw ector(768) column (not in Prisma client — managed via raw SQL). An ivfflat index exists on it.

---

## 4. Auth System

Two separate token shapes, same JWT_SECRET, verified in plugins/auth.ts:

| | Consumer | Business |
|---|---|---|
| Payload | { sub: userId } | { sub: businessUserId, businessId, role } |
| Guard | equireAuth(request, reply) | equireBizAuth(request, reply) |
| Issue | POST /api/auth/anonymous or /api/auth/register | POST /api/biz/auth/login |
| Mobile app | No change | N/A |

A business token intentionally fails equireAuth (it has a usinessId field — the consumer guard
rejects any payload with that key). A consumer token intentionally fails equireBizAuth.

---

## 5. Response Envelopes

**Consumer routes** (/api/* except /api/biz/*): return raw JSON — no wrapper. The mobile app
reads these directly.

**Business routes** (/api/biz/*): wrapped by iz-response-envelope.ts (a global Fastify onSend
hook) into { success: true, data: <payload> } or { success: false, error: { message: "..." } }.
This is what SAAS/frontend/src/hooks/useApi.ts expects. Do NOT manually add this envelope inside
route handlers — the hook does it automatically.

Exception: HTML responses (website preview ?format=html) and plain-text responses (WhatsApp webhook
challenge) bypass the envelope and return as-is.

---

## 6. Key Flywheel Bridges (Already Wired)

1. **Consumer intent → CRM Lead**: When a consumer's intent matches a business, lib/intently-flywheel.ts
   (ecordIntentlyLead) fires fire-and-forget from intent-requests.ts. Creates/upserts a Customer
   row with leadSource: "INTENTLY" and the raw intent text as notes.

2. **Catalog product/service → Offer embedding**: When a Product or Service is created/updated/deleted
   via iz-catalog.ts, lib/catalog-offer-sync.ts fires fire-and-forget to index/update/remove the
   matching Offer embedding. Gated on usiness.intentlyEnabled.

3. **Intent embedding write-path**: Every parsed intent is written to the semantic cache (fire-and-forget)
   from intent-requests.ts. erified=true when the intent led to real matches.

---

## 7. What Is NOT Built Yet (The Next Phases)

### Phase A — Consumer Transaction Rail (DONE)

The platform can match consumers to businesses but consumers cannot book or pay. This is the
single most important missing feature.

**What was built:**

#### A1. Booking flow in mobile app
- New screen: BookingScreen.tsx — after viewing a match, user taps "Book"
- Inputs: date picker, time picker (based on business working hours), notes textarea
- On submit: POST /api/bookings with { offerId, businessId, scheduledAt, notes }

#### A2. POST /api/bookings route in pps/api
- Creates an Appointment record linked to the business and the consumer's User
- Creates a Transaction record with status: PENDING
- If the business has utoAcceptUnder set and offer price is under the threshold:
  auto-accept (update Appointment.status = CONFIRMED) and fire the payment flow
- Otherwise: set Appointment.status = PENDING, notify the business

#### A3. Payment integration (Razorpay recommended)
- POST /api/bookings/:id/pay — create Razorpay order, return orderId + keyId to the app
- Mobile app: use eact-native-razorpay to present the native payment sheet
- POST /api/payments/razorpay-webhook — verify signature, mark Transaction.status = COMPLETED,
  update Appointment.status = CONFIRMED, fire Transaction → BusinessOS Order creation

#### A4. Transaction → Order bridge
- On Transaction.status = COMPLETED: call iz-orders.ts's internal create-order logic
  to create a real Order in the business's dashboard with source: "INTENTLY"

#### A5. Business notification on new booking
- Store BusinessUser.expoPushToken (new field in schema, collected at business login)
- On new booking: send an Expo push notification via expo-server-sdk npm package
- New lib/push-notifications.ts helper

#### A6. Bookings tab in BusinessOS dashboard
- New page SAAS/frontend/src/pages/Bookings.tsx
- Reads from GET /api/biz/bookings — list of Appointments + linked orders
- Actions: Accept, Decline, Mark Complete

---

### Phase B — Trust, Reviews & Business Verification (after Phase A)

1. **Post-transaction review prompt** — Schedule a push notification 24h after Transaction.status = COMPLETED. Consumer submits a 1-5 star Review linked to Transaction.id (not freestanding — no fake reviews).
2. **Business KYC-lite** — GST number field on business profile + document upload (S3/Cloudflare R2). Admin approval flow (simple: a flag in Business.kycStatus). Verified badge in app + ranking boost.
3. **Review display** — Review[] on BusinessProfileScreen, aggregate atingAverage updated on Business on each new review.

---

### Phase C — Multi-Turn Intent & Category Expansion (after Phase B)

1. **Multi-turn clarification gate** — In intent-service.ts, if parsed confidence < threshold on budget/location/timing, generate a single clarifying question back to the user instead of matching immediately. The IntentMessage model and conversation loop in intent-requests.ts already support multi-turn — only the confidence gate logic needs adding.
2. **Expand SUPPORTED_CATEGORIES** in pps/api/src/services/ai/schema.ts — add: spa, clinic, electrician, plumber, 	utor, event_venue.
3. **Standing offers** — new boolean Offer.isStanding. Standing offers surface in ExploreScreen without requiring an active intent search.

---

### Phase D — Unfulfilled Demand Intelligence (after Phase C)

1. **Demand clustering weekly job** — cron in pps/api: fetch all IntentRequest with status: OPEN from past 7 days, embed them if not already embedded, k-means cluster (k=10), label each cluster with top-3 terms. Write to new DemandCluster model.
2. **BusinessOS Intelligence tab** — SAAS/frontend/src/pages/Intelligence.tsx reading GET /api/biz/intelligence/demand-clusters. Shows: "47 people searched for 'organic tiffin delivery under Rs.200' — 0 businesses matched."
3. **Proactive backfill match on business registration** — After POST /api/biz/auth/register, fire a background job that matches the new business's initial offers against the past 7 days of unfulfilled intents and sends a "You could have served X customers" summary to the business.

---

## 8. Explicitly Not In Scope (Do Not Build Unprompted)

- **Qdrant migration** — pgvector handles current load fine. Revisit when embedding queries exceed 100ms P99 under real traffic.
- **Redis hot cache** — Not yet needed.
- **Creator layer / bidding / promoted placement** — Phase 4 product features.
- **Multi-city expansion** — After first city shows real transaction liquidity.
- **Agent-to-agent commerce (Phase 5)** — Far future. Requires trust/liquidity the platform doesn't have yet.
- **Genre master template system** — Will be designed as its own phase after everything above is done.
- **pps/business-dashboard** (the Next.js app) — Deprioritized. Don't touch it.
- **SAAS/backend** (old Express app) — Deprecated. Don't add to it. It still runs on port 3001 if you start it, but it's disconnected from the unified DB and should be ignored.

---

## 9. Conventions to Follow

- **No fake data fallbacks** — If an API call fails, show a real error state. Never substitute hardcoded mock data and present it as real. This was a systemic bug in the original BusinessOS code that was fully cleaned up during unification. Don't reintroduce it.
- **Fire-and-forget for non-blocking work** — Vector writes, CRM lead creation, offer indexing: call .catch(err => console.warn(...)) and do not wait them in the request handler.
- **Fire-and-forget for non-blocking work** — Vector writes, CRM lead creation, offer indexing: call .catch(err => console.warn(...)) and do not  wait them in the request handler.
- **Zod schemas for all route inputs** — Use z.object({...}).safeParse(request.body). If .success is false, return eply.status(400).send({ error: parsed.error.flatten() }).
- **equireBizAuth for all /api/biz/* routes** — Never use equireAuth (consumer guard) on business routes.
- **@@map on all new Prisma models** — Use snake_case table names, matching the schema's house style.
- **No raw process.env reads** — All env vars go through  pps/api/src/lib/env.ts (zod-validated).
- **Port numbers** —  pps/api runs on 4000. SAAS/frontend runs on 5173. Do not change these.
- **Do not run prisma migrate dev in this shell** — It needs a TTY. Use prisma migrate diff --from-url ... --to-schema-datamodel ... --script then hand-apply the SQL via prisma db execute. Or create the migration file manually in prisma/migrations/ and run prisma migrate resolve.
- **Embedding model**: gemini-embedding-001 with outputDimensionality: 768. NOT 	ext-embedding-004 (that name 404s). This was a real bug found and fixed during Phase 0.
- **SQL column names in raw queries**: the schema uses quoted camelCase Prisma column names in the actual Postgres tables (e.g., "refId", "businessId", "hitCount") NOT snake_case. Always quote column names in raw SQL. This was another real bug found and fixed during Phase 0.

---

## 10. How to Run

` ash
# Install deps (from workspace root)
npm install

# Start the unified API (port 4000)
npm run dev -w apps/api

# Start the BusinessOS dashboard (port 5173)
npm run dev -w SAAS/frontend

# Start the mobile app (Expo)
npm run start -w apps/mobile

# Typecheck everything
npx turbo run typecheck

# Typecheck just the API
npx turbo run typecheck --filter=@intently/api
`

Both the API and SAAS frontend need their own .env files with the appropriate env vars
(DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, etc.).
