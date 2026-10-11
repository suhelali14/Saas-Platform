import { GoogleGenAI } from "@google/genai";
import { BusinessType } from "@prisma/client";
import { env } from "../config/env.js";

// Smart-onboarding genre classifier (docs/plans smart-onboarding).
//
// A hybrid classification, not a blind AI guess: the user first picks one of
// 6 broad category buckets (deterministic, can't be misread), then this
// narrows to a specific BusinessType *within* that bucket using the rest of
// the onboarding answers. Bounding the problem this way before the AI call
// means the model is choosing the best of 3-6 plausible options with real
// context, not guessing cold across all 21 BusinessType values -- the same
// reasoning Razorpay's MCC auto-detection and Stripe Connect's
// type-narrowed-requirements approach both use (see the plan's research
// section).

export const CATEGORY_BUCKETS = {
  FOOD_AND_DINING: { label: "Food & Dining", types: ["RESTAURANT", "CAFE", "BAKERY"] as BusinessType[] },
  RETAIL_AND_SHOPPING: {
    label: "Retail & Shopping",
    types: ["KIRANA_STORE", "RETAIL_STORE", "GROCERY", "ELECTRONICS", "BOUTIQUE", "D2C_BRAND"] as BusinessType[],
  },
  HEALTH_AND_BEAUTY: {
    label: "Health & Beauty",
    types: ["SALON", "SPA", "CLINIC", "HOSPITAL", "PHARMACY", "GYM_FITNESS"] as BusinessType[],
  },
  HOME_AND_PROFESSIONAL_SERVICES: {
    label: "Home & Professional Services",
    types: ["REAL_ESTATE", "TRAVEL_AGENCY", "HOME_BUSINESS", "SERVICES"] as BusinessType[],
  },
  EDUCATION_AND_COACHING: { label: "Education & Coaching", types: ["EDUCATION", "COACHING"] as BusinessType[] },
  OTHER: { label: "Other", types: ["OTHER"] as BusinessType[] },
} as const;

export type CategoryBucket = keyof typeof CATEGORY_BUCKETS;

export interface ClassifyInput {
  bucket: CategoryBucket;
  name: string;
  description: string;
  offeredItems: { name: string; description?: string }[];
}

export interface ClassifyResult {
  businessType: BusinessType;
  confidence: number;
  reasoning: string;
}

function getGeminiClient(): GoogleGenAI | null {
  if (!env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
}

/**
 * Deterministic, never fails -- the always-available floor under the AI
 * call. The message is worded honestly (platform-trust-layer plan): the
 * quota this hits is a single shared platform-wide Gemini key, not
 * literally gated by the calling business's own plan tier, so this never
 * claims upgrading would have avoided *this* specific exhaustion -- it
 * mentions priority AI processing as a real Growth+ direction without
 * overpromising a causal fix that doesn't exist yet.
 */
function fallbackResult(bucket: CategoryBucket): ClassifyResult {
  const shortlist = CATEGORY_BUCKETS[bucket].types;
  return {
    businessType: shortlist[0]!,
    confidence: 0,
    reasoning:
      "Our AI is at capacity right now, so we've set a smart default based on your category -- you can change it anytime from Settings. Growth plan and above get priority AI processing.",
  };
}

export async function classifyBusiness(input: ClassifyInput): Promise<ClassifyResult> {
  const shortlist = CATEGORY_BUCKETS[input.bucket].types;

  // A one-option bucket (OTHER) needs no AI call at all.
  if (shortlist.length === 1) {
    return { businessType: shortlist[0]!, confidence: 1, reasoning: "Only one type in this category" };
  }

  const client = getGeminiClient();
  if (!client) return fallbackResult(input.bucket);

  const itemsText = input.offeredItems.length > 0
    ? input.offeredItems.map((i) => `- ${i.name}${i.description ? `: ${i.description}` : ""}`).join("\n")
    : "(none listed)";

  const prompt = `You are classifying a small business into the single best-matching type for a business management platform.

Business name: "${input.name}"
Description (in the owner's own words): "${input.description}"
What they offer:
${itemsText}

Choose exactly one type from this list (all are valid choices within the owner's chosen category):
${shortlist.join(", ")}

Return ONLY valid JSON:
{ "businessType": "<one of the listed types>", "confidence": <0.0-1.0>, "reasoning": "<one sentence>" }`;

  try {
    const result = await client.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    if (!result.text) return fallbackResult(input.bucket);

    const parsed = JSON.parse(result.text) as { businessType?: string; confidence?: number; reasoning?: string };
    if (!parsed.businessType || !shortlist.includes(parsed.businessType as BusinessType)) {
      return fallbackResult(input.bucket);
    }

    return {
      businessType: parsed.businessType as BusinessType,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reasoning: parsed.reasoning ?? "",
    };
  } catch (err) {
    console.warn("[business-classifier] Gemini classification failed, using fallback:", err);
    return fallbackResult(input.bucket);
  }
}

/** Genre for GenreProduct lookup is just the resolved BusinessType as a string. */
export function genreForBusinessType(businessType: BusinessType): string {
  return businessType;
}
