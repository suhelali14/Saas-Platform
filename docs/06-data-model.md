# Data Model

Postgres as source of truth for all entities below (see
[10-tech-stack-decisions.md](10-tech-stack-decisions.md)). This is a
conceptual model to guide schema design, not final DDL.

## Core entities

- **User** — consumer account: id, phone/email, city, preferences history,
  reward credit balance, created_at.
- **Business** — id, name, category(ies), locations, verification status,
  rating aggregate, verified-transaction count, subscription tier.
- **IntentRequest** — a single user ask: id, user_id, raw_text,
  structured fields (category, location, budget_min/max, timing,
  preferences[], hard_constraints[]), confidence scores, status
  (open/matched/fulfilled/expired), created_at.
- **IntentMessage** — one turn in an IntentRequest's refinement chat
  (docs/04-multi-agent-design.md "Conversational refinement"):
  intent_request_id, role (user/assistant), content, created_at. The first
  user message is the IntentRequest's own raw_text; every message after
  that is a refinement turn that re-parses with the full thread + the
  previously understood structured fields, merging into rather than
  replacing them.
- **Offer** — a business's response to (or standing offer independent of)
  an IntentRequest: id, business_id, intent_request_id (nullable for
  standing offers), price, description, availability_slots, expires_at.
- **Match** — the Matching Agent's output: intent_request_id, offer_id,
  rank, relevance_score, "why this matches" text, shown_at.
- **Transaction** — id, match_id (nullable if off-platform), user_id,
  business_id, amount, commission_amount, status
  (pending/completed/refunded/disputed), payment_reference.
- **Review** — transaction_id (required — reviews must be tied to a
  verified transaction, see
  [09-trust-safety-risk.md](09-trust-safety-risk.md)), rating, text.
- **RewardLedgerEntry** — user_id, type (referral/redemption), amount,
  related_transaction_id, created_at.
- **FunnelEvent** — one instrumented step in the named funnel (submitted
  → shown → opened → compared → booked, see
  [05-native-app-spec.md](05-native-app-spec.md)): user_id, event_type,
  intent_request_id (nullable), metadata, created_at. `submitted`/`shown`
  are written server-side automatically; `opened` is the one event the
  client fires explicitly. `compared`/`booked` exist in the type but
  aren't written yet — no Compare screen or transaction flow to trigger
  them.
- **OpenRequest** (Phase 3+) — higher-consideration version of
  IntentRequest: id, user_id, structured brief, status, proposals[]
  (each proposal referencing a business_id + Offer-like payload).
- **Creator** (Phase 4+) — id, user_id (creators are also platform users),
  audience metrics, categories, location.
- **CreatorCampaign** (Phase 4+) — business_id, creator_id, brief, fee,
  deliverables, tracked outcome metrics.

## Relationships (summary)

```
User 1---* IntentRequest 1---* Match *---1 Offer *---1 Business
IntentRequest 1---* IntentMessage
User 1---* FunnelEvent
User 1---* Transaction *---1 Business
Transaction 1---1 Review
Transaction 1---1 RewardLedgerEntry (referral credit, if applicable)
User 1---* OpenRequest 1---* Proposal *---1 Business
Business 1---* CreatorCampaign *---1 Creator
```

## Example: `IntentRequest` structured payload

```json
{
  "id": "ir_9f2a...",
  "user_id": "u_123",
  "raw_text": "find me a rooftop restaurant tonight for two, budget 1500, within 5km",
  "category": "restaurant",
  "location": { "lat": 12.935, "lng": 77.614, "radius_km": 5 },
  "budget": { "min": null, "max": 1500, "currency": "INR" },
  "timing": { "type": "today", "time_window": "evening" },
  "hard_constraints": ["party_size:2"],
  "soft_preferences": ["rooftop"],
  "confidence": { "category": 0.97, "location": 0.9, "budget": 0.95, "timing": 0.85 },
  "status": "matched",
  "created_at": "2026-08-23T13:05:00Z"
}
```

## Example: `Offer` payload

```json
{
  "id": "of_88bd...",
  "business_id": "b_456",
  "intent_request_id": "ir_9f2a...",
  "price": 1399,
  "currency": "INR",
  "description": "Rooftop dinner for two, 10% new-customer discount applied",
  "availability_slots": ["2026-08-23T20:30:00Z", "2026-08-23T21:00:00Z"],
  "expires_at": "2026-08-23T23:59:00Z"
}
```

## Phase 2-4 additions: AI/ML layer

Not yet in the Prisma schema — planning reference only, until
[14-mvp-implementation-plan.md](14-mvp-implementation-plan.md)'s relevant
milestone is reached. Full rationale in
[13-ai-cost-optimization-personalization.md](13-ai-cost-optimization-personalization.md).

- **IntentEmbeddingCache** (Phase 2+) — `id`, `embedding` (vector),
  `category`, `budgetBand`, `timingType` (the *structural* pattern being
  cached, never literal numbers), `taxonomyVersion`, `sourceModel`,
  `verified` (bool), `createdAt`.
- **UserProfile** (Phase 3+) — 1:1 with `User`. `categoryAffinity` (json),
  `avgBudgetByCategory` (json), `preferredTiming` (json),
  `priceSensitivity` (float), `updatedAt`.
- **UserTasteVector** (Phase 3+) — 1:1 with `User`. `embedding` (vector),
  `updatedAt`.

All three live in the same pgvector-backed Postgres instance as
`Business`/`Offer` embeddings — one vector store, distinguished by kind,
not three separate systems.

## Notes on privacy-sensitive fields

`IntentRequest.raw_text` and structured fields reveal purchase intent —
treat with the same access-control rigor as financial data (see
[09-trust-safety-risk.md](09-trust-safety-risk.md)): encrypted at rest,
access-logged, never included wholesale in analytics exports without
aggregation/anonymization.
