# Tech Stack Decisions

Each choice below states the recommendation, the alternative considered,
and why — so a later reader can revisit the decision deliberately instead
of guessing why it was made.

## Design tooling: Figma MCP

**Choice:** `@nexus2520/figma-mcp-server` (PAT-based, community), configured
in `.mcp.json` (gitignored — see `.mcp.json.example` for the shape) with
the token in a local `FIGMA_ACCESS_TOKEN` environment variable, never
committed. Figma's own official remote MCP server
(`https://mcp.figma.com/mcp`) is OAuth-only and was tried first, but
OAuth needs an interactive browser session this environment couldn't
complete; the PAT-based community server works headlessly. Used to pull
real design tokens/layout/screenshots directly into the native app's auth
screens rather than approximating a design from a URL alone — see
[05-native-app-spec.md](05-native-app-spec.md) "Design system source."
**Revisit trigger:** if OAuth becomes viable in this environment, the
official server has the broader feature set (native canvas writing) and
would be the better default.

## Native app

**Choice:** React Native + Expo, TypeScript.
**Alternative considered:** Flutter (Dart).
**Why:** shares TypeScript types/contracts with the backend and business
portal, larger hiring pool, Expo removes native build friction for a small
early team. Revisit only if the team ends up with strong existing Flutter
expertise — not worth switching otherwise.

## Business portal

**Choice:** Next.js (React, TypeScript), server-rendered for the
dashboard/analytics pages.
**Why:** shared language/types with the native app and backend; Next.js's
API routes can double as lightweight BFF endpoints early on before a
dedicated API Gateway is needed.

## Backend

**Choice:** Node.js + TypeScript for the core API/services (modular
monolith through Phase 2, per [03-architecture-overview.md](03-architecture-overview.md)).
**Alternative considered:** Python (stronger ML ecosystem, but the
matching/ranking logic here is mostly orchestration + API calls to an LLM
provider, not custom model training — Node/TS keeps one language across
the whole stack, which matters a lot for a small team).
**Revisit trigger:** if Phase 3+ requires custom ML model training (e.g.,
a learned ranking model beyond heuristic + LLM scoring), a Python
microservice for just that component is reasonable — don't rewrite the
whole backend.

## API style

**Choice:** REST for the mobile/web-facing BFF, internal service calls can
be plain typed HTTP/RPC. GraphQL is not necessary at this scale/team size
and adds tooling overhead without a corresponding benefit yet.

## Database

**Choice:** PostgreSQL as the single source of truth (Phase 1-3).
**Vector search:** `pgvector` extension on the same Postgres instance
through Phase 2-3 — avoids operating a second database system before
volume justifies it. **Revisit trigger:** move to a dedicated vector DB
(e.g., Pinecone, Weaviate, Qdrant) once business/offer count and query
volume make pgvector's latency or index size a real bottleneck (this is a
Phase 3+ consideration, not a Phase 1 one — see
[07-roadmap-phases.md](07-roadmap-phases.md)).
**Caching:** Redis in front of read-heavy business directory data, added
in Phase 2-3 once traffic justifies it.

## LLM / AI layer

**Primary choice:** Claude (Anthropic API) for the reasoning/parsing/
ranking agents, using a tool-calling / structured-output pattern (see
[04-multi-agent-design.md](04-multi-agent-design.md)).
**Model tiering:** use a smaller/faster model for routine intent parsing
and a stronger model only when confidence is low or the request is
complex/ambiguous — controls cost as volume grows. Load the `claude-api`
skill/reference when implementing this layer for current model
IDs/pricing rather than hardcoding assumptions that will go stale.
**Orchestration:** build agent orchestration using the same
tool-calling/function-calling pattern the Claude Agent SDK uses — each
agent's "tools" are typed wrappers around internal service endpoints
(`search_businesses`, `check_availability`, etc.), not free-form prompt
chains.

### Multi-provider AI layer

**Choice:** Claude and Gemini are both wired in behind one `AiProvider`
interface (`apps/api/src/services/ai/`) — `parseIntent(rawText):
Promise<ParsedIntent>` — with a single shared JSON Schema + Zod schema
(`ai/schema.ts`) defining the structured-output contract both providers
must satisfy. `provider-selector.ts` picks whichever provider actually
has an API key configured; `AI_PROVIDER=anthropic|gemini` forces a
specific one, `auto` (default) prefers Anthropic when both are set. Falls
back to a heuristic parser (per doc 13's tiered-inference Tier 0) when
neither is configured or the call fails — see
[14-mvp-implementation-plan.md](14-mvp-implementation-plan.md) M2.

**Why not pick one and commit:** rate limits, outages, and per-provider
cost/quality tradeoffs are all real operational risk for a system whose
core value proposition depends on this call succeeding on every request.
A provider-agnostic contract means an outage or a pricing change on one
side doesn't require an emergency rewrite — swap the env var, or extend
`provider-selector.ts` with a runtime fallback chain (try Anthropic, fall
through to Gemini on failure, per-request) when that's actually needed.
Not built yet — today's fallback chain is provider → heuristic only, not
provider → provider → heuristic; add the middle step if/when multi-key
setups in practice show one provider failing often enough to matter.

**Adding a third provider:** implement `AiProvider` in a new file under
`ai/`, export it as `null` when unconfigured (same pattern as the two
existing providers), and add it to `provider-selector.ts`. Nothing
outside `ai/` needs to change — `intent-service.ts` only depends on the
`AiProvider` contract, never on a specific SDK.

**Revisit trigger:** if a genuinely different capability (not just a
different vendor) is needed — e.g. a provider with a much larger context
window for a future feature — extend `AiProvider` rather than special-
casing it in `intent-service.ts`.

## Payments

**Choice:** Razorpay (or Cashfree) as the RBI-licensed Payment Aggregator
for the India-first launch. Never build custom payment/settlement
infrastructure — see [09-trust-safety-risk.md](09-trust-safety-risk.md).

## Maps / location

**Choice:** Google Maps SDK for geocoding, distance calculation, and
business location display. **Revisit trigger:** Mapbox if Google Maps API
cost becomes material at scale — not a Phase 1-2 concern.

## Push notifications

**Choice:** Expo push notifications (wraps FCM/APNs) for the native app;
a transactional SMS/WhatsApp provider (e.g., Twilio, Gupshup) for
OTP and business alert fallback when push isn't reliable.

## Infrastructure / hosting

**Choice:** A single major cloud provider (AWS or GCP — either is fine;
pick based on team familiarity, not a specific technical requirement at
this stage) with managed Postgres (RDS/Cloud SQL), containerized services
(ECS/Cloud Run) rather than a full Kubernetes setup — Kubernetes is
premature operational overhead for a Phase 1-3 team size.
**Revisit trigger:** move to Kubernetes only if/when multi-city scaling
(Phase 4+) genuinely requires orchestration complexity a managed
container service can't handle.

## CI/CD & environments

**Choice:** GitHub Actions (or equivalent) running type checks + tests on
every PR; `dev` → `staging` → `prod` environments; automatic deploy to
staging on merge to main, manual promotion to prod. Feature flags
(e.g., a simple flag service or LaunchDarkly-equivalent) for risky
ranking-logic changes so they can be A/B tested without a full release
cycle — matters especially here because ranking quality is the product.

## Observability

**Choice:** structured logging + a standard APM (e.g., Sentry for errors,
a metrics/dashboard tool like Grafana or a hosted equivalent) from Phase
1 — the agent orchestration layer specifically needs per-request tracing
(input, tool calls, output, latency, cost) for debugging bad matches, per
the auditability guardrail in
[04-multi-agent-design.md](04-multi-agent-design.md).
