import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthResponse, MeResponse } from "@intently/shared-types";
import { prisma } from "../lib/prisma.js";
import { signSessionToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { deriveReferralCode } from "../lib/referral.js";
import { requireAuth } from "../plugins/auth.js";

const anonymousAuthSchema = z.object({
  deviceId: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

/**
 * Anonymous-device auth (docs/14-mvp-implementation-plan.md M5) stays as a
 * "continue as guest" option; register/login are real email/password auth
 * added alongside it, not a replacement -- see docs/05-native-app-spec.md.
 * Phone/OTP is still a future upgrade needing an SMS provider this repo
 * doesn't have configured.
 */
export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/anonymous", async (request, reply) => {
    const parsed = anonymousAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { deviceId } = parsed.data;

    const user = await prisma.user.upsert({
      where: { deviceId },
      create: { deviceId },
      update: {},
    });

    const response: AuthResponse = { token: signSessionToken(user.id), userId: user.id, name: user.name };
    return reply.status(200).send(response);
  });

  app.post("/api/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "An account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });

    const response: AuthResponse = { token: signSessionToken(user.id), userId: user.id, name: user.name };
    return reply.status(201).send(response);
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const response: AuthResponse = { token: signSessionToken(user.id), userId: user.id, name: user.name };
    return reply.status(200).send(response);
  });

  app.get("/api/auth/me", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.status(404).send({ error: "Not found" });
    }

    const response: MeResponse = {
      userId: user.id,
      name: user.name,
      email: user.email,
      isGuest: !user.email,
      referralCode: deriveReferralCode(user.id),
    };
    return response;
  });

  app.post("/api/auth/change-password", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      return reply.status(400).send({ error: "This account doesn't have a password set (guest account)" });
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return reply.status(401).send({ error: "Current password is incorrect" });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    return reply.status(200).send({ success: true });
  });
}
