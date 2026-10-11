# Product Specification

Three surfaces, built in this order: **Consumer App (native) → Business
Portal (web) → Creator Layer (later)**.

## 1. Consumer product

### 1.1 Core interaction: "What do you need?"

A single prominent input (text, and eventually voice) on the home screen.
Examples of what it accepts:

- "I need a gym near Koramangala under ₹2,000/month"
- "Find me a rooftop restaurant tonight for two, budget ₹1,500, within 5km"
- "I want a wedding photographer in Pune next Saturday, budget ₹50k"
- "I need a laptop for coding under ₹80k"
- "Someone to repair my AC today"

### 1.2 Intent parsing

Free text is parsed by the Intent Understanding Agent (see
[04-multi-agent-design.md](04-multi-agent-design.md)) into a structured
object with fields like: `category`, `location`, `budget_min/max`,
`timing/urgency`, `preferences[]`, `hard_constraints[]`,
`soft_preferences[]`. The structured object is shown back to the user as
editable chips/filters — never a black box — so they can correct
misunderstandings before matches are fetched.

### 1.3 Matching & results

The Matching Agent returns a ranked shortlist (not everything that
technically qualifies — curated, like 3-5 options, not 47). Each result
card shows: price, distance, availability, relevant offer/discount, and
trust signals (review count/score, verified transaction count). Users can
ask follow-up questions in the same thread ("does it have parking?") which
re-queries the matched businesses' structured data or triggers a message to
the business.

### 1.4 Compare & choose

Side-by-side comparison view for the shortlist. User picks one, the app
either completes a transaction in-app (booking, payment) or hands off to
the business's own checkout with a tracked referral link, depending on
category and integration depth.

### 1.5 Open Requests (reverse marketplace) — Phase 3+

For higher-consideration purchases (photographer, contractor, custom
service), a user can post an open request instead of expecting instant
matches. Qualified businesses respond with proposals (portfolio, price,
availability). This is the "RFQ for consumers" feature and is one of the
more differentiated, harder-to-copy parts of the product.

### 1.6 Rewards / referral loop — Phase 4

Sharing a good deal with a friend who then transacts earns the referrer
platform credit ("Data Dividend" in the original brainstorm — start as
simple referral credit, not crypto, to avoid regulatory complexity early).
This is the primary organic growth loop before paid acquisition.

### 1.7 Screens (see [05-native-app-spec.md](05-native-app-spec.md) for full UX detail)

Home (intent box) → Chat/clarify → Results → Compare → Business profile →
Booking/checkout → Order/booking status → Rewards/wallet → Open Requests
feed → Profile/settings → Notifications.

## 2. Business product

### 2.1 Business profile

What they offer, categories, location(s), typical price range, live
availability/capacity, standing offers, and proof (review count/score,
verified transaction count — not vanity follower counts).

### 2.2 Inbound: respond to matched requests

When a user's intent matches a business's profile, the business gets a
notification with the (anonymized/structured, not full personal data)
request and can respond with a tailored offer within a time window. This
is the core "sell to demand, not to an audience" loop.

### 2.3 Outbound (Phase 3+): declare standing inventory/offers

Instead of only reacting per-request, a business can declare standing
offers ("500 coding laptops at ₹55,000") that the Matching Agent
proactively surfaces whenever a matching intent appears — closer to the
original "business agent declares inventory" vision, without requiring
full agent-to-agent autonomy yet.

### 2.4 Dashboard & analytics

Requests received, qualified opportunities, conversions, revenue
attributed, CAC, ROI/ROAS. This dashboard **is** the sales pitch to
businesses — see [08-business-model-gtm.md](08-business-model-gtm.md).
Phase 3+ adds "unfulfilled intent" intelligence (aggregated, privacy-safe
demand signals businesses can act on).

### 2.5 Priority bidding — Phase 4+

When multiple businesses match one request, they can pay a small fee to be
presented first/more prominently. Must be visually distinguished from
organic ranking (labelled "Promoted") to preserve user trust — do not let
this silently override relevance ranking.

## 3. Creator layer — Phase 4+

Businesses can request local creators (matched by audience size, location,
category affinity) for authentic content in exchange for a fee, product, or
both. The platform matches, tracks the resulting content's attributable
traffic/conversions, and takes a commission on the creator payout. This
connects Users ↔ Businesses ↔ Creators into one graph, useful for trust
signal generation (creator-reviewed businesses rank higher).

## 4. Long-term (Phase 5, moonshot): agent-to-agent commerce

A user's personal AI agent holds durable preferences/constraints and can
autonomously negotiate/transact with business agents within
user-authorized limits (e.g., "always find me the cheapest flight under
these constraints, autobook if under ₹15k"). This requires: (a) marketplace
liquidity, (b) a trusted transaction/payment rail already proven at Phase
2-3 scale, and (c) a standardized business-agent protocol. Do not attempt
before Phase 4 is solid — this is explicitly sequenced last in
[07-roadmap-phases.md](07-roadmap-phases.md).

## Feature-to-phase cross-reference

| Feature | Phase |
|---|---|
| Intent box + manual/concierge matching | 1 |
| Business self-serve profile + respond-to-request | 2 |
| Matching Agent v1 (LLM parsing + ranked results) | 2-3 |
| Business dashboard/analytics (ROI story) | 2-3 |
| Open Requests (reverse marketplace) | 3 |
| Standing offers / proactive inventory matching | 3 |
| Rewards/referral loop | 4 |
| Creator layer | 4 |
| Priority bidding | 4 |
| Multi-city / multi-vertical expansion | 4 |
| Agent-to-agent autonomous commerce | 5 |
