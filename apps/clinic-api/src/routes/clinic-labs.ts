import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireClinicalWriteAuth, requireLabResultAuth } from "../plugins/auth.js";
import { saveUploadedFile, readStoredFile, FileValidationError } from "../lib/file-storage.js";

const createSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional(),
  testNames: z.array(z.string().min(1).max(200)).min(1),
});

const resultTextSchema = z.object({
  resultText: z.string().max(5000),
});

const LAB_ORDER_INCLUDE = {
  patient: { select: { id: true, name: true, uhid: true } },
  doctor: { select: { name: true } },
  items: true,
};

export async function clinicLabRoutes(app: FastifyInstance) {
  // Small seeded catalog for the "order tests during consult" picker --
  // nothing like the 250k-row drug dataset's scale, ~20-30 common OPD tests.
  app.get("/api/clinic/lab-tests", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const tests = await prisma.labTest.findMany({ orderBy: { name: "asc" } });
    return { data: tests };
  });

  app.get("/api/clinic/lab-orders", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { patientId, status } = request.query as { patientId?: string; status?: string };
    const orders = await prisma.labOrder.findMany({
      where: { patientId: patientId || undefined, status: (status as any) || undefined },
      include: LAB_ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: orders };
  });

  app.get("/api/clinic/lab-orders/:id", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const order = await prisma.labOrder.findUnique({ where: { id }, include: LAB_ORDER_INCLUDE });
    if (!order) return reply.status(404).send({ error: "Not found" });
    return order;
  });

  // Doctor orders tests during a consult -- same clinical-write gate as
  // case sheets/prescriptions.
  app.post("/api/clinic/lab-orders", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    const order = await prisma.labOrder.create({
      data: {
        patientId: parsed.data.patientId,
        appointmentId: parsed.data.appointmentId,
        doctorId: auth.clinicUserId,
        items: { create: parsed.data.testNames.map((testName) => ({ testName })) },
      },
      include: LAB_ORDER_INCLUDE,
    });
    return reply.status(201).send(order);
  });

  async function maybeCompleteOrder(labOrderId: string) {
    const items = await prisma.labOrderItem.findMany({ where: { labOrderId } });
    if (items.length > 0 && items.every((i) => i.completedAt)) {
      await prisma.labOrder.update({ where: { id: labOrderId }, data: { status: "COMPLETED" } });
    }
  }

  // Text result -- whoever handles the report coming back (often reception
  // for a small clinic using an external lab).
  app.patch("/api/clinic/lab-orders/items/:itemId", async (request, reply) => {
    const auth = requireLabResultAuth(request, reply);
    if (!auth) return;

    const { itemId } = request.params as { itemId: string };
    const existing = await prisma.labOrderItem.findUnique({ where: { id: itemId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const parsed = resultTextSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const item = await prisma.labOrderItem.update({
      where: { id: itemId },
      data: { resultText: parsed.data.resultText, completedAt: new Date() },
    });
    await maybeCompleteOrder(item.labOrderId);
    return item;
  });

  // File result (uploaded PDF/image of the lab report).
  app.post("/api/clinic/lab-orders/items/:itemId/result-file", async (request, reply) => {
    const auth = requireLabResultAuth(request, reply);
    if (!auth) return;

    const { itemId } = request.params as { itemId: string };
    const existing = await prisma.labOrderItem.findUnique({ where: { id: itemId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    try {
      const saved = await saveUploadedFile("lab-results", itemId, data.filename, data.mimetype, data.file);
      const item = await prisma.labOrderItem.update({
        where: { id: itemId },
        data: {
          resultFilePath: saved.storagePath,
          resultFileName: saved.fileName,
          resultFileMime: saved.mimeType,
          completedAt: new Date(),
        },
      });
      await maybeCompleteOrder(item.labOrderId);
      return reply.status(201).send(item);
    } catch (err) {
      if (err instanceof FileValidationError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get("/api/clinic/lab-orders/items/:itemId/file", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { itemId } = request.params as { itemId: string };
    const item = await prisma.labOrderItem.findUnique({ where: { id: itemId } });
    if (!item?.resultFilePath) return reply.status(404).send({ error: "Not found" });

    const stream = readStoredFile(item.resultFilePath);
    if (!stream) return reply.status(404).send({ error: "File no longer available" });

    reply.header("Content-Type", item.resultFileMime ?? "application/octet-stream");
    reply.header("Content-Disposition", `inline; filename="${(item.resultFileName ?? "report").replace(/"/g, "")}"`);
    return reply.send(stream);
  });
}
