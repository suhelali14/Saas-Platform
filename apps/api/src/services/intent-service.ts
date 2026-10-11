import { SUPPORTED_CATEGORIES, type ParsedIntent } from "./ai/schema.js";
import { selectAiProvider } from "./ai/provider-selector.js";
import type { AiProviderName, ParseIntentInput } from "./ai/types.js";

export interface Clarification {
  field: "category" | "budget";
  question: string;
}

export interface IntentParseResult {
  parsed: ParsedIntent;
  source: AiProviderName | "heuristic";
  clarification: Clarification | null;
}

const CONFIDENCE_THRESHOLD = 0.6;

function detectClarification(parsed: ParsedIntent): Clarification | null {
  if (parsed.category === null || parsed.confidence.category < CONFIDENCE_THRESHOLD) {
    return {
      field: "category",
      question: `What kind of business are you looking for? (${SUPPORTED_CATEGORIES.join(", ")})`,
    };
  }
  if (parsed.budgetMax === null && parsed.confidence.budget < CONFIDENCE_THRESHOLD) {
    return { field: "budget", question: "What's your budget?" };
  }
  return null;
}

const CATEGORY_KEYWORDS: Record<(typeof SUPPORTED_CATEGORIES)[number], string[]> = {
  restaurant: ["restaurant", "dinner", "lunch", "food", "eat", "rooftop"],
  gym: ["gym", "fitness", "workout"],
  salon: ["salon", "haircut", "spa", "beauty"],
};

const BUDGET_PATTERN = /(?:under|budget|within)\s*(?:rs\.?|inr|₹)?\s*(\d{2,6})/i;

/**
 * Deterministic fallback -- used when no AI provider is configured, or when
 * the configured one fails, so local dev and degraded-mode requests keep
 * working rather than hard-failing the endpoint. See
 * docs/13-ai-cost-optimization-personalization.md Part 1 -- this is Tier 0
 * of the tiered-inference plan, not a replacement for it.
 *
 * On a refinement turn, carries `previousIntent` forward as the baseline
 * and only overrides fields the latest message actually signals -- without
 * this, a provider outage mid-conversation would silently wipe the
 * category/budget the user already established.
 */
function heuristicFallback(latestText: string, previousIntent?: ParsedIntent | null): ParsedIntent {
  const text = latestText.toLowerCase();

  let category: ParsedIntent["category"] = previousIntent?.category ?? null;
  for (const cat of SUPPORTED_CATEGORIES) {
    if (CATEGORY_KEYWORDS[cat].some((keyword) => text.includes(keyword))) {
      category = cat;
      break;
    }
  }

  const budgetMatch = text.match(BUDGET_PATTERN);
  const budgetMax = budgetMatch?.[1] ? Number(budgetMatch[1]) : (previousIntent?.budgetMax ?? null);

  return {
    category,
    budgetMin: previousIntent?.budgetMin ?? null,
    budgetMax,
    timingType: previousIntent?.timingType ?? null,
    timingWindow: previousIntent?.timingWindow ?? null,
    hardConstraints: previousIntent?.hardConstraints ?? [],
    softPreferences: previousIntent?.softPreferences ?? [],
    confidence: {
      category: category ? 0.5 : 0,
      budget: budgetMax !== null ? 0.5 : 0,
      timing: 0,
    },
  };
}

/**
 * The Intent Understanding Agent (docs/04-multi-agent-design.md), backed by
 * whichever AI provider is configured (docs/10-tech-stack-decisions.md
 * "Multi-provider AI layer") -- Claude and Gemini both implement the same
 * AiProvider contract (services/ai/types.ts) and produce output validated
 * against the same schema, so callers here never know or care which one
 * actually ran. Falls back to a heuristic parser rather than failing the
 * request outright -- see docs/14-mvp-implementation-plan.md M2.
 *
 * `input.turns` is the full conversation so far (a fresh request is just
 * one user turn); `input.previousIntent`, when present, is what to refine
 * rather than re-derive from scratch -- see the "Conversational
 * refinement" feature in docs/04-multi-agent-design.md.
 */
export async function parseIntent(input: ParseIntentInput): Promise<IntentParseResult> {
  const provider = selectAiProvider();
  const latestText = input.turns[input.turns.length - 1]?.content ?? "";

  if (!provider) {
    const parsed = heuristicFallback(latestText, input.previousIntent);
    return { parsed, source: "heuristic", clarification: detectClarification(parsed) };
  }

  try {
    const parsed = await provider.parseIntent(input);
    return { parsed, source: provider.name, clarification: detectClarification(parsed) };
  } catch (error) {
    console.error(`${provider.name} intent parse failed, falling back to heuristic parser:`, error);
    const parsed = heuristicFallback(latestText, input.previousIntent);
    return { parsed, source: "heuristic", clarification: detectClarification(parsed) };
  }
}
