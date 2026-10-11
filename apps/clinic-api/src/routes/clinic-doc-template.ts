import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../plugins/auth.js";
import { ACCENTS, DEFAULT_TEMPLATE, resolveTemplate } from "../lib/document-template.js";
import {
  createDocument, drawInfoGrid, drawAlertBanner, drawSectionHeading,
  drawTable, drawFieldList, drawSignature, finalizeDocument,
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

const templateSchema = z.object({
  headerMode: z.enum(["full", "compact", "none"]).optional(),
  topOffsetMm: z.coerce.number().min(0).max(120).optional(),
  accentColor: z.enum(Object.keys(ACCENTS) as [string, ...string[]]).optional(),
  watermarkEnabled: z.boolean().optional(),
  watermarkText: z.string().max(40).optional(),
  showFooter: z.boolean().optional(),
  footerNote: z.string().max(200).optional(),
  showQty: z.boolean().optional(),
  showTints: z.boolean().optional(),
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
    await prisma.clinic.update({ where: { id: existing.id }, data: { documentTemplate: { ...merged } } });
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
    const meta = {
      title: "Prescription",
      reference: "SAMPLE-0001",
      date: new Date(),
      footerNote: "Sample document — not a real prescription.",
    };

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", 'inline; filename="template-preview.pdf"');

    const doc = createDocument(branding, meta, template);

    drawInfoGrid(doc, [
      { label: "Patient", value: "Sample Patient" },
      { label: "UHID", value: "SAMPLE-0001" },
      { label: "Age / Sex", value: "42 yrs / Female" },
      { label: "Consulting Doctor", value: "Dr. Sample" },
      { label: "Blood Group", value: "O+" },
      { label: "Phone", value: "+91 90000 00000" },
    ]);

    drawAlertBanner(doc, [
      { label: "Allergies", text: "Penicillin (sample)" },
      { label: "Chronic conditions", text: "Type 2 Diabetes (sample)" },
    ]);

    drawFieldList(doc, [{ label: "Diagnosis", value: "Acute pharyngitis (sample)" }]);

    drawSectionHeading(doc, "Rx  ·  Medicines Advised");
    const columns = [
      { header: "#", width: 0.06, align: "center" as const },
      { header: "Medicine", width: template.showQty ? 0.34 : 0.42 },
      { header: "Dosage", width: 0.17, align: "center" as const },
      { header: "Frequency", width: 0.14, align: "center" as const },
      { header: "Duration", width: 0.16, align: "center" as const },
      ...(template.showQty ? [{ header: "Qty", width: 0.13, align: "right" as const }] : []),
    ];
    const rows = [
      ["1", "Amoxicillin 500mg Capsule", "1-0-1", "BD", "5 days", "10"],
      ["2", "Paracetamol 650mg Tablet", "1-1-1", "TDS", "3 days", "9"],
      ["3", "Cetirizine 10mg Tablet", "0-0-1", "OD", "5 days", "5"],
    ].map((r) => (template.showQty ? r : r.slice(0, 5)));

    drawTable(doc, columns, rows, {
      subRows: ["After food. Complete the full course.", "Only if fever above 100°F.", null],
    });

    drawFieldList(doc, [{ label: "Follow-up advised on", value: "Monday, 06 October 2026" }]);

    drawSignature(doc, "Dr. Sample", {
      qualifications: "MBBS, MD (General Medicine)",
      registrationNumber: clinic?.registrationNumber,
    });

    finalizeDocument(doc, branding, meta);
    return reply.send(doc);
  });
}
