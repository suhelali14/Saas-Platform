import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { getWebsiteConfig, saveWebsiteConfig, generateWebsiteHTML, processPublicStorefrontOrder, applyGenreProductToBusiness, type GenreApplyCustomizations } from "../../lib/website-render.js";
import { generateStorefrontWithAI } from "../../lib/website-ai.js";
import { generateReactAppAndExportToGitHub } from "../../lib/react-export.js";

// Ported from SAAS/backend/src/modules/website (unify-platform Phase 3) --
// the AI storefront generator, GitHub export, public storefront + direct
// checkout, and the Genre Product catalog/request system.
//
// Security fix vs. SAAS's original: `listGenreRequests`/`updateGenreRequest`
// had zero scoping at all (no businessId check, described as "admin"
// endpoints behind the same `authMiddleware` any business user gets) --
// any authenticated business could list and edit every other business's
// genre requests, including their contact phone/email. There's no
// platform-admin role in this schema, so the honest fix is scoping both
// to the caller's own business, not silently preserving a cross-tenant
// data leak.

const configSchema = z
  .object({
    template: z.string().optional(),
    theme: z.record(z.unknown()).optional(),
    primaryColor: z.string().optional(),
    font: z.string().optional(),
    storefrontMode: z.string().optional(),
    heroTitle: z.string().optional(),
    heroSubtitle: z.string().optional(),
    heroImage: z.string().optional(),
    showProducts: z.boolean().optional(),
    showServices: z.boolean().optional(),
    showWhatsApp: z.boolean().optional(),
    showReviews: z.boolean().optional(),
    enableOrdering: z.boolean().optional(),
    subdomain: z.string().optional(),
    customDomain: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    blocks: z.array(z.record(z.unknown())).optional(),
    isPublished: z.boolean().optional(),
  })
  .passthrough();

const generateAiSchema = z.object({ prompt: z.string().optional() });
const exportGithubSchema = z.object({ repoName: z.string().min(1) });

const checkoutSchema = z.object({
  slugOrId: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  deliveryAddress: z.string().optional(),
  items: z
    .array(z.object({ id: z.string().optional(), name: z.string(), price: z.coerce.number(), qty: z.coerce.number().int().positive() }))
    .min(1),
  paymentMethod: z.enum(["COD", "RAZORPAY", "UPI"]).optional(),
  notes: z.string().optional(),
});

const applyGenreSchema = z.object({
  customizations: z
    .object({
      primaryColor: z.string().optional(),
      font: z.string().optional(),
      disabledSections: z.array(z.string()).optional(),
      sectionOverrides: z.record(z.unknown()).optional(),
    })
    .optional(),
});

const genreRequestSchema = z.object({
  genre: z.string(),
  requirements: z.string().min(10, "Please describe your requirements in at least 10 characters."),
  referenceUrls: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
});

const patchGenreRequestSchema = z.object({ status: z.string().optional(), adminNotes: z.string().optional() });

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

export async function bizWebsiteRoutes(app: FastifyInstance) {
  // ── Public storefront (no auth) ─────────────────────────────────────────
  app.get("/api/biz/website/public/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    let business = await prisma.business.findUnique({ where: { slug } });
    if (!business) business = (await prisma.business.findFirst({ where: { isActive: true } })) ?? (await prisma.business.findFirst());
    if (!business) return reply.status(404).send({ error: "Website not found" });

    const html = await generateWebsiteHTML(business.id);
    reply.header("Content-Type", "text/html");
    return reply.send(html);
  });

  app.post("/api/biz/website/public/checkout", async (request, reply) => {
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    try {
      const result = await processPublicStorefrontOrder(d.slugOrId, {
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        deliveryAddress: d.deliveryAddress,
        items: d.items,
        notes: d.notes,
      });
      return reply.status(201).send(result);
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Checkout failed" });
    }
  });

  // ── Authenticated config / AI / export ──────────────────────────────────
  app.get("/api/biz/website/config", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;
    return getWebsiteConfig(auth.businessId);
  });

  app.post("/api/biz/website/config", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = configSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    return saveWebsiteConfig(auth.businessId, parsed.data);
  });

  app.get("/api/biz/website/preview", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const html = await generateWebsiteHTML(auth.businessId);
    const query = request.query as Record<string, string | undefined>;
    if (query.format === "html") {
      reply.header("Content-Type", "text/html");
      return reply.send(html);
    }
    return { html };
  });

  app.post("/api/biz/website/generate-ai", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = generateAiSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const aiData = await generateStorefrontWithAI(auth.businessId, parsed.data.prompt);
    await saveWebsiteConfig(auth.businessId, { theme: aiData.theme, blocks: aiData.blocks });
    const html = await generateWebsiteHTML(auth.businessId);
    return { aiData, html };
  });

  app.post("/api/biz/website/export-github", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = exportGithubSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const url = await generateReactAppAndExportToGitHub(auth.businessId, parsed.data.repoName);
      return { url };
    } catch (err) {
      const message = err instanceof Error ? err.message : "GitHub export failed";
      const status = message.includes("not configured") ? 503 : 400;
      return reply.status(status).send({ error: message });
    }
  });

  app.get("/api/biz/website/template/:category", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { category } = request.params as { category: string };
    const templates = await prisma.componentTemplate.findMany({ where: { category }, take: 1 });
    const html = templates.length > 0 ? templates[0]!.htmlContent : `<section class="p-20 text-center text-white bg-slate-900"><h2 class="text-3xl">${category}</h2></section>`;
    return { html };
  });

  // ── Genre Product catalog ───────────────────────────────────────────────
  app.get("/api/biz/website/genre-products", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;
    return prisma.genreProduct.findMany({ where: { isActive: true }, orderBy: { usageCount: "desc" } });
  });

  app.get("/api/biz/website/genre-products/:genre", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { genre } = request.params as { genre: string };
    const genreUpper = genre.toUpperCase();

    let product = await prisma.genreProduct.findUnique({ where: { genre: genreUpper } });
    if (!product) {
      const mapped = GENRE_MAPPING[genreUpper];
      if (mapped) product = await prisma.genreProduct.findUnique({ where: { genre: mapped } });
    }
    return product;
  });

  app.post("/api/biz/website/genre-products/:id/apply", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = applyGenreSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const customizations = parsed.data.customizations ?? {};

    const product = await prisma.genreProduct.findUnique({ where: { id } });
    if (!product) return reply.status(404).send({ error: "Genre product not found" });

    const business = await prisma.business.findUnique({ where: { id: auth.businessId } });
    if (!business) return reply.status(404).send({ error: "Business not found" });

    const { theme, blocks } = await applyGenreProductToBusiness(business, product, customizations as GenreApplyCustomizations);

    return { theme, blocks, product };
  });

  // ── Genre Product Requests (scoped to caller's own business) ───────────
  app.post("/api/biz/website/genre-requests", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = genreRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const genreRequest = await prisma.genreProductRequest.create({
      data: {
        businessId: auth.businessId,
        genre: d.genre,
        requirements: d.requirements,
        referenceUrls: d.referenceUrls,
        contactPhone: d.contactPhone,
        contactEmail: d.contactEmail,
        status: "PENDING",
      },
    });
    return reply.status(201).send(genreRequest);
  });

  app.get("/api/biz/website/genre-requests", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    return prisma.genreProductRequest.findMany({
      where: { businessId: auth.businessId, ...(query.status ? { status: query.status } : {}) },
      orderBy: { createdAt: "desc" },
    });
  });

  app.patch("/api/biz/website/genre-requests/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.genreProductRequest.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const parsed = patchGenreRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    return prisma.genreProductRequest.update({
      where: { id },
      data: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.adminNotes !== undefined ? { adminNotes: parsed.data.adminNotes } : {}),
      },
    });
  });
}
