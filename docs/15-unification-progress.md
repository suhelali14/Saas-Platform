# Unify Intently + BusinessOS

## Progress (updated as phases complete -- read this first on resume)

- **Phase 0: DONE, live-verified.** Build fixed, migration fixed+applied,
  city bug fixed. Two extra bugs found+fixed beyond original scope: wrong
  embedding model name (`text-embedding-004` 404s -> `gemini-embedding-001`,
  with `outputDimensionality: 768`), and every raw SQL query in
  `services/vector/*.ts` referenced snake_case columns (`ref_id`,
  `business_id`, `hit_count`) that don't exist -- fixed to the real
  camelCase columns, quoted. Also fixed a fake taste-boost vector (was
  `Array(768).fill(similarity)`, now the real offer embedding via a new
  `embedding` field returned from `searchOffers`). Live-verified: real
  intent submission now returns "semantic match NN%" reasons (v2), not
  v0's "matches gym" fallback.
- **Phase 1: DONE, live-verified.** `User`/`User` collision resolved
  (BusinessOS's login entity renamed `BusinessUser`). All ~26 BusinessOS
  models folded into `apps/api/prisma/schema.prisma` with explicit
  snake_case `@@map` added for consistency with this schema's house style
  (SAAS's own schema used Prisma's default PascalCase table names).
  `Business` merged: kept `plan` (PlanType enum) over `subscriptionTier`
  (dropped, shared-types `Business.subscriptionTier` renamed to `plan`,
  `mappers.ts` updated), dropped `businessOsId` (and the now-dead
  `intently-bridge.ts` select field), added `Business.users
  BusinessUser[]`. Migration generated via `prisma migrate diff --from-url`
  (non-interactive workaround -- `migrate dev` needs a TTY this shell
  doesn't have) then hand-corrected before applying: the raw diff wanted to
  `DROP COLUMN "vector"` and its index on `embedding_records` (Prisma has
  no idea that column exists, since it's deliberately unsupported/raw-SQL
  managed) -- stripped those two statements, and hand-appended the same
  raw-SQL pattern for the new `ComponentTemplate.embedding` vector column.
  Live-verified after applying: all 19 existing embeddings survived intact,
  full workspace typecheck clean, a real intent submission still returns
  real v2 matches (no regression), and all new BusinessOS tables
  (`businessUser`, `customer`, `product`, `order`, `genreProduct`,
  `conversation`, ...) are queryable.
- **Phase 2: DONE, live-verified.** Consumer tokens unchanged (`{sub}`
  only, zero mobile-app impact). Business tokens added:
  `{sub: businessUserId, businessId, role}`, same `JWT_SECRET`, 7-day expiry
  (`lib/jwt.ts`: `signBusinessToken`/`verifyBusinessToken` --
  `verifySessionToken` now explicitly rejects any payload with a
  `businessId` key, so a business token can never be misread as a consumer
  session even though both share one secret). `requireBizAuth` added next
  to `requireAuth` in `plugins/auth.ts`; the `onRequest` hook tries the
  business-shaped payload first, falls back to consumer. New
  `routes/biz/biz-auth.ts` (register/login/me), ported from
  `SAAS/backend/src/modules/auth` -- reuses this project's existing
  `hashPassword`/`verifyPassword` (bcryptjs) rather than introducing a
  second hashing convention. New `lib/slug.ts` (`uniqueSlug`, using
  `crypto.randomUUID()` instead of adding the `uuid` package SAAS used).
  One deliberate deviation from SAAS's original register payload: added a
  required `city` field, since this merged schema kept Intently's
  `Business.city` as required (mobile/mappers/matcher all assume it's
  present) -- the alternative was writing `city: ""` as a placeholder,
  which is exactly the fake-data pattern this project has consistently
  rejected. No refresh-token flow (SAAS had one via a second
  `JWT_REFRESH_SECRET`) -- out of this phase's scope, Intently's own
  consumer auth doesn't have one either. Live-verified: registered a real
  business+owner, logged in, hit `/me`, and confirmed strict separation in
  both directions -- a business token gets 401 on a consumer-only route and
  a consumer token gets 401 on `/api/biz/auth/me`.
- **Phase 3 (migrate the 14 Express modules): in progress.**
  - `biz-business` (profile GET/PUT, dna PUT, onboarding/complete POST):
    **DONE, live-verified** (all 4 endpoints tested against the real DB).
    Note: `business.service.ts`'s `getBusinessTypeConfig()` (module/feature
    list per BusinessType) was deliberately NOT ported -- grepped the whole
    SAAS backend, it's dead code there too (defined, never imported
    anywhere). Don't port it speculatively; if a later module (dashboard?
    website?) turns out to need it, port it then with real context.
  - `biz-catalog` (products/categories/services, incl. auto-created
    InventoryItem on product create): **DONE, live-verified** (created a
    category, a product with initial stock, confirmed the InventoryItem
    auto-created with the right quantity, listed, updated, created a
    service, soft-deleted a product). New shared `lib/pagination.ts`
    (ported `getPaginationParams`/`createPaginatedResult`) -- reused by
    every subsequent list endpoint. New shared `lib/slug.ts` addition:
    none needed, already existed from Phase 2.
  - `biz-customers` (CRM CRUD + stats + timeline): **DONE, live-verified**
    (created/listed/fetched/updated a customer, checked stats and empty
    timeline). Also ported `refreshCustomerMetrics()` (exported, not wired
    to a route -- SAAS calls it internally after every order change; will
    wire it in when `biz-orders` is built).
  - `biz-inventory` (list/low-stock/get/adjust): **DONE, live-verified**
    including the low-stock endpoint's raw SQL, which needed real fixing
    (not just quoting) -- SAAS's original referenced its own unmapped
    table names `"InventoryItem"`/`"Product"`; this schema's `@@map` makes
    the real tables `inventory_items`/`products`, so the query text itself
    had to change, not just get column-quoted like the vector-service
    fixes in Phase 0. Verified insufficient-stock rejection (400) too.
  - `biz-orders` (list/stats/get/create/status-update): **DONE,
    live-verified.** Create is transactional: order + items, inventory
    decrement, `InventoryMovement` (type `ORDER_FULFILLED`) per item,
    `Product.totalSold` increment, then `refreshCustomerMetrics` (imported
    from `biz-customers.ts`) fired for both create and status-change --
    deliberately wired into status-change too even though SAAS's original
    only refreshed on create, since a status change (e.g. CANCELLED)
    changes which orders count toward the metrics aggregate and leaving it
    stale there would be a real, not hypothetical, bug. Two real bugs
    found+fixed during live testing (not just typechecked):
    (1) the transaction called `nextOrderNumber()` *inside* the
    `prisma.$transaction` callback using the outer `prisma` client instead
    of `tx`, adding an extra Neon round-trip that blew the default 5s
    interactive-transaction timeout (`P2028`) -- fixed by computing
    `orderNumber` once before opening the transaction, and bumped the
    transaction timeout to 15s as headroom for the per-item inventory loop
    inside it; (2) **order creation had no stock-sufficiency check at
    all** -- confirmed live by ordering qty 9999 against 17 in stock, which
    silently succeeded and drove `InventoryItem.quantity` to -9982. Fixed
    by validating every line item's requested quantity against
    `product.inventory.quantity` (for `trackInventory` products) before the
    transaction opens, returning 400 `Insufficient stock for <name>` --
    matching the same check `biz-inventory.ts`'s adjust endpoint already
    had, which order creation should have had from the start. Re-verified
    end-to-end after both fixes: create (inventory decremented, movement
    recorded, totalSold bumped, customer metrics refreshed to
    lifetimeValue/totalOrders/segment), status update to DELIVERED (sets
    `deliveredAt`, re-refreshes customer metrics), stats (byStatus +
    today/month revenue), list (paginated, includes items+customer), and
    the oversell rejection (400, inventory left untouched).
  - `biz-employees` (list/get/create/update/soft-delete): **DONE,
    live-verified.** Straightforward port, no surprises -- `workingHours`
    is the one `Json?` field, cast `as Prisma.InputJsonValue | undefined`
    matching the established pattern. Verified create, list, get-by-id
    (with upcoming-appointments include), update, and soft-delete (row
    disappears from the `isActive: true`-filtered list) all against the
    real DB.
  - `biz-conversations` (Universal Inbox: list/get/send-message/status/
    assign/mark-read/stats): **DONE, live-verified.** Also ported
    `getOrCreateConversation()` (exported, not wired to any route -- same
    as SAAS's original, it's called by inbound-channel webhooks, none of
    which exist yet; `biz-whatsapp` will call it when built). Verified the
    full lifecycle against the real DB: created a conversation via the
    exported helper (ran once through a throwaway tsx script since no
    route creates one directly -- matches SAAS's own design, deleted the
    script after), listed it, fetched it, sent a business reply (confirmed
    `senderType: USER`/`direction: OUTBOUND`, `messageCount` incremented,
    `lastMessageAt` set), assigned it to an employee (status auto-flips to
    WAITING), updated status to RESOLVED (unreadCount zeroed), marked
    messages read, and confirmed inbox stats reflect the final state.
  - `biz-payments` (list+stats/create/upi-qr/tax-invoice html+json):
    **DONE, live-verified.** Found and fixed a real bug while reading the
    source, before it ever reached testing: SAAS's original
    `getPaymentsList` used `totalCollected?._sum?.amount || 184500` (and
    similar hardcoded fallbacks for transaction/pending counts) --
    Prisma's `_sum` is `null` when zero rows match, so `||` silently
    replaced a real "you have collected nothing yet" with fabricated demo
    numbers for every zero-transaction business. Replaced with `?? 0`
    throughout; live-verified a fresh business's stats correctly show
    `totalCollected: 0` (not 184500) with one real PENDING payment
    counted correctly. Also added a `businessId`-scoped order lookup in
    `createPayment` before creating the payment row (SAAS's original
    trusted `orderId` from the body with no ownership check) -- same
    multi-tenant-safety pattern already used in `biz-orders.ts`. UPI QR
    generation and both invoice response formats (JSON-wrapped HTML string
    and raw `text/html`) ported as-is and verified; the single hardcoded
    collection VPA (`businessos@icici`) is SAAS's original design, not new
    fake data -- real per-business payment-gateway onboarding is a
    payment-aggregator integration, explicitly out of scope per this
    plan's "Explicitly not in this pass" section.
  - `biz-dashboard`/`biz-analytics`/`biz-growth`: **DONE, live-verified.**
    These three had by far the worst fake-data problem found in this whole
    port -- worth flagging clearly since it's a bigger deviation from
    SAAS's original than any other module:
    - `biz-dashboard.ts`: same real-table-name bug as `biz-inventory`'s
      low-stock query (`"InventoryItem"` -> `"inventory_items"`), otherwise
      a straightforward port with `?? 0` in place of `|| 0` (equivalent
      here since order aggregates never went through a fake-number
      fallback in the original, just a real 0/null one).
    - `biz-analytics.ts`: SAAS's original faked nearly the entire response
      -- `grossRevenue`/`totalOrders`/`averageOrderValue` fell back to
      hardcoded numbers, `grossMargin`/`repeatRate` were hardcoded string
      constants never computed at all, channel revenue/percentages were
      derived from a fake total, `topProducts` fell back to five
      completely invented grocery products, and `dailyTrends` was never
      queried -- just seven hardcoded Mon-Sun rows returned unconditionally
      regardless of the `range` query param. Rebuilt real: gross
      revenue/orders/AOV from real aggregates; `repeatRate` computed for
      real as (customers with >=2 orders) / (customers with >=1 order);
      `grossMargin` computed from a real raw-SQL join of `order_items` to
      `products.costPrice` -- returns `null` (not a fake percentage) when
      no product has cost data set, since this schema has no
      historical cost-at-time-of-sale snapshot to compute a precise margin
      from; channel percentages computed from real per-source revenue
      aggregates; `topProducts` real, empty array if none; `dailyTrends`
      now a real raw-SQL `date_trunc('day', ...)` group-by honoring the
      `range` query param (1-90 days, clamped), labeled by ISO date instead
      of the original's fixed weekday names (which only made sense for a
      hardcoded 7-day fake set). New shared `lib/analytics-utils.ts`
      (`percentageChange`).
    - `biz-growth.ts`: segment counts/recentCampaigns fake-fallback bug,
      same pattern, fixed the same way (`count()` is never null, no
      fallback was ever needed). More serious: `launchBroadcastCampaign`
      marked every campaign `COMPLETED` and invented
      sentCount/deliveredCount/readCount (80% of target) as if messages had
      actually gone out over WhatsApp -- but no WhatsApp send integration
      exists yet (`biz-whatsapp` unbuilt). That's not a display bug, it's
      simulating a successful send that never happened, which is worse
      than an honest zero. Fixed: campaigns are created `DRAFT` with a
      real `targetCount`, `sentCount`/`deliveredCount`/`readCount` left at
      their real default of 0 -- becomes real once `biz-whatsapp` can
      actually send. `PREBUILT_CAMPAIGNS` template copy kept as-is (that's
      real authored content, not fabricated business data) except stripped
      the emoji.
    Live-verified all three against the real DB using the orders/customer
    created earlier in this session: dashboard overview (real
    revenue/orders/segments/low-stock/recent-activity), analytics (real
    KPIs, `grossMargin: null` confirmed since no product has costPrice
    set, real channel breakdown showing 100% POS since all test orders
    were MANUAL, real single-day trend row), growth dashboard (real
    segment counts, empty `recentCampaigns` before any campaign existed)
    and broadcast creation (real `targetCount: 1`, confirmed `status:
    DRAFT` and all counts `0`, then confirmed it appears in
    `recentCampaigns`).
  - `biz-website` (config/preview/AI-generate/GitHub-export/public
    storefront+checkout/genre-product catalog+requests): **DONE,
    live-verified.** By far the largest single module (5 new files: 4
    `lib/*` helpers + the route file, ~1500 lines ported from 6 SAAS source
    files across `modules/website/`, `modules/ai/`, `modules/github/`).
    Scope decisions made while porting, all deliberate:
    - Added `@octokit/rest` as a new dependency (GitHub export needs it;
      hit the familiar Windows/OneDrive `prisma generate` file-lock error
      installing it, fixed the same way as always -- kill the port-4000
      dev server first). Added `GITHUB_ACCESS_TOKEN` to `env.ts` as
      optional, matching the zod-validated-env convention this project
      already uses instead of SAAS's raw `process.env` read.
    - AI generation (`lib/website-ai.ts`) consolidated to **Gemini only**
      via the existing `@google/genai` SDK (already in package.json, used
      by the vector layer) -- SAAS's original supported both OpenAI and
      Gemini per-business via `business.aiProvider`/`aiApiKey`, but this
      workspace has no `openai` package and no reason to add a second AI
      SDK. A business configured for `aiProvider: "openai"` with no Gemini
      key falls through to the same regex-replace fallback the original
      already used when no AI client was available -- degrades, doesn't
      break. Uses `env.GEMINI_MODEL` (already configured elsewhere in this
      codebase) instead of the original's hardcoded outdated
      `gemini-1.5-pro`.
    - **Security fix**: SAAS's `listGenreRequests`/`updateGenreRequest`
      had zero businessId scoping at all -- despite being described as
      "admin" endpoints, they sat behind the exact same `authMiddleware`
      every business user gets, meaning any authenticated business could
      list and edit every other business's genre requests, including
      their contact phone/email. There's no platform-admin role anywhere
      in this schema, so silently porting this would ship a real
      cross-tenant data leak. Fixed by scoping both to the caller's own
      `businessId`; live-verified with two separate registered businesses
      -- confirmed business 2 sees an empty list (not business 1's
      request) and gets 404 (not a silent no-op) attempting to PATCH
      business 1's request.
    - Confirmed and skipped one more dead-code function
      (`getDefaultBlocks` in `website.ai.ts` -- defined, never called,
      never exported, same pattern as `getBusinessTypeConfig` in Phase 3's
      first module).
    - Deliberately did NOT touch the Products-block hardcoded placeholder
      products in `generateWebsiteHTML` (shown only when a business has
      zero real products) -- unlike the analytics/payments/growth
      fallback bugs fixed earlier, this is empty-state template filler for
      a storefront preview, not a business metric presented as real data,
      so it doesn't fall under this session's fake-data policy.
    Live-verified against the real DB: config get (null before
    save)/save, JSON+HTML preview, public storefront render by slug,
    **public direct checkout** (real order created with real
    subtotal/tax/total math and a new customer, source `WEBSITE`), genre
    products list/get (empty -- no `GenreProduct` rows seeded yet, expected
    since that catalog is the deferred "genre master template" phase),
    genre request create/list, the cross-tenant security fix (above), and
    `generate-ai` end-to-end with a **real Gemini call** (confirmed via a
    throwaway script, deleted after) -- also surfaced that the
    pre-configured `GEMINI_MODEL=gemini-3.7-flash` intermittently 503s
    ("high demand") under the 7-parallel-section-synthesis load a full
    storefront generation fires via `Promise.all`; confirmed this is a
    real, valid model (verified 2/3 direct calls succeeded) hitting
    transient Google-side capacity limits, not a wrong-model-name bug like
    the embedding fix in Phase 0 -- and confirmed the original's per-section
    try/catch-and-regex-fallback design (ported faithfully) correctly
    degrades instead of failing the whole request when that happens.
    Nothing to fix here; noting it because it's a real characteristic of
    the live system, not a hypothetical. `export-github` correctly returns
    503 "not configured" with no `GITHUB_ACCESS_TOKEN` set (matches the
    original's graceful-degrade design) -- not further live-tested since
    that needs a real GitHub token the user hasn't provided.
  - `biz-whatsapp` (Meta webhook verify+receive, authenticated
    send/send-template): **DONE, live-verified. Phase 3 is now
    COMPLETE -- all 14 Express modules migrated.** Pulled in two more
    files along the way that weren't separately listed in the plan but
    are hard dependencies of this module: `lib/ai-orchestrator.ts`
    (ported from `modules/ai/orchestrator.service.ts` -- intent
    classification + AI reply generation used by the WhatsApp inbound
    pipeline) and extended `biz-conversations.ts` with an exported
    `addMessage()` helper (ported from `conversation.service.ts`'s
    `addMessage`, which SAAS's whatsapp module calls directly) --
    refactored the existing authenticated `POST .../messages` route to
    call the same helper instead of duplicating the create-message logic,
    behavior-preserved (business replies still don't bump
    `unreadCount`/flip `status`, only customer-originated ones do).
    Consolidated `ai-orchestrator.ts` to Gemini via `@google/genai` for
    the same reason as `website-ai.ts` (no `openai` package in this
    workspace) -- multi-turn history mapped to Gemini's `role: user|model`
    `contents` array with `systemInstruction` carrying the business
    persona, replacing OpenAI's system-message-in-the-array shape. Used
    native `fetch` for the two outbound Meta Graph API calls in
    `lib/whatsapp.ts` instead of adding `axios` as a new dependency.
    Added `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/
    `WHATSAPP_VERIFY_TOKEN` to `env.ts` (optional, zod-validated, matching
    the `GITHUB_ACCESS_TOKEN` convention from `biz-website`) instead of
    SAAS's raw `process.env` reads.
    Live-verified against the real DB: webhook verification handshake
    (correct token echoes the challenge with 200, wrong token gets 403),
    authenticated `send`/`send-template` in demo mode (no WhatsApp
    credentials configured -- correctly logs `[WhatsApp DEMO]` and returns
    success rather than failing, matching the original's graceful
    degrade), and -- the real end-to-end test -- **a simulated inbound
    Meta webhook payload** (`POST .../webhook` with a realistic
    `entry[0].changes[0].value.messages[]` body): got the immediate
    `EVENT_RECEIVED` 200 ack, then confirmed via direct DB query
    (throwaway script, deleted after) that the async pipeline actually
    ran end-to-end for real -- a new `Customer` ("Rahul Test",
    919812345678) was created under the fallback first-active-business
    (no `Channel.config.phoneNumberId` mapping existed for the test
    payload's fake phone_number_id, so it correctly fell back, matching
    SAAS's single-tenant-local-testing design), a `WHATSAPP` `Conversation`
    was opened, the inbound message was saved (`direction: INBOUND`,
    `senderType: CUSTOMER`), `orchestrate()` classified it `GREETING` and
    generated a real contextual reply ("Hi Rahul Test! Welcome to Copper
    Leaf Kitchen...") which was saved as a second message
    (`senderType: AI_AGENT`, `aiInterpretation` populated with
    intent/confidence/handoffToHuman), and the outbound send fired in
    demo mode. Not further tested against the real Meta Graph API since
    that needs real WhatsApp Business API credentials the user hasn't set
    up -- same documented limitation as `biz-website`'s GitHub export.
  - **Phase 3 complete.**

- **Phase 4 (make the bridge real): DONE, live-verified.**
  - **`intently-bridge.ts` rewritten**: every handler (`settings` GET/PUT,
    `demand`, `leads`, `analytics`) used
    `prisma.business.findFirst({ where: { offers: { some: {} } } } })` --
    a placeholder that ignored the caller and, worse, authenticated with
    the *consumer* `requireAuth` even though these are business-owner-
    facing endpoints with no relationship to a consumer `User` at all.
    Switched every handler to `requireBizAuth` + `auth.businessId` directly
    (no lookup query needed at all now). Live-verified: settings
    GET/PUT round-trips real data for the real authenticated business, and
    -- the actual regression this fixes -- registered a second business
    and confirmed its `/settings` GET shows its own untouched defaults,
    not business 1's just-saved values (the exact cross-tenant leak the
    placeholder allowed). `demand`/`leads`/`analytics` all return real
    zero-state numbers correctly (no fake fallback anywhere in this file
    to begin with, unlike the Phase 3 analytics/growth bugs).
  - **Match → Customer hook**: new `lib/intently-flywheel.ts`
    (`recordIntentlyLead`), called from `intent-requests.ts`'s
    `runMatchingAndRespond` (fire-and-forget, same non-blocking pattern as
    the existing vector-cache write) for every uniquely matched business
    after a real match set is persisted. Required a real schema addition
    the plan's own wording assumed already existed --
    `Customer.leadSource String?` didn't exist on the model (migrated,
    live-applied, verified the 20 existing embeddings + all prior data
    survived). Dedupes on the existing `@@unique([businessId, phone])`
    when the consumer has a phone, falls back to `findFirst` by email
    otherwise; a guest/anonymous consumer with neither is intentionally
    skipped (no reliable key exists to dedupe or attribute a lead to).
    Live-verified: registered a real consumer (email-only, no phone),
    submitted a real "rooftop restaurant" intent, got 5 real semantic
    matches, and confirmed via direct DB query that all 5 matched
    businesses got a real `Customer` row with `leadSource: "INTENTLY"`
    and a notes field quoting the actual intent text.
  - **Catalog → Offer-embedding hook**: new `lib/catalog-offer-sync.ts`
    (`syncProductOffer`/`syncServiceOffer`/`removeProductOffer`/
    `removeServiceOffer`), wired into all 6 `biz-catalog.ts` write
    endpoints (product create/update/soft-delete, service
    create/update/soft-delete), gated on `business.intentlyEnabled` --
    without this, a business's real BusinessOS catalog would never
    actually be searchable by a consumer intent, which defeats the point
    of unifying the two systems. Required another real schema addition:
    `Offer.productId`/`Offer.serviceId` (`String? @unique`, no Prisma-level
    relation) so repeat catalog writes upsert the same `Offer` row instead
    of creating a duplicate on every price change (migrated + verified
    embeddings survived, same pattern as above). **Caught and fixed a real
    bug before it ever ran**: the first draft of the soft-delete path
    hard-deleted the `Offer` row -- but `Match.offerId`/`Transaction.offerId`
    are non-cascading FKs that may already reference it from real consumer
    activity, so deleting would either throw a foreign-key violation or
    silently orphan match history the moment a product with any match
    history got deactivated. Fixed to only remove the embedding-index
    entry (`removeOfferFromIndex`) and leave the `Offer` row intact.
    Live-verified the complete loop against the real DB and the real
    matching engine: created a product on the business already enabled
    from the settings test above -- confirmed a real `Offer` row
    (`productId`-linked) and a real `EmbeddingRecord` appeared; updated its
    price -- confirmed both the `Offer.price` and the embedding metadata's
    price updated; soft-deleted it -- confirmed the `Offer` row survived
    but its embedding was removed. Then, to prove the *whole* loop, not
    just the writes: created a real salon-flavored Service ("Premium
    Haircut and Styling", ₹599) via `biz-catalog`, then submitted a real
    consumer intent ("looking for a good salon for a haircut... budget
    under 800") from a *different* registered consumer account and got
    back **that exact service as a live match** ("Order Test Biz --
    semantic match 70%; within budget (₹599)") alongside the pre-seeded
    salons -- a catalog item created through this session's own port is
    now genuinely, independently discoverable by real consumer search, not
    just present in the database. (Side note while testing: a plain
    "wireless headphones" intent correctly returned zero matches with
    `status: OPEN` -- not a bug, `SUPPORTED_CATEGORIES` in
    `services/ai/schema.ts` is `["restaurant", "gym", "salon"]` only, a
    pre-existing MVP scope boundary in the intent parser that predates
    this session; retail/electronics products are out of that scope until
    the Intent Understanding Agent's category set is expanded, which is
    not part of this plan.)

**Phase 4 complete.**

- **Phase 5 (frontend cutover): in progress.**
  - **Critical gap found and fixed before anything else could work**:
    Phase 3's plan text explicitly said every ported endpoint should keep
    SAAS frontend's `{ success, data, error }` response envelope
    (`useApi.ts`'s `fetchWithAuth` does `if (!response.ok ||
    !data.success) throw`) -- but none of the ~90 endpoints across all 14
    modules actually did this; every one returns a raw payload
    (`return employee`, `return { data, pagination }` unwrapped, etc.).
    Repointing `VITE_API_URL` alone would have made literally every
    frontend API call throw, since `data.success` would be `undefined` on
    every response. Also discovered while checking this: SAAS's original
    Express routes were mounted at plain paths (`/api/customers`,
    `/api/catalog`, ...), not `/api/biz/*` -- confirmed by reading
    `SAAS/backend/src/index.ts`'s `app.use(...)` calls and cross-checking
    against `SAAS/frontend/src/hooks/useApi.ts`'s `fetch(`${API_BASE_URL}${endpoint}`)`
    pattern and real endpoint strings used in `pages/Customers.tsx`
    (`/customers`, `/customers/stats`, no `/biz` prefix anywhere in the
    frontend). Fixed both:
    - `SAAS/frontend/.env`: `VITE_API_URL="http://localhost:4000/api/biz"`
      (not just `/api` -- the `/biz` segment is absorbed into the base URL
      so none of the frontend's existing endpoint strings need to change).
    - New `apps/api/src/plugins/biz-response-envelope.ts`, a global
      `onSend` hook (registered once in `app.ts`, scoped internally to
      `request.url.startsWith("/api/biz/")` so Intently's own consumer
      routes are untouched) that wraps every JSON response instead of
      hand-editing 90 endpoints across 14 files for a purely mechanical
      shape change. Used `onSend`, not the more obvious
      `preSerialization`, after checking Fastify's own hook docs -- 
      `preSerialization` is explicitly skipped when the payload is `null`,
      and `GET /api/biz/website/config` legitimately returns `null` for an
      unconfigured business, so that hook choice would have silently
      bypassed the envelope for exactly the response shape most likely to
      trip up a frontend expecting `data.success` to always exist.
      List-shaped payloads (`{data: T[], pagination}`) unwrap to
      `{success, data, pagination}`; everything else nests as
      `{success, data: <payload>}`; 4xx/5xx responses normalize to
      `{success: false, error: {message}}` (extracting a readable string
      from either a plain `{error: "..."}` or a zod `.flatten()` shape).
      One deliberate shape simplification vs. SAAS's original: a
      message-only action response becomes
      `{success, data: {message: "..."}}` instead of the original's
      `{success, message: "..."}` -- one consistent `data.data` access
      pattern beats special-casing per endpoint.
      Live-verified every shape variant against the real running server:
      a paginated list, a single-item create, a message-only delete, a 401
      error, a 404 error, the `null`-config edge case (confirmed
      `{"success":true,"data":null}`, not silently bypassed), an
      unaffected consumer route (`/api/intent-requests` still returns its
      original raw `{"error": "..."}` shape, unwrapped, exactly as before
      -- the mobile app's contract is untouched), and both non-JSON
      passthroughs (HTML `?format=html` preview and the WhatsApp webhook's
      plain-text challenge echo both still return exactly as they did
      before this hook existed).
  - **Mock-data audit across all 14 pages: DONE.** The plan only named
    `Settings.tsx`/`Dashboard.tsx`; grepping the whole `pages/` directory
    turned up fake-data bugs in **8 files total**, several worse than
    display-only fallbacks:
    - `Dashboard.tsx`: the most severe -- `metrics`/`recentTransactions`/
      `upcomingTasks` were hardcoded **unconditionally** (comment literally
      said "Minimal Data Mock"), not even gated behind a failed fetch, and
      no real dashboard data was ever fetched at all. Rebuilt to call the
      real `/dashboard/overview` (built and verified in Phase 3) for
      revenue/orders/customers/low-stock metrics and real recent orders;
      removed the fabricated "Upcoming Tasks" card entirely since no
      Task/Reminder model exists anywhere in this schema -- leaving it
      would mean fabricating business data with no backing feature to
      eventually make real, unlike the other fixes which have a real
      endpoint behind them.
    - `Settings.tsx`: `fetchIntentlyData` fell back to fake demand numbers
      on failure (the plan's originally-named bug); worse,
      `handleSaveIntently` and `handleSave` both showed "✓ Settings Saved
      Successfully" **inside their own catch blocks** -- a failed save was
      indistinguishable from a successful one. Added a real `saveError`
      state and error banner instead of faking success.
    - `Onboarding.tsx`: same pattern -- `handleComplete`'s catch block
      marked onboarding complete locally and navigated to the dashboard
      even when the backend call failed, leaving the real
      `onboardingCompleted` flag `false` while the UI claimed otherwise.
      Fixed to show a real error and let the user retry.
    - `Customers.tsx`, `Catalog.tsx`, `Employees.tsx`, `Inventory.tsx`,
      `Orders.tsx`, `Conversations.tsx`: each had a `MOCK_*` constant
      substituted on fetch failure. Removed all six; added a consistent
      `loadError` state + inline retry banner per page instead. Several
      had a second, worse bug beyond the load-fallback:
      - `Employees.tsx`/`Inventory.tsx`: failed create/adjust actions
        applied a fake local-only change and reported success anyway --
        for Inventory specifically, this could have silently masked a real
        `400 Insufficient stock` rejection from the `biz-inventory`
        endpoint built in Phase 3, showing a stock adjustment as applied
        when the server actually rejected it. Fixed to surface the real
        error instead.
      - `Orders.tsx`: worse than a display bug -- `loadOrders` replaced
        even a **successful** real API response with mock orders whenever
        it happened to be empty (`ordRes.data.length > 0` gate), so a
        genuinely order-free business would never see its own real empty
        state. `updateStatus` swallowed failures while still applying the
        status change locally. `handleCreateOrder` never called the
        backend at all -- it fabricated a client-only order object from
        free-text name/phone/item fields that don't correspond to any
        real customer or product. Rebuilt as a real integration: the
        modal now fetches real customers/products into dropdowns and
        calls the actual `POST /orders` with a real `customerId`/
        `productId`, matching `biz-orders.ts`'s real contract (which
        requires both to already exist -- free text was never going to
        work against that endpoint).
      - `Conversations.tsx`: `handleAiDraftReply`'s catch fabricated a
        canned AI reply text on failure; `handleSendMessage` applied an
        optimistic local message even if the send failed, with no error
        shown. Fixed both; `handleSendMessage` now appends the real saved
        message returned by the server instead of a client-only stand-in.
        Left `toggleAiMode` as local-only UI state (unchanged) -- no
        `biz-conversations` endpoint persists `isAiHandled` directly, in
        SAAS's original design either, so this is a pre-existing feature
        gap, not data fabrication (it never claimed to be saved).
  - **Blocking contract mismatch found and fixed while simulating the
    real login flow**: `Login.tsx`/`AuthContext.tsx` expected
    `response.data.tokens: {accessToken, refreshToken}` and
    `response.data.user`, but `biz-auth.ts` (built in Phase 2) returns
    `{token, businessUser, business}` -- a single access token, no refresh
    token (a deliberate Phase 2 scope decision, noted in this file at the
    time). Every login/register would have thrown immediately. Fixed
    `AuthContext.login()` to accept a single `token: string` and store
    only `accessToken` in `localStorage` (which is what `useApi.ts`
    actually reads -- the `refreshToken` key was written but never read
    anywhere); fixed `Login.tsx` to read `response.data.token`/
    `response.data.businessUser`. Also added the missing required `city`
    field to the registration form -- `biz-auth.ts`'s register schema
    requires it (a deliberate Phase 2 decision to avoid writing a
    placeholder empty string), but the original registration form never
    collected it, so every registration would have 400'd.
  - Live-verified the complete real flow via curl, simulating exactly what
    the browser will send/receive: register (confirmed
    `response.data.token`/`businessUser`/`business` match what
    `Login.tsx` now reads) -> `PUT /business/profile` (onboarding step 1)
    -> `POST /business/onboarding/complete` (step 2, confirmed
    `onboardingCompleted: true`) -> `GET /auth/me` (confirms
    `AuthContext`'s refresh shape) -> `GET /dashboard/overview` (confirms
    the exact shape the rebuilt `Dashboard.tsx` reads). Full workspace
    frontend typecheck (`tsc -b`) is clean except 5 pre-existing errors
    unrelated to anything touched this session (`Sidebar.tsx` icon prop
    types, `Settings.tsx`/`Website.tsx` Badge/Button variant type
    mismatches in code this pass never edited) -- confirmed pre-existing
    by their locations falling entirely outside every file this session
    modified. `vite dev` boots clean on port 5173 with no runtime console
    errors from the initial bundle.
  - **Known limitation, stated plainly**: this session's tool set has no
    browser automation (checked via ToolSearch; only Figma MCP tools are
    available, no Playwright/Puppeteer). Every fix above is verified by
    real API contract simulation (curl against the live server, matching
    exactly what each page's `fetchWithAuth` call sends/expects) and a
    clean typecheck + clean dev-server boot -- but the actual rendered
    UI in a real browser (click-through, visual layout, console errors
    from React itself) has **not** been visually confirmed. If real
    browser testing matters before considering Phase 5 fully done, that
    still needs to happen -- ideally by the user opening
    `http://localhost:5173` themselves, since it's already running.
  - Established per-module pattern (repeat this for each remaining one):
    read the SAAS controller+service+routes fresh, port to
    `apps/api/src/routes/biz/biz-<name>.ts` using zod schemas in place of
    SAAS's untyped `data: any`/manual field checks (this project's existing
    convention), reuse `requireBizAuth`, register in `app.ts`, typecheck,
    then live curl-test every endpoint against the real DB before moving
    on. Watch for the Prisma `Json` field type error (`InputJsonValue`)
    on any endpoint accepting a JSON body field -- cast with
    `as Prisma.<Model>UpdateInput`, same fix applied in `biz-business.ts`
    and `funnel-service.ts`.
- Phases 4-5: not started.

Note: mid-Phase-0, the user asked (separately from this plan) about a
future "genre master template" system for onboarding new businesses by
industry -- told them BusinessOS's existing `GenreProduct` model already
is that pattern (data-driven per-genre starter config, not a code fork),
and that it'll be designed properly as its own phase once this plan is
done. Don't fold it into this plan uninvited.

## Context

Two products exist today: **Intently** (`apps/api` Fastify + `apps/mobile`, the consumer
side) and **BusinessOS** (`SAAS/backend` Express + `SAAS/frontend` React, the business
SaaS side). They're meant to be two faces of one marketplace — consumer intent on one
side, business fulfillment on the other — but they're currently two disconnected apps
with separate databases and separate auth. The user has already started wiring them
together (a vector-intelligence layer in `apps/api`, a stub bridge API, matching UI in
BusinessOS's frontend) and wants a plan to finish the job: one backend, one database,
one auth system, with BusinessOS as the business-facing surface and Intently as the
consumer-facing surface, both fed by the same data.

**What this plan is not**: it does not attempt Qdrant, unfulfilled-demand clustering, or
the creator/bidding features from the original planning docs' later phases. Those need
real usage volume to justify (per the docs' own reasoning) and aren't blocked on
anything below.

### What I found already in place — and what's actually broken

The user described this as "already did some changes." Concretely, on the `apps/api`
side: a full vector-intelligence layer (`services/vector/*.ts` — embedding via Google
`text-embedding-004`, an intent semantic cache, offer embeddings, per-user taste
vectors), a v2 matching engine (`matching-service.ts`) meant to replace the v0 filter,
a stub bridge (`routes/intently-bridge.ts`), and schema additions (`EmbeddingRecord`,
`Business.intentlyEnabled`/`intentlyCategories`/etc.). On the `SAAS/` side: a complete,
well-structured Express + Prisma app (14 modules, matching Prisma schema, a real React
frontend with a page per module) — genuinely solid work, untouched by any of the
Intently integration.

But right now:

1. **`apps/api` doesn't build.** `prisma generate` was never re-run after the schema
   changes, so `@prisma/client` doesn't know about `EmbeddingRecord` or the new
   `Business` fields yet — `npx turbo run typecheck --filter=@intently/api` fails with
   ~25 errors right now.
2. **The v2 vector matcher is dead code.** `findMatchesV2` reads `intentRequest.city`,
   but `IntentRequest` has no `city` field (only optional `locationLat`/`locationLng`,
   never populated anywhere). The city filter always compares against `""`, so
   `searchOffers` always returns zero rows, and `findMatches()` silently falls back to
   v0 every single time. The vector layer has never actually served a real match.
3. **The migration is incomplete.** `20260825000000_init_vector` only `ALTER TABLE`s
   `embedding_records` to add the vector column — but no applied migration actually
   *creates* that table, the new `Business` columns, or the `EmbeddingKind` enum.
   `prisma migrate status` confirms it's unapplied, and applying it as-is would fail
   (the table it alters doesn't exist yet).
4. **The bridge routes are unauthenticated in practice.** Every handler in
   `intently-bridge.ts` resolves "the business" via
   `prisma.business.findFirst({ where: { offers: { some: {} } } })` — completely
   ignoring the authenticated `userId`. In a multi-business dataset this returns/mutates
   an arbitrary business, not the caller's own. The code comments admit this
   ("placeholder: replace with userId join in Phase 2"), but it means the bridge is not
   safe to route real traffic through yet.
5. **`SAAS/frontend`'s Intently widgets fabricate data on failure.** `Settings.tsx` and
   `Dashboard.tsx` catch a failed bridge call and fall back to hardcoded mock numbers
   (`recentIntentsToday: 38`, etc.) — so the UI "works" today even with a completely
   broken backend behind it. This needs to go once the real bridge is live.
6. **Two live, separate Neon databases; incompatible JWT.** `apps/api` and
   `SAAS/backend` each have their own Neon project. JWTs use different secrets *and*
   different payload shapes (`{sub}` vs `{userId, businessId, email, role}`). Confirmed
   both hold only test/seed data (per your answer) — no data-migration/ETL step needed,
   which simplifies Phase 1 a lot.
7. **No Qdrant anywhere** — only a code comment noting it as a future revisit trigger.
   The ecosystem-map doc's diagrams overstate what's built; not a blocker, just noting
   the plan below doesn't touch it.

### Decisions already made (your answers)

- **Pacing: incremental, verify each step** — fix what's broken first, then migrate the
  SAAS backend module-by-module into `apps/api`, typechecking and smoke-testing against
  the real DB after each one. Never leave two things broken at once.
- **Data: both DBs are disposable test/seed data** — no ETL step. The plan reuses
  `apps/api`'s existing Neon database as the single canonical one (it's already wired
  into the mobile app, business-dashboard, and every doc from this session);
  `SAAS/backend`'s separate Neon project is retired, not migrated from.
- **`apps/business-dashboard` (the small Next.js app built earlier today) is
  deprioritized** — BusinessOS (`SAAS/frontend`) becomes the one business dashboard
  going forward. `apps/business-dashboard` is left as-is (it works, it's not in anyone's
  way) but gets no further investment; nothing in this plan touches it.
- **Port**: `master_plan.md` says the unified API should run on port 3000. I'm
  deliberately not doing that — `apps/api` already runs on **4000** everywhere (mobile
  app config, every doc from this session, every smoke test run today), and moving it to
  3000 would newly collide with `apps/business-dashboard`'s Next dev server. Simpler and
  safer to keep `apps/api` on 4000 and repoint `SAAS/frontend`'s `VITE_API_URL` there
  instead — one small env change vs. touching the mobile app and a dozen docs.

## Phase 0 — Fix the foundation (nothing below is safe to build on until this is done)

1. **Get `apps/api` building again.**
   - Stop the running dev server (same pattern used all session — check port 4000,
     `taskkill` the tsx watch process), run `npx prisma generate`, confirm
     `EmbeddingRecord` and the new `Business` fields resolve.
   - Fix the ~15 real TS strict-null errors already present in
     `services/vector/embedding.service.ts`, `intent-cache.service.ts`,
     `offer-embedding.service.ts`, `user-taste.service.ts` (array-access-possibly-
     undefined, `best` possibly undefined from a destructured query result) — small,
     mechanical fixes, not a design change.
   - Fix `intently-bridge.ts`'s two direct type errors (`intentlyCategories`/
     `intentlyEnabled` not found — these resolve once `prisma generate` picks up the
     new fields).
2. **Fix the migration.** Delete the incomplete hand-written
   `20260825000000_init_vector` migration, let `prisma migrate dev` generate a correct
   diff for everything actually pending (the `EmbeddingRecord` table, `EmbeddingKind`
   enum, the seven new `Business` columns), then hand-append the raw
   `CREATE EXTENSION vector` + `ALTER TABLE ... ADD COLUMN vector` + ivfflat index SQL
   Prisma can't generate natively (same pattern already used correctly elsewhere in this
   migration's draft). Apply it to the live Neon DB, confirm `prisma migrate status`
   is clean.
3. **Fix the `city` bug so v2 matching can actually run.** `IntentRequest` never
   captures a city today (v0 never needed one — it only filters on category/budget).
   Simplest correct fix: drop the hard `city` filter from `searchOffers()`'s WHERE
   clause entirely (stop requiring `metadata->>'city' = $2`) so vector search can
   actually return candidates city-wide, and note real location-aware filtering as
   later work that needs the Intent Understanding Agent to extract a location field in
   the first place (out of scope here — don't build it speculatively).
   - Reindex existing seeded businesses/offers once this is fixed
     (`reindexAllOffers()` already exists in `offer-embedding.service.ts` — call it once
     via a one-off script or a temporary admin route).
   - Live-verify: submit a real intent via curl/mobile, confirm `findMatchesV2` returns
     real results instead of silently falling back to v0 (check server logs / add a
     temporary log line if needed, then remove it).
4. **Leave the bridge routes' auth exactly as flagged, don't patch around it.** The
   underlying problem — there's no `Business.ownerId`/tenant link to resolve "the
   business this authenticated user owns" — only gets fixed once the schema is merged
   in Phase 1. Patching the lookup now would just be a different placeholder. Note this
   explicitly rather than silently leaving it as a landmine.

**Verify Phase 0 done:** `npx turbo run typecheck --filter=@intently/api` passes clean;
a live curl smoke test shows a real intent producing v2 vector matches (not the v0
fallback reason string).

## Phase 1 — Unified schema

1. **Resolve the one hard collision:** both schemas have a model literally named
   `User` — Intently's consumer account and BusinessOS's staff login are different
   entities that can't share a Prisma model name. Rename BusinessOS's login entity to
   `BusinessUser` on the way in; keep its existing `businessId` tenant link and its
   existing optional soft link to `Employee` (the separate HR/roster entity) exactly as
   `SAAS/backend`'s schema already has it. Intently's `User` is untouched.
2. **Fold BusinessOS's ~20 models into `apps/api/prisma/schema.prisma`** as their own
   block: `BusinessUser`, `Channel`, `Customer`, `Category`, `Product`,
   `ProductVariant`, `Service`, `Order`, `OrderItem`, `Appointment`, `InventoryItem`,
   `InventoryMovement`, `Payment`, `Invoice`, `Conversation`, `Message`, `Employee`,
   `Campaign`, `CampaignRecipient`, `Workflow`, `WorkflowExecution`, `AnalyticsEvent`,
   `WebsiteConfig`, `ComponentTemplate` (keeps its own `vector(768)` RAG column —
   same pgvector extension, no new infra), `GenreProduct`, `GenreProductRequest`.
3. **Merge the two `Business` models into one.** Keep Intently's marketplace fields
   (`ratingAverage`, `verifiedTxnCount`, `categories`, the `intently*` toggle fields —
   these now describe *this* business's own marketplace participation, no cross-
   reference needed) and add BusinessOS's operational fields (`workingHours`,
   `deliveryRules`, `paymentMethods`, `pricingRules`, `policies`, `aiProvider`/
   `aiApiKey`, `onboardingCompleted`, contact/location/currency/language fields).
   Resolve the one real overlap: `subscriptionTier` (Intently, plain string) vs. `plan`
   (BusinessOS, a real `PlanType` enum) describe the same thing — keep `plan`, drop
   `subscriptionTier`. Drop `businessOsId` entirely (it was only a Phase-1 stopgap
   cross-reference; once there's one `Business` model there's nothing to cross-
   reference). Add `Business.users BusinessUser[]` as the real tenant relation the
   bridge routes need in Phase 4.
4. **One migration, no ETL.** Since both databases are disposable test data, generate
   this as a normal `prisma migrate dev` diff against `apps/api`'s existing Neon
   database and apply it directly — no export/transform/import step.

**Verify Phase 1 done:** `prisma generate` + `npx turbo run typecheck --filter=@intently/api`
clean; `prisma migrate status` clean against the live DB; a quick `prisma studio` or
`$queryRaw` check confirms the new tables exist.

## Phase 2 — Shared auth

1. Extend (don't replace) the existing JWT shape in `apps/api/src/lib/jwt.ts`. Consumer
   tokens keep signing exactly `{ sub: userId }` (zero mobile-app changes). Add a
   business-token variant: `{ sub: businessUserId, businessId, role }`, still signed
   with the one existing `env.JWT_SECRET`.
2. Add `requireBizAuth(request, reply)` next to the existing `requireAuth` in
   `apps/api/src/plugins/auth.ts`, decorating `request.businessUserId`/
   `request.businessId`/`request.role` when a business-shaped token is presented.
3. Port `SAAS/backend/src/modules/auth`'s register/login/bcrypt logic into a new
   `apps/api/src/routes/biz/biz-auth.ts`, issuing the new business-token shape.

**Verify Phase 2 done:** register + login a test `BusinessUser` via curl against the
live API, confirm the token round-trips through `requireBizAuth` on a throwaway
protected route.

## Phase 3 — Migrate the 14 Express modules, one at a time

For each module: read the Express controller/service in
`SAAS/backend/src/modules/<name>`, port the logic to a new Fastify route file under
`apps/api/src/routes/biz/`, wire it through `requireBizAuth`, register it in `app.ts`,
typecheck, then smoke-test its key endpoints with curl against the live merged DB
before moving to the next module. Order (dependency-first, so nothing is blocked on a
module that doesn't exist yet):

1. `biz-business` (profile/DNA/onboarding — needed before anything else has a
   `businessId` to attach to)
2. `biz-catalog` (products/categories/services — needed before offer embeddings can
   wire in)
3. `biz-customers` (CRM)
4. `biz-inventory`
5. `biz-orders`
6. `biz-employees`
7. `biz-conversations` (Universal Inbox)
8. `biz-payments`
9. `biz-dashboard`, `biz-analytics`, `biz-growth`
10. `biz-website` (AI generation + GitHub export — most self-contained, most complex,
    done last)
11. `biz-whatsapp` (external webhook — needs real WhatsApp Business API credentials
    the user hasn't necessarily set up; low priority, can trail behind everything else)

Response shape: keep the same `{ success, data, error }` envelope
`SAAS/frontend/src/hooks/useApi.ts` already expects, so Phase 5's frontend cutover
doesn't have to touch 13 pages of response-handling code.

**Verify each module done:** typecheck clean, and at minimum one real create + one real
read smoke-tested via curl against the live DB, before starting the next module.

## Phase 4 — Make the bridge real

Now that `Business`/`BusinessUser` are unified and `requireBizAuth` exists:

1. Rewrite every `intently-bridge.ts` handler's placeholder lookup
   (`findFirst({ where: { offers: { some: {} } } })`) to a real
   `where: { id: request.businessId }` scoped lookup.
2. Wire the flywheel hooks the original docs describe, each only once its dependency
   from Phase 3 exists: **Match → Customer** (create/update a `Customer` with
   `source: "INTENTLY"` when a consumer's intent matches this business — hook into
   `intent-requests.ts`'s existing `runMatchingAndRespond`), **Transaction → Order**
   (Phase 2-scale feature in the roadmap sense — Intently doesn't have a real
   transaction/checkout flow yet, so this hook is a no-op stub until that exists, not
   built here), **Catalog → Offer embedding** (when a `Product`/`Service` is created via
   `biz-catalog`, call the existing `indexOffer()` from `offer-embedding.service.ts`).

**Verify Phase 4 done:** submit a real consumer intent, confirm a real `Customer` row
appears in the merged DB with `source: "INTENTLY"`, confirm `/api/biz/intently/leads`
returns it for the correct authenticated business only (not an arbitrary one).

## Phase 5 — Frontend cutover

1. `SAAS/frontend/.env`: `VITE_API_URL` → `http://localhost:4000/api`.
2. Remove the hardcoded mock-data fallback in `Settings.tsx`/`Dashboard.tsx` — a failed
   call should show an error state, never fabricated numbers.
3. Live walk the full loop: create a business through BusinessOS's Onboarding page →
   enable the Intently marketplace toggle in Settings → submit a real intent from the
   mobile app → confirm it shows up as live demand in the BusinessOS Dashboard and as a
   lead in Customers.

**Verify Phase 5 done:** that full loop, done for real, once, end to end.

## Explicitly not in this pass

Qdrant migration, unfulfilled-demand clustering, standing recommendations, creator/
bidding features, any payment-aggregator integration, `apps/business-dashboard`
deprecation — all correctly deferred per the roadmap's own "don't build ahead of real
usage" reasoning, and none of them block anything above.
