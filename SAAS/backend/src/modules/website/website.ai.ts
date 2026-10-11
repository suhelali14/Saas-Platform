import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../../lib/prisma';

export interface WebsiteBlock {
  id: string;
  type: string;
  order: number;
  props: any;
}

export interface AIStorefrontData {
  theme: {
    primaryColor: string;
    font: string;
    mode: 'dark' | 'light';
  };
  blocks: WebsiteBlock[];
}

// ─── AI Client Helpers ──────────────────────────────────────────────────────
function getOpenAI(apiKey?: string | null): OpenAI | null {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key || key.trim() === '') return null;
  return new OpenAI({ apiKey: key });
}

function getGemini(apiKey?: string | null) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '') return null;
  return new GoogleGenerativeAI(key);
}

// ─── Default Fallback Block Generator ────────────────────────────────────────
function getDefaultBlocks(business: any): WebsiteBlock[] {
  return [
    {
      id: 'block-1',
      type: 'Hero',
      order: 1,
      props: {
        title: `Welcome to ${business.name}`,
        subtitle: business.description || 'Your trusted local business.',
        badge: 'Top Rated Business',
        ctaPrimary: 'Explore Now',
        ctaSecondary: 'Contact Us',
      }
    },
    {
      id: 'block-2',
      type: 'FeatureGrid',
      order: 2,
      props: {
        features: [
          { title: 'Quality Assured', description: 'We guarantee 100% authentic quality.' },
          { title: 'Fast Support', description: 'We are available 24/7 on WhatsApp.' },
          { title: 'Secure Checkout', description: 'Safe and encrypted transactions.' }
        ]
      }
    },
    {
      id: 'block-3',
      type: 'Products',
      order: 3,
      props: {
        title: 'Our Best Sellers',
        limit: 8
      }
    },
    {
      id: 'block-4',
      type: 'ContactForm',
      order: 4,
      props: {
        title: 'Get in Touch',
        email: business.email || 'hello@example.com'
      }
    }
  ];
}

// ─── Main AI Generator Function (RAG Powered) ─────────────────────────────────

async function synthesizeSectionHtml(
  aiClient: any,
  isGemini: boolean,
  templateHtml: string,
  section: any,
  business: any,
  theme: any,
  userPrompt: string
): Promise<string> {
  const prompt = `You are an expert Frontend Architect.
Your task is to customize a base Tailwind HTML component to perfectly match the business described below.
Business: ${business.name} (${business.type || 'RETAIL'})
Description: ${business.description}
Contact: ${business.phone || '9876543210'}, ${business.email || 'support@example.com'}
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

  try {
    if (aiClient) {
      if (isGemini) {
        const model = aiClient.getGenerativeModel({ model: 'gemini-1.5-pro' });
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        return text.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      } else {
        const res = await aiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }]
        });
        let text = res.choices[0].message.content || '';
        return text.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
      }
    }
  } catch (err) {
    console.error('Section Synthesis Failed, falling back to regex replace:', err);
  }

  // Fallback string replacement
  return templateHtml
    .replace(/\{\{BUSINESS_NAME\}\}/g, business.name)
    .replace(/\{\{TITLE\}\}/g, business.name)
    .replace(/\{\{SUBTITLE\}\}/g, business.description || 'Premium quality, exceptional service.')
    .replace(/\{\{PHONE\}\}/g, business.phone || '+91 98765 43210')
    .replace(/\{\{EMAIL\}\}/g, business.email || 'hello@' + (business.slug || 'business') + '.com')
    .replace(/\{\{PRIMARY_COLOR\}\}/g, theme.primaryColor)
    .replace(/\{\{CTA_PRIMARY\}\}/g, 'Get Started')
    .replace(/\{\{CTA_SECONDARY\}\}/g, 'Learn More');
}

export async function generateStorefrontWithAI(
  businessId: string,
  userPrompt?: string
): Promise<AIStorefrontData> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      products: { take: 8, where: { isActive: true } },
      services: { take: 4, where: { isActive: true } },
    },
  });

  if (!business) throw new Error('Business not found');

  const bType = business.type || 'RETAIL_GROCERY';
  const provider = business.aiProvider || 'openai';
  const apiKey = business.aiApiKey;

  // 0. Check if a Genre Product exists for this industry
  const genreMapping: Record<string, string> = {
    SPA: 'SALON',
    CAFE: 'RESTAURANT',
    BAKERY: 'RESTAURANT',
    HOSPITAL: 'CLINIC',
    PHARMACY: 'CLINIC',
    BOUTIQUE: 'D2C_BRAND',
    KIRANA_STORE: 'RETAIL_STORE',
    GROCERY: 'RETAIL_STORE',
    ELECTRONICS: 'RETAIL_STORE',
  };

  const mappedGenre = genreMapping[bType] || bType;
  const genreProduct = await prisma.genreProduct.findUnique({
    where: { genre: mappedGenre }
  });

  if (genreProduct) {
    // If a genre product exists, we use it directly as the plan!
    // The AI's job is just to synthesize the specific copy for the user's prompt.
    const plan = {
      theme: genreProduct.defaultTheme,
      sections: genreProduct.sections
    };

    // Synthesize the sections
    const dynamicBlocks: WebsiteBlock[] = [];
    const aiClient = provider === 'gemini' ? getGemini(apiKey) : getOpenAI(apiKey);
    const isGemini = provider === 'gemini';

    const sectionPromises = (plan.sections as any[]).map(async (section: any, idx: number) => {
      const finalHtml = await synthesizeSectionHtml(
        aiClient,
        isGemini,
        section.htmlContent,
        section,
        business,
        plan.theme,
        userPrompt || ''
      );

      return {
        id: section.id || `block-${Date.now()}-${idx}`,
        type: 'RawHtml',
        order: idx + 1,
        props: {
          html: finalHtml,
          originalCategory: section.category,
          sectionName: section.name,
          editable: true
        }
      };
    });

    const generatedBlocks = await Promise.all(sectionPromises);
    
    // Update usage count
    await prisma.genreProduct.update({
      where: { id: genreProduct.id },
      data: { usageCount: { increment: 1 } }
    });

    return {
      theme: plan.theme as any,
      blocks: generatedBlocks
    };
  }

  // 1. Fallback Planning Phase: What sections do we need? (Generic generation)
  const planPrompt = `You are a web architect. Plan a high-converting landing page for an Indian SMB business.
- Business Name: "${business.name}"
- Business Type: "${bType}"
- Description: "${business.description || 'Local business'}"
- User Request: "${userPrompt || 'Generate modern storefront'}"

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

  let plan: any = null;
  let aiClient: any = null;
  let isGemini = provider === 'gemini';

  try {
    if (isGemini) {
      aiClient = getGemini(apiKey);
      if (aiClient) {
        const model = aiClient.getGenerativeModel({ model: 'gemini-1.5-pro' });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: planPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });
        plan = JSON.parse(result.response.text());
      }
    } else {
      aiClient = getOpenAI(apiKey);
      if (aiClient) {
        const res = await aiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: planPrompt }],
          response_format: { type: 'json_object' }
        });
        plan = JSON.parse(res.choices[0].message.content || '{}');
      }
    }
  } catch (error) {
    console.warn('AI Planning Failed, using fallback plan:', error);
  }

  if (!plan || !plan.sections) {
    plan = {
      theme: { primaryColor: '#10b981', font: 'Plus Jakarta Sans', mode: 'dark' },
      sections: [
        { category: 'Header', instruction: 'Glassmorphism sticky header' },
        { category: 'Hero', instruction: 'Ultra-Luxury Glassmorphism Hero for ' + business.name },
        { category: 'FeatureGrid', instruction: 'Bento grid highlighting core value propositions and authentic quality' },
        { category: 'Products', instruction: 'Curated luxury product catalog with quick order triggers' },
        { category: 'Testimonials', instruction: 'Social proof with verified 5-star customer reviews' },
        { category: 'ContactForm', instruction: 'Glassmorphic contact and WhatsApp inquiry concierge' },
        { category: 'Footer', instruction: 'Modern premium footer' }
      ]
    };
  }

  // 2. Retrieval & Synthesis Phase (RAG)
  const dynamicBlocks: WebsiteBlock[] = [];

  const sectionPromises = plan.sections.map(async (section: any, idx: number) => {
    let templateHtml = '';

    // Step A: Retrieve best template from Vector DB
    try {
      const templates = await prisma.componentTemplate.findMany({
        where: { category: section.category },
        take: 1
      });
      
      if (templates.length > 0) {
        templateHtml = templates[0].htmlContent;
      }
    } catch (e) {
      console.warn('DB Retrieval failed for', section.category);
    }

    if (!templateHtml) {
      if (section.category === 'Header') {
        templateHtml = `<header class="sticky top-0 z-50 backdrop-blur-2xl bg-[#07090e]/80 border-b border-white/[0.08] p-4 flex justify-between items-center text-white"><div class="font-black text-xl">{{TITLE}}</div><nav class="hidden md:flex gap-6"><a href="#products">Products</a><a href="#contact">Contact</a></nav></header>`;
      } else if (section.category === 'Footer') {
        templateHtml = `<footer class="bg-[#040609] border-t border-white/[0.08] py-16 px-4 text-center text-gray-500"><p>© 2026 {{TITLE}}. All rights reserved.</p></footer>`;
      } else {
        templateHtml = `<section class="p-20 text-center bg-slate-900 text-white"><h2 class="text-3xl">{{SECTION_TITLE}}</h2></section>`;
      }
    }

    // Step B: Synthesize (Inject Content)
    const finalHtml = await synthesizeSectionHtml(
      aiClient,
      isGemini,
      templateHtml,
      section,
      business,
      plan.theme,
      userPrompt || ''
    );

    return {
      id: `block-${Date.now()}-${idx}`,
      type: 'RawHtml',
      order: idx + 1,
      props: {
        html: finalHtml,
        originalCategory: section.category
      }
    };
  });

  const generatedBlocks = await Promise.all(sectionPromises);
  dynamicBlocks.push(...generatedBlocks);

  return {
    theme: plan.theme,
    blocks: dynamicBlocks
  };
}
