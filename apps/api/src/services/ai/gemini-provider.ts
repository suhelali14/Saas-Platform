import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import { INTENT_JSON_SCHEMA, buildIntentSystemPrompt, ParsedIntentSchema, type ParsedIntent } from "./schema.js";
import type { AiProvider, ParseIntentInput } from "./types.js";

const client = env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }) : null;

async function parseIntent({ turns, previousIntent }: ParseIntentInput): Promise<ParsedIntent> {
  if (!client) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  // Gemini's contents array uses "model" for the model's own turns, not
  // "assistant" -- everything else about our ConversationTurn shape maps
  // directly.
  const contents = turns.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));

  const response = await client.models.generateContent({
    model: env.GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: buildIntentSystemPrompt(previousIntent),
      responseMimeType: "application/json",
      responseSchema: INTENT_JSON_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned no output");
  }

  return ParsedIntentSchema.parse(JSON.parse(text));
}

export const geminiProvider: AiProvider | null = client ? { name: "gemini", parseIntent } : null;
