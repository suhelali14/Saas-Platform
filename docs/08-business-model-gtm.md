# Business Model & Go-To-Market

## North-star metric

**Intent → Outcome rate**: of all structured intent requests submitted,
what percentage result in a real, verified transaction. This is tracked
above DAU, downloads, time-in-app, or impressions — none of those indicate
whether the core promise ("we'll find you what you actually need") is
being kept. Track the full funnel:

```
Requests submitted -> Matched -> Offers shown -> Business responded ->
User engaged (compared/asked questions) -> Converted (transaction)
```

## Secondary metric: Business ROI

The dashboard number that sells the platform to businesses:

```
Campaign/period spend (commission paid) -> customers acquired ->
revenue generated -> CAC -> ROAS
```

This must be real, auditable data (tied to `Transaction` records, not
self-reported) — the entire pitch to businesses ("pay for outcomes, not
impressions") collapses if this number isn't trustworthy.

## Monetization (in priority order)

1. **Transaction commission (primary, long-term core)** — a percentage
   (e.g., 2-5%, calibrate per category — high-margin categories like
   services can bear more than low-margin retail) taken only when a
   `Transaction` completes. This is the model that structurally cannot be
   copied by an incumbent without cannibalizing their ad revenue (see doc
   01), so it should carry most of the revenue weight as soon as volume
   supports it.
2. **Qualified-lead fee** — for categories where the transaction itself
   doesn't happen on-platform (e.g., home renovation, high-ticket
   services), charge a flat fee (₹50-500, category-dependent) per
   verified qualified lead delivered.
3. **Business subscription (SaaS tier)** — free tier covers basic profile
   + leads; a paid tier (₹999-2,999/month) unlocks advanced analytics,
   the unfulfilled-intent market-intelligence product, CRM features, and
   creator-matching access. Do not gate core marketplace participation
   behind a subscription — that would recreate the "pay to be seen"
   dynamic this platform exists to avoid.
4. **Priority/promoted placement (Phase 4+)** — a bidding mechanism for
   position among already-relevant results, never a way to appear when
   not relevant (guardrail detailed in
   [04-multi-agent-design.md](04-multi-agent-design.md)).
5. **Creator marketplace commission (Phase 4+)** — a cut of the
   business-to-creator campaign fee.
6. **Aggregated market intelligence (Phase 3+)** — sold as part of the
   subscription tier or standalone; must be aggregated/anonymized, never
   expose individual user intent (see
   [09-trust-safety-risk.md](09-trust-safety-risk.md)).

## Go-to-market sequencing

### Demand side (users)

- Launch with a genuinely useful single-player feature (Phase 1, see
  roadmap) so users show up before any business does.
- Organic/local channels first: hyperlocal social groups, city subreddits,
  WhatsApp community groups, campus/office-park targeting for the initial
  categories — not paid broad-reach ads (ironic, and also just not
  cost-effective pre-liquidity).
- Referral loop (Phase 4) as the primary scaled growth channel once the
  core loop is proven: sharing a good matched deal earns credit when the
  recipient transacts.

### Supply side (businesses)

- **Manual, concierge-style recruitment for the first 50-100 businesses**
  per category/city — this cannot be automated early and should not be
  outsourced; direct founder-led sales teaches what businesses actually
  need to see to trust the platform.
- The pitch is always outcome-based and backed by real Phase 1 usage
  data: "N people this week asked for exactly what you sell — here's
  proof."
- Zero cost to join, revenue only on outcomes — removes the adoption
  barrier that a subscription-first pitch would create.
- Once ~50-100 businesses per category are active and the automated
  Matching Engine (Phase 2) is live, supply-side growth can shift to
  self-serve signup driven by the demand-side pull (businesses hear about
  it from customers asking "do you take payment through Intently").

## The chicken-and-egg sequencing (explicit)

```
Phase 0: validate demand + supply pain exist, in one city/vertical set
Phase 1: ship single-player utility -> users show up with zero businesses
Phase 2: use aggregated demand as the sales pitch -> manually recruit
         first businesses -> automate matching once both sides exist
Phase 3-4: reverse marketplace, standing offers, referral loop, creators
           -> network effects compound
```

Never attempt to launch both sides simultaneously at broad scale — this is
the single most common way two-sided marketplace startups die.

## Unit economics: how the AI layer funds user incentives

This is the mechanism, not just an assertion of "win-win." Semantic
caching ([13-ai-cost-optimization-personalization.md](13-ai-cost-optimization-personalization.md))
means cost-per-request trends **down** as volume trends **up** — the
opposite of naive linear LLM-cost scaling — which directly improves gross
margin on the transaction-commission model above. Personalization
(same doc, Part 2) improves the Intent → Outcome rate and likely average
order value, the two metrics this doc already names as the ones to
obsess over, which increases commission revenue per active user.

The margin improvement from lower AI cost is what funds the
referral-credit / Data Dividend budget without cutting into the
commission take-rate — efficiency pays for the user incentive, it isn't
a separate cost competing with it. Worth stating plainly in any investor
or planning conversation: this is why the AI/ML investment isn't just a
cost center, it's the thing that makes the user-facing economics work.

## Competitive moat recap (see doc 01 for full detail)

Not the LLM. The moat is: structured intent data + transaction-verified
outcomes + unfulfilled-demand intelligence, compounding through the
flywheel, in a business-model shape (pay-for-outcome) that incumbents
cannot adopt without damaging their existing ad-auction revenue.
