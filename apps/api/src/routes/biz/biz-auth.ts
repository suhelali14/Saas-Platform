import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BusinessType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signBusinessToken } from "../../lib/jwt.js";
import { uniqueSlug } from "../../lib/slug.js";
import { requireBizAuth } from "../../plugins/auth.js";

// Ported from SAAS/backend/src/modules/auth (unify-platform Phase 2) --
// same register/login shape and behavior, adapted to Fastify + this
// project's zod-validation + BusinessUser naming. No refresh-token flow
// (SAAS had one via a second JWT_REFRESH_SECRET) -- Intently's own consumer
// auth doesn't have one either, and it wasn't in this phase's scope; a
// single 7-day token matches SAAS's original access-token expiry.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  businessName: z.string().min(1).max(200),
  // Not in SAAS's original register payload (their Business.city was
  // optional, filled in later during onboarding) -- required here because
  // this merged schema keeps Intently's Business.city as a required field
  // (mobile, mappers.ts, and the marketplace matcher all assume it's
  // present). Asking for it at signup is normal SaaS UX and avoids ever
  // writing a placeholder empty string as "real" data.
  city: z.string().min(1),
  businessType: z.nativeEnum(BusinessType).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function bizAuthRoutes(app: FastifyInstance) {
  app.post("/api/biz/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { email, password, name, phone, businessName, city, businessType } = parsed.data;

    const existing = await prisma.businessUser.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName,
          slug: uniqueSlug(businessName),
          type: businessType ?? "RETAIL_STORE",
          city,
          email,
          phone,
        },
      });

      const businessUser = await tx.businessUser.create({
        data: {
          email,
          password: passwordHash,
          name,
          phone,
          role: "OWNER",
          businessId: business.id,
        },
      });

      return { businessUser, business };
    });

    const token = signBusinessToken(result.businessUser.id, result.business.id, result.businessUser.role);

    return reply.status(201).send({
      token,
      businessUser: {
        id: result.businessUser.id,
        email: result.businessUser.email,
        name: result.businessUser.name,
        role: result.businessUser.role,
      },
      business: {
        id: result.business.id,
        name: result.business.name,
        slug: result.business.slug,
        type: result.business.type,
        onboardingCompleted: result.business.onboardingCompleted,
      },
    });
  });

  app.post("/api/biz/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const businessUser = await prisma.businessUser.findUnique({
      where: { email },
      include: { business: true },
    });
    if (!businessUser || !(await verifyPassword(password, businessUser.password))) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }
    if (!businessUser.isActive) {
      return reply.status(401).send({ error: "Account is deactivated" });
    }

    await prisma.businessUser.update({ where: { id: businessUser.id }, data: { lastLoginAt: new Date() } });

    const token = signBusinessToken(businessUser.id, businessUser.businessId, businessUser.role);

    return reply.status(200).send({
      token,
      businessUser: {
        id: businessUser.id,
        email: businessUser.email,
        name: businessUser.name,
        role: businessUser.role,
      },
      business: {
        id: businessUser.business.id,
        name: businessUser.business.name,
        slug: businessUser.business.slug,
        type: businessUser.business.type,
        onboardingCompleted: businessUser.business.onboardingCompleted,
      },
    });
  });

  app.get("/api/biz/auth/me", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const businessUser = await prisma.businessUser.findUnique({
      where: { id: auth.businessUserId },
      include: { business: true },
    });
    if (!businessUser) {
      return reply.status(404).send({ error: "Not found" });
    }

    return {
      id: businessUser.id,
      email: businessUser.email,
      name: businessUser.name,
      role: businessUser.role,
      business: {
        id: businessUser.business.id,
        name: businessUser.business.name,
        slug: businessUser.business.slug,
        type: businessUser.business.type,
        onboardingCompleted: businessUser.business.onboardingCompleted,
      },
    };
  });
}
