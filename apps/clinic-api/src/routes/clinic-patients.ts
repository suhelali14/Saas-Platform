import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PatientCategory } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { DURABLE_CATEGORIES } from "../lib/triage.js";
import { requireClinicAuth, requirePatientAdminAuth } from "../plugins/auth.js";
import { generatePatientUhid } from "../lib/uhid.js";
import {
  createDocument, drawInfoGrid, drawAlertBanner, drawSectionHeading,
  drawTable, drawFieldList, drawParagraph, drawSignature,
  finalizeDocument, ensureSpace, doctorName,
} from "../lib/pdf.js";
import { resolveTemplate } from "../lib/document-template.js";
import { resolveStoredPath } from "../lib/file-storage.js";
import { findDuplicatesOf, mergePatients } from "../lib/patient-duplicates.js";

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
  email: z.string().email().max(200).optional().or(z.literal("")),
  // The question every clinic asks at the counter and this could not
  // record. Without it, an unconscious patient's family is reached by
  // going through their phone.
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(30).optional(),
  emergencyContactRelation: z.string().max(60).optional(),
  insuranceProvider: z.string().max(200).optional(),
  insurancePolicyNumber: z.string().max(100).optional(),
  referredBy: z.string().max(200).optional(),
  // For whoever next meets this person at the desk. Never clinical --
  // the case sheet is where clinical notes belong, and this field is
  // visible to reception.
  deskNote: z.string().max(1000).optional(),
  allergies: z.string().max(1000).optional(),
  chronicConditions: z.string().max(1000).optional(),
  /**
   * Only the durable values.
   *
   * EMERGENCY and PREGNANT describe a visit, not a person. Allowing
   * them here is what left a patient sorted to the front of every
   * queue for years because of one night in casualty. They are set on
   * the appointment instead.
   */
  category: z.enum(DURABLE_CATEGORIES).optional(),
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
    const { search, category, sort } = request.query as {
      search?: string; category?: string; sort?: string;
    };

    const patients = await prisma.patient.findMany({
      where: {
        // A record merged away as a duplicate is kept so its UHID still
        // resolves, but it must never appear in a list again -- two rows
        // for one person is the problem this was fixing.
        mergedIntoId: null,
        ...(category ? { category: category as never } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { uhid: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                // Searching by the person who referred them is how a
                // clinic answers "who did Dr Mehta send us".
                { referredBy: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: sort === "name" ? { name: "asc" } : { createdAt: "desc" },
      take: 100,
    });

    // When each was last here. Fetched in one grouped query rather than
    // one per row: a hundred patients would otherwise be a hundred round
    // trips to a database that may be in another country.
    const lastVisits = patients.length
      ? await prisma.appointment.groupBy({
          by: ["patientId"],
          where: { patientId: { in: patients.map((p) => p.id) } },
          _max: { scheduledAt: true },
        })
      : [];
    const lastSeen = new Map(lastVisits.map((v) => [v.patientId, v._max.scheduledAt]));

    return {
      data: patients.map((p) => ({ ...p, lastSeen: lastSeen.get(p.id) ?? null })),
    };
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

  /**
   * Patients who look like duplicates of this one.
   *
   * Suggested, never applied. A master patient index queues uncertain
   * pairs for human review, and here the reason is blunter: a wrong
   * merge is irreversible and mixes two people's medical histories, so
   * a false positive is a clinical risk rather than an inconvenience.
   */
  app.get("/api/clinic/patients/:id/duplicates", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
    if (!patient) return reply.status(404).send({ error: "Not found" });

    return { candidates: await findDuplicatesOf(id) };
  });

  /**
   * Merges a duplicate into this patient.
   *
   * Irreversible, and gated to the roles that own the patient record.
   * Reception creates duplicates and is best placed to recognise one, so
   * it is not doctor-only -- but a nurse or pharmacist has no business
   * rewriting who a patient is.
   */
  app.post("/api/clinic/patients/:id/merge", async (request, reply) => {
    const auth = requirePatientAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = z.object({ duplicateId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    try {
      const result = await mergePatients(id, parsed.data.duplicateId, auth.clinicUserId);
      return result;
    } catch (error) {
      // These are all "the operator needs to know what happened"
      // conditions -- already merged, gone, the same record twice -- not
      // server faults.
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Could not merge these records.",
      });
    }
  });

  /**
   * Who is overdue to come back.
   *
   * Two different questions, answered together because a front desk
   * treats them as one list of people to ring:
   *
   * - A follow-up the doctor asked for, whose date has passed with no
   *   visit since. This is continuity of care, and it is currently
   *   invisible unless the doctor ticked the reminder box for
   *   themselves.
   * - A patient with a chronic condition who has not been seen in a
   *   long time. Nothing in the system notices this today.
   *
   * Deliberately not a messaging feature. There is no SMS or WhatsApp
   * integration in this deployment, and generating a list somebody has
   * to act on is honest; claiming to have sent reminders would not be.
   */
  app.get("/api/clinic/patients-recall", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { months } = request.query as { months?: string };
    const quietMonths = Math.min(36, Math.max(1, Number(months) || 6));

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - quietMonths);

    // ── Follow-ups whose date has passed ─────────────────────────────
    const dueFollowUps = await prisma.caseSheet.findMany({
      where: { followUpDate: { lt: now, gte: cutoff } },
      select: {
        id: true, followUpDate: true, diagnosis: true,
        patient: {
          select: {
            id: true, uhid: true, name: true, phone: true, category: true,
            chronicConditions: true, mergedIntoId: true,
          },
        },
      },
      orderBy: { followUpDate: "asc" },
      take: 300,
    });

    // Did they actually come back after the follow-up was set? Checked
    // rather than assumed: a list that keeps naming people who already
    // returned is a list nobody uses twice.
    const patientIds = [...new Set(dueFollowUps.map((c) => c.patient.id))];
    const visitsSince = patientIds.length
      ? await prisma.appointment.groupBy({
          by: ["patientId"],
          where: { patientId: { in: patientIds }, status: { in: ["COMPLETED", "IN_PROGRESS"] } },
          _max: { scheduledAt: true },
        })
      : [];
    const lastVisit = new Map(visitsSince.map((v) => [v.patientId, v._max.scheduledAt]));

    const overdue = dueFollowUps
      .filter((c) => {
        if (c.patient.mergedIntoId) return false;
        const seen = lastVisit.get(c.patient.id);
        return !seen || !c.followUpDate || seen < c.followUpDate;
      })
      .map((c) => ({
        patientId: c.patient.id,
        uhid: c.patient.uhid,
        name: c.patient.name,
        phone: c.patient.phone,
        category: c.patient.category,
        reason: "follow-up" as const,
        dueOn: c.followUpDate,
        detail: c.diagnosis,
        lastSeen: lastVisit.get(c.patient.id) ?? null,
      }));

    // ── Chronic patients who have gone quiet ─────────────────────────
    //
    // Only chronic conditions. Somebody who came once with a cold and
    // has not been back is not overdue for anything, and putting them on
    // this list would make it a marketing list rather than a clinical
    // one.
    const chronic = await prisma.patient.findMany({
      where: {
        mergedIntoId: null,
        chronicConditions: { not: null },
        NOT: { chronicConditions: "" },
      },
      select: { id: true, uhid: true, name: true, phone: true, category: true, chronicConditions: true },
      take: 500,
    });
    const chronicVisits = chronic.length
      ? await prisma.appointment.groupBy({
          by: ["patientId"],
          where: { patientId: { in: chronic.map((p) => p.id) } },
          _max: { scheduledAt: true },
        })
      : [];
    const chronicLast = new Map(chronicVisits.map((v) => [v.patientId, v._max.scheduledAt]));

    const alreadyListed = new Set(overdue.map((o) => o.patientId));
    const quiet = chronic
      .filter((p) => {
        if (alreadyListed.has(p.id)) return false;
        const seen = chronicLast.get(p.id);
        return seen != null && seen < cutoff;
      })
      .map((p) => ({
        patientId: p.id,
        uhid: p.uhid,
        name: p.name,
        phone: p.phone,
        category: p.category,
        reason: "chronic-quiet" as const,
        dueOn: null,
        detail: p.chronicConditions,
        lastSeen: chronicLast.get(p.id) ?? null,
      }));

    return {
      quietMonths,
      generatedAt: now.toISOString(),
      overdue,
      quiet: quiet.sort((a, b) => (a.lastSeen?.getTime() ?? 0) - (b.lastSeen?.getTime() ?? 0)),
    };
  });

}
