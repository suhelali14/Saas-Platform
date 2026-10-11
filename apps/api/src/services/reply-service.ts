import type { ParsedIntent } from "./ai/schema.js";
import type { Clarification } from "./intent-service.js";

function formatBudget(intent: ParsedIntent): string | null {
  if (intent.budgetMax == null) return null;
  return intent.budgetMin != null ? `₹${intent.budgetMin}-₹${intent.budgetMax}` : `under ₹${intent.budgetMax}`;
}

function describeIntent(intent: ParsedIntent): string {
  const parts: string[] = [];
  if (intent.category) parts.push(intent.category);
  const budget = formatBudget(intent);
  if (budget) parts.push(budget);
  if (intent.timingWindow) parts.push(intent.timingWindow);
  else if (intent.timingType) parts.push(intent.timingType.replace("_", " "));
  return parts.length > 0 ? parts.join(", ") : "your request";
}

function describeChanges(previous: ParsedIntent, next: ParsedIntent): string[] {
  const changes: string[] = [];
  if (previous.category !== next.category) {
    changes.push(next.category ? `category to ${next.category}` : "category cleared");
  }
  if (previous.budgetMax !== next.budgetMax) {
    const budget = formatBudget(next);
    changes.push(budget ? `budget to ${budget}` : "budget cleared");
  }
  if (previous.timingType !== next.timingType || previous.timingWindow !== next.timingWindow) {
    const timing = next.timingWindow ?? next.timingType;
    changes.push(timing ? `timing to ${timing}` : "timing cleared");
  }
  return changes;
}

interface AssistantReplyInput {
  parsed: ParsedIntent;
  previousIntent?: ParsedIntent | null;
  matchCount: number;
  clarification: Clarification | null;
}

/**
 * Deterministic, not LLM-generated -- cheap and predictable, and avoids an
 * extra model round-trip just for a confirmation message (doc 13's
 * cost-consciousness). Templated from the diff between the previous and
 * newly understood state, so refinements ("under 1500 instead") get a
 * reply that actually names what changed rather than a generic "OK."
 */
export function generateAssistantReply({
  parsed,
  previousIntent,
  matchCount,
  clarification,
}: AssistantReplyInput): string {
  if (clarification) {
    return clarification.question;
  }

  const matchPhrase =
    matchCount > 0 ? `Found ${matchCount} match${matchCount === 1 ? "" : "es"}.` : "No matches yet for this.";

  if (!previousIntent) {
    return `Got it — looking for ${describeIntent(parsed)}. ${matchPhrase}`;
  }

  const changes = describeChanges(previousIntent, parsed);
  if (changes.length === 0) {
    return `Got it. ${matchPhrase}`;
  }

  return `Updated ${changes.join(" and ")}. ${matchPhrase}`;
}
