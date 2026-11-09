import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppointmentStatus } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { byTriage, VISIT_PRIORITIES } from "../lib/triage.js";
import { dayBounds, nextToken, stampsFor } from "../lib/queue.js";
import { requireClinicAuth, requireVitalsAuth } from "../plugins/auth.js";

const createSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().optional(),
  scheduledAt: z.string().datetime(),
  reason: z.string().max(500).optional(),
  /** What this visit is, for triage. Omitted means "whatever is usual
   *  for this patient". All five are legitimate here, unlike on the
   *  patient record -- see lib/triage.ts. */
  priority: z.enum(VISIT_PRIORITIES).optional(),
});

const updateSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  reason: z.string().max(500).optional(),
  doctorId: z.string().nullable().optional(),
  // Nullable: clearing it falls back to the patient's usual priority.
  priority: z.enum(VISIT_PRIORITIES).nullable().optional(),
});

/** Someone who is here now, without a booking. */
const walkInSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().optional(),
  reason: z.string().max(500).optional(),
  priority: z.enum(VISIT_PRIORITIES).optional(),
});

const vitalsSchema = z.object({
  bp: z.string().max(20).optional(),
  temp: z.string().max(20).optional(),
  spo2: z.string().max(10).optional(),
  weight: z.string().max(20).optional(),
  pulse: z.string().max(20).optional(),
});

// `priority` is a scalar on Appointment, so it comes back by default;
// `category` stays on the patient select because the queue falls back
// to it when a visit has none of its own.
const APPOINTMENT_INCLUDE = {
  patient: { select: { id: true, name: true, uhid: true, phone: true, age: true, gender: true, allergies: true, category: true } },
  doctor: { select: { id: true, name: true } },
};

// OPD triage priority lives in lib/triage.ts, with the reasoning for the
// tiers and for why a visit's priority beats the patient's. It was
// defined here and again in clinic-public.ts, across three sort sites --
// a queue that disagrees with the waiting-room display about who is next
// is worse than either being wrong alone.
export { PRIORITY_TIER } from "../lib/triage.js";

export async function clinicAppointmentRoutes(app: FastifyInstance) {
  // Active doctors, for the booking form's doctor picker -- available on
  // every plan tier (unlike full staff management) since booking against a
  // specific doctor is a core, not add-on, workflow once a clinic has more
  // than one.
  app.get("/api/clinic/doctors", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const doctors = await prisma.clinicUser.findMany({
      where: { role: "DOCTOR", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { data: doctors };
  });

  // Today's queue by default -- both reception and the doctor live on this view.
  app.get("/api/clinic/appointments", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { date, status, doctorId } = request.query as { date?: string; status?: string; doctorId?: string };
    const { start: startOfDay, end: endOfDay } = dayBounds(date ? new Date(date) : new Date());

    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: startOfDay, lte: endOfDay },
        status: status ? (status as AppointmentStatus) : undefined,
        doctorId: doctorId ? doctorId : undefined,
      },
      include: APPOINTMENT_INCLUDE,
      orderBy: { scheduledAt: "asc" },
    });

    // Stable sort (guaranteed by the JS spec) on top of the scheduledAt-asc
    // fetch above -- within a tier, check-in time order is preserved exactly.
    const sorted = [...appointments].sort(
      byTriage,
    );
    return { data: sorted };
  });

  app.post("/api/clinic/appointments", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    if (parsed.data.doctorId) {
      const doctor = await prisma.clinicUser.findFirst({ where: { id: parsed.data.doctorId, role: "DOCTOR", isActive: true } });
      if (!doctor) return reply.status(400).send({ error: "Selected doctor not found" });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: parsed.data.patientId,
        doctorId: parsed.data.doctorId,
        scheduledAt: new Date(parsed.data.scheduledAt),
        reason: parsed.data.reason,
        // Left null when not given, which means "whatever is usual for
        // this patient" rather than "General" -- so a senior citizen keeps
        // their place without reception restating it every visit.
        priority: parsed.data.priority ?? null,
      },
      include: APPOINTMENT_INCLUDE,
    });
    return reply.status(201).send(appointment);
  });

  app.patch("/api/clinic/appointments/:id", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    // The times each stage was reached, and a token on arrival. Only when
    // the status actually changes: re-saving a row with the same status
    // must not move its check-in time and reset somebody's wait.
    const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined;
    const statusChanged = parsed.data.status !== undefined && parsed.data.status !== existing.status;
    const { needsToken, ...times } = statusChanged
      ? stampsFor(existing, parsed.data.status!, new Date())
      : { needsToken: false };
    const data = { ...parsed.data, scheduledAt, ...times };

    const appointment = needsToken
      ? await prisma.$transaction(async (tx) => {
          const tokenNumber = await nextToken(tx, scheduledAt ?? existing.scheduledAt);
          return tx.appointment.update({ where: { id }, data: { ...data, tokenNumber }, include: APPOINTMENT_INCLUDE });
        })
      : await prisma.appointment.update({ where: { id }, data, include: APPOINTMENT_INCLUDE });
    return appointment;
  });

  /*
   * A walk-in: the patient is at the desk now.
   *
   * Arrives checked in, with a token, in one call, because the front desk
   * is doing this with someone standing in front of them. Booking for "now"
   * and then checking in was two steps and a time to type.
   *
   * If the patient already has a booking today that they have not arrived
   * for, that booking is the visit: it is checked in, rather than a second
   * appointment made beside it, which would leave the doctor with two rows
   * for one person and the booked one forever "not arrived". If they are
   * already in the queue, that is said, with their token, rather than a
   * second token issued.
   */
  app.post("/api/clinic/appointments/walk-in", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const parsed = walkInSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });
    if (parsed.data.doctorId) {
      const doctor = await prisma.clinicUser.findFirst({ where: { id: parsed.data.doctorId, role: "DOCTOR", isActive: true } });
      if (!doctor) return reply.status(400).send({ error: "Selected doctor not found" });
    }

    const now = new Date();
    const { start, end } = dayBounds(now);
    const today = await prisma.appointment.findMany({
      where: { patientId: patient.id, scheduledAt: { gte: start, lte: end }, status: { in: ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"] } },
      orderBy: { scheduledAt: "asc" },
    });
    const waiting = today.find((a) => a.status !== "SCHEDULED");
    if (waiting) {
      return reply.status(409).send({
        error: waiting.tokenNumber
          ? `${patient.name} is already in today's queue, token ${waiting.tokenNumber}.`
          : `${patient.name} is already in today's queue.`,
        appointmentId: waiting.id,
      });
    }
    const booked = today[0];

    const appointment = await prisma.$transaction(async (tx) => {
      if (booked) {
        const { needsToken, ...times } = stampsFor(booked, "CHECKED_IN", now);
        const tokenNumber = needsToken ? await nextToken(tx, booked.scheduledAt) : undefined;
        return tx.appointment.update({
          where: { id: booked.id },
          data: {
            status: "CHECKED_IN",
            ...times,
            ...(tokenNumber ? { tokenNumber } : {}),
            // What reception chose now is the more recent statement.
            ...(parsed.data.doctorId ? { doctorId: parsed.data.doctorId } : {}),
            ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
            ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
          },
          include: APPOINTMENT_INCLUDE,
        });
      }
      const tokenNumber = await nextToken(tx, now);
      return tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: parsed.data.doctorId,
          scheduledAt: now,
          status: "CHECKED_IN",
          checkedInAt: now,
          tokenNumber,
          reason: parsed.data.reason,
          priority: parsed.data.priority ?? null,
        },
        include: APPOINTMENT_INCLUDE,
      });
    });
    return reply.status(201).send({ ...appointment, matchedBooking: !!booked });
  });

  // Nurse (or doctor/admin) can record pre-consult vitals without full
  // case-sheet write access -- matches the real-world nurse role researched
  // for this phase (documents vitals, doesn't diagnose).
  app.patch("/api/clinic/appointments/:id/vitals", async (request, reply) => {
    const auth = requireVitalsAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = vitalsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { vitals: parsed.data },
      include: APPOINTMENT_INCLUDE,
    });
    return appointment;
  });

  // The "session data, appointment-wise" view -- everything created during
  // one visit, in one call. FHIR-Encounter-style: the appointment is the
  // anchor every clinical record from that visit references back to.
  // Also surfaces two things a doctor needs at the START of a consult, not
  // after digging through the patient's profile: allergy/chronic-condition
  // alerts, and a quick reference to the most recent prior visit.
  app.get("/api/clinic/appointments/:id/encounter", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, uhid: true, phone: true, age: true, gender: true, allergies: true, chronicConditions: true, bloodGroup: true } },
        doctor: { select: { id: true, name: true } },
      },
    });
    if (!appointment) return reply.status(404).send({ error: "Not found" });

    const [caseSheets, prescriptions, certificates, labOrders, previousVisit] = await Promise.all([
      prisma.caseSheet.findMany({ where: { appointmentId: id }, include: { doctor: { select: { name: true } }, attachments: true }, orderBy: { createdAt: "desc" } }),
      prisma.prescription.findMany({ where: { appointmentId: id }, include: { items: true, doctor: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.certificate.findMany({ where: { appointmentId: id }, include: { doctor: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.labOrder.findMany({ where: { appointmentId: id }, include: { items: true, doctor: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.caseSheet.findFirst({
        where: { patientId: appointment.patientId, appointmentId: { not: id } },
        select: { createdAt: true, diagnosis: true, chiefComplaint: true, followUpDate: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { appointment, caseSheets, prescriptions, certificates, labOrders, previousVisit };
  });
}
