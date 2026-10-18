import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireFrontDeskAuth } from "../plugins/auth.js";
import { generatePatientUhid } from "../lib/uhid.js";

/**
 * Patient-requested appointments.
 *
 * ── Why this is a request and not a booking ─────────────────────────
 *
 * The obvious feature is self-service booking: show the free slots, let
 * the patient take one. It was not built, for a reason that is about this
 * deployment rather than about effort -- the clinic has no SMS, WhatsApp
 * or email delivery. A patient who booked a confirmed slot would get an
 * on-screen message and then silence: no confirmation to keep, no
 * reminder the day before, and no way to be told if the doctor is away.
 * Meanwhile the clinic would have strangers filling the doctor's day with
 * nothing standing between an unverified name and the diary.
 *
 * So a request is a request. It says plainly that the clinic will call
 * back, it asks for a day and a rough window rather than a time the
 * clinic has not agreed to, and reception turns it into a real
 * appointment. Every one of those is honest about what the software can
 * actually deliver. When delivery exists, real slots can be layered on
 * top of this model without discarding it.
 *
 * ── What the public endpoint must not do ────────────────────────────
 *
 * It is the only unauthenticated write in the whole API, so it is the
 * only place a stranger can put data into a clinic's database.
 *
 *  - It never creates a Patient. An unverified name in the patient
 *    register would mix with real records, and the duplicate-merge tool
 *    exists precisely because split records make a doctor read half a
 *    history mid-consultation. A request lives in its own list until a
 *    person at the clinic looks at it.
 *  - It never reads anything back. There is no GET by id, no list, and
 *    no "check my request" lookup -- any of those would turn a phone
 *    number into an oracle for whether that person is a patient here.
 *  - It stores no IP address. The rate limit it needs operates on the
 *    request in flight; keeping the address afterwards would be
 *    collecting personal data to solve a problem that is already solved.
 */

const SLOTS = ["morning", "afternoon", "evening"] as const;

/** How far ahead someone may ask. A year out is not a real request. */
const MAX_DAYS_AHEAD = 120;

/**
 * Anchored to local noon, like every other date-only value in this
 * system. `new Date("2026-03-14")` is parsed as UTC midnight and reads
 * back as the 13th in IST -- the same trap already fixed in the queue's
 * date picker and in a patient's date of birth.
 */
function parseRequestedDate(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), 12, 0, 0, 0);
  // Reject a rolled-over date (31 February becomes 3 March) rather than
  // silently booking the wrong day.
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
  return date;
}

const publicRequestSchema = z.object({
  name: z.string().trim().min(2, "Please give a name").max(120),
  phone: z
    .string()
    .trim()
    .min(6, "Please give a phone number the clinic can call")
    .max(20)
    .regex(/^[0-9+][0-9 ()-]*$/, "Use digits, and + ( ) - if you need them"),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  preferredDate: z.string().trim().max(10).optional(),
  preferredSlot: z.enum(SLOTS).optional(),
  reason: z.string().trim().max(500).optional(),
});

/** Two requests from the same number within this window are treated as the
 *  same request -- a double tap on a slow connection, not two intentions. */
const DUPLICATE_WINDOW_MS = 60 * 60 * 1000;

export async function clinicBookingRoutes(app: FastifyInstance) {
  // ── Public: ask for an appointment ───────────────────────────────────
  app.post(
    "/api/clinic/public/appointment-requests",
    {
      // Much tighter than the global limit. This is an unauthenticated
      // write, so it is the endpoint someone would point a script at --
      // and a clinic's request list filled with noise is a denial of
      // service against reception, not just against the server.
      config: { rateLimit: { max: 5, timeWindow: "10 minutes" } },
    },
    async (request, reply) => {
      const parsed = publicRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const { name, phone, email, preferredSlot, reason } = parsed.data;

      let preferredDate: Date | null = null;
      if (parsed.data.preferredDate) {
        preferredDate = parseRequestedDate(parsed.data.preferredDate);
        if (!preferredDate) {
          return reply.status(400).send({ error: "That date did not look like a real day." });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (preferredDate < today) {
          return reply.status(400).send({ error: "That day has already passed." });
        }
        const limit = new Date(today.getTime() + MAX_DAYS_AHEAD * 86_400_000);
        if (preferredDate > limit) {
          return reply.status(400).send({ error: "Please pick a day within the next few months." });
        }
      }

      // Collapse an accidental double submit. Returns the SAME shape as a
      // fresh create, so the patient cannot tell the difference and does
      // not try again.
      const recent = await prisma.appointmentRequest.findFirst({
        where: {
          phone,
          status: "NEW",
          createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (recent) {
        return reply.status(201).send({ ok: true, id: recent.id });
      }

      const created = await prisma.appointmentRequest.create({
        data: {
          name,
          phone,
          email: email || null,
          preferredDate,
          preferredSlot: preferredSlot ?? null,
          reason: reason || null,
        },
      });

      // Deliberately minimal. The patient gets confirmation that it
      // arrived and nothing else -- no clinic internals, no queue
      // position, no indication of whether they are already a patient.
      return reply.status(201).send({ ok: true, id: created.id });
    },
  );

  // ── Front desk: the list ─────────────────────────────────────────────
  app.get("/api/clinic/appointment-requests", async (request, reply) => {
    const auth = requireFrontDeskAuth(request, reply);
    if (!auth) return;

    const query = z
      .object({
        status: z.enum(["NEW", "CONFIRMED", "DECLINED"]).optional(),
        take: z.coerce.number().int().min(1).max(200).optional(),
      })
      .safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: query.error.flatten() });

    const status = query.data.status ?? "NEW";
    const requests = await prisma.appointmentRequest.findMany({
      where: { status },
      // Oldest first for NEW: someone who asked yesterday has been
      // waiting longer than someone who asked a minute ago. Newest first
      // once handled, where the question is "what did we just do".
      orderBy: { createdAt: status === "NEW" ? "asc" : "desc" },
      take: query.data.take ?? 100,
      include: {
        patient: { select: { id: true, uhid: true, name: true } },
        appointment: { select: { id: true, scheduledAt: true, status: true } },
      },
    });

    const newCount = await prisma.appointmentRequest.count({ where: { status: "NEW" } });
    return { requests, newCount };
  });

  // ── Front desk: confirm ──────────────────────────────────────────────
  //
  // This is the step that creates real records, and it is one transaction
  // on purpose: a patient created without the appointment that justified
  // it, or an appointment whose request still reads NEW, are both states
  // someone has to clean up by hand later.
  app.post("/api/clinic/appointment-requests/:id/confirm", async (request, reply) => {
    const auth = requireFrontDeskAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const body = z
      .object({
        /** When the clinic is actually seeing them. */
        scheduledAt: z.string().min(1),
        doctorId: z.string().optional(),
        /** Link to an existing patient instead of creating one. Reception
         *  decides this, having seen the match -- guessing from a phone
         *  number would merge two people who share a household handset. */
        patientId: z.string().optional(),
        note: z.string().max(500).optional(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const when = new Date(body.data.scheduledAt);
    if (Number.isNaN(when.getTime())) {
      return reply.status(400).send({ error: "That appointment time did not parse." });
    }

    const existing = await prisma.appointmentRequest.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (existing.status !== "NEW") {
      return reply.status(409).send({ error: `This request was already ${existing.status.toLowerCase()}.` });
    }

    // Generated outside the transaction: it reads a Postgres sequence,
    // which is deliberately non-transactional so two reception desks
    // registering at once cannot collide.
    const uhid = body.data.patientId ? null : await generatePatientUhid();

    const result = await prisma.$transaction(async (tx) => {
      let patientId = body.data.patientId;

      if (patientId) {
        const found = await tx.patient.findUnique({ where: { id: patientId } });
        if (!found) throw Object.assign(new Error("That patient no longer exists."), { statusCode: 400 });
      } else {
        const patient = await tx.patient.create({
          data: {
            uhid: uhid!,
            name: existing.name,
            phone: existing.phone,
            email: existing.email,
          },
        });
        patientId = patient.id;
      }

      const appointment = await tx.appointment.create({
        data: {
          patientId,
          doctorId: body.data.doctorId ?? null,
          scheduledAt: when,
          reason: existing.reason ?? "Requested online",
        },
      });

      return tx.appointmentRequest.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          patientId,
          appointmentId: appointment.id,
          handledById: auth.clinicUserId,
          handledByName: request.clinicUserName,
          handledAt: new Date(),
          note: body.data.note ?? null,
        },
        include: {
          patient: { select: { id: true, uhid: true, name: true } },
          appointment: { select: { id: true, scheduledAt: true, status: true } },
        },
      });
    });

    return result;
  });

  // ── Front desk: decline ──────────────────────────────────────────────
  app.post("/api/clinic/appointment-requests/:id/decline", async (request, reply) => {
    const auth = requireFrontDeskAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const body = z.object({ note: z.string().max(500).optional() }).safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.appointmentRequest.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (existing.status !== "NEW") {
      return reply.status(409).send({ error: `This request was already ${existing.status.toLowerCase()}.` });
    }

    // Declined, never deleted. The clinic's record of who asked and what
    // was decided is the point; a tidy list that loses that is worse than
    // a long one.
    return prisma.appointmentRequest.update({
      where: { id },
      data: {
        status: "DECLINED",
        handledById: auth.clinicUserId,
        handledByName: request.clinicUserName,
        handledAt: new Date(),
        note: body.data.note ?? null,
      },
    });
  });
}
