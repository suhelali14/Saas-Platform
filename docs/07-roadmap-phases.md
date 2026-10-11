# Roadmap — Phases 0 through 5

Each phase has: **Goal**, **Deliverables**, **Technical tasks**, **Exit
criteria** (what must be true to move on), and **Rough timeline** (assumes
a very small team — 1-3 people — adjust with real headcount, see
[11-glossary-open-questions.md](11-glossary-open-questions.md)).

No code is written until Phase 0 is complete and Phase 1 scope is locked.

---

## Phase 0 — Foundation & Validation (2–4 weeks)

**Goal:** confirm the wedge (city + verticals) is real before building
anything, and get the legal/brand basics in place.

**Deliverables**
- Confirmed launch city and 3-5 initial categories (default recommendation:
  Bengaluru; Restaurants, Beauty/Salons, Fitness/Gyms — see
  [11-glossary-open-questions.md](11-glossary-open-questions.md) to
  confirm/override).
- 20-30 informal conversations: 15+ with potential users ("how do you
  currently find X"), 10+ with local business owners in the chosen
  categories ("what do you currently pay to acquire a customer, what do
  you hate about it").
- One-page landing site with the value prop + waitlist signup, to gauge
  organic interest before building the app.
- Legal entity setup (if not already done) and a decision on whether
  in-app payments launch in Phase 1 or Phase 2 (affects whether a payment
  aggregator/compliance review is needed early).
- Working name locked (or consciously deferred) — see doc 11.

**Technical tasks**
- None beyond the landing page. Do not start backend/app code yet.

**Exit criteria**
- Clear evidence (from the conversations + waitlist signal) that the
  target users actually search/ask around for these categories often
  enough, and that target businesses feel real pain around CAC/ad ROI.
- If validation is weak, revisit the vertical/city choice before Phase 1 —
  this is the cheapest point to pivot.

---

## Phase 1 — Single-Player Utility MVP (6–10 weeks)

**Goal:** ship something a user finds useful with **zero businesses
onboarded yet**, to solve the chicken-and-egg problem from the demand
side, per [01-vision-positioning.md](01-vision-positioning.md).

**Deliverables**
- Native app v0.1 (React Native/Expo): the intent box, Intent
  Understanding Agent (basic version — category/location/budget/timing
  parsing only, no multi-turn clarification yet), and a results screen
  backed by **manually curated data** (the team researches and enters
  offers from 15-30 real local businesses per category — "Wizard of Oz"
  matching, not automated yet).
- Manual concierge loop: when a user submits an intent the automated
  matcher can't confidently serve, a human (founder/ops) fills the gap
  behind the scenes for the first cohort of users — this teaches you what
  automated matching actually needs to handle.
- Basic accounts (phone/OTP), request history.
- Analytics instrumentation on the full funnel (see
  [05-native-app-spec.md](05-native-app-spec.md)).

**Technical tasks**
- Set up repo, CI, environments (see
  [10-tech-stack-decisions.md](10-tech-stack-decisions.md)).
- Postgres schema for User, IntentRequest, Business, Offer (manually
  populated), Match (see [06-data-model.md](06-data-model.md)).
- Intent Service with LLM-backed parsing (single agent, function-calling,
  schema-validated output — see
  [04-multi-agent-design.md](04-multi-agent-design.md)).
- Simple rule/filter-based matching against the manually curated
  dataset (skip vector search/embeddings until Phase 2 — not needed at
  this data volume).
- Native app screens: Onboarding, Home, Results, Business Profile
  (read-only), basic Notifications.
- No payments in-app yet unless Phase 0 decided otherwise — track
  "contacted business" as the conversion event.
- Start the embedding write-path now (compute + store an embedding for
  every LLM-parsed intent, no cache-lookup logic yet): cheap, and it's
  the data the Phase 2-3 semantic cache and personalization need to be
  useful on day one of being switched on. See
  [13-ai-cost-optimization-personalization.md](13-ai-cost-optimization-personalization.md).

**Exit criteria**
- Target: X active weekly users submitting real intents (set a concrete
  number once city/vertical is confirmed — e.g., 500-1,000 weekly
  requests) with a healthy intent→"contacted business" rate (track this
  number itself as the first version of the north-star metric, see
  [08-business-model-gtm.md](08-business-model-gtm.md)).
- Enough usage data and manually-observed patterns to know what automated
  matching needs to get right in Phase 2.

---

## Phase 2 — Two-Sided Marketplace Automation (8–12 weeks)

**Goal:** replace the manual concierge with a real supply side and
automated matching; prove the core loop works without a human in it.

**Deliverables**
- Business Portal (Next.js): self-serve signup, profile creation, offer
  management, availability, and a dashboard showing requests received →
  responded → converted → revenue.
- Outreach: manually recruit the first 50-100 businesses per
  [08-business-model-gtm.md](08-business-model-gtm.md) using the Phase 1
  usage data as the pitch ("we have N people/week asking for exactly what
  you sell").
- Automated Matching Engine v1 (vector search + hard-constraint filtering
  + basic ranking — see [03-architecture-overview.md](03-architecture-overview.md)
  and [04-multi-agent-design.md](04-multi-agent-design.md)).
- In-app payments/booking (if not already live) via a payment aggregator,
  with commission calculation and business payout scheduling.
- Notification Service: real-time alerts to businesses on new matched
  requests (response-time matters for conversion — instrument this).
- Trust & Safety v1: basic business verification (KYC-lite), review
  system tied to verified transactions only.

**Technical tasks**
- pgvector-backed embeddings for business/offer semantic search.
- Matching/Ranking Agent (per doc 04) replacing the Phase 1 rule-based
  filter.
- Transaction & Payments Service, commission engine.
- Business Portal auth, dashboard, offer/availability CRUD.
- Feedback loop: persist (intent, shown matches, outcome) for every
  request — this dataset starts driving ranking improvements from here on.
- Semantic cache read-path goes live once there's enough verified-parse
  volume to tune similarity thresholds against: skip the full model call
  on a high-confidence cache hit. See
  [13-ai-cost-optimization-personalization.md](13-ai-cost-optimization-personalization.md)
  Part 1 — this is what starts bending the cost-per-request curve down.

**Exit criteria**
- A meaningful share of transactions are fully automated (no manual
  concierge intervention).
- Business-side retention signal: businesses that got a real paying
  customer through the platform continue responding to new requests
  (this is the real test of the "outcome, not impression" pitch).
- Intent→Outcome conversion rate and business ROI numbers are real and
  defensible (see doc 08 for the exact metrics).

---

## Phase 3 — AI Layer Maturity & Reverse Marketplace (10–14 weeks)

**Goal:** deepen the AI layer's quality and add the differentiated
features that are hard for incumbents to copy quickly.

**Deliverables**
- Multi-turn clarification in the Intent Understanding Agent
  (confidence-gated follow-up questions, per doc 04).
- Open Requests / reverse marketplace feature for higher-consideration
  categories (see [02-product-spec.md](02-product-spec.md) §1.5).
- Standing offers / proactive inventory matching for businesses (no
  per-request response needed for straightforward categories).
- Business Analytics/Insight Agent: plain-language dashboard summaries +
  early version of the "unfulfilled intent" market-intelligence product.
- Trust & Fraud Agent (async risk scoring on offers/reviews/requests).
- Personalization goes live: `UserProfile` (structured affinities) and
  `UserTasteVector` (embedding) start feeding the Ranking Agent, per
  [13-ai-cost-optimization-personalization.md](13-ai-cost-optimization-personalization.md)
  Part 2. The structured profile can technically start updating from
  Phase 1 (pure arithmetic, no volume needed) — this is when it starts
  being *used*, once there's enough per-user transaction history for it
  to mean anything.
- Expand from 3-5 categories to a broader set within the same city, only
  after the original categories show healthy liquidity.

**Technical tasks**
- Vector store scaling decision (stay on pgvector vs. move to a dedicated
  vector DB — revisit per doc 10 based on real query volume).
- Ranking function tuning using the Phase 2 feedback dataset; stand up a
  golden eval set for the Intent Understanding Agent in CI (per doc 04).
- Redis caching layer in front of the business directory for read scaling.
- Geographic sharding groundwork if multi-city is imminent.

**Exit criteria**
- Category expansion within the launch city shows the same or better
  liquidity as the original wedge categories (validates the matching
  engine generalizes, not just hand-tuned for the first 3 categories).
- Unfulfilled-intent data product has at least one paying/interested
  business pilot.

---

## Phase 4 — Growth, Network Effects & New Markets (ongoing, 3-6 month waves)

**Goal:** turn the working single-city marketplace into a repeatable
growth machine and add the network-effect features.

**Deliverables**
- Rewards/referral loop (platform credit for successful referrals).
- Creator layer: business-to-creator matching, campaign tracking,
  commission on creator payouts.
- Priority bidding for promoted placement (transparently labeled, never
  overriding hard constraints — per doc 04 guardrails).
- Second city launch, replaying the Phase 0-2 playbook (this time faster,
  with a proven product and a real business-recruitment pitch deck).
- B2B SaaS tier for advanced analytics (per
  [08-business-model-gtm.md](08-business-model-gtm.md)).

**Technical tasks**
- Multi-city data partitioning/indexing.
- Creator matching (extends the same Matching Engine with a creator
  entity type — see [06-data-model.md](06-data-model.md)).
- Bidding/auction logic for promoted placement, isolated so it cannot
  affect relevance-ranked results.

**Exit criteria**
- Referral loop demonstrably lowers blended CAC.
- Second city reaches Phase 2-equivalent liquidity in materially less
  time than the first city took (proof the playbook is repeatable, which
  is what makes this fundable/scalable).

---

## Phase 5 — Agent-to-Agent Commerce (moonshot, not scheduled — precondition-gated)

**Goal:** the original "personal AI agent negotiates with business AI
agent" vision, attempted only once the platform has real liquidity, a
trusted transaction rail, and enough standardized business data for
autonomous decisions to be safe.

**Preconditions before this phase is even scheduled**
- Multiple cities/verticals at healthy liquidity (Phase 4 exit criteria
  met more than once).
- A track record of transaction trust (low dispute rate, verified payout
  reliability) — autonomous agents transacting on a user's behalf require
  a much higher trust bar than a human clicking "confirm."
- A standardized protocol for business agents to declare inventory/offers
  machine-readably (an extension of the standing-offer data model from
  Phase 3).

**Deliverables (when reached)**
- User-authorized autonomous agent limits (e.g., "auto-book anything
  matching these exact constraints under this price").
- Business-agent protocol + priority-bidding-as-an-API for agent-to-agent
  matching.
- Data Dividend mechanism formalized (platform credit at minimum; defer
  crypto/token mechanics unless there's a specific, compliant reason to
  add them — do not add complexity for its own sake).

**Explicitly not started earlier** — see
[01-vision-positioning.md](01-vision-positioning.md) non-goals. This phase
depends on trust and liquidity that cannot be faked; attempting it early
would burn credibility the platform needs for everything else.
