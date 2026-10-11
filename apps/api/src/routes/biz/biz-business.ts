import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BusinessType, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";

// Ported from SAAS/backend/src/modules/business (unify-platform Phase 3).
// SAAS's updateBusiness/updateDNA accepted `data: any` and just passed
// whatever fields showed up straight to Prisma; replaced with explicit
// zod .partial() schemas here (this project's established convention),
// same effect (partial update, any subset of fields) but type-checked.
const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  type: z.nativeEnum(BusinessType).optional(),
  aiProvider: z.string().optional(),
  aiApiKey: z.string().optional(),
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
});

const updateDnaSchema = z.object({
  languages: z.array(z.string()).optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  workingHours: z.record(z.string(), z.unknown()).optional(),
  deliveryRules: z.record(z.string(), z.unknown()).optional(),
  paymentMethods: z.array(z.string()).optional(),
  pricingRules: z.record(z.string(), z.unknown()).optional(),
  policies: z.record(z.string(), z.unknown()).optional(),
});

export async function bizBusinessRoutes(app: FastifyInstance) {
  app.get("/api/biz/business/profile", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      include: {
        channels: true,
        websiteConfig: true,
        _count: {
          select: { customers: true, products: true, services: true, orders: true, employees: true, conversations: true },
        },
      },
    });
    if (!business) {
      return reply.status(404).send({ error: "Not found" });
    }
    return business;
  });

  app.put("/api/biz/business/profile", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const data = { ...parsed.data };
    
    // The frontend sends an empty string for the secret if it hasn't been changed.
    // If it's an empty string, we don't want to update it (which would wipe it).
    if (data.razorpayKeySecret === '') {
      delete data.razorpayKeySecret;
    }

    const business = await prisma.business.update({ where: { id: auth.businessId }, data });
    return business;
  });

  app.put("/api/biz/business/dna", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = updateDnaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const business = await prisma.business.update({
      where: { id: auth.businessId },
      data: parsed.data as Prisma.BusinessUpdateInput,
    });
    return business;
  });

  // Onboarding completion moved to POST /api/biz/onboarding/complete
  // (biz-onboarding.ts) -- that one runs the real provisioner (catalog +
  // website + operational profile) before flipping onboardingCompleted.
  // This bare version is intentionally not kept: a route that could flip
  // the flag without provisioning anything would let a business skip
  // straight to "done" with an empty catalog and no storefront, defeating
  // the whole point of smart onboarding.
}
