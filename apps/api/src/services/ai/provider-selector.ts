import { env } from "../../config/env.js";
import { anthropicProvider } from "./anthropic-provider.js";
import { geminiProvider } from "./gemini-provider.js";
import type { AiProvider } from "./types.js";

/**
 * Multi-provider selection (docs/14-mvp-implementation-plan.md M2, docs/10-tech-stack-decisions.md
 * "Multi-provider AI layer"): use whichever provider actually has a key
 * configured. AI_PROVIDER forces a specific one; "auto" (default) prefers
 * Anthropic when both are configured -- not a cost-based choice, just a
 * stable default so behavior doesn't silently change based on which env
 * vars happen to be set. Returns null if nothing is configured, in which
 * case intent-service.ts falls back to the heuristic parser.
 */
export function selectAiProvider(): AiProvider | null {
  if (env.AI_PROVIDER === "anthropic") return anthropicProvider;
  if (env.AI_PROVIDER === "gemini") return geminiProvider;
  return anthropicProvider ?? geminiProvider ?? null;
}
