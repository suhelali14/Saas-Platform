import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { verifyPassword } from "../../lib/password.js";
import { signAdminToken } from "../../lib/jwt.js";
import { requireAdminAuth } from "../../plugins/auth.js";

// Platform trust layer -- admin auth (docs/plans platform-trust-layer).
// Deliberately no POST /register anywhere in this file. Admin accounts are
// created only by prisma/seed-admin.ts (run manually, out-of-band) -- a
// public self-registration endpoint for the account type that approves
// every other business's KYC would be the single worst place on this
// platform to get authorization wrong.

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function adminAuthRoutes(app: FastifyInstance) {
  app.post("/api/admin/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    // Same generic-failure message whether the email doesn't exist or the
    // password is wrong -- distinguishing the two lets an attacker enumerate
    // real admin email addresses one guess at a time.
    if (!admin || !(await verifyPassword(password, admin.password))) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }
    if (!admin.isActive) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const token = signAdminToken(admin.id, admin.role);
    return {
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    };
  });

  app.get("/api/admin/auth/me", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const admin = await prisma.adminUser.findUnique({ where: { id: auth.adminId } });
    if (!admin || !admin.isActive) return reply.status(404).send({ error: "Not found" });

    return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
  });
}
