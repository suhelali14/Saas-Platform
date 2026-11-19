/**
 * CRUD for clinic-defined certificate templates.
 *
 * Doctor or admin writes the template; anyone issuing a certificate
 * picks one, which prefills the content with resolved placeholders.
 * The template body never reaches the Certificate row -- only its
 * resolved output does, so an edit to a template later cannot
 * retroactively change what a patient was already given.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireClinicalWriteAuth, requireAdminAuth } from "../plugins/auth.js";
import {
  CERTIFICATE_TOKENS,
  SEED_TEMPLATES,
  resolveCertificateTemplate,
  type CertificateContext,
} from "../lib/certificate-templates.js";
import { CertificateType } from "../generated/prisma-client/index.js";

const upsertSchema = z.object({
  type: z.nativeEnum(CertificateType),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  body: z.string().min(1).max(5000),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const previewSchema = z.object({
  body: z.string().min(1).max(5000),
  /** Optional sample context; defaults are substituted where missing so
   *  the preview always shows a coherent certificate rather than
   *  "___" fields that hide typos. */
  context: z
    .object({
      patientName: z.string().optional(),
      patientAge: z.number().optional(),
      patientGender: z.string().optional(),
      patientUHID: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      referredTo: z.string().optional(),
      reason: z.string().optional(),
    })
    .optional(),
});

async function seedIfEmpty(actorId: string) {
  const count = await prisma.certificateTemplate.count();
  if (count > 0) return;
  // Only seed when the table is empty; after a clinic has deleted the
  // defaults we don't resurrect them.
  for (const t of SEED_TEMPLATES) {
    await prisma.certificateTemplate.create({
      data: {
        type: t.type,
        name: t.name,
        description: t.description,
        body: t.body,
        isDefault: t.isDefault,
        createdById: actorId,
      },
    });
  }
}

export async function clinicCertificateTemplateRoutes(app: FastifyInstance) {
  // ── List, optionally filtered by type. Also auto-seeds the three
  //    defaults on the FIRST load for a clinic that has never issued
  //    a certificate, so the picker is never empty. ─────────────────
  app.get("/api/clinic/certificate-templates", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    await seedIfEmpty(auth.clinicUserId);
    const { type, includeInactive } = request.query as { type?: string; includeInactive?: string };
    const where: Parameters<typeof prisma.certificateTemplate.findMany>[0] extends infer A
      ? A extends { where?: infer W }
        ? W
        : never
      : never = {};
    if (type && Object.keys(CertificateType).includes(type)) {
      (where as { type?: CertificateType }).type = type as CertificateType;
    }
    if (includeInactive !== "1") {
      (where as { isActive?: boolean }).isActive = true;
    }
    const templates = await prisma.certificateTemplate.findMany({
      where,
      orderBy: [{ type: "asc" }, { isDefault: "desc" }, { name: "asc" }],
      include: { createdBy: { select: { name: true } } },
    });
    return { data: templates, tokens: CERTIFICATE_TOKENS };
  });

  app.get("/api/clinic/certificate-templates/:id", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const template = await prisma.certificateTemplate.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true } } },
    });
    if (!template) return reply.status(404).send({ error: "Template not found" });
    return template;
  });

  app.post("/api/clinic/certificate-templates", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    // If this one is marked default, clear the previous default for its
    // type -- one default per type, as the UI promises.
    if (parsed.data.isDefault) {
      await prisma.certificateTemplate.updateMany({
        where: { type: parsed.data.type, isDefault: true },
        data: { isDefault: false },
      });
    }
    try {
      const template = await prisma.certificateTemplate.create({
        data: {
          type: parsed.data.type,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          body: parsed.data.body,
          isDefault: parsed.data.isDefault ?? false,
          isActive: parsed.data.isActive ?? true,
          createdById: auth.clinicUserId,
        },
      });
      return reply.status(201).send(template);
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return reply.status(409).send({ error: "A template with that name already exists for this type." });
      }
      throw e;
    }
  });

  app.patch("/api/clinic/certificate-templates/:id", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = upsertSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const current = await prisma.certificateTemplate.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: "Template not found" });

    if (parsed.data.isDefault) {
      await prisma.certificateTemplate.updateMany({
        where: { type: parsed.data.type ?? current.type, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }
    try {
      const template = await prisma.certificateTemplate.update({
        where: { id },
        data: {
          type: parsed.data.type,
          name: parsed.data.name,
          description: parsed.data.description,
          body: parsed.data.body,
          isDefault: parsed.data.isDefault,
          isActive: parsed.data.isActive,
        },
      });
      return template;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return reply.status(409).send({ error: "A template with that name already exists for this type." });
      }
      throw e;
    }
  });

  app.delete("/api/clinic/certificate-templates/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    // Soft-delete by marking inactive -- there may be certificates that
    // reference this template as the one they were issued from, and
    // the audit story is better if they continue to resolve.
    const template = await prisma.certificateTemplate.update({
      where: { id },
      data: { isActive: false, isDefault: false },
    });
    return template;
  });

  // ── Preview a template body against sample data. Used by the editor
  //    so the clinic can see what the resolved certificate will say
  //    before saving. ─────────────────────────────────────────────────
  app.post("/api/clinic/certificate-templates/preview", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const parsed = previewSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const clinic = await prisma.clinic.findFirst();
    const doctor = await prisma.clinicUser.findUnique({ where: { id: auth.clinicUserId } });
    const ctx: CertificateContext = {
      patient: {
        name: parsed.data.context?.patientName ?? "Rajesh Kumar",
        age: parsed.data.context?.patientAge ?? 42,
        gender: parsed.data.context?.patientGender ?? "Male",
        uhid: parsed.data.context?.patientUHID ?? "SMPL-00001",
      },
      doctor: {
        name: doctor?.name ?? "Example",
        qualifications: doctor?.qualifications ?? "MBBS",
        registrationNumber: clinic?.registrationNumber ?? null,
      },
      clinic: {
        name: clinic?.name ?? "Example Clinic",
        address: clinic?.address ?? null,
      },
      fromDate: parsed.data.context?.fromDate ? new Date(parsed.data.context.fromDate) : new Date(),
      toDate: parsed.data.context?.toDate
        ? new Date(parsed.data.context.toDate)
        : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      extras: {
        referredTo: parsed.data.context?.referredTo ?? "Dr. Example (Cardiology, City Hospital)",
        reason: parsed.data.context?.reason ?? "evaluation of persistent chest pain",
      },
    };
    const resolved = resolveCertificateTemplate(parsed.data.body, ctx);
    return { resolved };
  });
}
