import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppointmentStatus } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireVitalsAuth } from "../plugins/auth.js";

const createSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().optional(),
  scheduledAt: z.string().datetime(),
  reason: z.string().max(500).optional(),
});

const updateSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  reason: z.string().max(500).optional(),
  doctorId: z.string().nullable().optional(),
});

const vitalsSchema = z.object({
  bp: z.string().max(20).optional(),
  temp: z.string().max(20).optional(),
  spo2: z.string().max(10).optional(),
  weight: z.string().max(20).optional(),
  pulse: z.string().max(20).optional(),
});

const APPOINTMENT_INCLUDE = {
  patient: { select: { id: true, name: true, uhid: true, phone: true, age: true, gender: true, allergies: true, category: true } },
  doctor: { select: { id: true, name: true } },
};

// OPD triage priority -- deterministic tier + FIFO-within-tier, not a
// black-box score (see the plan's Phase 3 research: real Indian hospital
// queues give configurable priority to emergencies, pregnant women, and
// senior citizens layered on the main FIFO queue, not a full re-sort).
// Lower number = seen sooner.
const PRIORITY_TIER: Record<string, number> = {
  EMERGENCY: 0,
  PREGNANT: 1,
  SENIOR_CITIZEN: 1,
  CHILD: 2,
  GENERAL: 3,
};

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
    const day = date ? new Date(date) : new Date();
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

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
      (a, b) => (PRIORITY_TIER[a.patient.category] ?? 3) - (PRIORITY_TIER[b.patient.category] ?? 3),
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

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        ...parsed.data,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
      },
      include: APPOINTMENT_INCLUDE,
    });
    return appointment;
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
