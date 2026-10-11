# Trust, Safety & Risk

## Why this matters more than usual here

The core promise ("we'll match you with a real, honest offer") fails
completely if fake businesses, fake reviews, or fake offers get through —
worse than a normal marketplace, because users are trusting the platform's
*judgment*, not just browsing a listing themselves. Trust is the product,
not a feature bolted onto it.

## Fraud/abuse surfaces and mitigations

| Surface | Risk | Mitigation |
|---|---|---|
| Business signup | Fake/non-existent businesses | KYC-lite verification (business registration/GST where applicable, phone verification) before a business can respond to live requests |
| Offers | Bait offers that don't honor the stated price/availability | Track fulfillment rate per business; auto-flag businesses whose offers frequently don't convert or get disputed; surfaced in ranking (unreliable businesses rank lower even if cheap) |
| Reviews | Fabricated/incentivized reviews | Reviews only allowed tied to a verified `Transaction` (see [06-data-model.md](06-data-model.md)) — no review without a real completed transaction |
| Requests | Spam/bot-generated intent requests polluting business notifications | Rate-limit per user/device, Trust & Fraud Agent risk-scores new requests asynchronously (see [04-multi-agent-design.md](04-multi-agent-design.md)) |
| Referral loop (Phase 4) | Self-referral / credit farming | Cap credits per user/period, require the referred user's transaction to be genuinely new (not the same household/payment method) |
| Priority bidding (Phase 4) | Pay-to-win eroding trust in "relevant results" | Structurally isolated so bids can never override hard-constraint match (enforced in code, not policy) |

## Privacy

- **Intent data is sensitive.** It reveals what a person wants to buy,
  when, and at what budget — arguably more revealing than typical browsing
  history. Treat it with financial-data-grade access control: encrypted at
  rest, access-logged, least-privilege service boundaries (per
  [03-architecture-overview.md](03-architecture-overview.md)).
- Aggregated market-intelligence products (sold to businesses per
  [08-business-model-gtm.md](08-business-model-gtm.md)) must be built from
  anonymized, aggregated data only — never expose an individual's
  request history to a business, even indirectly (e.g., k-anonymity
  thresholds before a demand-trend stat is shown).
- Users need visibility and control: request history, and the ability to
  delete/export their data (see
  [05-native-app-spec.md](05-native-app-spec.md) Profile/Settings).

## Persistent user profile privacy

[06-data-model.md](06-data-model.md)'s `UserProfile` and `UserTasteVector`
(Phase 3+, full design in
[13-ai-cost-optimization-personalization.md](13-ai-cost-optimization-personalization.md))
are a step beyond single-request intent data: a durable,
cross-session psychographic/purchase profile. That needs its own explicit
handling, not just an extension of the intent-data rule above:

- **Opt-in and disclosed**, not silently on by default — a user should
  know this profile exists and why.
- **Explainable**, not a black box — when it influences a result (per the
  "recommended because you often book rooftop restaurants" pattern in
  doc 13), say so in the UI. Same principle as doc 05's "never show a
  black-box result," extended to recommendations.
- **Independently deletable** from request history — deleting the profile
  must not require deleting past transactions/requests, and vice versa.
- **Never exposed at the individual level** in the market-intelligence
  product ([08-business-model-gtm.md](08-business-model-gtm.md)) —
  aggregated/clustered only, same k-anonymity bar as raw intent data.

## Regulatory/compliance (India-first launch, per doc 11 default)

- **DPDP Act 2023 (India's data protection law):** consent-based
  collection, purpose limitation, breach notification — build data
  handling to this standard from Phase 1, not retrofitted later.
- **Payments:** in-app payment handling must go through an RBI-licensed
  Payment Aggregator (e.g., Razorpay, Cashfree) — never build custom
  payment/settlement infrastructure or hold customer funds directly;
  that requires licensing the company almost certainly does not have.
- **Marketplace liability:** clarify in Terms of Service that the
  platform facilitates matching/transactions but the underlying
  goods/services are the business's responsibility — standard marketplace
  liability shielding, done properly with actual legal review before
  Phase 2 launch (real money moving).
- **GST/tax on commission revenue:** standard business compliance, flag
  for the company's accountant/legal counsel before Phase 2.
- If/when expanding beyond India, GDPR (EU) or other local regimes apply —
  not a Phase 0-4 concern given the India-first default, but worth noting
  before any international expansion decision.

## Dispute resolution

- Every `Transaction` has a status field including `disputed` (see doc
  06). Build a lightweight resolution flow early (Phase 2): user/business
  can flag an issue, ops reviews, refund/credit issued via the payment
  aggregator's refund API.
- Track dispute rate per business as a trust signal feeding ranking (a
  business with a high dispute rate should surface less, automatically).

## Operational risk

- **LLM hallucination risk** is mitigated structurally per the guardrails
  in [04-multi-agent-design.md](04-multi-agent-design.md) (never let the
  agent invent business facts — always tool-call the real data).
- **Cost risk**: LLM API spend must be budgeted and monitored per request
  and in aggregate from day one — a viral spike in low-value/spam requests
  could otherwise create runaway cost before revenue exists to cover it
  (rate limiting doubles as a cost control, not just an abuse control).
- **Single-city concentration risk** during Phases 0-3 is intentional
  (see roadmap) but means a local regulatory or market shock has outsized
  impact — acceptable trade-off for achieving liquidity, revisit at Phase
  4 multi-city expansion.
