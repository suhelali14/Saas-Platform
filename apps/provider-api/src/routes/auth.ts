import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifyPassword, hashPassword } from "../lib/password.js";
import { signProviderToken } from "../lib/jwt.js";
import { requireProviderAuth } from "../plugins/auth.js";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function authRoutes(app: FastifyInstance) {
  // The console can provision billable infrastructure and read every
  // customer's commercial terms, so its login is throttled harder than the
  // clinic's.
  app.post(
    "/api/provider/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    // One message for both failure modes -- no account enumeration.
    const invalid = () => reply.status(401).send({ error: "Invalid email or password" });

    const user = await prisma.providerUser.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.isActive) return invalid();
    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid();

    return {
      token: signProviderToken(user.id, user.role),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      };
    },
  );

  app.get("/api/provider/auth/me", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const user = await prisma.providerUser.findUnique({
      where: { id: auth.id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) return reply.status(404).send({ error: "Not found" });
    return { user };
  });

  app.post("/api/provider/auth/password", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const parsed = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(200) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const user = await prisma.providerUser.findUnique({ where: { id: auth.id } });
    if (!user) return reply.status(404).send({ error: "Not found" });
    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return reply.status(400).send({ error: "Current password is incorrect" });
    }
    await prisma.providerUser.update({ where: { id: auth.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
    return { ok: true };
  });
}
