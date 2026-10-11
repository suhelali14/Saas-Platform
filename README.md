# Intently — Intent-to-Commerce Platform

**Working codename:** `Intently` (placeholder — rename anytime, see [11-glossary-open-questions.md](docs/11-glossary-open-questions.md))

## One-paragraph pitch

Advertising shows people things and hopes they care. Intently reverses it: a user
states a real need in plain language ("I need a gym near Koramangala under
₹2,000/month"), an AI layer turns that into a structured request, and local
businesses compete to fulfill it with real offers — price, availability, proof.
Users get a decision engine instead of a feed of interruptions. Businesses pay
only when the match produces a real outcome (a booking, a sale, a qualified
lead) instead of paying for impressions and hoping. The company is not
"another ad network" — it is a marketplace for human intent.

## Why this doc set exists

This is a from-scratch, no-code-yet planning phase. Everything about the idea —
positioning, product, architecture, the multi-agent AI design, the native app,
the phased build plan, the business model, and the risk list — is captured
here in `docs/` so none of it depends on this conversation's memory. Read
`docs/` top to bottom for full context; each file is self-contained enough to
be read on its own later.

## Reading order

| # | Doc | What it covers |
|---|-----|-----------------|
| 1 | [01-vision-positioning.md](docs/01-vision-positioning.md) | The refined idea, why it can win, what NOT to build, the moat |
| 2 | [02-product-spec.md](docs/02-product-spec.md) | What the product actually does, for users and businesses |
| 3 | [03-architecture-overview.md](docs/03-architecture-overview.md) | System components, data flow, scaling approach |
| 4 | [04-multi-agent-design.md](docs/04-multi-agent-design.md) | The AI/agent layer that powers matching |
| 5 | [05-native-app-spec.md](docs/05-native-app-spec.md) | Native app screens, stack, UX flows |
| 6 | [06-data-model.md](docs/06-data-model.md) | Core entities and schemas |
| 7 | [07-roadmap-phases.md](docs/07-roadmap-phases.md) | Phase 0 → Phase 5 build plan, detailed tasks per phase |
| 8 | [08-business-model-gtm.md](docs/08-business-model-gtm.md) | Monetization, go-to-market, north-star metrics |
| 9 | [09-trust-safety-risk.md](docs/09-trust-safety-risk.md) | Fraud, privacy, legal/compliance risk |
| 10 | [10-tech-stack-decisions.md](docs/10-tech-stack-decisions.md) | Concrete stack choices and rationale |
| 11 | [11-glossary-open-questions.md](docs/11-glossary-open-questions.md) | Terms, naming, and decisions still owned by the user |
| 12 | [12-dev-setup.md](docs/12-dev-setup.md) | How to install, configure, and run the code below |
| 13 | [13-ai-cost-optimization-personalization.md](docs/13-ai-cost-optimization-personalization.md) | Semantic caching to cut AI cost, the user behavior matrix, and how both tie into monetization |
| 14 | [14-mvp-implementation-plan.md](docs/14-mvp-implementation-plan.md) | Granular, file-level milestones for what to build next |

## Repo layout

```
apps/
  api/                  Fastify + TypeScript + Prisma backend
  business-dashboard/   Next.js business portal
  mobile/               Expo React Native consumer app
packages/
  shared-types/         TypeScript DTOs shared across all three apps
docs/                   The planning doc set above
docker-compose.yml       Local Postgres + pgvector for dev
```

See [12-dev-setup.md](docs/12-dev-setup.md) to install and run any of
this.

## Current status

**Phase:** 1 (early) — the monorepo scaffold is up and most of the core
loop is code-complete: native app → JWT-authenticated API → real
Claude-backed Intent Understanding Agent (falls back to a heuristic
parser without a key) → v0 matching engine → Postgres, via a shared
TypeScript contract, with a user profile updating on every request. The
native app has a real design system pulled from an actual Figma file
(`src/theme`, `src/components`), a React Query data layer, and a full
Onboarding → Welcome → Login/Register/Guest → 4-tab (Home, Explore,
Activity, Profile) flow with real email/password auth, a real referral
code, and change-password — every list renders real API data, no
placeholder arrays. Every Activity/Results session is a real chat thread,
not a one-shot form: users can keep refining a search ("under 1500
instead") and the agent merges the change into what it already
understood rather than starting over — see doc 04's "Conversational
refinement" and doc 05's "Current implementation." All four workspaces
type-check clean; see [12-dev-setup.md](docs/12-dev-setup.md) "What's
already verified" and
[14-mvp-implementation-plan.md](docs/14-mvp-implementation-plan.md)
"Status" for the exact smoke tests run so far. The Intent Understanding
Agent supports either Claude or Gemini behind one provider interface
(`apps/api/src/services/ai/`, see
[10-tech-stack-decisions.md](docs/10-tech-stack-decisions.md)
"Multi-provider AI layer") — whichever has a key configured gets used,
falling back to a heuristic parser if neither is set or a call fails.
This environment has both a live Postgres (Neon) and a Gemini key
configured, verified via live end-to-end smoke tests against the real
database.

## Next steps

Working milestone list: [14-mvp-implementation-plan.md](docs/14-mvp-implementation-plan.md).
**M0, M1, M2, M4, M5, M6, and M7 are all code-complete and live-verified**
against the real Neon database — M0 (hosted Postgres) and M2 (a Gemini
key) both got resolved, so nothing below is blocked on external setup
anymore. Only **M3** (the embedding write-path, Phase 2 prep — cheap now,
needed later for the semantic cache/personalization in doc 13) is still
open and unstarted.

Past that, the roadmap moves into real Phase 2 territory
([07-roadmap-phases.md](docs/07-roadmap-phases.md)): a vector-search
Matching Engine (replacing the current v0 filter/keyword matcher),
in-app payments (needs a payment aggregator account — a user decision,
not a code gap), business notifications, and Trust & Safety v1. The
Business Dashboard built for M6 is deliberately bare-bones (no
business-side auth yet — anyone with the URL can edit any business),
fine for hand-recruiting the first businesses, not fine for self-serve
onboarding at scale.

Also open: confirm or override the defaults this plan made on the user's
behalf — working name, launch city, initial verticals, budget/team size
(see [11-glossary-open-questions.md](docs/11-glossary-open-questions.md)).
