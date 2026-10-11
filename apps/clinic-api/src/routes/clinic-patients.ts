import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PatientCategory } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth } from "../plugins/auth.js";
import { generatePatientUhid } from "../lib/uhid.js";
import {
  createDocument, drawInfoGrid, drawAlertBanner, drawSectionHeading,
  drawTable, drawFieldList, drawParagraph, drawSignature,
  finalizeDocument, ensureSpace, doctorName,
} from "../lib/pdf.js";
import { resolveTemplate } from "../lib/document-template.js";
import { resolveStoredPath } from "../lib/file-storage.js";

/** One consistent date format across every document. The report was
 * printing "21/9/2026" while the letterhead beside it printed
 * "26 Sept 2026". */
function longDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const patientSchema = z.object({
  name: z.string().min(1).max(200),
  // Accepts a plain `YYYY-MM-DD` as well as a full ISO timestamp. The
  // original `.datetime()` rejected the former, which is exactly what an
  // `<input type="date">` submits -- so date of birth could never actually
  // be saved from a form, and the column sat unused.
  dob: z
    .union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional()
    .nullable(),
  age: z.coerce.number().int().min(0).max(150).optional(),
  gender: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  bloodGroup: z.string().max(10).optional(),
  allergies: z.string().max(1000).optional(),
  chronicConditions: z.string().max(1000).optional(),
  category: z.nativeEnum(PatientCategory).optional(),
});

/**
 * `dob` arrives as a string but the column is a DateTime, so it has to be
 * converted rather than spread through. A bare `YYYY-MM-DD` is parsed as
 * UTC midnight by `new Date()`, which in IST reads back as the *previous*
 * day -- the same timezone trap already fixed in the queue's date picker.
 * Anchoring to local noon keeps the calendar date intact in any timezone.
 */
function withParsedDob<T extends { dob?: string | null }>(data: T): Omit<T, "dob"> & { dob?: Date | null } {
  const { dob, ...rest } = data;
  if (dob === undefined) return rest as Omit<T, "dob"> & { dob?: Date | null };
  if (dob === null) return { ...rest, dob: null } as Omit<T, "dob"> & { dob?: Date | null };

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12, 0, 0)
    : new Date(dob);
  return { ...rest, dob: parsed } as Omit<T, "dob"> & { dob?: Date | null };
}

/**
 * One visit entry's heading: what kind of record, then date and doctor
 * pushed right. Shared by case sheets, prescriptions and certificates so
 * the three cannot drift apart visually.
 */
function drawEntryHeading(doc: PDFKit.PDFDocument, kind: string, date: string, doctor: string) {
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827");
  doc.text(kind, 46, y, { width: 260 });
  doc.font("Helvetica").fontSize(8.5).fillColor("#6b7280");
  doc.text(`${date}   ·   ${doctor}`, 306, y + 1, { width: 243, align: "right" });
  const ruleY = Math.max(doc.y, y + 13) + 2;
  doc.moveTo(46, ruleY).lineTo(549, ruleY).lineWidth(0.4).strokeColor("#e5e7eb").stroke();
  doc.y = ruleY + 6;
  doc.x = 46;
  doc.fillColor("#1f2937");
}

export async function clinicPatientRoutes(app: FastifyInstance) {
  app.get("/api/clinic/patients", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    // `search` is a single quick-search box -- matches name OR uhid OR phone,
    // since a front-desk lookup is typically "one of these", not all three
    // at once. Real receptionists search by whichever they have on hand.
    const { search } = request.query as { search?: string };
    const patients = await prisma.patient.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { uhid: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: patients };
  });

  app.post("/api/clinic/patients", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const parsed = patientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const uhid = await generatePatientUhid();
    const patient = await prisma.patient.create({ data: { ...withParsedDob(parsed.data), uhid } });
    return reply.status(201).send(patient);
  });

  app.get("/api/clinic/patients/:id", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) return reply.status(404).send({ error: "Not found" });
    return patient;
  });

  app.put("/api/clinic/patients/:id", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = patientSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const patient = await prisma.patient.update({ where: { id }, data: withParsedDob(parsed.data) });
    return patient;
  });

  // Chronological timeline: past case sheets, prescriptions, appointments --
  // no dedicated table, just a join by patientId ordered by date, per the plan.
  app.get("/api/clinic/patients/:id/history", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) return reply.status(404).send({ error: "Not found" });

    const [caseSheets, prescriptions, certificates, appointments] = await Promise.all([
      prisma.caseSheet.findMany({
        where: { patientId: id },
        include: { doctor: { select: { name: true } }, attachments: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.prescription.findMany({
        where: { patientId: id },
        include: { items: true, doctor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.certificate.findMany({
        where: { patientId: id },
        include: { doctor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.appointment.findMany({
        where: { patientId: id },
        orderBy: { scheduledAt: "desc" },
      }),
    ]);

    return { patient, caseSheets, prescriptions, certificates, appointments };
  });

  // Full patient history as a printable/downloadable PDF -- "every patient
  // history reports" -- useful for referrals, insurance, or a patient
  // requesting a copy of their own records. Reuses the same letterhead
  // pipeline as prescriptions/certificates.
  app.get("/api/clinic/patients/:id/report/pdf", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) return reply.status(404).send({ error: "Not found" });

    const [caseSheets, prescriptions, certificates, clinic] = await Promise.all([
      prisma.caseSheet.findMany({ where: { patientId: id }, include: { doctor: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.prescription.findMany({ where: { patientId: id }, include: { items: true, doctor: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.certificate.findMany({ where: { patientId: id }, include: { doctor: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.clinic.findFirst(),
    ]);

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="patient-report-${patient.uhid}.pdf"`);

    const branding = {
      name: clinic?.name ?? "Clinic",
      address: clinic?.address,
      phone: clinic?.phone,
      email: clinic?.email,
      registrationNumber: clinic?.registrationNumber,
      logoPath: clinic?.logoPath ? resolveStoredPath(clinic.logoPath) : null,
    };
    const meta = {
      title: "Patient History Report",
      reference: patient.uhid,
      date: new Date(),
      footerNote: "Confidential medical record.",
    };
    const template = resolveTemplate(clinic?.documentTemplate);

    const doc = createDocument(branding, meta, template);

    drawInfoGrid(doc, [
      { label: "Patient", value: patient.name },
      { label: "UHID", value: patient.uhid },
      { label: "Age / Sex", value: [patient.age != null ? `${patient.age} yrs` : null, patient.gender].filter(Boolean).join(" / ") },
      { label: "Blood Group", value: patient.bloodGroup ?? "" },
      { label: "Phone", value: patient.phone ?? "" },
      { label: "Registered", value: patient.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) },
    ]);

    // A medical record that gets forwarded to another doctor must carry the
    // allergy where it will be seen, not buried in a grey details line.
    drawAlertBanner(doc, [
      { label: "Allergies", text: patient.allergies ?? "" },
      { label: "Chronic conditions", text: patient.chronicConditions ?? "" },
    ]);

    drawSectionHeading(doc, "Clinical History");

    type Entry = { date: Date; render: () => void };
    const entries: Entry[] = [];

    for (const c of caseSheets) {
      entries.push({
        date: c.createdAt,
        render: () => {
          ensureSpace(doc, 70);
          drawEntryHeading(doc, "Consultation", longDate(c.createdAt), `Dr. ${c.doctor.name}`);
          drawFieldList(doc, [
            { label: "Chief complaint", value: c.chiefComplaint },
            { label: "History", value: c.hopi },
            { label: "Diagnosis", value: c.diagnosis },
            { label: "Notes", value: c.notes },
          ]);
          doc.moveDown(0.4);
        },
      });
    }
    for (const p of prescriptions) {
      entries.push({
        date: p.createdAt,
        render: () => {
          ensureSpace(doc, 80);
          drawEntryHeading(doc, "Prescription", longDate(p.createdAt), `Dr. ${p.doctor.name}`);
          drawTable(
            doc,
            [
              { header: "Medicine", width: 0.42 },
              { header: "Dosage", width: 0.18, align: "center" },
              { header: "Frequency", width: 0.2, align: "center" },
              { header: "Duration", width: 0.2, align: "center" },
            ],
            p.items.map((item) => [item.drugName, item.dosage, item.frequency, item.duration]),
          );
        },
      });
    }
    for (const c of certificates) {
      entries.push({
        date: c.createdAt,
        render: () => {
          ensureSpace(doc, 70);
          const kind = c.type.replace(/_/g, " ").toLowerCase();
          drawEntryHeading(doc, `${kind.charAt(0).toUpperCase()}${kind.slice(1)} certificate`, longDate(c.createdAt), `Dr. ${c.doctor.name}`);
          drawParagraph(doc, c.content, { size: 9.5 });
        },
      });
    }

    // Newest first: someone opening a history report is almost always
    // asking "what happened recently", not reading it as a biography.
    entries.sort((a, b) => b.date.getTime() - a.date.getTime());
    if (entries.length === 0) {
      drawParagraph(doc, "No clinical records on file for this patient yet.");
    } else {
      for (const entry of entries) entry.render();
    }

    drawSignature(doc, doctorName(clinic?.doctorName) || "Authorised Signatory", {
      registrationNumber: clinic?.registrationNumber,
    });

    finalizeDocument(doc, branding, meta);
    return reply.send(doc);
  });
}
