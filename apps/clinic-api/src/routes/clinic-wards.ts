import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isFeatureEnabled } from "../config/features.js";
import {
  NURSING_ROLES, OT_ROLES, RADIOLOGY_ROLES, requireClinicAuth, requireClinicalWriteAuth, requireRoles,
} from "../plugins/auth.js";
import { dayBounds } from "../lib/queue.js";

/**
 * The operation theatre, radiology and the nursing chart.
 *
 * Three modules in one file because each is small and each hangs off the
 * same two things -- a patient, and usually an admission. Each registers
 * only when its module is on (see app.ts).
 */

async function staffName(id: string) {
  return (await prisma.clinicUser.findUnique({ where: { id }, select: { name: true } }))?.name ?? "Staff";
}

// ── Operation theatre ─────────────────────────────────────────────────

export async function clinicOtRoutes(app: FastifyInstance) {
  /** A day's theatre list, by theatre and time. */
  app.get("/api/clinic/ot", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const { date } = request.query as { date?: string };
    const { start, end } = dayBounds(date ? new Date(`${date.slice(0, 10)}T12:00:00`) : new Date());
    const data = await prisma.otBooking.findMany({
      where: { scheduledAt: { gte: start, lte: end } },
      include: {
        patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, allergies: true } },
        surgeon: { select: { id: true, name: true } },
        admission: { select: { id: true, ipNumber: true } },
      },
      orderBy: [{ theatre: "asc" }, { scheduledAt: "asc" }],
    });
    return { data };
  });

  app.post("/api/clinic/ot", async (request, reply) => {
    const auth = requireRoles(request, reply, OT_ROLES, "Only a doctor, nurse or admin can book the theatre.");
    if (!auth) return;
    const parsed = z.object({
      patientId: z.string().min(1),
      admissionId: z.string().optional(),
      surgeonId: z.string().optional(),
      anaesthetist: z.string().max(120).optional(),
      theatre: z.string().trim().min(1).max(40),
      procedure: z.string().trim().min(2).max(200),
      scheduledAt: z.string().datetime(),
      durationMins: z.coerce.number().int().min(10).max(720).default(60),
      anaesthesiaType: z.string().max(60).optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const startAt = new Date(parsed.data.scheduledAt);
    const endAt = new Date(startAt.getTime() + parsed.data.durationMins * 60_000);
    // A theatre holds one operation at a time. Checked against the day's
    // bookings rather than trusted to the screen, which two people can be
    // looking at.
    const sameDay = await prisma.otBooking.findMany({
      where: { theatre: parsed.data.theatre, status: { in: ["SCHEDULED", "IN_PROGRESS"] }, scheduledAt: { gte: new Date(startAt.getTime() - 12 * 3_600_000), lte: endAt } },
    });
    const clash = sameDay.find((b) => b.scheduledAt < endAt && new Date(b.scheduledAt.getTime() + b.durationMins * 60_000) > startAt);
    if (clash) {
      return reply.status(409).send({ error: `${parsed.data.theatre} is booked then (${clash.procedure}, ${clash.scheduledAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}).` });
    }
    const booking = await prisma.otBooking.create({ data: { ...parsed.data, scheduledAt: startAt } });
    return reply.status(201).send(booking);
  });

  app.put("/api/clinic/ot/:id", async (request, reply) => {
    const auth = requireRoles(request, reply, OT_ROLES, "Only a doctor, nurse or admin can update the theatre list.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({
      status: z.enum(["SCHEDULED", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
      operationNotes: z.string().max(8000).optional(),
      anaesthetist: z.string().max(120).optional(),
      anaesthesiaType: z.string().max(60).optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const existing = await prisma.otBooking.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    if (parsed.data.operationNotes !== undefined && auth.role !== "DOCTOR") {
      return reply.status(403).send({ error: "Only a doctor writes the operation notes." });
    }
    const now = new Date();
    const booking = await prisma.otBooking.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(parsed.data.status === "IN_PROGRESS" && !existing.startedAt ? { startedAt: now } : {}),
        ...(parsed.data.status === "DONE" && !existing.endedAt ? { endedAt: now } : {}),
      },
    });
    return booking;
  });
}

// ── Radiology ─────────────────────────────────────────────────────────

export async function clinicRadiologyRoutes(app: FastifyInstance) {
  app.get("/api/clinic/radiology", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const { status, patientId } = request.query as { status?: string; patientId?: string };
    const data = await prisma.radiologyOrder.findMany({
      where: { ...(status ? { status: status as never } : {}), ...(patientId ? { patientId } : {}) },
      include: {
        patient: { select: { id: true, name: true, uhid: true, age: true, gender: true } },
        orderedBy: { select: { name: true } },
        admission: { select: { id: true, ipNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { data };
  });

  /** Ordering is a doctor's, as it is for labs. */
  app.post("/api/clinic/radiology", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const parsed = z.object({
      patientId: z.string().min(1),
      appointmentId: z.string().optional(),
      admissionId: z.string().optional(),
      modality: z.enum(["XRAY", "USG", "CT", "MRI", "ECG", "ECHO", "OTHER"]),
      study: z.string().trim().min(2).max(200),
      clinicalNotes: z.string().max(1000).optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const order = await prisma.radiologyOrder.create({ data: { ...parsed.data, orderedById: auth.clinicUserId } });
    return reply.status(201).send(order);
  });

  /** Mark done, and write the report. */
  app.put("/api/clinic/radiology/:id", async (request, reply) => {
    const auth = requireRoles(request, reply, RADIOLOGY_ROLES, "Only the radiographer or a doctor can update imaging.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({
      status: z.enum(["ORDERED", "DONE", "REPORTED", "CANCELLED"]).optional(),
      report: z.string().max(10_000).optional(),
      impression: z.string().max(2000).optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const existing = await prisma.radiologyOrder.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    const reporting = parsed.data.report !== undefined || parsed.data.status === "REPORTED";
    if (reporting && !(parsed.data.report ?? existing.report)?.trim()) {
      return reply.status(400).send({ error: "Write the report before marking it reported." });
    }
    const now = new Date();
    const order = await prisma.radiologyOrder.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(parsed.data.status === "DONE" && !existing.doneAt ? { doneAt: now } : {}),
        ...(reporting ? { status: "REPORTED", reportedAt: now, reportedByName: await staffName(auth.clinicUserId), ...(existing.doneAt ? {} : { doneAt: now }) } : {}),
      },
    });
    return order;
  });
}

// ── Nursing ───────────────────────────────────────────────────────────

const vitalsSchema = z.object({
  bp: z.string().max(20).optional(),
  pulse: z.string().max(10).optional(),
  temp: z.string().max(10).optional(),
  spo2: z.string().max(10).optional(),
  rr: z.string().max(10).optional(),
  sugar: z.string().max(20).optional(),
  pain: z.string().max(10).optional(),
});

export async function clinicNursingRoutes(app: FastifyInstance) {
  /** Every admitted patient, ward by ward, with when they were last charted. */
  app.get("/api/clinic/nursing/ward-list", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const admitted = await prisma.admission.findMany({
      where: { status: "ADMITTED" },
      include: {
        patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, allergies: true } },
        bed: { include: { ward: { select: { name: true } } } },
        admittingDoctor: { select: { name: true } },
        nursingEntries: { orderBy: { at: "desc" }, take: 1 },
      },
      orderBy: { admittedAt: "asc" },
    });
    const lastVitals = await prisma.nursingEntry.groupBy({
      by: ["admissionId"],
      where: { kind: "VITALS", admissionId: { in: admitted.map((a) => a.id) } },
      _max: { at: true },
    });
    const vitalsAt = new Map(lastVitals.map((v) => [v.admissionId, v._max.at]));
    return {
      data: admitted.map((a) => ({
        id: a.id, ipNumber: a.ipNumber, patient: a.patient, ward: a.bed?.ward.name ?? null, bed: a.bed?.label ?? null,
        doctor: a.admittingDoctor?.name ?? null, admittedAt: a.admittedAt,
        lastVitalsAt: vitalsAt.get(a.id) ?? null, lastEntry: a.nursingEntries[0] ?? null,
      })),
    };
  });

  app.get("/api/clinic/admissions/:id/nursing", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const data = await prisma.nursingEntry.findMany({ where: { admissionId: id }, orderBy: { at: "desc" }, take: 300 });
    return { data };
  });

  app.post("/api/clinic/admissions/:id/nursing", async (request, reply) => {
    const auth = requireRoles(request, reply, NURSING_ROLES, "Only a nurse or doctor writes on the ward chart.");
    if (!auth) return;
    if (!isFeatureEnabled("nursing")) return reply.status(404).send({ error: "Not found" });
    const { id } = request.params as { id: string };
    const parsed = z.object({
      kind: z.enum(["VITALS", "NOTE", "MEDICATION"]),
      vitals: vitalsSchema.optional(),
      note: z.string().max(4000).optional(),
      drugName: z.string().max(200).optional(),
      dose: z.string().max(60).optional(),
      route: z.string().max(40).optional(),
      at: z.string().datetime().optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    if (d.kind === "VITALS" && !(d.vitals && Object.values(d.vitals).some((v) => v && v.trim()))) return reply.status(400).send({ error: "Enter at least one reading." });
    if (d.kind === "NOTE" && !d.note?.trim()) return reply.status(400).send({ error: "Write the note." });
    if (d.kind === "MEDICATION" && !(d.drugName?.trim() && d.dose?.trim())) return reply.status(400).send({ error: "Enter the medicine and the dose given." });
    const a = await prisma.admission.findUnique({ where: { id } });
    if (!a) return reply.status(404).send({ error: "Not found" });
    if (a.status !== "ADMITTED") return reply.status(409).send({ error: "This patient has been discharged." });
    const entry = await prisma.nursingEntry.create({
      data: { admissionId: id, kind: d.kind, vitals: d.vitals ?? undefined, note: d.note ?? null, drugName: d.drugName ?? null, dose: d.dose ?? null, route: d.route ?? null, at: d.at ? new Date(d.at) : new Date(), byName: await staffName(auth.clinicUserId) },
    });
    return reply.status(201).send(entry);
  });
}
