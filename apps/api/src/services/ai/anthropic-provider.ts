import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { INTENT_JSON_SCHEMA, buildIntentSystemPrompt, ParsedIntentSchema, type ParsedIntent } from "./schema.js";
import type { AiProvider, ParseIntentInput } from "./types.js";

const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

// Forced single tool call rather than output_config.format/zodOutputFormat:
// the SDK's zod helper expects Zod v4's internal type shape and this
// project is on Zod v3 (shared with every route's request validation).
// ParsedIntentSchema.parse() below still does the runtime validation doc
// 04's "structured output validation" guardrail requires.
const INTENT_TOOL = {
  name: "record_intent",
  description: "Record the structured interpretation of a user's shopping/service intent request.",
  input_schema: INTENT_JSON_SCHEMA,
} as Anthropic.Tool;

async function parseIntent({ turns, previousIntent }: ParseIntentInput): Promise<ParsedIntent> {
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Claude's message roles are already "user"/"assistant" -- no translation needed.
  const messages: Anthropic.MessageParam[] = turns.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  const response = await client.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: buildIntentSystemPrompt(previousIntent),
    messages,
    tools: [INTENT_TOOL],
    tool_choice: { type: "tool", name: "record_intent" },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude did not call the record_intent tool");
  }

  return ParsedIntentSchema.parse(toolUse.input);
}

export const anthropicProvider: AiProvider | null = client ? { name: "anthropic", parseIntent } : null;
