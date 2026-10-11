import type { ParsedIntent } from "./schema.js";

export type AiProviderName = "anthropic" | "gemini";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ParseIntentInput {
  // Full thread so far, ending with the latest user turn. A single
  // fresh request is just [{role: "user", content: rawText}].
  turns: ConversationTurn[];
  // The last understood structured state, if this is a refinement --
  // lets the model merge ("under 1500 instead") rather than re-parsing
  // the latest message in isolation and losing prior context (category,
  // location, etc. the user isn't repeating).
  previousIntent?: ParsedIntent | null;
}

export interface AiProvider {
  name: AiProviderName;
  parseIntent(input: ParseIntentInput): Promise<ParsedIntent>;
}
