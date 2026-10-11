# Vision & Positioning

## The problem, precisely stated

**Businesses** pay for probability. A ₹50,000 campaign buys impressions and
clicks; whether any of it becomes revenue is a guess evaluated after the
money is spent. Customer Acquisition Cost keeps rising because the entire
model is "pay to be seen," not "pay for a result."

**Users** are interrupted by things they didn't ask for, tracked to make the
interruption slightly less random, and still have to do their own research to
compare price, quality, and trust before buying anything.

Both sides are optimizing around the same broken primitive: **advertising
targets audiences; it does not fulfill intent.**

## The reversal

Traditional model:
```
Business -> creates ad -> platform interrupts user -> hopes user cares
```

Intently's model:
```
User expresses a need -> AI structures the need -> businesses compete to
fulfill it -> user chooses -> transaction happens -> business pays for the
outcome, not the impression
```

This is not a better ad unit. It is a different object: an **intent
request**, structurally similar to an RFQ (request for quote), but
consumer-facing, real-time, and conversational.

## Positioning statement

> Intently is the place where demand meets supply directly. Users say what
> they need in plain language; local businesses respond with real,
> comparable offers; nothing gets paid for until something real happens.

Alternate framing for the brand/philosophy: **"Advertising ends when intent
begins."**

Do not position this internally or externally as:
- "an AI ad platform" — everyone will say they have AI; it is not a moat
- "a better Facebook/Google Ads" — a fight against unlimited capital
- "a social app" — distribution game the incumbents already won

## Why the incumbents can't easily copy this

Google, Meta, TikTok, and Amazon are all built around **attention →
targeting → interruption**. Their entire ad-auction business model, ranking
systems, and organizational incentives are built on maximizing impressions
and engagement, monetized by advertisers bidding for attention. Pivoting to
"we only get paid when a real transaction happens, and we suppress
irrelevant impressions" cannibalizes their existing revenue engine. This is
a classic incumbent's-dilemma gap — the same reason Google is only
cautiously adding conversational/agentic commerce, not rebuilding search ads
around it.

That gap is the opportunity window, not permanent immunity. It closes as
agentic commerce becomes mainstream (see Sources referenced in the original
brainstorm: McKinsey's "agentic advertising economy," Google's 2026
conversational-commerce direction). The company must reach marketplace
liquidity in a defensible niche before the giants bolt on a similar feature.

## The moat (what actually compounds)

Not the LLM — every competitor has access to comparable models. The moat is
the **flywheel data + liquidity**, specifically:

```
More users -> more intent signals -> more attractive to businesses
More businesses -> better match quality & selection -> more users satisfied
More transactions -> better ranking/matching model -> higher conversion
Higher conversion -> stronger business ROI story -> more businesses join
```

Three data assets nobody else has once this runs for a while:
1. **Structured intent data** — what people actually want, in their own
   words, at the moment they want it (categorically different from Meta's
   inferred interest graph).
2. **Transaction-verified outcomes** — which offers actually convert, at
   what price, for whom — this trains a matching/ranking system incumbents
   cannot buy.
3. **Unfulfilled-demand data** — requests nobody could satisfy — sellable
   market intelligence ("10,000 people asked for X this week, nobody sells
   it").

## Non-goals (explicitly out of scope, to avoid scope creep)

- Do **not** build a general ad-serving/bidding platform.
- Do **not** try to launch multi-city, multi-vertical, or global on day one.
- Do **not** build the "personal AI agent negotiates autonomously with a
  business AI agent" version first — that is the Phase 5 moonshot, not the
  MVP. It requires liquidity and trust the company will not have on day one.
- Do **not** monetize via impressions, clicks, or attention. Every revenue
  line ties to a verified outcome (see
  [08-business-model-gtm.md](08-business-model-gtm.md)).
- Do **not** build a broad social/content feed. Discovery happens through
  intent, not scroll.

## The strategic wedge (how a startup with no distribution wins a first foothold)

Single city, single behavior, 3–5 categories. See
[07-roadmap-phases.md](07-roadmap-phases.md) Phase 0/1 for the concrete plan,
and [11-glossary-open-questions.md](11-glossary-open-questions.md) for the
default city/vertical choice this plan makes (confirm or override).

The wedge only works if Phase 1 is a **single-player utility** — something
useful to a user even with zero businesses on the platform (e.g., local
price/offer discovery). That removes the chicken-and-egg blocker: users show
up for the utility, and their aggregated intent becomes the pitch used to
manually recruit the first businesses.
