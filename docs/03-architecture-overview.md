# System Architecture Overview

## Guiding principle

Build a **modular monolith** for Phases 1-2, not microservices. The team is
small, the domain is still being discovered, and premature service
boundaries are expensive to get wrong. Split into services only where a
component has genuinely different scaling/latency needs (the LLM/agent
layer, notifications) — see [10-tech-stack-decisions.md](10-tech-stack-decisions.md).

## High-level component map

```
                         +----------------------+
                         |   Native Consumer     |
                         |   App (iOS/Android)   |
                         +-----------+-----------+
                                     |
                                     v
+--------------------+     +--------------------+     +----------------------+
|  Business Portal   | <-- |    API Gateway /    | --> |  Admin / Ops Console |
|  (web, Next.js)    |     |    BFF layer         |     |  (internal)          |
+--------------------+     +----------+-----------+     +----------------------+
                                      |
        +----------------+-----------+-----------+------------------+
        v                v                       v                  v
+---------------+ +---------------+     +------------------+ +----------------+
| Intent Service | | Matching      |     | Business/         | | Transaction &  |
| (LLM parsing)  | | Engine        | <-> | Inventory Service  | | Payments Svc   |
+-------+--------+ +-------+-------+     +---------+----------+ +--------+-------+
        |                  |                       |                    |
        v                  v                       v                    v
+---------------+ +----------------+     +------------------+ +----------------+
| Vector Search /| | Ranking &      |     | Postgres           | | Payment        |
| Embeddings     | | Feedback Store |     | (source of truth)  | | Aggregator     |
| (pgvector)     | |                |     |                    | | (Razorpay etc.)|
+---------------+ +----------------+     +------------------+ +----------------+

        Cross-cutting: Notification Service | Trust & Safety Service |
        Analytics/BI Service | Agent Orchestration Layer (see doc 04)
```

## Component responsibilities

**API Gateway / BFF** — single entry point for the native app and web
portal; auth, rate limiting, request routing to internal services.

**Intent Service** — takes raw user text (or voice transcript), calls the
LLM to produce a structured `IntentRequest` object (see
[06-data-model.md](06-data-model.md)), asks clarifying questions when
confidence is low, and persists the structured intent.

**Matching Engine** — given a structured intent, retrieves candidate
businesses (vector similarity search over business/offer embeddings +
hard-constraint filtering: location radius, budget, availability), then
ranks candidates using a scoring function that blends relevance, price
fit, distance, historical conversion rate, and rating. Returns top-N.

**Business/Inventory Service** — CRUD for business profiles, offers,
availability/capacity, standing inventory declarations.

**Transaction & Payments Service** — booking/order creation, payment
capture via a payment aggregator, commission calculation and payout
scheduling to businesses, refund/dispute handling.

**Notification Service** — push (native app), SMS/WhatsApp, email; used
for match alerts to businesses (time-sensitive — a business that responds
in 5 minutes vs 2 hours materially changes conversion) and status updates
to users.

**Trust & Safety Service** — business verification/KYC status, review
authenticity checks, fraud/spam scoring on both requests and offers, abuse
reporting. See [09-trust-safety-risk.md](09-trust-safety-risk.md).

**Analytics/BI Service** — powers the business dashboard (requests →
conversions → revenue → ROI) and, later, the "unfulfilled intent"
aggregate-demand product sold to businesses.

**Agent Orchestration Layer** — the multi-agent middleware itself; see
[04-multi-agent-design.md](04-multi-agent-design.md) for full detail. It
sits "above" Intent Service and Matching Engine, calling them as tools.

## Request lifecycle (end-to-end trace)

1. User types/speaks an intent in the native app.
2. App sends raw text to Intent Service via API Gateway.
3. Intent Service (via Agent Orchestration Layer) calls the LLM with
   function-calling tools to produce a structured `IntentRequest`; if
   confidence is low on a required field, the agent asks one clarifying
   question instead of guessing.
4. Structured intent is persisted and handed to the Matching Engine.
5. Matching Engine retrieves candidate businesses (vector search +
   filters), scores/ranks them, returns top-N with computed fit reasons.
6. Results shown to user; simultaneously, matched businesses are notified
   of a new (anonymized) opportunity with a response window.
7. Business responds with a specific offer (or the standing offer is
   auto-attached if no per-request response needed).
8. User compares, selects one, and either completes payment/booking in-app
   (Transaction Service) or is routed to the business with a tracked
   referral (for categories not yet supporting in-app checkout).
9. Outcome (converted / not converted, amount, satisfaction) is written
   back to the Ranking & Feedback Store — this is the training signal that
   improves future matching quality (the flywheel from doc 01).
10. Commission is calculated and settled per
    [08-business-model-gtm.md](08-business-model-gtm.md).

## Scaling considerations (apply from Phase 3 onward, not Phase 1)

- **LLM calls are the latency-sensitive, cost-sensitive hot path.** Cache
  aggressively (identical/similar intents), use smaller/faster models for
  simple parsing and reserve larger models for ambiguous requests, and set
  hard token/cost budgets per request.
- **Vector search** should move to a dedicated store (see
  [10-tech-stack-decisions.md](10-tech-stack-decisions.md)) once business
  count and query volume outgrow pgvector's comfortable range — not before.
- **Geographic sharding**: once multi-city, most queries are naturally
  scoped to a metro area — partition matching indexes by city to keep
  candidate sets small and relevant.
- **Read-heavy business directory data** benefits from a cache layer
  (Redis) in front of Postgres once traffic grows past Phase 2.

## Environments & delivery

Three environments minimum: `dev`, `staging`, `prod`. CI runs tests + type
checks on every PR; deploys to staging automatically on merge to main;
manual promote to prod. Feature-flag risky new matching logic so ranking
changes can be A/B tested without a full deploy cycle (this matters a lot
here because ranking quality *is* the product).

## Security baseline (from day one, not deferred)

- All PII (phone, address, payment details) encrypted at rest.
- Intent data is sensitive by nature (reveals what someone wants to buy,
  when, at what budget) — treat with the same care as financial data, not
  as generic analytics data. See
  [09-trust-safety-risk.md](09-trust-safety-risk.md).
- Principle of least privilege between services; business portal must
  never be able to query another business's raw customer data.
- Payment handling delegated entirely to a licensed payment aggregator —
  never store raw card/UPI credentials.
