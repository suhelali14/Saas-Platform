import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../plugins/auth.js";
import {
  freeSlots, hashToken, lastTen, localDay, newToken, samePhone, validCallback, weekHours, windowOf,
  type Busy, type DayHours, type WeekKey,
} from "../lib/connector.js";

/**
 * The Nayaverse Growth connector (Growth's docs/CLINIC_CONNECTOR.md).
 *
 * The clinic's admin creates a token in Settings and pastes it into Growth.
 * With it, the clinic's WhatsApp assistant may:
 *
 *   - read the clinic's name, doctors, timings, consultation fees and free
 *     slots (GET /catalogue, GET /slots);
 *   - ask for an appointment at a free time (POST /requests). It lands in
 *     the same list as the website's requests, and reception confirms or
 *     declines it as they do now; nothing is booked by the token;
 *   - tell a patient their own next appointment and the queue, by the
 *     phone the patient is writing from (GET /appointments).
 *
 * There is no route through which it reads a record, a prescription, a
 * result, another patient, or anything a patient did not just tell it.
 */

/** How long one consultation slot is, for the free times offered. */
const SLOT_MINUTES = 15;
const MAX_ACTIVE_TOKENS = 5;

interface Token {
  id: string;
  tokenHash: string;
}

/** The token on a connector call, or a 401. */
async function connectorAuth(request: FastifyRequest, reply: FastifyReply): Promise<Token | null> {
  const header = request.headers.authorization ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!raw.startsWith("nvc_") || raw.length > 200) {
    reply.status(401).send({ error: "A connector token is required." });
    return null;
  }
  const token = await prisma.connectorToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!token || token.revokedAt) {
    reply.status(401).send({ error: "This connector token is not valid." });
    return null;
  }
  // Written at most every five minutes: the screen says "last used", not a log.
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 5 * 60_000) {
    await prisma.connectorToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { id: token.id, tokenHash: token.tokenHash };
}

async function clinicHours(): Promise<{ name: string; hours: Partial<Record<WeekKey, DayHours>>; fee: number | null }> {
  const clinic = await prisma.clinic.findFirst({ select: { name: true, timings: true, defaultConsultationFee: true } });
  return {
    name: clinic?.name ?? "Clinic",
    hours: weekHours(clinic?.timings),
    fee: clinic?.defaultConsultationFee != null ? Number(clinic.defaultConsultationFee) : null,
  };
}

/** Times already taken on a day for a doctor: appointments, and WhatsApp requests still waiting. */
async function busyOn(day: Date, doctorId: string | null): Promise<Busy[]> {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  const appts = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: start, lte: end },
      status: { in: ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"] },
      ...(doctorId ? { doctorId } : {}),
    },
    select: { scheduledAt: true },
  });
  const held = await prisma.appointmentRequest.findMany({
    where: { status: "NEW", source: "whatsapp", requestedAt: { gte: start, lte: end }, ...(doctorId ? { doctorId } : {}) },
    select: { requestedAt: true },
  });
  const slot = SLOT_MINUTES * 60_000;
  return [
    ...appts.map((a) => ({ start: a.scheduledAt, end: new Date(a.scheduledAt.getTime() + slot) })),
    ...held.filter((r) => r.requestedAt).map((r) => ({ start: r.requestedAt!, end: new Date(r.requestedAt!.getTime() + slot) })),
  ];
}

async function doctorById(id: string | undefined): Promise<{ id: string; name: string } | null> {
  if (!id) return null;
  return prisma.clinicUser.findFirst({ where: { id, role: "DOCTOR", isActive: true }, select: { id: true, name: true } });
}

export async function clinicConnectorRoutes(app: FastifyInstance) {
  // ── The clinic's admin: tokens ───────────────────────────────────────
  app.get("/api/clinic/connector/tokens", async (request, reply) => {
    if (!requireAdminAuth(request, reply)) return;
    const tokens = await prisma.connectorToken.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, tokenTail: true, callbackUrl: true, createdByName: true, createdAt: true, lastUsedAt: true, revokedAt: true, revokedByName: true },
    });
    return { tokens: tokens.map((t) => ({ ...t, connected: Boolean(t.callbackUrl) })) };
  });

  // Not by voice: a token is a key to the clinic's diary, made by an admin
  // on purpose, on screen, where it is shown once.
  app.post("/api/clinic/connector/tokens", { config: { assistant: false } }, async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const body = z.object({ name: z.string().trim().min(2).max(80) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Give the token a name, like “WhatsApp assistant”." });
    const active = await prisma.connectorToken.count({ where: { revokedAt: null } });
    if (active >= MAX_ACTIVE_TOKENS) {
      return reply.status(409).send({ error: `There are already ${MAX_ACTIVE_TOKENS} working tokens. Revoke one you no longer use first.` });
    }
    const token = newToken();
    const created = await prisma.connectorToken.create({
      data: { name: body.data.name, tokenHash: hashToken(token), tokenTail: token.slice(-4), createdById: auth.clinicUserId, createdByName: request.clinicUserName },
      select: { id: true, name: true, tokenTail: true, createdAt: true },
    });
    // The only time the token is ever shown. It is not stored, so it
    // cannot be shown again: a lost token is revoked and a new one made.
    return reply.status(201).send({ ...created, token });
  });

  // Not by voice either: revoking cuts the WhatsApp assistant off at once.
  app.post("/api/clinic/connector/tokens/:id/revoke", { config: { assistant: false } }, async (request, reply) => {
    if (!requireAdminAuth(request, reply)) return;
    const { id } = request.params as { id: string };
    const found = await prisma.connectorToken.findUnique({ where: { id } });
    if (!found) return reply.status(404).send({ error: "Not found" });
    if (found.revokedAt) return { ok: true };
    await prisma.connectorToken.update({ where: { id }, data: { revokedAt: new Date(), revokedByName: request.clinicUserName } });
    return { ok: true };
  });

  // ── The connector ────────────────────────────────────────────────────
  const limit = { config: { rateLimit: { max: 240, timeWindow: "1 minute" } } };

  app.get("/api/connector/v1/catalogue", limit, async (request, reply) => {
    if (!(await connectorAuth(request, reply))) return;
    const { name, hours, fee } = await clinicHours();
    const doctors = await prisma.clinicUser.findMany({
      where: { role: "DOCTOR", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    const items = await prisma.serviceItem.findMany({
      where: { isActive: true, category: "CONSULTATION" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, defaultPrice: true },
      take: 30,
    });
    const services = items.length
      ? items.map((s) => ({ id: s.id, name: s.name, category: "Consultation", feePaise: Math.round(Number(s.defaultPrice) * 100), minutes: SLOT_MINUTES }))
      : [{ id: "consultation", name: "Consultation", category: "Consultation", feePaise: fee != null ? Math.round(fee * 100) : 0, minutes: SLOT_MINUTES }];
    return { clinic: name, doctors: doctors.map((d) => ({ ...d, hours })), services };
  });

  app.get("/api/connector/v1/slots", limit, async (request, reply) => {
    if (!(await connectorAuth(request, reply))) return;
    const q = z.object({ doctor: z.string().max(60).optional(), date: z.string().max(10) }).safeParse(request.query);
    const day = q.success ? localDay(q.data.date) : null;
    if (!q.success || !day) return reply.status(400).send({ error: "Give a doctor and a date as 2026-11-30." });
    const doctor = q.data.doctor ? await doctorById(q.data.doctor) : null;
    if (q.data.doctor && !doctor) return reply.status(404).send({ error: "No such doctor." });
    const { hours } = await clinicHours();
    const slots = freeSlots({ day, hours, minutes: SLOT_MINUTES, step: SLOT_MINUTES, busy: await busyOn(day, doctor?.id ?? null), now: new Date() });
    return { slots: slots.map((s) => s.toISOString()) };
  });

  app.post("/api/connector/v1/requests", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const token = await connectorAuth(request, reply);
    if (!token) return;
    const body = z
      .object({
        name: z.string().trim().max(120).optional(),
        phone: z.string().trim().min(6).max(20).regex(/^[0-9+][0-9 ()-]*$/),
        doctorId: z.string().max(60).optional().or(z.literal("")),
        serviceId: z.string().max(60).optional().or(z.literal("")),
        start: z.string().min(10).max(40),
      })
      .safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const start = new Date(body.data.start);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
      return reply.status(400).send({ error: "That time has passed." });
    }
    const doctor = body.data.doctorId ? await doctorById(body.data.doctorId) : null;
    if (body.data.doctorId && !doctor) return reply.status(404).send({ error: "No such doctor." });

    // The same number asking again within the hour is the same request.
    const recent = await prisma.appointmentRequest.findFirst({
      where: { status: "NEW", source: "whatsapp", createdAt: { gte: new Date(Date.now() - 60 * 60_000) }, phone: { contains: lastTen(body.data.phone).slice(-4) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent && samePhone(recent.phone, body.data.phone)) return reply.status(201).send({ id: recent.id });

    // Only a time the clinic would still offer: someone else may have taken it.
    const { hours } = await clinicHours();
    const free = freeSlots({ day: start, hours, minutes: SLOT_MINUTES, step: SLOT_MINUTES, busy: await busyOn(start, doctor?.id ?? null), now: new Date(), leadMinutes: 0 });
    if (!free.some((s) => s.getTime() === start.getTime())) {
      return reply.status(409).send({ error: "That time is no longer free." });
    }
    let serviceName: string | null = null;
    if (body.data.serviceId && body.data.serviceId !== "consultation") {
      const s = await prisma.serviceItem.findFirst({ where: { id: body.data.serviceId, isActive: true }, select: { name: true } });
      serviceName = s?.name ?? null;
    }
    const day = new Date(start);
    day.setHours(12, 0, 0, 0);
    const created = await prisma.appointmentRequest.create({
      data: {
        name: body.data.name && body.data.name.length >= 2 ? body.data.name : "Patient on WhatsApp",
        phone: body.data.phone,
        preferredDate: day,
        preferredSlot: windowOf(start),
        reason: `Asked on WhatsApp${serviceName ? ` for ${serviceName}` : ""}${doctor ? ` with ${doctor.name}` : ""}`,
        source: "whatsapp",
        requestedAt: start,
        doctorId: doctor?.id ?? null,
        serviceName,
        connectorTokenId: token.id,
      },
      select: { id: true },
    });
    return reply.status(201).send({ id: created.id });
  });

  app.get("/api/connector/v1/appointments", limit, async (request, reply) => {
    if (!(await connectorAuth(request, reply))) return;
    const q = z.object({ phone: z.string().min(6).max(20) }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ error: "Give the phone number." });
    const tail = lastTen(q.data.phone);
    if (tail.length !== 10) return { appointment: null };

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    // Prefiltered on the last four digits in the database, matched on ten here:
    // the register holds numbers written every which way.
    const patients = (await prisma.patient.findMany({ where: { phone: { contains: tail.slice(-4) } }, select: { id: true, phone: true }, take: 50 }))
      .filter((p) => samePhone(p.phone, tail));
    const appt = patients.length
      ? await prisma.appointment.findFirst({
          where: { patientId: { in: patients.map((p) => p.id) }, scheduledAt: { gte: start }, status: { in: ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"] } },
          orderBy: { scheduledAt: "asc" },
          select: { scheduledAt: true, status: true, tokenNumber: true, doctorId: true, doctor: { select: { name: true } } },
        })
      : null;
    if (appt) {
      let current = 0;
      let ahead: number | null = null;
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const today = appt.scheduledAt <= end;
      if (today && appt.tokenNumber && appt.status === "CHECKED_IN") {
        const scope = { scheduledAt: { gte: start, lte: end }, ...(appt.doctorId ? { doctorId: appt.doctorId } : {}) };
        const seeing = await prisma.appointment.findFirst({ where: { ...scope, status: "IN_PROGRESS" }, orderBy: { startedAt: "desc" }, select: { tokenNumber: true } });
        current = seeing?.tokenNumber ?? 0;
        ahead = await prisma.appointment.count({ where: { ...scope, status: "CHECKED_IN", tokenNumber: { lt: appt.tokenNumber } } });
      }
      return {
        appointment: {
          doctor: appt.doctor?.name ?? "",
          start: appt.scheduledAt.toISOString(),
          token: appt.tokenNumber ?? 0,
          current,
          ahead,
          status: "confirmed",
        },
      };
    }
    // Asked on WhatsApp and not confirmed yet.
    const waiting = (await prisma.appointmentRequest.findMany({
      where: { status: "NEW", source: "whatsapp", requestedAt: { gte: start }, phone: { contains: tail.slice(-4) } },
      orderBy: { requestedAt: "asc" },
      select: { phone: true, requestedAt: true, doctorId: true },
      take: 10,
    })).find((r) => samePhone(r.phone, tail));
    if (waiting?.requestedAt) {
      const doctor = waiting.doctorId ? await doctorById(waiting.doctorId) : null;
      return { appointment: { doctor: doctor?.name ?? "", start: waiting.requestedAt.toISOString(), token: 0, current: 0, ahead: null, status: "requested" } };
    }
    return { appointment: null };
  });

  app.put("/api/connector/v1/callback", limit, async (request, reply) => {
    const token = await connectorAuth(request, reply);
    if (!token) return;
    const body = z.object({ url: z.string().max(500) }).safeParse(request.body);
    if (!body.success || !validCallback(body.data.url)) {
      return reply.status(400).send({ error: "The address must be https on nayaverse.in." });
    }
    await prisma.connectorToken.update({ where: { id: token.id }, data: { callbackUrl: body.data.url } });
    return { ok: true };
  });
}
