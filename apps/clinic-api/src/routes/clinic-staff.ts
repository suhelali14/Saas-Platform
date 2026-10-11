import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ClinicRole } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../plugins/auth.js";
import { hashPassword } from "../lib/password.js";

// Gated behind the STANDARD+ plan feature ("staff") -- app.ts only
// registers this module at all when isFeatureEnabled("staff") is true.

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
  name: z.string().min(1).max(100),
  role: z.nativeEnum(ClinicRole),
});

export async function clinicStaffRoutes(app: FastifyInstance) {
  app.get("/api/clinic/staff", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const staff = await prisma.clinicUser.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return { data: staff };
  });

  app.post("/api/clinic/staff", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.clinicUser.findUnique({ where: { email: parsed.data.email } });
    if (existing) return reply.status(409).send({ error: "A staff account with this email already exists" });

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.clinicUser.create({
      data: { email: parsed.data.email, passwordHash, name: parsed.data.name, role: parsed.data.role },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    return reply.status(201).send(user);
  });

  app.patch("/api/clinic/staff/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = z.object({ isActive: z.boolean().optional(), role: z.nativeEnum(ClinicRole).optional() }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.clinicUser.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const user = await prisma.clinicUser.update({
      where: { id },
      data: parsed.data,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    return user;
  });
}
