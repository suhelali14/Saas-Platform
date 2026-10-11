import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireClinicalWriteAuth } from "../plugins/auth.js";
import { saveUploadedFile, readStoredFile, FileValidationError } from "../lib/file-storage.js";

const vitalsSchema = z.object({
  bp: z.string().max(20).optional(),
  temp: z.string().max(20).optional(),
  spo2: z.string().max(10).optional(),
  weight: z.string().max(20).optional(),
  pulse: z.string().max(20).optional(),
});

const createSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional(),
  chiefComplaint: z.string().max(1000).optional(),
  hopi: z.string().max(2000).optional(),
  vitals: vitalsSchema.optional(),
  diagnosis: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  followUpDate: z.string().datetime().optional(),
  remindDoctor: z.boolean().optional(),
});

export async function clinicCaseSheetRoutes(app: FastifyInstance) {
  app.get("/api/clinic/case-sheets", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { patientId } = request.query as { patientId?: string };
    const caseSheets = await prisma.caseSheet.findMany({
      where: patientId ? { patientId } : undefined,
      include: { doctor: { select: { name: true } }, attachments: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: caseSheets };
  });

  app.post("/api/clinic/case-sheets", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    const caseSheet = await prisma.caseSheet.create({
      data: {
        patientId: parsed.data.patientId,
        appointmentId: parsed.data.appointmentId,
        doctorId: auth.clinicUserId,
        chiefComplaint: parsed.data.chiefComplaint,
        hopi: parsed.data.hopi,
        vitals: parsed.data.vitals,
        diagnosis: parsed.data.diagnosis,
        notes: parsed.data.notes,
        followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : undefined,
        remindDoctor: parsed.data.followUpDate ? (parsed.data.remindDoctor ?? false) : false,
      },
      include: { doctor: { select: { name: true } }, attachments: true },
    });

    if (parsed.data.appointmentId) {
      await prisma.appointment.update({
        where: { id: parsed.data.appointmentId },
        data: { status: "COMPLETED" },
      }).catch(() => {});
    }

    return reply.status(201).send(caseSheet);
  });

  app.get("/api/clinic/case-sheets/:id", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const caseSheet = await prisma.caseSheet.findUnique({
      where: { id },
      include: { doctor: { select: { name: true } }, patient: true, attachments: true },
    });
    if (!caseSheet) return reply.status(404).send({ error: "Not found" });
    return caseSheet;
  });

  app.post("/api/clinic/case-sheets/:id/attachments", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const caseSheet = await prisma.caseSheet.findUnique({ where: { id } });
    if (!caseSheet) return reply.status(404).send({ error: "Not found" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    try {
      const saved = await saveUploadedFile("case-sheets", id, data.filename, data.mimetype, data.file);
      const attachment = await prisma.caseSheetAttachment.create({
        data: { caseSheetId: id, fileName: saved.fileName, storagePath: saved.storagePath, mimeType: saved.mimeType },
      });
      return reply.status(201).send(attachment);
    } catch (err) {
      if (err instanceof FileValidationError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  // Dismiss/resolve a doctor follow-up reminder -- doesn't touch
  // followUpDate itself (the clinical record stays accurate), just marks
  // that the reminder was seen/handled so it stops showing as due.
  app.patch("/api/clinic/case-sheets/:id/reminder", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.caseSheet.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const caseSheet = await prisma.caseSheet.update({
      where: { id },
      data: { reminderResolvedAt: new Date() },
    });
    return caseSheet;
  });

  app.get("/api/clinic/case-sheets/attachments/:attachmentId/file", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { attachmentId } = request.params as { attachmentId: string };
    const attachment = await prisma.caseSheetAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) return reply.status(404).send({ error: "Not found" });

    const stream = readStoredFile(attachment.storagePath);
    if (!stream) return reply.status(404).send({ error: "File no longer available" });

    reply.header("Content-Type", attachment.mimeType);
    reply.header("Content-Disposition", `inline; filename="${attachment.fileName.replace(/"/g, "")}"`);
    return reply.send(stream);
  });
}
