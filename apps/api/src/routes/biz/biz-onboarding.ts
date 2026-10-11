import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BusinessType, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { classifyBusiness, CATEGORY_BUCKETS } from "../../lib/business-classifier.js";
import { provisionBusiness, recommendPlan, type OnboardingDraftData } from "../../lib/onboarding-provisioner.js";

// Smart-onboarding wizard API (docs/plans smart-onboarding). Replaces the
// old thin "PUT /business/profile { type }" + "POST /onboarding/complete"
// pair with a resumable multi-step draft (steps 1-6 only ever write to
// OnboardingDraft.data) and a real provisioning step (7 -- POST /complete)
// that creates the business's actual catalog/website/operational profile.

const bucketKeys = Object.keys(CATEGORY_BUCKETS) as [keyof typeof CATEGORY_BUCKETS, ...(keyof typeof CATEGORY_BUCKETS)[]];

// Every field optional -- PATCH /draft accumulates answers progressively,
// one step's worth per call, shallow-merged into the existing draft.
const draftDataSchema = z.object({
  bucket: z.enum(bucketKeys).optional(),
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  logo: z.string().optional(),
  offeredItems: z.array(z.object({ name: z.string().min(1), price: z.coerce.number().nonnegative(), description: z.string().optional() })).optional(),
  workingHours: z.record(z.string(), z.object({ open: z.string(), close: z.string() }).nullable()).optional(),
  fulfillment: z.array(z.enum(["DINE_IN", "PICKUP", "DELIVERY", "APPOINTMENT_ONLY"])).optional(),
  teamSize: z.enum(["SOLO", "SMALL", "MEDIUM", "LARGE"]).optional(),
  paymentMethods: z.array(z.string()).optional(),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
});

const patchDraftSchema = z.object({
  step: z.number().int().min(1).max(7),
  data: draftDataSchema,
});

const completeSchema = z.object({
  businessTypeOverride: z.nativeEnum(BusinessType).optional(),
});

async function getOrCreateDraft(businessId: string) {
  const existing = await prisma.onboardingDraft.findUnique({ where: { businessId } });
  if (existing) return existing;
  return prisma.onboardingDraft.create({ data: { businessId } });
}

/** Fills in safe defaults for anything a skipped optional step never set. */
function toProvisionerInput(data: Record<string, unknown>): OnboardingDraftData | null {
  const d = data as Partial<OnboardingDraftData>;
  if (!d.bucket || !d.name || !d.description) return null;

  return {
    bucket: d.bucket,
    name: d.name,
    description: d.description,
    city: "", // Business.city is already set at registration; provisioner doesn't touch it.
    address: d.address,
    phone: d.phone,
    logo: d.logo,
    offeredItems: d.offeredItems ?? [],
    workingHours: d.workingHours ?? {},
    fulfillment: d.fulfillment ?? [],
    teamSize: d.teamSize ?? "SOLO",
    paymentMethods: d.paymentMethods ?? [],
    whatsapp: d.whatsapp,
    instagram: d.instagram,
    razorpayKeyId: d.razorpayKeyId,
    razorpayKeySecret: d.razorpayKeySecret,
  };
}

export async function bizOnboardingRoutes(app: FastifyInstance) {
  app.get("/api/biz/onboarding/draft", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const draft = await getOrCreateDraft(auth.businessId);
    return { step: draft.step, data: draft.data, categoryBuckets: CATEGORY_BUCKETS };
  });

  app.patch("/api/biz/onboarding/draft", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = patchDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await getOrCreateDraft(auth.businessId);
    const mergedData = { ...(existing.data as Record<string, unknown>), ...parsed.data.data };

    const updated = await prisma.onboardingDraft.update({
      where: { businessId: auth.businessId },
      data: {
        step: Math.max(existing.step, parsed.data.step),
        data: mergedData as Prisma.InputJsonValue,
      },
    });

    return { step: updated.step, data: updated.data };
  });

  /**
   * Read-only preview for the Review step -- runs the classifier and plan
   * recommendation against the draft's current data without writing
   * anything to Product/Service/WebsiteConfig/Business.
   */
  app.post("/api/biz/onboarding/classify", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const draft = await getOrCreateDraft(auth.businessId);
    const input = toProvisionerInput(draft.data as Record<string, unknown>);
    if (!input) {
      return reply.status(400).send({ error: "Complete the category, name, and description steps first" });
    }

    const classification = await classifyBusiness({
      bucket: input.bucket,
      name: input.name,
      description: input.description,
      offeredItems: input.offeredItems,
    });

    const hasGenreTemplate = await prisma.genreProduct.findUnique({ where: { genre: classification.businessType } });

    return {
      ...classification,
      planRecommendation: recommendPlan(input),
      hasGenreTemplate: !!hasGenreTemplate,
    };
  });

  app.post("/api/biz/onboarding/complete", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = completeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const draft = await getOrCreateDraft(auth.businessId);
    const input = toProvisionerInput(draft.data as Record<string, unknown>);
    if (!input) {
      return reply.status(400).send({ error: "Complete the category, name, and description steps first" });
    }
    if (parsed.data.businessTypeOverride) {
      input.businessTypeOverride = parsed.data.businessTypeOverride;
    }

    const result = await provisionBusiness(auth.businessId, input);
    return result;
  });
}
