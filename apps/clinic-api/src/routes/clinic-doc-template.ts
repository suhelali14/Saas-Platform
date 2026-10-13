import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../plugins/auth.js";
import {
  ACCENTS, DEFAULT_TEMPLATE, resolveTemplate, layoutFor,
  DOC_KINDS, BLOCK_TYPES, LETTERHEAD_FIELDS, MEDICINE_COLUMNS,
} from "../lib/document-template.js";
import {
  createDocument, drawInfoGrid, drawAlertBanner, drawSectionHeading,
  drawTable, drawFieldList, drawSignature, finalizeDocument,
  renderBlocks, tableColumns, shownColumnKeys,
} from "../lib/pdf.js";
import { resolveStoredPath } from "../lib/file-storage.js";

/**
 * The clinic's printed-document template, plus a live preview.
 *
 * The preview matters more than it sounds: every option here changes how a
 * legal document looks on paper, and the alternative to a preview is the
 * doctor discovering a broken layout after printing fifty prescriptions.
 * It renders through exactly the same code path as a real prescription --
 * a preview drawn by a separate routine would be free to disagree with
 * reality, which is the one thing a preview must never do.
 */

/**
 * Deliberately permissive about shape and strict about meaning.
 *
 * Zod checks that a block list is a list of objects with string keys;
 * resolveTemplate then decides which keys exist, which are required,
 * what the widths may be and what order survives. Validating the
 * semantics twice, in two places, is how the two drift -- and the
 * renderer reads the resolved value, not this one.
 */
const blockSchema = z.object({
  key: z.string().max(40),
  label: z.string().max(80).optional(),
  show: z.boolean().optional(),
  text: z.string().max(2000).optional(),
});

const columnSchema = z.object({
  key: z.string().max(40),
  label: z.string().max(40).optional(),
  show: z.boolean().optional(),
  width: z.coerce.number().optional(),
});

const kindSchema = z.object({
  title: z.string().max(80).optional(),
  footerNote: z.string().max(300).optional(),
  blocks: z.array(blockSchema).max(40).optional(),
  columns: z.array(columnSchema).max(20).optional(),
});

const templateSchema = z.object({
  headerMode: z.enum(["full", "compact", "none"]).optional(),
  topOffsetMm: z.coerce.number().min(0).max(120).optional(),
  accentColor: z.enum(Object.keys(ACCENTS) as [string, ...string[]]).optional(),
  watermarkEnabled: z.boolean().optional(),
  watermarkText: z.string().max(40).optional(),
  showFooter: z.boolean().optional(),
  footerNote: z.string().max(300).optional(),
  showQty: z.boolean().optional(),
  showTints: z.boolean().optional(),
  letterhead: z.array(z.object({
    key: z.string().max(40),
    label: z.string().max(60).optional(),
    show: z.boolean().optional(),
  })).max(20).optional(),
  kinds: z.record(z.string(), kindSchema).optional(),
});

export async function clinicDocTemplateRoutes(app: FastifyInstance) {
  app.get("/api/clinic/document-template", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const clinic = await prisma.clinic.findFirst({ select: { documentTemplate: true } });
    return {
      template: resolveTemplate(clinic?.documentTemplate),
      defaults: DEFAULT_TEMPLATE,
      accents: Object.entries(ACCENTS).map(([key, v]) => ({ key, label: v.label, ink: v.ink })),
      // The vocabulary the editor may compose from. Served rather than
      // duplicated in the frontend: a block the renderer cannot draw must
      // never be offerable, and two copies of this list would drift the
      // first time one is added.
      vocabulary: {
        kinds: DOC_KINDS.map((kind) => ({
          kind,
          blocks: BLOCK_TYPES[kind].map((b) => ({
            key: b.key,
            label: b.label,
            required: "required" in b ? b.required : false,
            critical: "critical" in b ? b.critical : false,
          })),
        })),
        letterhead: LETTERHEAD_FIELDS.map((f) => ({ key: f.key, label: f.label, always: f.always ?? false })),
        medicineColumns: MEDICINE_COLUMNS.map((c) => ({ key: c.key, label: c.label, defaultWidth: c.defaultWidth })),
      },
    };
  });

  app.put("/api/clinic/document-template", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const parsed = templateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.clinic.findFirst();
    if (!existing) return reply.status(404).send({ error: "Clinic not configured" });

    // Merged over what is stored, then re-resolved, so a partial save can
    // never leave a half-written template in the database.
    const merged = resolveTemplate({ ...resolveTemplate(existing.documentTemplate), ...parsed.data });
    // Round-tripped rather than cast: it satisfies Prisma's JSON input
    // type and, more usefully, guarantees the column holds valid JSON
    // with no undefined holes in it.
    await prisma.clinic.update({
      where: { id: existing.id },
      data: { documentTemplate: JSON.parse(JSON.stringify(merged)) },
    });
    return { template: merged };
  });

  /**
   * Renders a sample prescription with the supplied (unsaved) settings, so
   * the admin sees the result before committing to it.
   *
   * Sample data is obviously fictional -- "Sample Patient", "SAMPLE-0001" --
   * because a preview that used a real patient would put PHI into a file
   * generated for a settings screen.
   */
  app.post("/api/clinic/document-template/preview", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const parsed = templateSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const clinic = await prisma.clinic.findFirst();
    const template = resolveTemplate({ ...resolveTemplate(clinic?.documentTemplate), ...parsed.data });

    const branding = {
      name: clinic?.name ?? "Clinic",
      address: clinic?.address,
      phone: clinic?.phone,
      email: clinic?.email,
      registrationNumber: clinic?.registrationNumber,
      logoPath: clinic?.logoPath ? resolveStoredPath(clinic.logoPath) : null,
    };
    const layout = layoutFor(template, "prescription");
    const meta = {
      title: layout.title || "Prescription",
      reference: "SAMPLE-0001",
      date: new Date(),
      footerNote: "Sample document — not a real prescription.",
      kind: "prescription" as const,
    };

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", 'inline; filename="template-preview.pdf"');

    const doc = createDocument(branding, meta, template);

    // Obviously fictional, deliberately: a preview built from a real
    // patient would put PHI into a file generated for a settings screen.
    const SAMPLE = [
      { name: "Amoxicillin 500mg Capsule", composition: "Amoxicillin (500mg)", dosage: "1-0-1", frequency: "BD", duration: "5 days", qty: "10", instructions: "After food. Complete the full course." },
      { name: "Paracetamol 650mg Tablet", composition: "Paracetamol (650mg)", dosage: "1-1-1", frequency: "TDS", duration: "3 days", qty: "9", instructions: "Only if fever above 100°F." },
      { name: "Cetirizine 10mg Tablet", composition: "Cetirizine (10mg)", dosage: "0-0-1", frequency: "OD", duration: "5 days", qty: "5", instructions: "" },
    ];

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

    // The same walk as the real prescription route, so what is previewed
    // is what will be printed.
    renderBlocks(doc, template, "prescription", {
      patientInfo: () => drawInfoGrid(doc, [
        { label: "Patient", value: "Sample Patient" },
        { label: "UHID", value: "SAMPLE-0001" },
        { label: "Age / Sex", value: "42 yrs / Female" },
        { label: "Consulting Doctor", value: "Dr. Sample" },
        { label: "Blood Group", value: "O+" },
        { label: "Phone", value: "+91 90000 00000" },
      ]),

      allergyBanner: () => drawAlertBanner(doc, [
        { label: "Allergies", text: "Penicillin (sample)" },
        { label: "Chronic conditions", text: "Type 2 Diabetes (sample)" },
      ]),

      diagnosis: (label) => {
        drawFieldList(doc, [{ label: label || "Diagnosis", value: "Acute pharyngitis (sample)" }]);
        doc.moveDown(0.3);
      },

      vitals: (label) => {
        drawSectionHeading(doc, label || "Vitals");
        drawFieldList(doc, [
          { label: "BP", value: "118/76" },
          { label: "Pulse", value: "76" },
          { label: "Temp", value: "99.1F" },
          { label: "SpO2", value: "98%" },
          { label: "Weight", value: "64kg" },
        ]);
        doc.moveDown(0.3);
      },

      medicines: (label) => {
        drawSectionHeading(doc, label || "Rx  ·  Medicines Advised");
        const keys = shownColumnKeys(layout.columns ?? [], COLUMN_SPEC);
        drawTable(
          doc,
          tableColumns(layout.columns ?? [], COLUMN_SPEC),
          SAMPLE.map((item, i) => keys.map((key) =>
            key === "index" ? String(i + 1) : (item as Record<string, string>)[key] ?? "",
          )),
          {
            subRows: keys.includes("instructions")
              ? undefined
              : SAMPLE.map((item) => item.instructions || null),
          },
        );
      },

      advice: (label) => {
        drawSectionHeading(doc, label || "Advice");
        drawFieldList(doc, SAMPLE.filter((s) => s.instructions).map((s, i) => ({
          label: `${i + 1}`, value: s.instructions,
        })));
        doc.moveDown(0.3);
      },

      followUp: (label) => drawFieldList(doc, [
        { label: label || "Follow-up advised on", value: "Monday, 06 October 2026" },
      ]),

      signature: () => drawSignature(doc, "Dr. Sample", {
        qualifications: "MBBS, MD (General Medicine)",
        registrationNumber: clinic?.registrationNumber,
      }),
    });

    finalizeDocument(doc, branding, meta);
    return reply.send(doc);
  });
}
