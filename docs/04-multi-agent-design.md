# Multi-Agent Design (the AI layer)

## Why multi-agent instead of one big prompt

Each responsibility below has a different job, different tools, different
failure mode, and needs to be independently testable/improvable. A single
mega-prompt handling parsing + ranking + fraud detection + negotiation
degrades badly as scope grows and is impossible to evaluate piece by piece.
Splitting by responsibility lets each agent have a narrow, testable
contract (structured input → structured output), which matters enormously
for reliability in a product where a bad parse or a bad match directly
loses money for a business.

## Agent roster

### 1. Intent Understanding Agent (consumer-facing)

- **Input:** raw user text/voice + conversation history.
- **Output:** structured `IntentRequest` (see
  [06-data-model.md](06-data-model.md)) + a confidence score per field.
- **Behavior:** if a required field (category, location) is missing or
  low-confidence, ask exactly one targeted clarifying question — never
  guess silently on things that change the outcome (budget, timing).
- **Tools it can call:** `geocode_location`, `resolve_category`
  (maps free text to the platform's category taxonomy),
  `get_user_past_preferences` (for personalization once available).

### 1a. Conversational refinement (built, v0)

Every `IntentRequest` created in the app is a chat thread the user can keep
talking in from the Activity screen, not a one-shot form submit — matching
docs/05-native-app-spec.md's Activity tab and the underlying
`IntentMessage` model in docs/06-data-model.md.

- **Turn flow:** the first user message creates the `IntentRequest` +
  produces the first assistant reply. Each subsequent message is a
  refinement: it's appended to the thread, the full conversation +
  the previously understood structured state (category, budget, timing,
  constraints) is sent back to the Intent Understanding Agent, matches are
  recomputed against the refined state, and a new deterministic assistant
  reply is posted.
- **Merge, don't reset:** the system prompt instructs the model to carry
  forward any field the latest message doesn't address and only update
  the fields it actually refines — "under 1500 instead" updates
  `budgetMax` alone and leaves `category` untouched, even though the reply
  never repeats "gym." The same carry-forward rule applies to the
  heuristic fallback, so a transient provider outage mid-conversation
  doesn't silently wipe fields the user already established.
- **Assistant replies are deterministic, not LLM-generated** — templated
  from the diff between the previous and newly parsed state (see doc 13's
  cost-consciousness: no extra model round-trip just to say "got it").
  When the agent needs a clarification, that clarifying question *is* the
  assistant's chat reply — there's no separate clarification UI.
- **Persistence:** `IntentMessage` rows (`USER`/`ASSISTANT`, one thread per
  `IntentRequest`); each refinement turn deletes and recreates that
  request's `Match` rows so the match list always reflects the latest
  understood state, and updates the user's taste profile
  (docs/13-ai-cost-optimization-personalization.md Part 2A) again.
- **Endpoints:** `POST /api/intent-requests` (first turn),
  `POST /api/intent-requests/:id/messages` (refinement turn), both
  returning the full thread + current matches; `GET /api/intent-requests/:id`
  returns the same shape for re-opening a past Activity session.
- **Not yet built:** the Matching/Ranking Agent below is still the v0
  filter-and-score matcher, not vector search — refinement re-runs that
  same v0 matcher on every turn, it doesn't change what the matcher itself
  can express.

### 2. Matching / Ranking Agent

- **Input:** structured `IntentRequest`.
- **Output:** ranked list of candidate businesses/offers with a short
  human-readable "why this matches" reason per result (transparency
  matters for trust).
- **Tools it can call:** `vector_search_businesses`, `check_availability`,
  `get_business_conversion_history`, `get_active_offers`.
- **Ranking inputs blended:** semantic relevance, hard-constraint fit
  (budget/location/timing), historical conversion rate for similar
  intents, rating/trust score, and (Phase 4+) promoted-placement bids —
  bids must never override a hard constraint mismatch (do not show a
  ₹5,000 gym as a match for a ₹2,000 budget just because it paid to be
  promoted).

### 3. Business Response Assistant (business-facing, optional convenience)

- Helps a small business owner draft a competitive offer/response quickly
  (e.g., suggests a price based on comparable successful offers in the
  category). This is an assistive tool, not autonomous — the business
  always approves before it's sent. Reduces friction for the supply side,
  which is usually the harder side to activate in a marketplace.

### 4. Trust & Fraud Agent

- **Input:** new business signups, new offers, requests, and reviews.
- **Output:** a risk score + flags (e.g., "offer price implausibly low,"
  "review pattern looks fabricated," "duplicate/spam request").
- Runs asynchronously, does not block the core matching loop, escalates
  high-risk items to human review. See
  [09-trust-safety-risk.md](09-trust-safety-risk.md).

### 5. Analytics/Insight Agent (business-facing, Phase 3+)

- Summarizes a business's dashboard data into plain language
  ("Your conversion rate on 'budget gym' requests dropped 15% this week
  because two competitors added a lower-priced plan") and produces the
  aggregated "unfulfilled intent" market-intelligence product.

### 6. Negotiation/Autonomous Agent (Phase 5 moonshot — not built early)

- The eventual "user's personal agent talks to business's agent" layer.
  Explicitly deferred; see [02-product-spec.md](02-product-spec.md) §4 and
  [07-roadmap-phases.md](07-roadmap-phases.md) Phase 5 for preconditions.

## Tiered inference (cost control)

Not every request should reach this section's agents via a full model
call. A semantic cache sits in front of the Intent Understanding Agent:
incoming text is embedded and checked against previously-verified parses
in pgvector before paying for a model call at all, with a cheaper model
tier for medium-confidence matches and the full agent reserved for novel
or ambiguous requests. This is what keeps cost-per-request falling as
volume rises instead of scaling linearly with it. Full design, the
cache-hit/miss decision logic, and the user taste vector that also lives
in this same vector store: see
[13-ai-cost-optimization-personalization.md](13-ai-cost-optimization-personalization.md).
The Ranking Agent's blended signals (below) include the user taste vector
from that doc once it exists (Phase 3+).

## Orchestration pattern

Use a **tool-calling / function-calling** pattern (not free-form chained
prompts): each agent is an LLM call constrained to a strict output schema,
with a fixed set of callable tools (typed functions backed by the services
in [03-architecture-overview.md](03-architecture-overview.md)). This is the
same pattern the Claude Agent SDK / Claude API tool-use is built around —
practically, that means each agent's "tools" map directly to internal API
endpoints (`search_businesses`, `get_offers`, `check_availability`,
`place_booking`, `geocode_location`, etc.), and the LLM's role is
narrowly: understand language, decide which tool to call with what
arguments, and produce structured output — not to freelance business
logic.

```
User text
   |
   v
[Intent Understanding Agent] --tools--> geocode, resolve_category
   |  (structured IntentRequest, confidence scores)
   v
[Matching/Ranking Agent] --tools--> vector_search, check_availability,
   |                                  get_conversion_history
   |  (ranked candidates + reasons)
   v
Results shown to user  ---->  outcome recorded  ---->  feedback store
                                                              |
                                                              v
                                        improves future ranking (offline
                                        retraining / prompt+heuristic tuning)
```

## Guardrails (non-negotiable from day one)

1. **Never let the LLM invent business data.** All facts shown to a user
   (price, availability, address) must come from a tool call against the
   real database — the LLM composes/explains, it does not hallucinate
   inventory.
2. **Structured output validation.** Every agent output is validated
   against a schema before use; invalid output triggers a retry or falls
   back to a simpler deterministic path (e.g., plain filter search) rather
   than showing a broken result.
3. **Confidence-gated clarification**, not silent guessing, on any field
   that changes money or timing.
4. **Full auditability.** Log the structured input/output and tool calls
   for every agent invocation (not raw chain-of-thought) — needed for
   debugging bad matches and for the Trust & Safety review process.
5. **Cost/latency budget per request**, enforced in code, so a pathological
   query can't spiral into excessive LLM spend.
6. **Promoted placement is transparently labeled** and structurally
   forbidden from overriding hard constraints (see Matching Agent above).

## Evaluation loop

Every completed request produces a labeled example: (intent, candidates
shown, candidate chosen or none, outcome). This is the dataset used to:
- Tune the ranking function's weights.
- Build a golden eval set for the Intent Understanding Agent (does it parse
  correctly against known-good structured intents?) that runs in CI before
  any prompt or model change ships.
- Eventually justify the "Business ROI" dashboard numbers with real,
  audited conversion data.

## Model/provider choice

Default to Claude via the Anthropic API for the reasoning/parsing agents
(quality on structured extraction and tool-use, and this plan's author has
direct familiarity with the Claude Agent SDK's multi-agent patterns — reuse
that experience rather than re-deriving an orchestration framework from
scratch). See [10-tech-stack-decisions.md](10-tech-stack-decisions.md) for
the concrete model-tier recommendation (cheap/fast model for routine
parsing, escalate to a stronger model only for ambiguous requests) and
cost-control detail.

The Intent Understanding Agent's model backend is not hardcoded to one
vendor: Gemini is wired in as a second, equally-real implementation of the
same provider contract (`AiProvider` in `apps/api/src/services/ai/`), not
a stub — see doc 10's "Multi-provider AI layer" for the architecture and
why. Every other agent in the roster above is still Claude-only for now;
extend the same pattern if/when one of them needs the same resilience.
