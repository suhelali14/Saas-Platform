# Glossary & Open Questions

This plan makes several defaults on the user's behalf so planning could
proceed without stalling (per working style: act on reasonable defaults,
flag them for override). Everything below marked **[DEFAULT — CONFIRM OR
OVERRIDE]** should be explicitly revisited before Phase 0 work begins.

## Glossary

- **Intent Request** — a user's structured, parsed expression of a need
  (see [06-data-model.md](06-data-model.md)).
- **Matching Engine** — the system that ranks candidate businesses/offers
  against a structured intent.
- **Open Request** — the "reverse marketplace" feature where businesses
  submit proposals against a user-posted brief (Phase 3+).
- **Standing Offer** — inventory/pricing a business declares proactively,
  independent of any single request (Phase 3+).
- **Data Dividend** — the original brainstorm's term for paying users when
  a business is granted access to pitch them; implemented conservatively
  as platform credit via the referral loop (Phase 4), not crypto (see
  [08-business-model-gtm.md](08-business-model-gtm.md)).
- **Intent → Outcome rate** — the north-star metric; see
  [08-business-model-gtm.md](08-business-model-gtm.md).
- **Wedge** — the deliberately narrow city + vertical starting point; see
  [01-vision-positioning.md](01-vision-positioning.md).

## Open questions / defaults made by this plan

1. **Product name.** [DEFAULT — CONFIRM OR OVERRIDE] Using `Intently`
   throughout as a working codename. Other candidates from the original
   brainstorm: Needly, Wantly, Matchly, Nexa, Veya, DemandX, AskBuy, NeedX.
   Recommend avoiding a generic "AI-something" name — the brand should
   feel like a new category, not another AI SaaS wrapper.

2. **Launch city.** [DEFAULT — CONFIRM OR OVERRIDE] Bengaluru, per the
   original brainstorm's own reasoning (large market, high smartphone/app
   fluency, dense local-services base). Should be confirmed against
   wherever the founder(s) actually have on-the-ground access for
   Phase 0-2's manual/concierge work — that matters more than market size
   at this stage.

3. **Initial verticals.** [DEFAULT — CONFIRM OR OVERRIDE] Restaurants,
   Beauty/Salons, Fitness/Gyms. These were chosen (in the original
   brainstorm) for being high-frequency, low-consideration, easy to
   verify/transact, and easy to manually seed with 15-30 businesses each
   for Phase 1. Alternative worth considering: skip Restaurants (most
   contested category, incumbents already strong there via
   Zomato/Swiggy) and lead with a category with weaker existing digital
   discovery, e.g., local services (AC repair, appliance repair,
   home services) — flagged here as a genuine alternative, not just a
   placeholder, worth a real decision in Phase 0's validation
   conversations.

4. **Team size / budget.** Not specified anywhere in this plan. The
   roadmap timelines in
   [07-roadmap-phases.md](07-roadmap-phases.md) assume a very small
   (1-3 person) team; they compress significantly with more engineers,
   and Phase 0-2's manual/concierge work compresses with a dedicated
   ops/growth person separate from engineering.

5. **In-app payments timing (Phase 1 vs Phase 2).** Recommended default:
   defer to Phase 2 (track "contacted business" as the Phase 1 conversion
   event) to avoid taking on payment-aggregator integration and PA/PG
   compliance overhead before the core matching loop is validated. Revisit
   if a category (e.g., appointment booking with deposit) genuinely needs
   payment earlier.

6. **Funding/legal structure.** Out of scope for this technical/product
   plan — flagged only because Phase 0 lists "legal entity setup" as a
   deliverable; the user owns this decision entirely.

## How to use this file going forward

When any of the above is decided, update this file directly (mark it
`[CONFIRMED]` instead of `[DEFAULT]`) and propagate the change to any
other doc that referenced the default (e.g., city name appears in docs 07
and 08). This file is the single place to check "what's still an open
decision" without re-reading everything.
