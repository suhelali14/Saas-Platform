import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DrugFrequency } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireClinicalWriteAuth, requirePharmacyAuth } from "../plugins/auth.js";
import {
  createDocument, drawInfoGrid, drawAlertBanner, drawSectionHeading,
  drawTable, drawFieldList, drawSignature, finalizeDocument,
  renderBlocks, tableColumns, shownColumnKeys,
} from "../lib/pdf.js";
import { resolveTemplate, layoutFor } from "../lib/document-template.js";
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
      include: {
        items: { include: { drug: { select: { composition: true } } } },
        doctor: true,
        patient: true,
      },
    });
    if (!prescription) return reply.status(404).send({ error: "Not found" });

    const clinic = await prisma.clinic.findFirst();
    const caseSheet = prescription.caseSheetId
      ? await prisma.caseSheet.findUnique({ where: { id: prescription.caseSheetId }, select: { diagnosis: true, followUpDate: true, vitals: true } })
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
      // The fallback, used when neither this kind nor the clinic has set
      // a note of its own. finalizeDocument decides between them.
      footerNote: "This is a computer-generated prescription.",
      kind: "prescription" as const,
    };

    const template = resolveTemplate(clinic?.documentTemplate);
    const layout = layoutFor(template, "prescription");

    // The clinic may rename the document itself -- a practice that calls
    // this a "Treatment Advice" rather than a "Prescription" can say so --
    // and give it its own footer, which differs by document far more than
    // the clinic's name does.
    if (layout.title) meta.title = layout.title;

    const doc = createDocument(branding, meta, template);

    // One routine per block. Which of these run, in what order, and under
    // what heading is the template's decision, not this function's.
    const COLUMN_SPEC: Record<string, { label: string; align?: "left" | "center" | "right" }> = {
      index: { label: "#", align: "center" },
      name: { label: "Medicine" },
      composition: { label: "Composition" },
      dosage: { label: "Dosage", align: "center" },
      frequency: { label: "Frequency", align: "center" },
      duration: { label: "Duration", align: "center" },
      qty: { label: "Qty", align: "right" },
      instructions: { label: "Instructions" },
    };

    renderBlocks(doc, template, "prescription", {
      patientInfo: () => drawInfoGrid(doc, [
        { label: "Patient", value: prescription.patient.name },
        { label: "UHID", value: prescription.patient.uhid },
        { label: "Age / Sex", value: ageSex(prescription.patient) },
        { label: "Consulting Doctor", value: `Dr. ${prescription.doctor.name}` },
        { label: "Blood Group", value: prescription.patient.bloodGroup ?? "" },
        { label: "Phone", value: prescription.patient.phone ?? "" },
      ]),

      // Default order puts this before the medicines, deliberately: a
      // pharmacist reading top to bottom must hit a penicillin allergy
      // before they read what to dispense. A clinic can move it, but it
      // starts where it does for a reason.
      allergyBanner: () => drawAlertBanner(doc, [
        { label: "Allergies", text: prescription.patient.allergies ?? "" },
        { label: "Chronic conditions", text: prescription.patient.chronicConditions ?? "" },
      ]),

      diagnosis: (label) => {
        if (!caseSheet?.diagnosis) return;
        drawFieldList(doc, [{ label: label || "Diagnosis", value: caseSheet.diagnosis }]);
        doc.moveDown(0.3);
      },

      vitals: (label) => {
        const v = caseSheet?.vitals as Record<string, unknown> | null | undefined;
        if (!v) return;
        const fields = [
          { label: "BP", value: str(v.bp) },
          { label: "Pulse", value: str(v.pulse) },
          { label: "Temp", value: str(v.temp) },
          { label: "SpO2", value: str(v.spo2) },
          { label: "Weight", value: str(v.weight) },
        ].filter((f) => f.value);
        if (!fields.length) return;
        drawSectionHeading(doc, label || "Vitals");
        drawFieldList(doc, fields);
        doc.moveDown(0.3);
      },

      medicines: (label) => {
        drawSectionHeading(doc, label || "Rx  ·  Medicines Advised");
        const keys = shownColumnKeys(layout.columns ?? [], COLUMN_SPEC);
        drawTable(
          doc,
          tableColumns(layout.columns ?? [], COLUMN_SPEC),
          prescription.items.map((item, i) => keys.map((key) => {
            switch (key) {
              case "index": return String(i + 1);
              case "name": return item.drugName;
              case "composition": return item.drug?.composition ?? "—";
              case "dosage": return item.dosage;
              case "frequency": return item.frequency;
              case "duration": return item.duration;
              // A computed estimate, which is why it is optional: a clinic
              // dispensing by strip does not want a number on the sheet
              // that its own pharmacy will contradict.
              case "qty": return String(parseQuantityFromDosage(item.dosage, item.duration) ?? "—");
              case "instructions": return item.instructions ?? "";
              default: return "";
            }
          })),
          {
            // Instructions go under the row only when they are not already
            // a column of their own; printing both is just repetition.
            subRows: keys.includes("instructions")
              ? undefined
              : prescription.items.map((item) => item.instructions ?? null),
          },
        );
      },

      advice: (label) => {
        const advice = prescription.items.map((i) => i.instructions).filter(Boolean);
        if (!advice.length) return;
        drawSectionHeading(doc, label || "Advice");
        drawFieldList(doc, advice.map((text, i) => ({ label: `${i + 1}`, value: text as string })));
        doc.moveDown(0.3);
      },

      followUp: (label) => {
        if (!caseSheet?.followUpDate) return;
        drawFieldList(doc, [{
          label: label || "Follow-up advised on",
          value: caseSheet.followUpDate.toLocaleDateString("en-IN", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric",
          }),
        }]);
      },

      signature: () => drawSignature(doc, `Dr. ${prescription.doctor.name}`, {
        signatureImagePath: prescription.doctor.signatureImagePath
          ? resolveStoredPath(prescription.doctor.signatureImagePath)
          : null,
        qualifications: prescription.doctor.qualifications,
        registrationNumber: clinic?.registrationNumber,
      }),
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

  /**
   * What this patient was last prescribed, ready to be re-issued.
   *
   * The single biggest time saving available in a consultation with a
   * returning patient: a chronic patient on four drugs is four drug
   * lookups, four dosages, four frequencies and four durations, all of
   * it information already in the record.
   *
   * Different from a named template, which answers "what do I usually
   * give for a throat infection". This answers "what is this person
   * already taking", which is the question for the half of a list that
   * is coming back.
   *
   * Returns the items for the form to prefill -- it does not issue
   * anything. The doctor reviews and saves, which is what stops a
   * repeat becoming an unexamined one.
   */
  app.get("/api/clinic/patients/:id/last-prescription", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };

    const last = await prisma.prescription.findFirst({
      where: { patientId: id },
      include: {
        items: { orderBy: { id: "asc" } },
        doctor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!last) return { prescription: null };

    const days = Math.floor((Date.now() - last.createdAt.getTime()) / 86_400_000);

    return {
      prescription: {
        id: last.id,
        issuedAt: last.createdAt,
        doctorName: last.doctor.name,
        daysAgo: days,
        // Flagged rather than blocked. Six months is long enough that a
        // repeat should be a deliberate decision about a patient whose
        // condition may have changed, and the form says so -- but a
        // doctor looking at the patient is better placed to judge than
        // a cutoff is.
        stale: days > 180,
        items: last.items.map((i) => ({
          drugId: i.drugId,
          drugName: i.drugName,
          dosage: i.dosage,
          frequency: i.frequency,
          duration: i.duration,
          instructions: i.instructions,
        })),
      },
    };
  });
}

/** A vitals value as a printable string, or "" when it was never recorded. */
function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s === "null" || s === "undefined" ? "" : s;


}
