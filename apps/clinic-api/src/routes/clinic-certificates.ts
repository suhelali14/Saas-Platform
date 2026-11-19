import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CertificateType } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireClinicalWriteAuth } from "../plugins/auth.js";
import { newLetterheadDoc, patientInfoBlock, signatureBlock } from "../lib/pdf.js";
import { resolveStoredPath } from "../lib/file-storage.js";
import { resolveCertificateTemplate, type CertificateContext } from "../lib/certificate-templates.js";

const CERT_TITLES: Record<CertificateType, string> = {
  SICK_LEAVE: "Medical / Sick Leave Certificate",
  FITNESS: "Fitness Certificate",
  REFERRAL: "Referral Letter",
};

function readableDate(iso?: string): string {
  if (!iso) return "___";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function defaultContent(type: CertificateType, patientName: string, fromDate?: string, toDate?: string): string {
  switch (type) {
    case "SICK_LEAVE":
      return `This is to certify that ${patientName} was examined and advised rest from ${readableDate(fromDate)} to ${readableDate(toDate)} due to medical illness.`;
    case "FITNESS":
      return `This is to certify that ${patientName} was examined on this date and is found fit to resume regular duties/activities.`;
    case "REFERRAL":
      return `${patientName} is being referred for further evaluation and management. Kindly assess and advise.`;
  }
}

const createSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional(),
  type: z.nativeEnum(CertificateType),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  content: z.string().max(5000).optional(),
  /** Which template to start from. Its body is resolved against the
   *  patient / doctor / clinic / date context and used as `content`
   *  unless a `content` override was typed in the form. */
  templateId: z.string().optional(),
  /** Referral extras: free-text destination and reason. */
  referredTo: z.string().max(200).optional(),
  reason: z.string().max(1000).optional(),
});

export async function clinicCertificateRoutes(app: FastifyInstance) {
  app.get("/api/clinic/certificates", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { patientId } = request.query as { patientId?: string };
    const certificates = await prisma.certificate.findMany({
      where: patientId ? { patientId } : undefined,
      include: { doctor: { select: { name: true } }, patient: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: certificates };
  });

  app.post("/api/clinic/certificates", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    // Resolve the content. Three paths, in order of precedence:
    //   1. A hand-typed `content` always wins -- an override is an
    //      override. This is the escape hatch for one-off wording.
    //   2. A `templateId` resolves its body against this certificate's
    //      context (patient, doctor, clinic, dates, referral extras).
    //   3. The legacy default content (SICK_LEAVE / FITNESS / REFERRAL)
    //      stays as a safety net so a clinic that has deleted every
    //      template still gets a usable certificate.
    let content = parsed.data.content;
    let templateId: string | null = parsed.data.templateId ?? null;
    if (!content && templateId) {
      const template = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });
      if (!template || !template.isActive) {
        return reply.status(400).send({ error: "Template not found or inactive." });
      }
      const doctor = await prisma.clinicUser.findUnique({ where: { id: auth.clinicUserId } });
      const clinic = await prisma.clinic.findFirst();
      const ctx: CertificateContext = {
        patient: {
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          uhid: patient.uhid,
          phone: patient.phone,
          address: patient.address,
        },
        doctor: {
          name: doctor?.name ?? "Doctor",
          qualifications: doctor?.qualifications ?? null,
          registrationNumber: clinic?.registrationNumber ?? null,
        },
        clinic: {
          name: clinic?.name ?? "",
          address: clinic?.address ?? null,
        },
        fromDate: parsed.data.fromDate ? new Date(parsed.data.fromDate) : null,
        toDate: parsed.data.toDate ? new Date(parsed.data.toDate) : null,
        extras: {
          referredTo: parsed.data.referredTo ?? "",
          reason: parsed.data.reason ?? "",
        },
      };
      content = resolveCertificateTemplate(template.body, ctx);
    }
    if (!content) {
      content = defaultContent(parsed.data.type, patient.name, parsed.data.fromDate, parsed.data.toDate);
    }

    const certificate = await prisma.certificate.create({
      data: {
        patientId: parsed.data.patientId,
        appointmentId: parsed.data.appointmentId,
        doctorId: auth.clinicUserId,
        type: parsed.data.type,
        fromDate: parsed.data.fromDate ? new Date(parsed.data.fromDate) : undefined,
        toDate: parsed.data.toDate ? new Date(parsed.data.toDate) : undefined,
        content,
        templateId,
      },
      include: {
        doctor: { select: { name: true } },
        patient: { select: { name: true } },
        template: { select: { id: true, name: true, type: true } },
      },
    });
    return reply.status(201).send(certificate);
  });

  app.get("/api/clinic/certificates/:id/pdf", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: { doctor: true, patient: true },
    });
    if (!certificate) return reply.status(404).send({ error: "Not found" });

    const clinic = await prisma.clinic.findFirst();

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="certificate-${id}.pdf"`);

    const doc = newLetterheadDoc(
      { name: clinic?.name ?? "Clinic", address: clinic?.address, phone: clinic?.phone, registrationNumber: clinic?.registrationNumber },
      CERT_TITLES[certificate.type],
    );
    patientInfoBlock(doc, certificate.patient, certificate.createdAt);

    doc.fontSize(11).font("Helvetica").text(certificate.content, { align: "left", lineGap: 4 });

    signatureBlock(doc, `Dr. ${certificate.doctor.name}`, {
      signatureImagePath: certificate.doctor.signatureImagePath ? resolveStoredPath(certificate.doctor.signatureImagePath) : null,
      qualifications: certificate.doctor.qualifications,
      registrationNumber: clinic?.registrationNumber,
    });
    doc.end();
    return reply.send(doc);
  });
}
