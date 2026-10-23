import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifyPassword } from "../lib/password.js";
import { signClinicToken } from "../lib/jwt.js";
import {
  createSession, listSessions, newSessionId, revokeOtherSessions, revokeSession,
} from "../lib/sessions.js";
import { env } from "../config/env.js";
import { requireClinicAuth } from "../plugins/auth.js";
import { auditAuth } from "../lib/audit.js";
import { isFeatureEnabled } from "../config/features.js";

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

    // The session is the thing that can be cancelled; the token only
    // points at it. Created before the token is signed, so a Redis
    // failure means no sign-in rather than a token with nothing behind
    // it -- which would be a credential nobody could revoke.
    const sid = newSessionId();
    try {
      await createSession(sid, {
        userId: user.id,
        role: user.role,
        isAdmin: user.isAdmin,
        tokenVersion: user.tokenVersion,
        createdAt: new Date().toISOString(),
        userAgent: (request.headers["user-agent"] ?? "").slice(0, 120) || undefined,
      });
    } catch {
      return reply.status(503).send({
        error: "Sign-in is temporarily unavailable. Please try again in a moment.",
      });
    }

    // One device per login, unless this deployment turned it off. Done
    // AFTER the new session exists, so a failure here leaves the person
    // signed in on both rather than on neither -- losing a seat guarantee
    // is a billing problem, locking a clinic out is a clinical one.
    let endedElsewhere = 0;
    if (env.CLINIC_SINGLE_DEVICE) {
      try {
        endedElsewhere = await revokeOtherSessions(user.id, sid);
      } catch {
        // Logged, not fatal. See above.
        request.log.warn({ userId: user.id }, "could not end this user's other sessions");
      }
    }
    if (endedElsewhere > 0) {
      auditAuth(request, "SESSION_TAKEOVER", { id: user.id, name: user.name, role: user.role });
    }

    const token = signClinicToken(user.id, user.role, sid);
    return {
      token,
      user: {
        id: user.id, email: user.email, name: user.name,
        role: user.role, isAdmin: user.isAdmin,
      },
      /** So the new device can say "we signed you out on your other one". */
      endedElsewhere,
    };
  });

  // ── Signing out, for real ────────────────────────────────────────────
  //
  // There was no logout endpoint at all: the browser dropped its copy of
  // the token and the token itself stayed valid for up to twelve hours.
  // On a shared front-desk machine that is not signing out.
  app.post("/api/clinic/auth/logout", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    if (auth.sessionId) await revokeSession(auth.sessionId, auth.clinicUserId);
    return { ok: true };
  });

  // Where this account is signed in, and a way to end any of them. Shown
  // to the person themselves -- an admin ends other people's sessions by
  // deactivating them or changing their role, both of which revoke.
  app.get("/api/clinic/auth/sessions", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    return { sessions: await listSessions(auth.clinicUserId, auth.sessionId ?? undefined) };
  });

  app.post("/api/clinic/auth/sessions/revoke-others", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const all = await listSessions(auth.clinicUserId, auth.sessionId ?? undefined);
    let ended = 0;
    for (const sess of all) {
      if (sess.current) continue;
      await revokeSession(sess.sid, auth.clinicUserId);
      ended += 1;
    }
    return { ended };
  });

  app.get("/api/clinic/auth/me", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const user = await prisma.clinicUser.findUnique({
      where: { id: auth.clinicUserId },
      select: { id: true, email: true, name: true, role: true, isAdmin: true },
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
