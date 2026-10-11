import { z } from "zod";

export const SUPPORTED_CATEGORIES = ["restaurant", "gym", "salon"] as const;

export const ParsedIntentSchema = z.object({
  category: z.enum(SUPPORTED_CATEGORIES).nullable(),
  budgetMin: z.number().nullable(),
  budgetMax: z.number().nullable(),
  timingType: z.enum(["today", "tomorrow", "this_week", "flexible"]).nullable(),
  timingWindow: z.enum(["morning", "afternoon", "evening", "weekend"]).nullable(),
  hardConstraints: z.array(z.string()),
  softPreferences: z.array(z.string()),
  confidence: z.object({
    category: z.number().min(0).max(1),
    budget: z.number().min(0).max(1),
    timing: z.number().min(0).max(1),
  }),
});

export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

// Plain JSON Schema, shared by every provider's structured-output mechanism
// (Claude's forced tool_use input_schema, Gemini's responseSchema -- both
// accept the same standard-JSON-Schema shape, nullable fields included).
// Deliberately not derived from the zod schema above -- SDK-specific zod
// helpers pin to versions/shapes that don't match this project's Zod v3
// (see docs/14-mvp-implementation-plan.md M2). Keep the two in sync by
// hand; ParsedIntentSchema is what actually validates output at runtime
// either way, so a drift here fails loudly, not silently.
export const INTENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    category: { type: ["string", "null"], enum: [...SUPPORTED_CATEGORIES, null] },
    budgetMin: { type: ["number", "null"] },
    budgetMax: { type: ["number", "null"] },
    timingType: { type: ["string", "null"], enum: ["today", "tomorrow", "this_week", "flexible", null] },
    timingWindow: {
      type: ["string", "null"],
      enum: ["morning", "afternoon", "evening", "weekend", null],
    },
    hardConstraints: { type: "array", items: { type: "string" } },
    softPreferences: { type: "array", items: { type: "string" } },
    confidence: {
      type: "object",
      properties: {
        category: { type: "number" },
        budget: { type: "number" },
        timing: { type: "number" },
      },
      required: ["category", "budget", "timing"],
    },
  },
  required: [
    "category",
    "budgetMin",
    "budgetMax",
    "timingType",
    "timingWindow",
    "hardConstraints",
    "softPreferences",
    "confidence",
  ],
};

export const INTENT_SYSTEM_PROMPT = `You extract structured shopping/service intent from a user's free-text request for a local marketplace app. Supported categories are exactly: ${SUPPORTED_CATEGORIES.join(", ")} -- use null if the request doesn't confidently match one of these, never invent a category outside this list. Extract budget as a plain number in the request's stated currency's usual unit (e.g. rupees, not paise). Distinguish hard constraints (explicit must-haves, e.g. "party of 4", "wheelchair accessible") from soft preferences (nice-to-haves, e.g. "rooftop", "quiet"). Give an honest 0-1 confidence for category, budget, and timing individually -- do not default to high confidence when the text is ambiguous or when a field wasn't mentioned at all.`;

const REFINEMENT_INSTRUCTIONS = `This is a refinement of an earlier request, not a fresh one. The current understood state (from the prior turn) is given below as JSON. The latest user message may change some fields and leave others unstated -- carry forward any field the new message doesn't address, and only update the fields it actually refines. E.g. if the prior state has category=gym and the user now says "under 1500 instead", the correct output keeps category=gym and updates only budgetMax. Never null out a field just because the latest message didn't repeat it.

Previous state: `;

/**
 * Builds the system prompt for a parse call -- plain for a fresh request,
 * with refinement instructions + the prior structured state appended when
 * this is a follow-up turn in an existing conversation (docs/04
 * "Conversational refinement").
 */
export function buildIntentSystemPrompt(previousIntent?: ParsedIntent | null): string {
  if (!previousIntent) {
    return INTENT_SYSTEM_PROMPT;
  }
  return `${INTENT_SYSTEM_PROMPT}\n\n${REFINEMENT_INSTRUCTIONS}${JSON.stringify(previousIntent)}`;
}
