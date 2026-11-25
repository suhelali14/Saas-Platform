/**
 * CRUD for the doctor's / clinic's service catalogue -- the "bill
 * board". The invoice editor picks from this list in one tap.
 *
 * Doctor-scoped items (doctorId set) only show up on that doctor's
 * board; clinic-wide items (doctorId null) appear for everyone. The
 * listing merges both, with the doctor's own items first, so a
 * clinic can agree on consultation prices while each doctor stocks
 * their own injections.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireClinicalWriteAuth, requireAdminAuth } from "../plugins/auth.js";
import { InvoiceItemCategory } from "../generated/prisma-client/index.js";
import { told } from "../lib/assistant/declare.js";

const upsertSchema = z.object({
  code: z.string().max(40).optional().nullable(),
  name: z.string().min(1).max(200),
  category: z.nativeEnum(InvoiceItemCategory),
  defaultPrice: z.coerce.number().nonnegative(),
  /** Null / empty = clinic-wide item (admin only). Set = doctor's own
   *  board (any doctor can write to their own). */
  doctorId: z.string().optional().nullable(),
  /** Optional link to a stocked Drug for medicines / injections. */
  drugId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

const SEED_ITEMS: Array<{
  name: string;
  category: InvoiceItemCategory;
  defaultPrice: number;
  description: string;
}> = [
  { name: "General Consultation", category: "CONSULTATION", defaultPrice: 500, description: "First visit, routine out-patient consultation." },
  { name: "Follow-up Consultation", category: "CONSULTATION", defaultPrice: 300, description: "Review visit within 15 days of a previous consultation." },
  { name: "Dressing - small", category: "PROCEDURE", defaultPrice: 150, description: "Minor dressing / wound care." },
];

async function seedIfEmpty() {
  const count = await prisma.serviceItem.count();
  if (count > 0) return;
  for (const s of SEED_ITEMS) {
    await prisma.serviceItem.create({ data: s });
  }
}

export async function clinicServiceItemRoutes(app: FastifyInstance) {
  // List -- merged doctor's own + clinic-wide. The `doctorId` query
  // param filters the merge so a doctor sees their own items first;
  // omitting it returns everything the clinic has.
  app.get("/api/clinic/service-items", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    await seedIfEmpty();
    const { doctorId, category, includeInactive, search } = request.query as {
      doctorId?: string;
      category?: string;
      includeInactive?: string;
      search?: string;
    };
    const where: Record<string, unknown> = {};
    if (category && Object.keys(InvoiceItemCategory).includes(category)) where.category = category;
    if (includeInactive !== "1") where.isActive = true;
    if (search) where.name = { contains: search, mode: "insensitive" };
    if (doctorId) {
      // Doctor view: their own items PLUS the clinic-wide ones.
      where.OR = [{ doctorId }, { doctorId: null }];
    }
    const items = await prisma.serviceItem.findMany({
      where,
      orderBy: [{ doctorId: "desc" }, { category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        doctor: { select: { id: true, name: true } },
        drug: { select: { id: true, name: true, price: true } },
      },
    });
    return { data: items };
  });

  app.get("/api/clinic/service-items/:id", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const item = await prisma.serviceItem.findUnique({
      where: { id },
      include: { doctor: { select: { id: true, name: true } }, drug: true },
    });
    if (!item) return reply.status(404).send({ error: "Service item not found" });
    return item;
  });

  app.post("/api/clinic/service-items", {
    config: {
      // What the assistant needs to add a line to the price list. With
      // this, "ECG is not on the price list" is no longer a dead end: the
      // doctor says what it costs and it is there.
      assistant: told({
        name: "add_to_price_list",
        summary: "Adds a service, procedure or test to the price list, so it can be charged on a bill: 'add ECG to the price list at 300', 'injection ka charge 150 rakho', 'new service dressing large 250'. Needs its name and its price.",
        asks: z.object({
          name: z.string().trim().min(1).max(200).describe("What the service is called, as it should read on a bill."),
          price: z.number().nonnegative().max(10_000_000).describe("Its price in rupees."),
          kind: z.enum(["CONSULTATION", "PROCEDURE", "LAB", "MEDICINE", "OTHER"]).optional().describe("What sort of charge it is. PROCEDURE when unsure."),
          forWholeClinic: z.boolean().optional().describe("True only when they say it is for every doctor in the clinic. Otherwise it goes on their own list."),
        }),
        toBody: (a) => ({ name: a.name, defaultPrice: a.price, category: a.kind ?? "PROCEDURE", ...(a.forWholeClinic ? { doctorId: "CLINIC" } : {}) }),
        title: (a) => `Add "${a.name}" to the price list at ₹${a.price.toLocaleString("en-IN")}?`,
        labels: { kind: "Kind", forWholeClinic: "For every doctor" },
        done: (item, a) => `"${item?.name ?? a.name}" is on the price list at ₹${a.price.toLocaleString("en-IN")}. You can charge it now.`,
        roles: ["DOCTOR"],
        module: "billing",
      }),
    },
  }, async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    // A doctor may only write to their OWN board; only admin may write
    // clinic-wide items (doctorId null). This keeps the "my prices are
    // mine" promise.
    let doctorId = parsed.data.doctorId ?? auth.clinicUserId;
    if (doctorId === "" || doctorId === "CLINIC") doctorId = null as unknown as string;
    const user = await prisma.clinicUser.findUnique({ where: { id: auth.clinicUserId } });
    if (doctorId === null && !user?.isAdmin) {
      return reply.status(403).send({ error: "Only an admin can add a clinic-wide item. Add it to your own board instead." });
    }
    if (doctorId && doctorId !== auth.clinicUserId && !user?.isAdmin) {
      return reply.status(403).send({ error: "You can only edit your own board." });
    }

    try {
      const item = await prisma.serviceItem.create({
        data: {
          code: parsed.data.code ?? null,
          name: parsed.data.name,
          category: parsed.data.category,
          defaultPrice: parsed.data.defaultPrice,
          doctorId: doctorId ?? null,
          drugId: parsed.data.drugId ?? null,
          description: parsed.data.description ?? null,
          sortOrder: parsed.data.sortOrder ?? 0,
          isActive: parsed.data.isActive ?? true,
        },
      });
      return reply.status(201).send(item);
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return reply.status(409).send({ error: "An item with that name already exists on this board." });
      }
      throw e;
    }
  });

  app.patch("/api/clinic/service-items/:id", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const current = await prisma.serviceItem.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: "Service item not found" });

    const user = await prisma.clinicUser.findUnique({ where: { id: auth.clinicUserId } });
    if (current.doctorId === null && !user?.isAdmin) {
      return reply.status(403).send({ error: "Only an admin can edit clinic-wide items." });
    }
    if (current.doctorId && current.doctorId !== auth.clinicUserId && !user?.isAdmin) {
      return reply.status(403).send({ error: "You can only edit items on your own board." });
    }

    const parsed = upsertSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    try {
      const item = await prisma.serviceItem.update({
        where: { id },
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          category: parsed.data.category,
          defaultPrice: parsed.data.defaultPrice,
          drugId: parsed.data.drugId,
          description: parsed.data.description,
          sortOrder: parsed.data.sortOrder,
          isActive: parsed.data.isActive,
        },
      });
      return item;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return reply.status(409).send({ error: "An item with that name already exists on this board." });
      }
      throw e;
    }
  });

  app.delete("/api/clinic/service-items/:id", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const current = await prisma.serviceItem.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: "Service item not found" });
    const user = await prisma.clinicUser.findUnique({ where: { id: auth.clinicUserId } });
    if (current.doctorId === null && !user?.isAdmin) {
      return reply.status(403).send({ error: "Only an admin can remove clinic-wide items." });
    }
    if (current.doctorId && current.doctorId !== auth.clinicUserId && !user?.isAdmin) {
      return reply.status(403).send({ error: "You can only remove items on your own board." });
    }
    // Soft-delete: a historic InvoiceItem may reference this item by
    // name; keeping the row makes the audit history readable.
    const item = await prisma.serviceItem.update({ where: { id }, data: { isActive: false } });
    return item;
  });

  // Reorder: an admin or the owning doctor supplies a list of
  // {id, sortOrder} to bulk-update. Used by the manager UI's
  // drag-handles.
  // Not for the assistant. It lays something out or previews it, which is done by eye on its own screen.
  app.post("/api/clinic/service-items/reorder", { config: { assistant: false } }, async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const parsed = z.array(z.object({ id: z.string(), sortOrder: z.number().int() })).max(500).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const user = await prisma.clinicUser.findUnique({ where: { id: auth.clinicUserId } });
    // Only update items the caller is allowed to edit.
    const ids = parsed.data.map((p) => p.id);
    const items = await prisma.serviceItem.findMany({ where: { id: { in: ids } }, select: { id: true, doctorId: true } });
    const allowed = new Set(
      items.filter((i) => (i.doctorId === null ? !!user?.isAdmin : i.doctorId === auth.clinicUserId || !!user?.isAdmin)).map((i) => i.id),
    );
    await prisma.$transaction(parsed.data.filter((p) => allowed.has(p.id)).map((p) => prisma.serviceItem.update({ where: { id: p.id }, data: { sortOrder: p.sortOrder } })));
    return { ok: true, updated: allowed.size };
  });

  // Suppress unused import warning for requireAdminAuth kept for future use.
  void requireAdminAuth;
}
