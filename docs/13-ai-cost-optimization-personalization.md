# AI Cost Optimization & Personalization

## Why this doc exists

Two asks that turn out to be one system: (1) cut the per-request cost of
the AI layer as volume grows, and (2) build a durable, evolving profile of
what each user actually wants, to power real personalization. Both run
through the same piece of infrastructure — the vector database already
decided in [10-tech-stack-decisions.md](10-tech-stack-decisions.md)
(pgvector) — so this is one system, not two.

Short answer to "can we do this": yes, and it doesn't require abandoning
Claude — it requires using Claude only where it earns its cost, and
building cheap infrastructure to handle everything else. Below is exactly
how, and in what order.

## Part 1 — Cutting AI cost: tiered inference over a semantic cache

### The core idea

Right now (per [04-multi-agent-design.md](04-multi-agent-design.md)),
every intent request either hits the heuristic placeholder parser or,
once wired up, calls Claude directly. That means cost scales linearly
with request volume forever — the more successful the product is, the
more it costs per unit of success. That's backwards. It should get
**cheaper per request** as the product matures, because most requests are
variations on things the system has already seen and correctly
understood before.

The fix is a **semantic cache**: before paying for a full model call,
check whether a sufficiently similar request has already been parsed
correctly, and if so, reuse that answer instead of asking the model
again.

### The pipeline

```
Raw text in
   |
   v
[1] Embed the text (cheap embedding call -- roughly one to two orders of
    magnitude cheaper per call than a Claude generation call; not a
    precise figure, check the claude-api skill for current pricing to
    model this against your own volume)
   |
   v
[2] Vector search pgvector for the nearest previously-CACHED,
    VERIFIED-correct intent parses (cosine similarity)
   |
   v
   high similarity (e.g. > 0.93 -- tune empirically once real
   data exists) AND structural agreement across neighbors?
   |                                                    |
  yes                                                   no
   |                                                     |
   v                                                     v
[3a] CACHE HIT                          medium similarity (0.80-0.93)?
  Reuse the cached STRUCTURAL parse       |                        |
  (category, timing pattern, etc).       yes                       no
  Extract request-specific literals       |                        |
  (exact budget number, exact             v                        v
  location) from the CURRENT text  [3b] CHEAP MODEL TIER   [3c] FULL MODEL TIER
  via cheap regex -- never copy      (e.g. Haiku) parses     (per doc 04:
  literals from the cache. Skip      the request              tool-calling,
  the model call entirely.                                    confidence-gated
                                                                clarification)
   |                                        |                        |
   +----------------------------------------+------------------------+
                                 |
                                 v
              [4] If the final structured intent is verified correct
              (user didn't edit the chips, or it led to a match/
              transaction), write (embedding, structural parse,
              verified=true) back into the cache.
```

Step 4 is what makes this compound: every real request that gets
correctly understood makes the *next* similar request cheaper. Same
flywheel described in [01-vision-positioning.md](01-vision-positioning.md),
applied to infrastructure cost instead of just matching quality.

### Structural vs. literal — why the split matters

The cache should never let a cached match silently overwrite what a
specific user actually typed. Two requests can share the same *pattern*
("find me a rooftop restaurant tonight for two, budget X") while having
completely different literals (X = 1,500 vs. X = 3,000). What gets
cached and reused is the **structure** — which fields exist, what
category, what timing pattern, what preference tags apply — never the
specific numbers or place names, which always come from cheap,
deterministic extraction run on the actual current text. Same guardrail
as doc 04's "never let the LLM invent business data," extended: never let
the cache invent request-specific facts either.

### Why "our own AI/ML layer" doesn't mean dropping Claude

Be precise about what gets built and in what order — "build our own
model" can quietly turn into a multi-quarter research project if scoped
wrong:

1. **Now (Phase 1-2): heuristic fast path** (already built) **+ semantic
   cache** (this doc). Zero training required. Works from the first day
   the cache has any entries in it.
2. **Phase 3-4: distillation.** Once the verified-parse dataset (the same
   one doc 04's evaluation loop already accumulates) has real volume,
   train a small, cheap classifier/extractor on it — this is what "our
   own AI/ML layer" means in practice. It handles the routine,
   high-frequency long tail. Claude stays in the loop as: (a) the
   fallback for genuinely novel or ambiguous phrasing, and (b) the
   periodic "teacher" that re-labels a fresh sample to retrain the small
   model as language patterns drift.
3. **Never: full replacement.** A platform whose entire value proposition
   is understanding open-ended human language shouldn't bet its core
   capability on a small model with no fallback. Target state is "Claude
   handles the hard 10-20%, the cheap layer handles the easy 80-90%" —
   not "no more Claude."

### The vector DB question, answered

This doesn't need a new system. [10-tech-stack-decisions.md](10-tech-stack-decisions.md)
already chose pgvector on the existing Postgres instance for Phase 1-3,
specifically so business/offer matching embeddings wouldn't require
standing up separate infrastructure. This doc extends that same instance
to also hold intent-cache embeddings and user taste vectors (Part 2,
below) — **one vector store, three embedding types**, distinguished by a
`kind` column and separate similarity indexes. The existing "revisit
trigger" (move to a dedicated vector DB once pgvector's latency/index
size becomes a real bottleneck) still applies, now informed by combined
volume across all three uses.

### Operational guardrails

- **Cold start is expected, not a bug.** Day one, the cache is empty and
  everything falls through to the full model (or today's heuristic).
  Coverage grows with usage — don't expect savings before there's a few
  weeks of real Phase 1-2 traffic.
- **Cache staleness.** Tag cache entries with the taxonomy/category-list
  version and the model version that produced them; when the category
  taxonomy changes (new verticals, per
  [07-roadmap-phases.md](07-roadmap-phases.md) Phase 3-4 expansion),
  invalidate or deprioritize entries tagged with the old version rather
  than letting the cache quietly serve outdated structure.
- **Similarity thresholds are starting points, not constants.**
  0.93/0.80 above are reasonable defaults to launch with — tune them
  against real precision/recall once there's a labeled sample (does a
  "cache hit" actually match what the full model would have said?).
- **Cost/latency budget per request** (already a guardrail in doc 04) now
  includes the embedding call — trivial in practice since embedding calls
  are cheap and fast, but still counted, not assumed free.

## Part 2 — The user behavior matrix (personalization)

### Two representations, not one

"A matrix per user" is the right instinct, and it splits cleanly into two
complementary pieces — build both, they serve different purposes.

**A. Structured profile** (literally a row of features per user —
interpretable, cheap, no ML required):

| Field | What it captures | Updated on |
|---|---|---|
| `categoryAffinity` | Weighted counts per category (e.g. `{restaurant: 12, gym: 3}`) | Every intent request (small weight), every completed transaction (larger weight) |
| `avgBudgetByCategory` | Running average budget per category | Every intent request with a detected budget |
| `preferredTiming` | Counts of timing patterns (evening, weekend, ...) | Every intent request |
| `recentLocations` | Recent lat/lng clusters | Every intent request with location |
| `priceSensitivity` | Ratio of chosen-offer price to median shown price, averaged | Every completed transaction |

All of these are running aggregates, computed incrementally with simple
arithmetic on write — no model training, no batch job, no ML
infrastructure. This alone powers real, explainable personalization:
pre-filling budget when a user is vague, defaulting timing, and —
critically — an explainable "recommended because you often book rooftop
restaurants" surfaced in the UI, extending doc 05's "never show a
black-box result" principle to recommendations, not just search results.

**B. Learned taste vector** (one embedding per user, stored in pgvector):

Updated as an exponential moving average over the embeddings of things
the user actually engaged with positively (booked, or explicitly
compared/favorited):

```
new_vector = (1 - α) · old_vector + α · embedding(interacted_offer_or_business)
```

with α ≈ 0.2 as a starting point (more weight on recent behavior, but not
thrashing on one data point). This requires no model training — it
reuses the same embeddings already computed for business/offer matching
(Part 1) and the semantic cache, just accumulated per user over time. It
answers a different question than the structured profile: not "what
category does this user like" but "which specific offers, in embedding
space, does this user's history sit closest to" — useful for nuance the
discrete category buckets miss (e.g., someone who consistently picks
quiet, minimalist-decor restaurants regardless of cuisine).

### How this feeds the product

- **Ranking Agent** (doc 04): the user taste vector becomes one more
  blended signal alongside relevance, budget fit, distance, historical
  conversion, and rating — a small boost for candidates near the user's
  taste vector, never enough to override a hard constraint (same rule
  promoted placement already follows).
- **Proactive recommendations** (doc 02 §1.6 / §2.3, Phase 3-4): standing
  offers can be matched against a user's taste vector even with no active
  intent request — the concrete mechanism behind the original brainstorm's
  "never search for a business again" idea.
- **Business Analytics/Insight Agent** (doc 04): aggregated (never
  individual) taste-vector clustering is a richer version of the
  "unfulfilled intent" market-intelligence product in
  [08-business-model-gtm.md](08-business-model-gtm.md) — demand
  clusters, not just literal request text.

### Privacy — this is a bigger deal than request-level intent data

[09-trust-safety-risk.md](09-trust-safety-risk.md) already treats
single-request intent data as financial-data-grade sensitive. A
persistent cross-session profile is a step beyond that — it's a durable
psychographic/purchase profile, and needs its own explicit handling, not
just an extension of the existing rule. See the addition made to doc 09.
Short version: opt-in and disclosed (not silently on by default),
user-visible and explainable (ties to the "never a black box" rule
above), independently deletable from request history, and never exposed
at the individual level in any data product.

## Part 3 — Monetization: why this genuinely benefits both sides

This is the connective tissue the two halves of this doc share, and it's
worth being explicit about the mechanism rather than just asserting
"win-win."

**Company side.** Semantic caching means cost-per-request trends down as
volume trends up — the opposite of naive linear LLM-cost scaling. That
directly improves gross margin on the commission model
([08-business-model-gtm.md](08-business-model-gtm.md)), which matters a
lot for a business whose entire pitch is "we're cheaper than ad-buying
for the merchant." Personalization improves the Intent → Outcome rate and
likely average order value — the two metrics doc 08 already names as the
ones to obsess over — which increases commission revenue per active user
and improves LTV, which is what justifies the Phase 4 referral/growth
spend.

**User side.** Faster answers (cache hits are near-instant versus a full
model round-trip), fewer repeated questions (the profile fills in likely
defaults instead of re-asking budget/location every time), and
better-fit results over time. Concretely tying it to money: the margin
improvement from cost reduction is what funds the referral-credit / Data
Dividend budget described in doc 08 without cutting into the commission
take-rate — that's the actual mechanism connecting "we built efficient
infrastructure" to "so users get paid for referrals," not a hand-wave.
State this plainly to the team and to investors: efficiency funds the
user incentive, it isn't a separate cost center competing with it.

## Sequencing — what's buildable now vs. what needs real usage data first

| Piece | Can start now (Phase 1) | Needs volume first |
|---|---|---|
| Embedding write-path (compute + store embeddings for every parsed intent) | Yes — cheap, starts the data flowing | — |
| Cache-hit read-path (skip the model call on a match) | Plumbing can be written now | Only safe to trust once there's a labeled sample to tune thresholds against — Phase 2-3 |
| Structured user profile (category affinity, avg budget, etc.) | Yes — pure arithmetic, no dependency on volume | — |
| User taste vector | Schema can exist now | Meaningless until a user has completed transactions — Phase 3 |
| Distilled small model | No | Needs a real accumulated verified-parse dataset — Phase 4+ |

See [14-mvp-implementation-plan.md](14-mvp-implementation-plan.md) for
exactly which of these are in the next concrete build steps.
