import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isFeatureEnabled } from "../config/features.js";
import { CLAIM_ROLES, requireClinicAuth, requireRoles } from "../plugins/auth.js";

/**
 * The insurance desk and the government schemes desk.
 *
 * One record shape for both, because the work is the same: get a
 * pre-authorisation, treat within it, submit the claim with the documents
 * the payer asks for, answer queries, and record what was settled and
 * what was deducted. Which desk a claim belongs to is its payer; each desk
 * is its own module, so a clinic can have the insurance desk without the
 * scheme desk.
 *
 * The claim itself is filed on the payer's own portal -- PM-JAY's TMS, an
 * insurer's or TPA's system. No public interface lets software like this
 * file there, so this does not pretend to. It is the hospital's own
 * record: what is pending, what is owed, and how long it has been owed.
 */

const SCHEMES = ["PMJAY", "MJPJAY", "CGHS", "ECHS", "OTHER"] as const;
const PREAUTH = ["NOT_NEEDED", "DRAFT", "SUBMITTED", "QUERY", "APPROVED", "ENHANCEMENT", "REJECTED"] as const;
const CLAIM = ["NOT_SUBMITTED", "SUBMITTED", "QUERY", "APPROVED", "SETTLED", "REJECTED"] as const;

/** The documents every claim of this kind asks for, as a starting list. */
const DEFAULT_DOCUMENTS: Record<string, string[]> = {
  INSURANCE: ["Pre-authorisation form, signed", "Policy card and photo ID", "Doctor's notes and investigation reports", "Final bill with break-up", "Discharge summary", "Pharmacy bills"],
  PMJAY: ["Beneficiary verification (BIS) and e-card", "Photo of the patient in the bed", "Pre-auth documents per the package", "Discharge summary", "Investigation reports", "Implant invoice and sticker, where used"],
  MJPJAY: ["Ration card / scheme card and photo ID", "Arogyamitra registration", "Pre-auth documents per the package", "Discharge summary", "Investigation reports"],
  CGHS: ["CGHS card and referral letter", "Final bill item-wise at CGHS rates", "Discharge summary", "Investigation reports"],
  ECHS: ["ECHS card and referral from polyclinic", "Final bill at approved rates", "Discharge summary", "Implant sticker and batch number, where used"],
  OTHER: ["Scheme card and photo ID", "Discharge summary", "Final bill"],
};

const createSchema = z.object({
  patientId: z.string().min(1),
  admissionId: z.string().optional(),
  payer: z.enum(["INSURANCE", "SCHEME"]),
  payerName: z.string().trim().min(2).max(160),
  scheme: z.enum(SCHEMES).optional(),
  memberId: z.string().max(80).optional(),
  packageId: z.string().optional(),
  packageCode: z.string().max(40).optional(),
  packageName: z.string().max(200).optional(),
  packageRate: z.coerce.number().min(0).max(100_000_000).optional(),
  notes: z.string().max(2000).optional(),
});

const updateSchema = z.object({
  memberId: z.string().max(80).nullable().optional(),
  packageCode: z.string().max(40).nullable().optional(),
  packageName: z.string().max(200).nullable().optional(),
  packageRate: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  preauthStatus: z.enum(PREAUTH).optional(),
  preauthNumber: z.string().max(80).nullable().optional(),
  preauthAmount: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  preauthValidTill: z.string().nullable().optional(),
  claimStatus: z.enum(CLAIM).optional(),
  claimAmount: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  approvedAmount: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  settledAmount: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  settlementRef: z.string().max(80).nullable().optional(),
  deductionReason: z.string().max(500).nullable().optional(),
  documents: z.array(z.object({ name: z.string().max(200), done: z.boolean() })).max(40).optional(),
  notes: z.string().max(2000).nullable().optional(),
  note: z.string().max(500).optional(),
});

function deskOn(payer: string) {
  return payer === "SCHEME" ? isFeatureEnabled("schemes") : isFeatureEnabled("insurance");
}

async function staffName(id: string) {
  return (await prisma.clinicUser.findUnique({ where: { id }, select: { name: true } }))?.name ?? "Staff";
}

const STATUS_WORDS: Record<string, string> = {
  NOT_NEEDED: "not needed", DRAFT: "draft", SUBMITTED: "submitted", QUERY: "query raised", APPROVED: "approved",
  ENHANCEMENT: "enhancement asked", REJECTED: "rejected", NOT_SUBMITTED: "not submitted", SETTLED: "settled",
};

export async function clinicClaimRoutes(app: FastifyInstance) {
  app.get("/api/clinic/claims", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const { payer, open } = request.query as { payer?: string; open?: string };
    const payers = ["INSURANCE", "SCHEME"].filter((p) => deskOn(p) && (!payer || p === payer));
    const claims = await prisma.claim.findMany({
      where: {
        payer: { in: payers as never },
        ...(open === "1" ? { claimStatus: { notIn: ["SETTLED", "REJECTED"] } } : {}),
      },
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
        admission: { select: { id: true, ipNumber: true, status: true, admittedAt: true, dischargedAt: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const now = Date.now();
    return {
      data: claims.map((c) => ({
        ...c,
        // Days a submitted claim has waited for money: the ageing a
        // hospital chases its receivables by.
        ageDays: c.claimSubmittedAt && c.claimStatus !== "SETTLED" && c.claimStatus !== "REJECTED"
          ? Math.floor((now - c.claimSubmittedAt.getTime()) / 86_400_000) : null,
      })),
    };
  });

  app.post("/api/clinic/claims", async (request, reply) => {
    const auth = requireRoles(request, reply, CLAIM_ROLES, "Only billing or front-desk staff can open a claim.");
    if (!auth) return;
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    if (!deskOn(parsed.data.payer)) return reply.status(404).send({ error: "Not found" });
    if (parsed.data.payer === "SCHEME" && !parsed.data.scheme) return reply.status(400).send({ error: "Say which scheme." });
    const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId }, select: { id: true } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    let pkg = null;
    if (parsed.data.packageId) {
      pkg = await prisma.schemePackage.findUnique({ where: { id: parsed.data.packageId } });
      if (!pkg) return reply.status(404).send({ error: "That package is not in the rate list." });
    }
    const docList = Array.isArray(pkg?.documents) && (pkg!.documents as unknown[]).length
      ? (pkg!.documents as string[])
      : DEFAULT_DOCUMENTS[parsed.data.payer === "INSURANCE" ? "INSURANCE" : parsed.data.scheme ?? "OTHER"]!;
    const { packageId: _p, ...rest } = parsed.data;
    const byName = await staffName(auth.clinicUserId);
    const claim = await prisma.claim.create({
      data: {
        ...rest,
        packageCode: pkg?.code ?? rest.packageCode ?? null,
        packageName: pkg?.name ?? rest.packageName ?? null,
        packageRate: pkg?.rate ?? rest.packageRate ?? null,
        documents: docList.map((name) => ({ name, done: false })),
        events: { create: [{ byName, what: "Claim opened" }] },
      },
    });
    if (parsed.data.admissionId) {
      await prisma.admission.updateMany({ where: { id: parsed.data.admissionId }, data: { payerType: parsed.data.payer } });
    }
    return reply.status(201).send(claim);
  });

  app.get("/api/clinic/claims/:id", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, uhid: true, age: true, gender: true, phone: true } },
        admission: { select: { id: true, ipNumber: true, status: true, admittedAt: true, dischargedAt: true, finalDiagnosis: true, provisionalDiagnosis: true } },
        events: { orderBy: { at: "desc" } },
      },
    });
    if (!claim || !deskOn(claim.payer)) return reply.status(404).send({ error: "Not found" });
    return claim;
  });

  /**
   * Move a claim along. Every status change is written to its history with
   * who did it, so "when did we submit, and who answered the query" has
   * an answer months later.
   */
  app.put("/api/clinic/claims/:id", async (request, reply) => {
    const auth = requireRoles(request, reply, CLAIM_ROLES, "Only billing or front-desk staff can update a claim.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const existing = await prisma.claim.findUnique({ where: { id } });
    if (!existing || !deskOn(existing.payer)) return reply.status(404).send({ error: "Not found" });

    const { note, preauthValidTill, ...data } = parsed.data;
    const now = new Date();
    const events: string[] = [];
    const stamp: Record<string, unknown> = {};
    if (data.preauthStatus && data.preauthStatus !== existing.preauthStatus) {
      events.push(`Pre-auth ${STATUS_WORDS[data.preauthStatus]}`);
      if (data.preauthStatus === "APPROVED") stamp.preauthApprovedAt = now;
    }
    if (data.claimStatus && data.claimStatus !== existing.claimStatus) {
      events.push(`Claim ${STATUS_WORDS[data.claimStatus]}`);
      if (data.claimStatus === "SUBMITTED" && !existing.claimSubmittedAt) stamp.claimSubmittedAt = now;
      if (data.claimStatus === "SETTLED") {
        stamp.settledAt = now;
        const settled = data.settledAmount ?? (existing.settledAmount === null ? null : Number(existing.settledAmount));
        if (settled === null || settled === undefined) return reply.status(400).send({ error: "Enter the amount settled." });
      }
    }
    if (data.documents) {
      const was = Array.isArray(existing.documents) ? (existing.documents as { done: boolean }[]).filter((d) => d.done).length : 0;
      const nowDone = data.documents.filter((d) => d.done).length;
      if (nowDone !== was) events.push(`Documents: ${nowDone} of ${data.documents.length} ready`);
    }
    if (note) events.push(note);

    const byName = await staffName(auth.clinicUserId);
    const claim = await prisma.claim.update({
      where: { id },
      data: {
        ...data,
        ...stamp,
        ...(preauthValidTill !== undefined ? { preauthValidTill: preauthValidTill ? new Date(`${preauthValidTill.slice(0, 10)}T23:59:00+05:30`) : null } : {}),
        ...(events.length ? { events: { create: events.map((what) => ({ byName, what })) } } : {}),
      },
      include: { events: { orderBy: { at: "desc" } } },
    });
    return claim;
  });

  /** Money owed by payers, oldest first: what the desk chases. */
  app.get("/api/clinic/claims-summary", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const payers = ["INSURANCE", "SCHEME"].filter(deskOn);
    const open = await prisma.claim.findMany({
      where: { payer: { in: payers as never }, claimStatus: { notIn: ["SETTLED", "REJECTED"] } },
      select: { payer: true, payerName: true, claimStatus: true, preauthStatus: true, claimAmount: true, approvedAmount: true, preauthAmount: true, claimSubmittedAt: true },
    });
    const now = Date.now();
    const buckets = { under30: 0, d30to60: 0, d60to90: 0, over90: 0 };
    let pendingPreauth = 0;
    let queries = 0;
    let owed = 0;
    for (const c of open) {
      if (c.preauthStatus === "SUBMITTED" || c.preauthStatus === "ENHANCEMENT") pendingPreauth += 1;
      if (c.preauthStatus === "QUERY" || c.claimStatus === "QUERY") queries += 1;
      if (c.claimSubmittedAt) {
        const amount = Number(c.approvedAmount ?? c.claimAmount ?? 0);
        owed += amount;
        const age = (now - c.claimSubmittedAt.getTime()) / 86_400_000;
        if (age < 30) buckets.under30 += amount; else if (age < 60) buckets.d30to60 += amount; else if (age < 90) buckets.d60to90 += amount; else buckets.over90 += amount;
      }
    }
    return { open: open.length, pendingPreauth, queries, owed, buckets };
  });

  // ── The scheme package rate list ────────────────────────────────────
  // The hospital's own copy, loaded from the scheme's current list. Ships
  // empty: a rate copied from an old circular is a wrong claim.

  app.get("/api/clinic/scheme-packages", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    if (!isFeatureEnabled("schemes")) return reply.status(404).send({ error: "Not found" });
    const { scheme, q } = request.query as { scheme?: string; q?: string };
    const data = await prisma.schemePackage.findMany({
      where: {
        isActive: true,
        ...(scheme ? { scheme } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ scheme: "asc" }, { code: "asc" }],
      take: 200,
    });
    return { data };
  });

  app.post("/api/clinic/scheme-packages", async (request, reply) => {
    const auth = requireRoles(request, reply, CLAIM_ROLES, "Only billing staff can edit the package list.");
    if (!auth) return;
    if (!isFeatureEnabled("schemes")) return reply.status(404).send({ error: "Not found" });
    const parsed = z.object({
      scheme: z.enum(SCHEMES),
      code: z.string().trim().min(1).max(40),
      name: z.string().trim().min(2).max(200),
      rate: z.coerce.number().min(0).max(100_000_000),
      documents: z.array(z.string().max(200)).max(30).optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const pkg = await prisma.schemePackage.upsert({
      where: { scheme_code: { scheme: parsed.data.scheme, code: parsed.data.code } },
      update: { name: parsed.data.name, rate: parsed.data.rate, documents: parsed.data.documents ?? undefined, isActive: true },
      create: { ...parsed.data, documents: parsed.data.documents ?? [] },
    });
    return reply.status(201).send(pkg);
  });
}
