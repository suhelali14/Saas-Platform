import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BusinessVerificationStatus, KycDocumentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireAdminAuth } from "../../plugins/auth.js";
import { readStoredFile } from "../../lib/file-storage.js";
import { getPaginationParams, createPaginatedResult } from "../../lib/pagination.js";

// Platform trust layer -- admin-side KYC review (docs/plans platform-trust-layer).

const reviewDocumentSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(500).optional(),
});

const decideBusinessSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  notes: z.string().max(2000).optional(),
});

export async function adminKycRoutes(app: FastifyInstance) {
  app.get("/api/admin/kyc/businesses", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    const { page, limit, skip } = getPaginationParams(query);
    const where: { verificationStatus?: BusinessVerificationStatus } = {};
    if (query.status) where.verificationStatus = query.status as BusinessVerificationStatus;

    const [items, total] = await Promise.all([
      prisma.business.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          city: true,
          email: true,
          phone: true,
          panNumber: true,
          gstin: true,
          noGstinDeclared: true,
          verificationStatus: true,
          createdAt: true,
          _count: { select: { kycDocuments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.business.count({ where }),
    ]);

    return createPaginatedResult(items, total, page, limit);
  });

  app.get("/api/admin/kyc/businesses/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const business = await prisma.business.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        address: true,
        email: true,
        phone: true,
        panNumber: true,
        gstin: true,
        noGstinDeclared: true,
        verificationStatus: true,
        verificationNotes: true,
        createdAt: true,
      },
    });
    if (!business) return reply.status(404).send({ error: "Not found" });

    const documents = await prisma.kycDocument.findMany({
      where: { businessId: id },
      orderBy: { uploadedAt: "desc" },
    });

    return { ...business, documents };
  });

  app.get("/api/admin/kyc/documents/:id/file", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const doc = await prisma.kycDocument.findUnique({ where: { id } });
    if (!doc) return reply.status(404).send({ error: "Not found" });

    const stream = readStoredFile(doc.storagePath);
    if (!stream) return reply.status(404).send({ error: "File no longer available" });

    reply.header("Content-Type", doc.mimeType);
    reply.header("Content-Disposition", `inline; filename="${doc.fileName.replace(/"/g, "")}"`);
    return reply.send(stream);
  });

  app.post("/api/admin/kyc/documents/:id/review", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = reviewDocumentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    if (parsed.data.status === "REJECTED" && !parsed.data.rejectionReason) {
      return reply.status(400).send({ error: "A rejection reason is required" });
    }

    const doc = await prisma.kycDocument.findUnique({ where: { id } });
    if (!doc) return reply.status(404).send({ error: "Not found" });

    const updated = await prisma.kycDocument.update({
      where: { id },
      data: {
        status: parsed.data.status as KycDocumentStatus,
        rejectionReason: parsed.data.status === "REJECTED" ? parsed.data.rejectionReason : null,
        reviewedByAdminId: auth.adminId,
        reviewedAt: new Date(),
      },
    });
    return updated;
  });

  app.post("/api/admin/kyc/businesses/:id/decision", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = decideBusinessSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const business = await prisma.business.findUnique({ where: { id } });
    if (!business) return reply.status(404).send({ error: "Not found" });

    const updated = await prisma.business.update({
      where: { id },
      data: {
        verificationStatus: parsed.data.status as BusinessVerificationStatus,
        verificationNotes: parsed.data.notes ?? business.verificationNotes,
      },
      select: { id: true, name: true, verificationStatus: true, verificationNotes: true },
    });
    return updated;
  });
}
