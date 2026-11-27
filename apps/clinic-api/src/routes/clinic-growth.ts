import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../plugins/auth.js";

/**
 * "Open Nayaverse Growth" (Growth's decision D53, docs/PLANS.md there).
 *
 * A clinic on Nayaverse Clinic gets a Growth account in one click, with
 * Reviews QR free for a year. The admin presses the button; this API asks
 * Growth, with the key both sides share, for a link valid for 30 minutes;
 * the browser opens it, and Growth makes the account or, the next time,
 * signs the same clinic's owner straight in.
 *
 * What is sent: the clinic's name and its own id (so the same clinic always
 * reaches the same account), and the admin's name and email. Nothing about
 * any patient, appointment or record.
 */
export async function clinicGrowthRoutes(app: FastifyInstance) {
  const available = () => Boolean(env.GROWTH_URL && env.GROWTH_PARTNER_KEY);

  app.get("/api/clinic/growth", async (request, reply) => {
    if (!requireAdminAuth(request, reply)) return;
    return { available: available() };
  });

  // An admin's own click, on screen: never by voice.
  app.post("/api/clinic/growth/open", { config: { assistant: false } }, async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    if (!available()) return reply.status(404).send({ error: "Nayaverse Growth is not connected to this clinic yet." });
    const [clinic, user] = await Promise.all([
      prisma.clinic.findFirst({ select: { id: true, name: true } }),
      prisma.clinicUser.findUnique({ where: { id: auth.clinicUserId }, select: { name: true, email: true } }),
    ]);
    if (!clinic || !user) return reply.status(409).send({ error: "Finish the clinic's settings first." });
    try {
      const res = await fetch(`${env.GROWTH_URL!.replace(/\/$/, "")}/api/partner/welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROWTH_PARTNER_KEY}` },
        body: JSON.stringify({ ref: clinic.id.toLowerCase(), businessName: clinic.name.slice(0, 80), kind: "clinic", ownerName: user.name.slice(0, 80), ownerEmail: user.email }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        request.log.warn({ status: res.status, error: body.error }, "growth welcome");
        return reply.status(502).send({ error: body.error ?? "Nayaverse Growth did not answer. Try again in a minute." });
      }
      return { url: body.url };
    } catch (err) {
      request.log.warn({ err }, "growth welcome");
      return reply.status(502).send({ error: "Nayaverse Growth did not answer. Try again in a minute." });
    }
  });
}
