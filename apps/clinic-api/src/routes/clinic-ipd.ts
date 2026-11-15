import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { resolvedSchema } from "../lib/db-schema.js";
import { IPD_ROLES, requireAdminAuth, requireClinicAuth, requireRoles } from "../plugins/auth.js";
import { ipNumber, stayBill, type Move } from "../lib/ipd.js";

/**
 * Inpatients: wards, beds, admissions, transfers, the running account,
 * and discharge.
 *
 * The bed a patient is in is on the admission; every bed they have been
 * in is a BedMove carrying the ward's rate at the time, which is what the
 * room charge is worked out from (lib/ipd.ts). Services are posted to the
 * account as charges. Discharge writes the summary and turns the account
 * into one bill, which the cash counter settles from the deposit.
 */

const WARD_KINDS = ["GENERAL", "SEMI_PRIVATE", "PRIVATE", "ICU", "NICU", "DAYCARE"] as const;
const CATEGORIES = ["NURSING", "DOCTOR_VISIT", "PROCEDURE", "MEDICINE", "CONSUMABLE", "LAB", "RADIOLOGY", "OT", "OTHER"] as const;

async function staffName(id: string) {
  return (await prisma.clinicUser.findUnique({ where: { id }, select: { name: true } }))?.name ?? "Staff";
}

const ADMISSION_INCLUDE = {
  patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, phone: true, allergies: true, chronicConditions: true, bloodGroup: true } },
  admittingDoctor: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  bed: { include: { ward: { select: { id: true, name: true, kind: true } } } },
} as const;

/** The running bill for one admission, through now (or discharge). Takes
 *  a transaction client when it must read inside one, as discharge does. */
async function billFor(admissionId: string, db: Prisma.TransactionClient = prisma) {
  const a = await db.admission.findUnique({
    where: { id: admissionId },
    include: { moves: { orderBy: { at: "asc" } }, charges: { orderBy: { at: "asc" } }, deposits: true },
  });
  if (!a) return null;
  const end = a.dischargedAt ?? new Date();
  const moves: Move[] = a.moves.map((m) => ({ wardName: m.wardName, dailyRate: Number(m.dailyRate), at: m.at }));
  const bill = stayBill(
    moves,
    a.charges.map((c) => ({ category: c.category, description: c.description, quantity: c.quantity, rate: Number(c.rate) })),
    a.deposits.map((d) => ({ kind: d.kind, amount: Number(d.amount) })),
    end,
  );
  return { bill, charges: a.charges, moves: a.moves, deposits: a.deposits };
}

export async function clinicIpdRoutes(app: FastifyInstance) {
  // ── Wards and beds (set up by an admin) ─────────────────────────────

  app.get("/api/clinic/wards", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const wards = await prisma.ward.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { beds: { orderBy: { label: "asc" } } },
    });
    return { data: wards };
  });

  app.post("/api/clinic/wards", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const parsed = z.object({
      name: z.string().trim().min(1).max(60),
      kind: z.enum(WARD_KINDS),
      dailyRate: z.coerce.number().min(0).max(1_000_000),
      beds: z.coerce.number().int().min(0).max(200).optional(),
      bedPrefix: z.string().max(10).optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const clash = await prisma.ward.findUnique({ where: { name: parsed.data.name } });
    if (clash) return reply.status(409).send({ error: `There is already a ward called ${parsed.data.name}.` });
    const prefix = parsed.data.bedPrefix ?? parsed.data.name.slice(0, 1).toUpperCase();
    const ward = await prisma.ward.create({
      data: {
        name: parsed.data.name, kind: parsed.data.kind, dailyRate: parsed.data.dailyRate,
        beds: { create: Array.from({ length: parsed.data.beds ?? 0 }, (_, i) => ({ label: `${prefix}-${i + 1}` })) },
      },
      include: { beds: true },
    });
    return reply.status(201).send(ward);
  });

  app.put("/api/clinic/wards/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({
      name: z.string().trim().min(1).max(60).optional(),
      dailyRate: z.coerce.number().min(0).max(1_000_000).optional(),
      isActive: z.boolean().optional(),
      addBeds: z.array(z.string().trim().min(1).max(20)).max(100).optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { addBeds, ...data } = parsed.data;
    // A new rate applies to beds taken from now on. A patient already in
    // the ward keeps the rate they moved in at (it is on their BedMove).
    const ward = await prisma.ward.update({ where: { id }, data });
    if (addBeds?.length) {
      await prisma.bed.createMany({ data: addBeds.map((label) => ({ wardId: id, label })), skipDuplicates: true });
    }
    return ward;
  });

  /** Take a bed out of use (cleaning, repair) or put it back. */
  app.put("/api/clinic/beds/:id", async (request, reply) => {
    const auth = requireRoles(request, reply, IPD_ROLES, "Only ward staff can change a bed.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({ blockedReason: z.string().max(80).nullable().optional(), isActive: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const occupied = await prisma.admission.findFirst({ where: { bedId: id, status: "ADMITTED" } });
    if (occupied && (parsed.data.blockedReason || parsed.data.isActive === false)) {
      return reply.status(409).send({ error: "There is a patient in this bed. Transfer them first." });
    }
    return prisma.bed.update({ where: { id }, data: parsed.data });
  });

  // ── The bed board ───────────────────────────────────────────────────

  app.get("/api/clinic/ipd/board", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const [wards, admitted] = await Promise.all([
      prisma.ward.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { beds: { where: { isActive: true }, orderBy: { label: "asc" } } } }),
      prisma.admission.findMany({ where: { status: "ADMITTED" }, include: ADMISSION_INCLUDE, orderBy: { admittedAt: "asc" } }),
    ]);
    const byBed = new Map(admitted.filter((a) => a.bedId).map((a) => [a.bedId!, a]));
    return {
      wards: wards.map((w) => ({
        ...w,
        beds: w.beds.map((b) => ({ ...b, admission: byBed.get(b.id) ?? null })),
      })),
      // Admitted with no bed yet: waiting for one, shown first.
      unassigned: admitted.filter((a) => !a.bedId),
      counts: {
        admitted: admitted.length,
        beds: wards.reduce((s, w) => s + w.beds.length, 0),
        free: wards.reduce((s, w) => s + w.beds.filter((b) => !byBed.has(b.id) && !b.blockedReason).length, 0),
      },
    };
  });

  // ── Admissions ──────────────────────────────────────────────────────

  app.get("/api/clinic/admissions", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const { status, patientId } = request.query as { status?: string; patientId?: string };
    const admissions = await prisma.admission.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(patientId ? { patientId } : {}),
      },
      include: ADMISSION_INCLUDE,
      orderBy: { admittedAt: "desc" },
      take: 100,
    });
    return { data: admissions };
  });

  app.post("/api/clinic/admissions", async (request, reply) => {
    const auth = requireRoles(request, reply, IPD_ROLES, "Only ward or front-desk staff can admit a patient.");
    if (!auth) return;
    const parsed = z.object({
      patientId: z.string().min(1),
      admittingDoctorId: z.string().optional(),
      departmentId: z.string().optional(),
      bedId: z.string().optional(),
      reason: z.string().max(500).optional(),
      provisionalDiagnosis: z.string().max(500).optional(),
      payerType: z.enum(["SELF", "INSURANCE", "SCHEME"]).default("SELF"),
      estimatedCost: z.coerce.number().min(0).max(100_000_000).optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId }, select: { id: true, name: true } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });
    const already = await prisma.admission.findFirst({ where: { patientId: patient.id, status: "ADMITTED" } });
    if (already) return reply.status(409).send({ error: `${patient.name} is already admitted (${already.ipNumber}).`, admissionId: already.id });

    const byName = await staffName(auth.clinicUserId);
    const schema = resolvedSchema();
    try {
      const admission = await prisma.$transaction(async (tx) => {
        let bed = null;
        if (parsed.data.bedId) {
          bed = await tx.bed.findUnique({ where: { id: parsed.data.bedId }, include: { ward: true } });
          if (!bed || !bed.isActive) throw new Error("BED_GONE");
          if (bed.blockedReason) throw new Error("BED_BLOCKED");
          const taken = await tx.admission.findFirst({ where: { bedId: bed.id, status: "ADMITTED" } });
          if (taken) throw new Error("BED_TAKEN");
        }

        const rows = await tx.$queryRawUnsafe<{ nextval: bigint }[]>(`SELECT nextval('"${schema}"."ip_number_seq"')`);
        const now = new Date();
        return tx.admission.create({
          data: {
            ipNumber: ipNumber(Number(rows[0]!.nextval), now),
            patientId: patient.id,
            admittingDoctorId: parsed.data.admittingDoctorId ?? null,
            departmentId: parsed.data.departmentId ?? null,
            bedId: bed?.id ?? null,
            admittedAt: now,
            reason: parsed.data.reason ?? null,
            provisionalDiagnosis: parsed.data.provisionalDiagnosis ?? null,
            payerType: parsed.data.payerType,
            estimatedCost: parsed.data.estimatedCost ?? null,
            ...(bed ? { moves: { create: [{ bedId: bed.id, wardName: bed.ward.name, dailyRate: bed.ward.dailyRate, at: now, byName }] } } : {}),
          },
          include: ADMISSION_INCLUDE,
        });
      });
      return reply.status(201).send(admission);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "BED_TAKEN") return reply.status(409).send({ error: "That bed has just been taken. Choose another." });
      if (code === "BED_BLOCKED") return reply.status(409).send({ error: "That bed is out of use." });
      if (code === "BED_GONE") return reply.status(404).send({ error: "That bed no longer exists." });
      if (isUniqueViolation(e)) {
        const target = String((e as Prisma.PrismaClientKnownRequestError).meta?.target ?? "");
        return reply.status(409).send({
          error: target.includes("patient") ? `${patient.name} is already admitted.` : "That bed has just been taken. Choose another.",
        });
      }
      throw e;
    }
  });

  app.get("/api/clinic/admissions/:id", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const admission = await prisma.admission.findUnique({
      where: { id },
      include: {
        ...ADMISSION_INCLUDE,
        invoices: { select: { id: true, createdAt: true } },
        claims: { select: { id: true, payer: true, payerName: true, preauthStatus: true, claimStatus: true, preauthAmount: true, approvedAmount: true } },
        otBookings: { orderBy: { scheduledAt: "asc" }, include: { surgeon: { select: { name: true } } } },
        radiologyOrders: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!admission) return reply.status(404).send({ error: "Not found" });
    const running = await billFor(id);
    return { admission, ...running };
  });

  /** Move to another bed; the old bed frees, the new rate starts now. */
  app.post("/api/clinic/admissions/:id/transfer", async (request, reply) => {
    const auth = requireRoles(request, reply, IPD_ROLES, "Only ward staff can move a patient.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({ bedId: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Choose a bed." });
    const byName = await staffName(auth.clinicUserId);
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const a = await tx.admission.findUnique({ where: { id } });
        if (!a || a.status !== "ADMITTED") throw new Error("NOT_ADMITTED");
        if (a.bedId === parsed.data.bedId) throw new Error("SAME_BED");
        const bed = await tx.bed.findUnique({ where: { id: parsed.data.bedId }, include: { ward: true } });
        if (!bed || !bed.isActive || bed.blockedReason) throw new Error("BED_BLOCKED");
        const taken = await tx.admission.findFirst({ where: { bedId: bed.id, status: "ADMITTED" } });
        if (taken) throw new Error("BED_TAKEN");
        await tx.bedMove.create({ data: { admissionId: id, bedId: bed.id, wardName: bed.ward.name, dailyRate: bed.ward.dailyRate, byName } });
        return tx.admission.update({ where: { id }, data: { bedId: bed.id }, include: ADMISSION_INCLUDE });
      });
      return updated;
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "BED_TAKEN") return reply.status(409).send({ error: "That bed is taken." });
      if (code === "BED_BLOCKED") return reply.status(409).send({ error: "That bed is out of use." });
      if (code === "SAME_BED") return reply.status(400).send({ error: "The patient is already in that bed." });
      if (code === "NOT_ADMITTED") return reply.status(409).send({ error: "This patient is not admitted." });
      if (isUniqueViolation(e)) return reply.status(409).send({ error: "That bed is taken." });
      throw e;
    }
  });

  /** Post a service to the account. */
  app.post("/api/clinic/admissions/:id/charges", async (request, reply) => {
    const auth = requireRoles(request, reply, IPD_ROLES, "Only ward or billing staff can post charges.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({
      category: z.enum(CATEGORIES),
      description: z.string().trim().min(1).max(200),
      quantity: z.coerce.number().int().min(1).max(1000).default(1),
      rate: z.coerce.number().min(0).max(10_000_000),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const a = await prisma.admission.findUnique({ where: { id } });
    if (!a) return reply.status(404).send({ error: "Not found" });
    if (a.status !== "ADMITTED") return reply.status(409).send({ error: "This stay is closed; charges go on before discharge." });
    const charge = await prisma.admissionCharge.create({ data: { ...parsed.data, admissionId: id, byName: await staffName(auth.clinicUserId) } });
    return reply.status(201).send({ charge, ...(await billFor(id)) });
  });

  app.delete("/api/clinic/admissions/:id/charges/:chargeId", async (request, reply) => {
    const auth = requireRoles(request, reply, IPD_ROLES, "Only ward or billing staff can remove charges.");
    if (!auth) return;
    const { id, chargeId } = request.params as { id: string; chargeId: string };
    const a = await prisma.admission.findUnique({ where: { id } });
    if (!a || a.status !== "ADMITTED") return reply.status(409).send({ error: "Charges can only be removed while the patient is admitted." });
    await prisma.admissionCharge.deleteMany({ where: { id: chargeId, admissionId: id } });
    return billFor(id);
  });

  /**
   * Discharge: the summary, then the account becomes one bill.
   *
   * Room days and every posted charge become the bill's lines, so the bill
   * a patient is handed matches the account the ward ran. The deposit is
   * settled against it at the counter, never silently here.
   */
  app.post("/api/clinic/admissions/:id/discharge", async (request, reply) => {
    const auth = requireRoles(request, reply, IPD_ROLES, "Only ward staff can discharge a patient.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({
      finalDiagnosis: z.string().trim().min(2).max(1000),
      treatmentGiven: z.string().max(4000).optional(),
      conditionAtDischarge: z.string().max(200).optional(),
      dischargeAdvice: z.string().max(4000).optional(),
      followUpDate: z.string().optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "The final diagnosis is needed to discharge." });
    const a = await prisma.admission.findUnique({ where: { id } });
    if (!a) return reply.status(404).send({ error: "Not found" });
    if (a.status !== "ADMITTED") return reply.status(409).send({ error: "This patient has already been discharged." });

    /*
     * One step, which only one request can win. Closing the stay is a
     * conditional update -- still ADMITTED, or nothing happens -- so a
     * double-tapped Discharge or two desks at once cannot both make a
     * bill; and the bill is made in the same transaction, so a failure
     * cannot leave a discharged patient with no bill to settle.
     */
    const dischargedAt = new Date();
    try {
      const { invoiceId, running } = await prisma.$transaction(async (tx) => {
        const closed = await tx.admission.updateMany({
          where: { id, status: "ADMITTED" },
          data: {
            ...parsed.data,
            followUpDate: parsed.data.followUpDate ? new Date(`${parsed.data.followUpDate.slice(0, 10)}T12:00:00+05:30`) : null,
            status: "DISCHARGED",
            dischargedAt,
            // The bed frees the moment the patient leaves.
            bedId: null,
          },
        });
        if (closed.count === 0) throw new Error("ALREADY_DISCHARGED");
        const running = (await billFor(id, tx))!;
        const items = [
          ...running.bill.room.filter((r) => r.days > 0).map((r) => ({ category: "OTHER" as const, description: `Room: ${r.wardName}, ${r.days} day${r.days === 1 ? "" : "s"} at ₹${r.dailyRate}`, quantity: r.days, amount: r.dailyRate })),
          ...running.charges.map((c) => ({
            category: (c.category === "MEDICINE" || c.category === "CONSUMABLE" ? "MEDICINE" : c.category === "LAB" || c.category === "RADIOLOGY" ? "LAB" : c.category === "PROCEDURE" || c.category === "OT" ? "PROCEDURE" : c.category === "DOCTOR_VISIT" ? "CONSULTATION" : "OTHER") as never,
            description: c.description, quantity: c.quantity, amount: c.rate,
          })),
        ];
        const invoice = await tx.invoice.create({
          data: { patientId: a.patientId, admissionId: id, items: { create: items } },
        });
        return { invoiceId: invoice.id, running };
      });
      return { dischargedAt, invoiceId, ...running };
    } catch (e) {
      if (e instanceof Error && e.message === "ALREADY_DISCHARGED") {
        return reply.status(409).send({ error: "This patient has already been discharged." });
      }
      throw e;
    }
  });
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
