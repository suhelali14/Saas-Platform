import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DrugFrequency } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireClinicalWriteAuth, requirePharmacyAuth } from "../plugins/auth.js";
import {
  createDocument, drawInfoGrid, drawAlertBanner, drawSectionHeading,
  drawTable, drawFieldList, drawSignature, finalizeDocument,
} from "../lib/pdf.js";
import { resolveTemplate } from "../lib/document-template.js";
import { resolveStoredPath } from "../lib/file-storage.js";
import { parseQuantityFromDosage, decrementStockFEFO } from "../lib/inventory.js";

const itemSchema = z.object({
  drugId: z.string().optional(),
  drugName: z.string().min(1).max(200),
  dosage: z.string().min(1).max(50),
  frequency: z.nativeEnum(DrugFrequency),
  duration: z.string().min(1).max(50),
  instructions: z.string().max(200).optional(),
});

const createSchema = z.object({
  patientId: z.string().min(1),
  caseSheetId: z.string().optional(),
  appointmentId: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

const templateSchema = z.object({
  name: z.string().min(1).max(200),
  items: z.array(itemSchema).min(1),
});


/**
 * "34 / Female". Prefers a stored date of birth over a typed age: an age
 * entered two years ago is wrong now, a date of birth never is.
 */
function ageSex(patient: { age?: number | null; dob?: Date | null; gender?: string | null }): string {
  let years: number | null = patient.age ?? null;
  if (patient.dob) {
    const now = new Date();
    let y = now.getFullYear() - patient.dob.getFullYear();
    const m = now.getMonth() - patient.dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < patient.dob.getDate())) y -= 1;
    if (y >= 0 && y < 150) years = y;
  }
  return [years != null ? `${years} yrs` : null, patient.gender].filter(Boolean).join(" / ");
}

export async function clinicPrescriptionRoutes(app: FastifyInstance) {
  app.get("/api/clinic/prescriptions", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { patientId, dispensed } = request.query as { patientId?: string; dispensed?: string };
    const prescriptions = await prisma.prescription.findMany({
      where: {
        patientId: patientId || undefined,
        dispensed: dispensed === "false" ? false : dispensed === "true" ? true : undefined,
      },
      include: {
        items: true,
        doctor: { select: { name: true } },
        patient: { select: { id: true, name: true, uhid: true } },
        dispensedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: prescriptions };
  });

  app.post("/api/clinic/prescriptions", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    const prescription = await prisma.prescription.create({
      data: {
        patientId: parsed.data.patientId,
        caseSheetId: parsed.data.caseSheetId,
        appointmentId: parsed.data.appointmentId,
        doctorId: auth.clinicUserId,
        items: { create: parsed.data.items },
      },
      include: { items: true, doctor: { select: { name: true } }, patient: { select: { name: true } } },
    });
    return reply.status(201).send(prescription);
  });

  // Compounder/pharmacist workflow -- "necessary details" only (drug/dosage/
  // patient), no access to the underlying clinical case sheet needed here.
  // Auto-deducts stock FEFO for any item with both a matched drug and a
  // computable quantity (see lib/inventory.ts) -- best-effort, never blocks
  // dispensing on a shortfall or an unparseable dosage.
  app.patch("/api/clinic/prescriptions/:id/dispense", async (request, reply) => {
    const auth = requirePharmacyAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.prescription.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const stockWarnings: string[] = [];
    for (const item of existing.items) {
      if (!item.drugId) continue;
      const quantity = parseQuantityFromDosage(item.dosage, item.duration);
      if (quantity == null) continue;
      const { shortfall } = await decrementStockFEFO(item.drugId, quantity);
      if (shortfall > 0) stockWarnings.push(`${item.drugName}: ${shortfall} unit(s) short of stock`);
    }

    const prescription = await prisma.prescription.update({
      where: { id },
      data: { dispensed: true, dispensedAt: new Date(), dispensedById: auth.clinicUserId },
      include: { items: true, patient: { select: { name: true, uhid: true } }, dispensedBy: { select: { name: true } } },
    });
    return { ...prescription, stockWarnings };
  });

  app.get("/api/clinic/prescriptions/:id/pdf", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: { items: true, doctor: true, patient: true },
    });
    if (!prescription) return reply.status(404).send({ error: "Not found" });

    const clinic = await prisma.clinic.findFirst();
    const caseSheet = prescription.caseSheetId
      ? await prisma.caseSheet.findUnique({ where: { id: prescription.caseSheetId }, select: { diagnosis: true, followUpDate: true } })
      : null;

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="prescription-${prescription.patient.uhid}.pdf"`);

    const branding = {
      name: clinic?.name ?? "Clinic",
      address: clinic?.address,
      phone: clinic?.phone,
      email: clinic?.email,
      registrationNumber: clinic?.registrationNumber,
      logoPath: clinic?.logoPath ? resolveStoredPath(clinic.logoPath) : null,
    };
    const meta = {
      title: "Prescription",
      reference: prescription.patient.uhid,
      date: prescription.createdAt,
      footerNote: "This is a computer-generated prescription.",
    };

    const template = resolveTemplate(clinic?.documentTemplate);
    const doc = createDocument(branding, meta, template);

    drawInfoGrid(doc, [
      { label: "Patient", value: prescription.patient.name },
      { label: "UHID", value: prescription.patient.uhid },
      { label: "Age / Sex", value: ageSex(prescription.patient) },
      { label: "Consulting Doctor", value: `Dr. ${prescription.doctor.name}` },
      { label: "Blood Group", value: prescription.patient.bloodGroup ?? "" },
      { label: "Phone", value: prescription.patient.phone ?? "" },
    ]);

    // Before the medicines, deliberately: a pharmacist reading top-to-bottom
    // must hit a penicillin allergy before they read what to dispense.
    drawAlertBanner(doc, [
      { label: "Allergies", text: prescription.patient.allergies ?? "" },
      { label: "Chronic conditions", text: prescription.patient.chronicConditions ?? "" },
    ]);

    if (caseSheet?.diagnosis) {
      drawFieldList(doc, [{ label: "Diagnosis", value: caseSheet.diagnosis }]);
      doc.moveDown(0.3);
    }

    drawSectionHeading(doc, "Rx  ·  Medicines Advised");
    // The quantity column is optional: it is a computed estimate, and a
    // clinic that dispenses by strip rather than by tablet does not want a
    // number on the sheet that its own pharmacy will contradict. Widths are
    // redistributed rather than leaving a gap when it is off.
    drawTable(
      doc,
      [
        { header: "#", width: 0.06, align: "center" },
        { header: "Medicine", width: template.showQty ? 0.34 : 0.42 },
        { header: "Dosage", width: 0.17, align: "center" },
        { header: "Frequency", width: 0.14, align: "center" },
        { header: "Duration", width: 0.16, align: "center" },
        ...(template.showQty ? [{ header: "Qty", width: 0.13, align: "right" as const }] : []),
      ],
      prescription.items.map((item, i) => {
        const row = [
          String(i + 1),
          item.drugName,
          item.dosage,
          item.frequency,
          item.duration,
        ];
        if (template.showQty) {
          row.push(String(parseQuantityFromDosage(item.dosage, item.duration) ?? "—"));
        }
        return row;
      }),
      { subRows: prescription.items.map((item) => item.instructions ?? null) },
    );

    if (caseSheet?.followUpDate) {
      drawFieldList(doc, [
        {
          label: "Follow-up advised on",
          value: caseSheet.followUpDate.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
        },
      ]);
    }

    drawSignature(doc, `Dr. ${prescription.doctor.name}`, {
      signatureImagePath: prescription.doctor.signatureImagePath ? resolveStoredPath(prescription.doctor.signatureImagePath) : null,
      qualifications: prescription.doctor.qualifications,
      registrationNumber: clinic?.registrationNumber,
    });

    finalizeDocument(doc, branding, meta);
    return reply.send(doc);
  });

  // Save an existing prescription's items as a reusable template.
  app.post("/api/clinic/prescription-templates", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;

    const parsed = templateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const template = await prisma.prescriptionTemplate.create({
      data: { name: parsed.data.name, items: parsed.data.items },
    });
    return reply.status(201).send(template);
  });

  app.get("/api/clinic/prescription-templates", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const templates = await prisma.prescriptionTemplate.findMany({ orderBy: { name: "asc" } });
    return { data: templates };
  });
}
