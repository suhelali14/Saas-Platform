import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireClinicalWriteAuth } from "../plugins/auth.js";

const createSchema = z.object({
  name: z.string().min(1).max(300),
  composition: z.string().max(500).optional(),
  manufacturer: z.string().max(300).optional(),
  packSize: z.string().max(200).optional(),
  type: z.string().max(100).optional(),
});

export async function clinicDrugRoutes(app: FastifyInstance) {
  // Backed by a real ~250k-row Indian medicine dataset (see
  // prisma/seed-data/import-drugs.ts) plus anything a doctor adds manually.
  // "Type 2-3 letters, auto-complete" -- prefix search on `name`, which has
  // a trigram GIN index for fast case-insensitive matching at this scale.
  app.get("/api/clinic/drugs", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { search } = request.query as { search?: string };
    if (!search || search.length < 2) return { data: [] };

    const drugs = await prisma.drug.findMany({
      where: { name: { startsWith: search, mode: "insensitive" }, isDiscontinued: false },
      take: 15,
      orderBy: { name: "asc" },
    });
    return { data: drugs };
  });

  // "If new medicine there we can add that" -- a doctor who searches and
  // finds nothing can add it here, immediately available for future
  // autocomplete. Doctor/admin only, same clinical-content gate as
  // prescriptions/case-sheets/certificates.
  app.post("/api/clinic/drugs", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.drug.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
    if (existing) return reply.status(200).send(existing);

    const drug = await prisma.drug.create({ data: { ...parsed.data, addedManually: true } });
    return reply.status(201).send(drug);
  });
}
