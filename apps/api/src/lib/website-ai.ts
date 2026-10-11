import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import type { Business, Product, Service } from "@prisma/client";

// Ported from SAAS/backend/src/modules/website/website.ai.ts.
// SAAS's original supported both OpenAI and Gemini per-business
// (`business.aiProvider`/`business.aiApiKey`, defaulting to
// `OPENAI_API_KEY`/`GEMINI_API_KEY` env vars). This project's existing
// vector layer already standardized on Gemini only via `@google/genai`
// (no `openai` package in this workspace) -- consolidated to Gemini-only
// here rather than adding a second AI SDK. A business with
// `aiProvider: "openai"` and no Gemini key falls through to the same
// regex-replace fallback the original already used when no AI client was
// available, so nothing silently breaks, it just doesn't get AI-customized
// copy until it has a Gemini key.

export interface WebsiteBlock {
  id: string;
  type: string;
  order: number;
  props: Record<string, unknown>;
}

export interface AIStorefrontData {
  theme: { primaryColor: string; font: string; mode: "dark" | "light" };
  blocks: WebsiteBlock[];
}

type BusinessWithCatalog = Business & { products: Product[]; services: Service[] };

function getGeminiClient(apiKey?: string | null): GoogleGenAI | null {
  const key = apiKey || env.GEMINI_API_KEY;
  if (!key || key.trim() === "") return null;
  return new GoogleGenAI({ apiKey: key });
}

async function synthesizeSectionHtml(
  client: GoogleGenAI | null,
  templateHtml: string,
  section: { category: string; instruction: string },
  business: Business,
  theme: { primaryColor: string },
  userPrompt: string,
): Promise<string> {
  const prompt = `You are an expert Frontend Architect.
Your task is to customize a base Tailwind HTML component to perfectly match the business described below.
Business: ${business.name} (${business.type || "RETAIL"})
Description: ${business.description}
Contact: ${business.phone || "9876543210"}, ${business.email || "support@example.com"}
Primary Color: ${theme.primaryColor}

Section Category: ${section.category}
Instruction: ${section.instruction}
User Request: ${userPrompt}

Base Template HTML:
${templateHtml}

Instructions:
1. Rewrite the Base Template HTML to match the business.
2. Change text (titles, descriptions, button text) to be highly relevant and persuasive for this specific business.
3. Replace generic emojis or placeholder text with appropriate ones.
4. Ensure the primary color (${theme.primaryColor}) is used correctly where appropriate (e.g., text-[${theme.primaryColor}], bg-[${theme.primaryColor}]).
5. DO NOT change the core structure (Tailwind flex/grid, etc) drastically unless requested, but you can tweak spacing/padding.
6. Return ONLY the raw HTML code. Do not include markdown blocks like \`\`\`html.
7. Make it sound extremely premium and high-end.

Return ONLY raw HTML.`;

  if (client) {
    try {
      const result = await client.models.generateContent({ model: env.GEMINI_MODEL, contents: prompt });
      const text = result.text;
      if (text) return text.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();
    } catch (err) {
      console.error("[website-ai] Section synthesis failed, falling back to regex replace:", err);
    }
  }

  return templateHtml
    .replace(/\{\{BUSINESS_NAME\}\}/g, business.name)
    .replace(/\{\{TITLE\}\}/g, business.name)
    .replace(/\{\{SUBTITLE\}\}/g, business.description || "Premium quality, exceptional service.")
    .replace(/\{\{PHONE\}\}/g, business.phone || "+91 98765 43210")
    .replace(/\{\{EMAIL\}\}/g, business.email || "hello@" + (business.slug || "business") + ".com")
    .replace(/\{\{PRIMARY_COLOR\}\}/g, theme.primaryColor)
    .replace(/\{\{CTA_PRIMARY\}\}/g, "Get Started")
    .replace(/\{\{CTA_SECONDARY\}\}/g, "Learn More");
}

const GENRE_MAPPING: Record<string, string> = {
  SPA: "SALON",
  CAFE: "RESTAURANT",
  BAKERY: "RESTAURANT",
  HOSPITAL: "CLINIC",
  PHARMACY: "CLINIC",
  BOUTIQUE: "D2C_BRAND",
  KIRANA_STORE: "RETAIL_STORE",
  GROCERY: "RETAIL_STORE",
  ELECTRONICS: "RETAIL_STORE",
};

export async function generateStorefrontWithAI(businessId: string, userPrompt?: string): Promise<AIStorefrontData> {
  const business = (await prisma.business.findUnique({
    where: { id: businessId },
    include: { products: { take: 8, where: { isActive: true } }, services: { take: 4, where: { isActive: true } } },
  })) as BusinessWithCatalog | null;

  if (!business) throw new Error("Business not found");

  const bType = business.type || "RETAIL_STORE";
  const client = getGeminiClient(business.aiApiKey);

  const mappedGenre = GENRE_MAPPING[bType] || bType;
  const genreProduct = await prisma.genreProduct.findUnique({ where: { genre: mappedGenre } });

  if (genreProduct) {
    const theme = genreProduct.defaultTheme as unknown as { primaryColor: string; font: string; mode: "dark" | "light" };
    const sections = genreProduct.sections as unknown as { id?: string; htmlContent: string; category: string; instruction: string; name?: string }[];

    const generatedBlocks = await Promise.all(
      sections.map(async (section, idx) => {
        const finalHtml = await synthesizeSectionHtml(client, section.htmlContent, section, business, theme, userPrompt || "");
        return {
          id: section.id || `block-${Date.now()}-${idx}`,
          type: "RawHtml",
          order: idx + 1,
          props: { html: finalHtml, originalCategory: section.category, sectionName: section.name, editable: true },
        };
      }),
    );

    await prisma.genreProduct.update({ where: { id: genreProduct.id }, data: { usageCount: { increment: 1 } } });

    return { theme, blocks: generatedBlocks };
  }

  const planPrompt = `You are a web architect. Plan a high-converting landing page for an Indian SMB business.
- Business Name: "${business.name}"
- Business Type: "${bType}"
- Description: "${business.description || "Local business"}"
- User Request: "${userPrompt || "Generate modern storefront"}"

Return ONLY valid JSON:
{
  "theme": { "primaryColor": "#10b981", "font": "Inter", "mode": "dark" },
  "sections": [
    { "category": "Header", "instruction": "Modern sticky header with logo and navigation" },
    { "category": "Hero", "instruction": "A modern hero section with a call to action" },
    { "category": "FeatureGrid", "instruction": "Highlight quality and fast delivery" },
    { "category": "Footer", "instruction": "Modern footer with links" }
  ]
}`;

  let plan: { theme: { primaryColor: string; font: string; mode: "dark" | "light" }; sections: { category: string; instruction: string }[] } | null = null;

  if (client) {
    try {
      const result = await client.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: planPrompt,
        config: { responseMimeType: "application/json" },
      });
      if (result.text) plan = JSON.parse(result.text);
    } catch (error) {
      console.warn("[website-ai] AI planning failed, using fallback plan:", error);
    }
  }

  if (!plan || !plan.sections) {
    plan = {
      theme: { primaryColor: "#10b981", font: "Plus Jakarta Sans", mode: "dark" },
      sections: [
        { category: "Header", instruction: "Glassmorphism sticky header" },
        { category: "Hero", instruction: "Ultra-Luxury Glassmorphism Hero for " + business.name },
        { category: "FeatureGrid", instruction: "Bento grid highlighting core value propositions and authentic quality" },
        { category: "Products", instruction: "Curated luxury product catalog with quick order triggers" },
        { category: "Testimonials", instruction: "Social proof with verified 5-star customer reviews" },
        { category: "ContactForm", instruction: "Glassmorphic contact and WhatsApp inquiry concierge" },
        { category: "Footer", instruction: "Modern premium footer" },
      ],
    };
  }

  const generatedBlocks = await Promise.all(
    plan.sections.map(async (section, idx) => {
      let templateHtml = "";
      try {
        const templates = await prisma.componentTemplate.findMany({ where: { category: section.category }, take: 1 });
        if (templates.length > 0) templateHtml = templates[0]!.htmlContent;
      } catch {
        console.warn("[website-ai] Template retrieval failed for", section.category);
      }

      if (!templateHtml) {
        if (section.category === "Header") {
          templateHtml = `<header class="sticky top-0 z-50 backdrop-blur-2xl bg-[#07090e]/80 border-b border-white/[0.08] p-4 flex justify-between items-center text-white"><div class="font-black text-xl">{{TITLE}}</div><nav class="hidden md:flex gap-6"><a href="#products">Products</a><a href="#contact">Contact</a></nav></header>`;
        } else if (section.category === "Footer") {
          templateHtml = `<footer class="bg-[#040609] border-t border-white/[0.08] py-16 px-4 text-center text-gray-500"><p>© 2026 {{TITLE}}. All rights reserved.</p></footer>`;
        } else {
          templateHtml = `<section class="p-20 text-center bg-slate-900 text-white"><h2 class="text-3xl">{{SECTION_TITLE}}</h2></section>`;
        }
      }

      const finalHtml = await synthesizeSectionHtml(client, templateHtml, section, business, plan!.theme, userPrompt || "");
      return { id: `block-${Date.now()}-${idx}`, type: "RawHtml", order: idx + 1, props: { html: finalHtml, originalCategory: section.category } };
    }),
  );

  return { theme: plan.theme, blocks: generatedBlocks };
}
