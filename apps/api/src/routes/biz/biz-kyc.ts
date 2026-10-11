import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { KycDocumentType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { saveUploadedFile, readStoredFile, FileValidationError } from "../../lib/file-storage.js";

// Platform trust layer -- business-side KYC (docs/plans platform-trust-layer).
// Typed identity fields (panNumber/gstin) live on Business directly, same
// research-grounded reasoning as the plan: a photo of a PAN card can't be
// diffed against a cancelled cheque's account-holder name, but two text
// fields can -- Razorpay's own published data blames ~40% of real-world KYC
// rejections on exactly that kind of mismatch going unchecked.

const detailsSchema = z.object({
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, "Enter a valid 10-character PAN").optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z0-9]{13}$/i, "Enter a valid 15-character GSTIN").optional(),
  noGstinDeclared: z.boolean().optional(),
});

export async function bizKycRoutes(app: FastifyInstance) {
  app.get("/api/biz/kyc/status", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: {
        verificationStatus: true,
        verificationNotes: true,
        panNumber: true,
        gstin: true,
        noGstinDeclared: true,
      },
    });
    if (!business) return reply.status(404).send({ error: "Business not found" });

    const documents = await prisma.kycDocument.findMany({
      where: { businessId: auth.businessId },
      select: { id: true, type: true, fileName: true, status: true, rejectionReason: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" },
    });

    return { ...business, documents };
  });

  app.put("/api/biz/kyc/details", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = detailsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const business = await prisma.business.update({
      where: { id: auth.businessId },
      data: parsed.data,
      select: { panNumber: true, gstin: true, noGstinDeclared: true },
    });
    return business;
  });

  app.post("/api/biz/kyc/documents", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const typeField = data.fields.type;
    const typeValue = typeField && !Array.isArray(typeField) && typeField.type === "field" ? String(typeField.value) : undefined;
    if (!typeValue || !Object.values(KycDocumentType).includes(typeValue as KycDocumentType)) {
      return reply.status(400).send({ error: `type must be one of: ${Object.values(KycDocumentType).join(", ")}` });
    }

    try {
      const saved = await saveUploadedFile(auth.businessId, data.filename, data.mimetype, data.file);

      // A re-upload of the same document type replaces the pending/rejected
      // one rather than piling up duplicates a reviewer has to sort through.
      await prisma.kycDocument.deleteMany({
        where: { businessId: auth.businessId, type: typeValue as KycDocumentType, status: { not: "APPROVED" } },
      });

      const doc = await prisma.kycDocument.create({
        data: {
          businessId: auth.businessId,
          type: typeValue as KycDocumentType,
          fileName: saved.fileName,
          mimeType: saved.mimeType,
          storagePath: saved.storagePath,
          status: "PENDING",
        },
      });
      return reply.status(201).send(doc);
    } catch (err) {
      if (err instanceof FileValidationError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get("/api/biz/kyc/documents", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    return prisma.kycDocument.findMany({
      where: { businessId: auth.businessId },
      orderBy: { uploadedAt: "desc" },
    });
  });

  app.get("/api/biz/kyc/documents/:id/file", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const doc = await prisma.kycDocument.findFirst({ where: { id, businessId: auth.businessId } });
    if (!doc) return reply.status(404).send({ error: "Not found" });

    const stream = readStoredFile(doc.storagePath);
    if (!stream) return reply.status(404).send({ error: "File no longer available" });

    reply.header("Content-Type", doc.mimeType);
    reply.header("Content-Disposition", `inline; filename="${doc.fileName.replace(/"/g, "")}"`);
    return reply.send(stream);
  });
}
