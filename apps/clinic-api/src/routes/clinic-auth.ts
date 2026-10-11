import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifyPassword } from "../lib/password.js";
import { signClinicToken } from "../lib/jwt.js";
import { requireClinicAuth } from "../plugins/auth.js";
import { auditAuth } from "../lib/audit.js";
import { isFeatureEnabled } from "../config/features.js";
import { env } from "../config/env.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function clinicAuthRoutes(app: FastifyInstance) {
  // Public -- lets the login screen show the real clinic name/logo instead
  // of generic branding, without leaking anything sensitive.
  app.get("/api/clinic/public-info", async () => {
    const clinic = await prisma.clinic.findFirst({ select: { name: true, logoPath: true } });
    return clinic ?? { name: "Clinic", logoPath: null };
  });

  // Five attempts a minute from one address. Far beyond honest mistyping,
  // and low enough that a brute-force attempt is pointless.
  app.post(
    "/api/clinic/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    // Generic failure message for both cases -- no account enumeration.
    // The audit entry records the attempted email, though: the response
    // stays vague to an attacker while the clinic's own admin can still see
    // repeated failed attempts against a real account.
    const invalid = (userId: string | null, role: string) => {
      auditAuth(request, "LOGIN_FAILED", { id: userId, name: email, role });
      return reply.status(401).send({ error: "Invalid email or password" });
    };

    const user = await prisma.clinicUser.findUnique({ where: { email } });
    if (!user || !user.isActive) return invalid(null, "(unknown)");

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return invalid(user.id, user.role);

    auditAuth(request, "LOGIN", { id: user.id, name: user.name, role: user.role });
    const token = signClinicToken(user.id, user.role);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  });

  app.get("/api/clinic/auth/me", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const user = await prisma.clinicUser.findUnique({
      where: { id: auth.clinicUserId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) return reply.status(404).send({ error: "Not found" });

    const clinic = await prisma.clinic.findFirst();

    return {
      user,
      clinic: clinic ? { name: clinic.name, doctorName: clinic.doctorName } : null,
      plan: env.CLINIC_PLAN,
      enabledFeatures: {
        staff: isFeatureEnabled("staff"),
      },
    };
  });
}
