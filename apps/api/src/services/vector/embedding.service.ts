/**
 * Embedding Service — wraps Google's gemini-embedding-001 model.
 *
 * text-embedding-004 (the model this originally targeted) 404s on the
 * current API — verified live and cross-checked against Google's GA
 * announcement blog post before switching. gemini-embedding-001 is the
 * current text embedding model; it defaults to 3072 dimensions but
 * supports truncation via `outputDimensionality` (Google's docs
 * specifically recommend 3072/1536/768 as the supported truncation
 * sizes, auto-normalized) — requested at 768 here to match this
 * project's `vector(768)` column.
 *
 * Uses the same @google/genai SDK already in package.json so no new
 * vendor dependency is added. Falls back gracefully when the API key
 * is not configured (returns a zero-vector so callers don't hard-fail).
 *
 * Per docs/13-ai-cost-optimization-personalization.md Part 1 + Part 2.
 */

import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";

export const EMBEDDING_DIM = 768;
const EMBEDDING_MODEL = "gemini-embedding-001";

const client = env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  : null;

/**
 * Embed a single text string.
 * Returns a 768-dim float array.
 * Returns a zero-vector when the API key is not configured (graceful degradation).
 */
export async function embed(text: string): Promise<number[]> {
  if (!client) {
    console.warn("[embedding] GEMINI_API_KEY not set — returning zero-vector");
    return new Array(EMBEDDING_DIM).fill(0);
  }

  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIM },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("[embedding] Empty embedding response from Google API");
  }
  return values;
}

/**
 * Embed multiple texts in one batch call (up to 100 per Google API limits).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!client) {
    return texts.map(() => new Array(EMBEDDING_DIM).fill(0));
  }
  // Google embedContent supports a single string; batch via Promise.all.
  // For very large batches, add chunking here (100 per batch).
  return Promise.all(texts.map(embed));
}

/**
 * Cosine similarity between two vectors. Range [-1, 1].
 * 1.0 = identical, 0 = orthogonal, -1 = opposite.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`[embedding] Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Serialize a float array to a Postgres vector literal: '[0.1,0.2,...]'
 * Used for raw SQL vector queries.
 */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
