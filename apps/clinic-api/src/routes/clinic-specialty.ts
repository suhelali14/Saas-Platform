import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { Prisma } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth, requireClinicAuth, requireRoles } from "../plugins/auth.js";
import { LIBRARY } from "../lib/specialty-library.js";
import {
  cleanData, cleanOwnFields, compute, describe, gestationalAge,
  type FormDef, type FormField,
} from "../lib/specialty-forms.js";

/**
 * Specialty records: the form library, a patient's family links, care
 * episodes (a pregnancy, an infertility treatment) and filled-in forms.
 * The engine is lib/specialty-forms.ts; the forms are
 * lib/specialty-library.ts plus whatever the clinic adds.
 *
 * In every plan. These are clinical records, and the pricing rule is that
 * clinical records are never sold separately.
 */

export type LiveForm = FormDef & { isActive: boolean; builtIn: boolean };

/** The forms as this clinic has them: built-ins with its changes, then its own. */
export async function formLibrary(): Promise<LiveForm[]> {
  const rows = await prisma.clinicForm.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const out: LiveForm[] = LIBRARY.map((f) => {
    const r = byKey.get(f.key);
    const extra = (r?.extraFields as FormField[] | null) ?? [];
    return {
      ...f,
      sections: extra.length ? [...f.sections, { title: "Your clinic's fields", fields: extra }] : f.sections,
      isActive: r ? r.isActive : true,
      builtIn: true,
    };
  });
  for (const r of rows) {
    if (!r.custom || !r.definition) continue;
    out.push({ ...(r.definition as unknown as FormDef), key: r.key, custom: true, isActive: r.isActive, builtIn: false });
  }
  return out;
}

// Money-only roles have no business in a pregnancy record; everyone who
// treats or dispenses does (a pharmacist needs to know a patient is
// pregnant before handing over a teratogen).
const NO_READ = new Set(["CASHIER", "BILLING_CLERK"]);
const RECORD_ROLES = new Set(["DOCTOR", "NURSE"]);
const RELATION_ROLES = new Set(["DOCTOR", "NURSE", "RECEPTIONIST"]);
const DOCTOR = new Set(["DOCTOR"]);

function requireReader(request: FastifyRequest, reply: FastifyReply) {
  const auth = requireClinicAuth(request, reply);
  if (!auth) return null;
  if (NO_READ.has(auth.role) && !auth.isAdmin) {
    reply.status(403).send({ error: "Specialty records are for clinical staff." });
    return null;
  }
  return auth;
}

/** Today in India, as YYYY-MM-DD. */
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const atNoonIst = (day: string) => new Date(`${day}T12:00:00+05:30`);
const dayOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

async function staff(id: string) {
  return prisma.clinicUser.findUnique({ where: { id }, select: { name: true, specialization: true } });
}

/** The day a pregnancy began, for its episode's start: from the scan's EDD if given, else the LMP. */
function pregnancyStart(data: Record<string, unknown>): string | null {
  if (typeof data.usg_edd === "string" && DAY_RE.test(data.usg_edd)) {
    return new Date(new Date(`${data.usg_edd}T00:00:00Z`).getTime() - 280 * 86_400_000).toISOString().slice(0, 10);
  }
  return typeof data.lmp === "string" && DAY_RE.test(data.lmp) ? data.lmp : null;
}

function present(r: { recordedOn: Date; data: unknown; formKey: string }, forms: Map<string, LiveForm>) {
  const def = forms.get(r.formKey);
  return { ...r, recordedOn: dayOf(r.recordedOn), summary: def ? describe(def, r.data as Record<string, unknown>) : "" };
}

/** Specialty records for the day-by-day history, each with its one-line summary. */
export async function recordsForHistory(patientId: string) {
  const [forms, rows] = await Promise.all([
    formLibrary(),
    prisma.specialtyRecord.findMany({ where: { patientId }, orderBy: { recordedOn: "desc" }, take: 300 }),
  ]);
  const byKey = new Map(forms.map((f) => [f.key, f]));
  return rows.map((r) => ({ ...present(r, byKey), title: byKey.get(r.formKey)?.title ?? r.formKey }));
}

const relationSchema = z.object({
  kind: z.enum(["SPOUSE", "PARTNER", "FATHER", "MOTHER", "CHILD", "SIBLING", "GUARDIAN", "OTHER"]),
  relatedPatientId: z.string().min(1).nullable().optional(),
  name: z.string().trim().max(120).optional(),
  age: z.coerce.number().int().min(0).max(120).nullable().optional(),
  gender: z.string().max(20).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  bloodGroup: z.string().max(10).nullable().optional(),
  occupation: z.string().max(120).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/** Keeps a clinic's earlier fields as retired when they are left out, so records made with them still read. */
function keepRetired(next: FormField[], previous: FormField[] | null | undefined): FormField[] {
  const have = new Set(next.map((f) => f.key));
  return [...next, ...(previous ?? []).filter((f) => !have.has(f.key)).map((f) => ({ ...f, retired: true }))];
}

export async function clinicSpecialtyRoutes(app: FastifyInstance) {
  // ── The library ─────────────────────────────────────────────────────

  app.get("/api/clinic/specialty/forms", async (request, reply) => {
    const auth = requireReader(request, reply);
    if (!auth) return;
    return { forms: await formLibrary() };
  });

  /** Switch a form on or off, give a built-in form extra fields, or edit the clinic's own. */
  app.put("/api/clinic/specialty/forms/:key", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const { key } = request.params as { key: string };
    const body = (request.body ?? {}) as { isActive?: unknown; extraFields?: unknown; fields?: unknown; title?: unknown; specialty?: unknown };
    const builtIn = LIBRARY.find((f) => f.key === key);
    const row = await prisma.clinicForm.findUnique({ where: { key } });
    if (!builtIn && !row?.custom) return reply.status(404).send({ error: "No such form." });
    const isActive = typeof body.isActive === "boolean" ? body.isActive : row?.isActive ?? true;

    if (builtIn) {
      let extraFields = (row?.extraFields as FormField[] | null) ?? null;
      if (body.extraFields !== undefined) {
        const { fields, errors } = cleanOwnFields(body.extraFields, builtIn);
        if (errors.length) return reply.status(400).send({ error: errors[0], errors });
        extraFields = keepRetired(fields, extraFields);
      }
      await prisma.clinicForm.upsert({
        where: { key },
        create: { key, isActive, extraFields: (extraFields ?? undefined) as never },
        update: { isActive, extraFields: (extraFields ?? undefined) as never },
      });
      return { forms: await formLibrary() };
    }

    const def = row!.definition as unknown as FormDef;
    let next = def;
    if (body.fields !== undefined || body.title !== undefined || body.specialty !== undefined) {
      const { fields, errors } = body.fields !== undefined ? cleanOwnFields(body.fields, def) : { fields: def.sections[0]?.fields ?? [], errors: [] };
      if (errors.length) return reply.status(400).send({ error: errors[0], errors });
      if (!fields.filter((f) => !f.retired).length) return reply.status(400).send({ error: "A form needs at least one field." });
      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : def.title;
      const specialty = typeof body.specialty === "string" && body.specialty.trim() ? body.specialty.trim().slice(0, 60) : def.specialty;
      const all = keepRetired(fields, def.sections[0]?.fields);
      next = { ...def, title, specialty, version: def.version + 1, sections: [{ title, fields: all }], summary: all.filter((f) => !f.retired).slice(0, 6).map((f) => f.key) };
    }
    await prisma.clinicForm.update({ where: { key }, data: { isActive, definition: next as never } });
    return { forms: await formLibrary() };
  });

  /** A form of the clinic's own, built from the same field types. */
  app.post("/api/clinic/specialty/forms", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const parsed = z.object({
      title: z.string().trim().min(2).max(80),
      specialty: z.string().trim().min(2).max(60),
      kind: z.enum(["history", "visit"]),
      fields: z.array(z.unknown()).min(1).max(40),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Give the form a name, a speciality, and at least one field." });
    const { fields, errors } = cleanOwnFields(parsed.data.fields, { key: "custom", tags: [parsed.data.specialty.toLowerCase()] });
    if (errors.length) return reply.status(400).send({ error: errors[0], errors });
    const base = `custom_${parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "form"}`;
    let key = base;
    for (let n = 2; await prisma.clinicForm.findUnique({ where: { key } }); n++) key = `${base}_${n}`;
    const def: FormDef = {
      key, version: 1, title: parsed.data.title, specialty: parsed.data.specialty, kind: parsed.data.kind,
      tags: parsed.data.specialty.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3),
      sections: [{ title: parsed.data.title, fields }], summary: fields.slice(0, 6).map((f) => f.key), custom: true,
    };
    await prisma.clinicForm.create({ data: { key, custom: true, isActive: true, definition: def as never } });
    return reply.status(201).send({ key, forms: await formLibrary() });
  });

  // ── One patient's specialty records ─────────────────────────────────

  app.get("/api/clinic/patients/:id/specialty", async (request, reply) => {
    const auth = requireReader(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const { appointmentId } = request.query as { appointmentId?: string };
    const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true, name: true, age: true, gender: true, category: true, chronicConditions: true, dob: true } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    const forms = await formLibrary();
    const byKey = new Map(forms.map((f) => [f.key, f]));
    const episodeInclude = {
      partner: { include: { relatedPatient: { select: { id: true, name: true, uhid: true } } } },
      patient: { select: { id: true, name: true, uhid: true } },
      records: { orderBy: { recordedOn: "asc" as const } },
    };
    const [relations, linkedFrom, own, viaPartner, history, visits] = await Promise.all([
      prisma.patientRelation.findMany({ where: { patientId: id }, include: { relatedPatient: { select: { id: true, name: true, uhid: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.patientRelation.findMany({ where: { relatedPatientId: id }, include: { patient: { select: { id: true, name: true, uhid: true } } } }),
      prisma.careEpisode.findMany({ where: { patientId: id }, include: episodeInclude, orderBy: { startedOn: "desc" } }),
      // A couple's episode lives on one partner's record and shows on both.
      prisma.careEpisode.findMany({ where: { partner: { relatedPatientId: id } }, include: episodeInclude, orderBy: { startedOn: "desc" } }),
      prisma.specialtyRecord.findMany({ where: { patientId: id, scope: "HISTORY" }, orderBy: { updatedAt: "desc" } }),
      prisma.specialtyRecord.findMany({ where: { patientId: id, scope: "VISIT", episodeId: null }, orderBy: { recordedOn: "desc" }, take: 150 }),
    ]);

    const today = todayIst();
    const episodes = [...own.map((e) => ({ e, viaPartner: false })), ...viaPartner.map((e) => ({ e, viaPartner: true }))].map(({ e, viaPartner: via }) => {
      const def = byKey.get(e.formKey);
      const data = e.data as Record<string, unknown>;
      return {
        ...e,
        startedOn: dayOf(e.startedOn),
        closedOn: e.closedOn ? dayOf(e.closedOn) : null,
        viaPartner: via,
        title: def?.title ?? e.formKey,
        summary: def ? describe(def, data) : "",
        gaToday: e.formKey === "pregnancy" && e.status === "ACTIVE" ? gestationalAge(today, data)?.text ?? null : null,
        records: e.records.map((r) => present(r, byKey)),
      };
    });

    // What to offer first: forms for the doctor's speciality or the
    // visit's department, and forms the patient's own record calls for.
    let words = "";
    if (appointmentId) {
      const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { doctor: { select: { specialization: true } }, department: { select: { name: true } } } });
      words = `${appt?.doctor?.specialization ?? ""} ${appt?.department?.name ?? ""}`;
    }
    if (!words.trim() && auth.role === "DOCTOR") words = (await staff(auth.clinicUserId))?.specialization ?? "";
    words = words.toLowerCase();
    const conditions = (patient.chronicConditions ?? "").toLowerCase();
    const gender = (patient.gender ?? "").toLowerCase();
    const openKinds = new Set(episodes.filter((x) => x.status === "ACTIVE" && !x.viaPartner).map((x) => x.formKey));
    const fits = (f: LiveForm) => {
      const s = f.suggest;
      if (s?.gender && gender && !gender.startsWith(s.gender.toLowerCase())) return false;
      if (patient.age != null && ((s?.minAge !== undefined && patient.age < s.minAge) || (s?.maxAge !== undefined && patient.age > s.maxAge))) return false;
      return true;
    };
    const suggested = forms
      .filter((f) => f.isActive && !f.episodeKey && !openKinds.has(f.key) && fits(f) && !(f.suggest?.unlessOpen?.some((k) => openKinds.has(k)) ?? false))
      .filter((f) =>
        (words && f.tags.some((t) => words.includes(t))) ||
        (f.suggest?.category && f.suggest.category === patient.category) ||
        (f.suggest?.conditions?.some((c) => conditions.includes(c)) ?? false))
      .map((f) => f.key);

    const pregnancy = episodes.find((x) => x.formKey === "pregnancy" && x.status === "ACTIVE" && !x.viaPartner);
    const pd = pregnancy?.data as Record<string, unknown> | undefined;
    return {
      forms,
      relations,
      linkedFrom,
      episodes,
      history: history.map((r) => present(r, byKey)),
      visits: visits.map((r) => present(r, byKey)),
      suggested,
      pregnancy: pregnancy ? { episodeId: pregnancy.id, ga: pregnancy.gaToday, edd: (pd?.usg_edd as string | undefined) ?? (pd?.edd as string | undefined) ?? null } : null,
    };
  });

  // ── Family and partner ──────────────────────────────────────────────

  async function relationData(patientId: string, body: z.infer<typeof relationSchema>) {
    if (body.relatedPatientId) {
      if (body.relatedPatientId === patientId) return { error: "A patient cannot be linked to themselves." };
      const p = await prisma.patient.findUnique({ where: { id: body.relatedPatientId }, select: { id: true, name: true, age: true, gender: true, phone: true, bloodGroup: true } });
      if (!p) return { error: "That patient was not found." };
      // The link carries a copy of their particulars so the record reads
      // on its own; the patient's own file stays the one to keep current.
      return { data: { relatedPatientId: p.id, name: p.name, age: p.age, gender: p.gender, phone: p.phone, bloodGroup: p.bloodGroup, occupation: body.occupation ?? null, notes: body.notes ?? null } };
    }
    if (!body.name?.trim()) return { error: "Give their name, or choose them from the patient list." };
    return { data: { relatedPatientId: null, name: body.name.trim(), age: body.age ?? null, gender: body.gender ?? null, phone: body.phone ?? null, bloodGroup: body.bloodGroup ?? null, occupation: body.occupation ?? null, notes: body.notes ?? null } };
  }

  app.post("/api/clinic/patients/:id/relations", async (request, reply) => {
    const auth = requireRoles(request, reply, RELATION_ROLES, "Only clinical and front-desk staff can add family details.", { allowAdmin: true });
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = relationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Say how they are related, and who they are." });
    if (!(await prisma.patient.findUnique({ where: { id }, select: { id: true } }))) return reply.status(404).send({ error: "Patient not found" });
    const r = await relationData(id, parsed.data);
    if ("error" in r) return reply.status(400).send({ error: r.error });
    const relation = await prisma.patientRelation.create({ data: { patientId: id, kind: parsed.data.kind, ...r.data } });
    return reply.status(201).send(relation);
  });

  app.put("/api/clinic/relations/:id", async (request, reply) => {
    const auth = requireRoles(request, reply, RELATION_ROLES, "Only clinical and front-desk staff can change family details.", { allowAdmin: true });
    if (!auth) return;
    const { id } = request.params as { id: string };
    const existing = await prisma.patientRelation.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    const parsed = relationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Say how they are related, and who they are." });
    const r = await relationData(existing.patientId, parsed.data);
    if ("error" in r) return reply.status(400).send({ error: r.error });
    return prisma.patientRelation.update({ where: { id }, data: { kind: parsed.data.kind, ...r.data } });
  });

  app.delete("/api/clinic/relations/:id", async (request, reply) => {
    const auth = requireRoles(request, reply, RELATION_ROLES, "Only clinical and front-desk staff can remove family details.", { allowAdmin: true });
    if (!auth) return;
    const { id } = request.params as { id: string };
    const { count } = await prisma.patientRelation.deleteMany({ where: { id } });
    if (!count) return reply.status(404).send({ error: "Not found" });
    return { ok: true };
  });

  // ── Episodes ────────────────────────────────────────────────────────

  app.post("/api/clinic/patients/:id/episodes", async (request, reply) => {
    const auth = requireRoles(request, reply, DOCTOR, "Only a doctor can open a pregnancy or treatment record.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { formKey?: string; data?: unknown; partnerId?: string | null };
    const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true, age: true, dob: true } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });
    const def = (await formLibrary()).find((f) => f.key === body.formKey && f.kind === "episode");
    if (!def || !def.isActive) return reply.status(400).send({ error: "Choose a pregnancy or treatment form that is switched on." });
    const open = await prisma.careEpisode.findFirst({ where: { patientId: id, formKey: def.key, status: "ACTIVE" } });
    if (open) return reply.status(409).send({ error: `There is already an open ${def.title.toLowerCase()} record for this patient.`, episodeId: open.id });
    const { data, errors } = cleanData(def.sections, body.data);
    if (errors.length) return reply.status(400).send({ error: errors[0], errors });
    if (def.key === "pregnancy" && !pregnancyStart(data)) return reply.status(400).send({ error: "Give the LMP, or the EDD from a dating scan, so the weeks can be counted." });
    if (body.partnerId) {
      const partner = await prisma.patientRelation.findFirst({ where: { id: body.partnerId, patientId: id } });
      if (!partner) return reply.status(400).send({ error: "That partner is not linked to this patient." });
    }
    const today = todayIst();
    const startedOn = (def.key === "pregnancy" ? pregnancyStart(data) : null) ?? today;
    const me = await staff(auth.clinicUserId);
    const episode = await prisma.careEpisode.create({
      data: {
        patientId: id, formKey: def.key, formVersion: def.version, startedOn: atNoonIst(startedOn), partnerId: body.partnerId || null,
        data: compute(def.sections, data, { recordedOn: today, patient }) as never,
        createdById: auth.clinicUserId, createdByName: me?.name ?? "Doctor",
      },
    });
    return reply.status(201).send(episode);
  });

  app.put("/api/clinic/episodes/:id", async (request, reply) => {
    const auth = requireRoles(request, reply, DOCTOR, "Only a doctor can change a pregnancy or treatment record.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { data?: unknown; partnerId?: string | null };
    const ep = await prisma.careEpisode.findUnique({ where: { id }, include: { patient: { select: { age: true, dob: true } } } });
    if (!ep) return reply.status(404).send({ error: "Not found" });
    const def = (await formLibrary()).find((f) => f.key === ep.formKey);
    if (!def) return reply.status(409).send({ error: "This record's form no longer exists." });
    let data = ep.data as Record<string, unknown>;
    if (body.data !== undefined) {
      const c = cleanData(def.sections, body.data);
      if (c.errors.length) return reply.status(400).send({ error: c.errors[0], errors: c.errors });
      if (def.key === "pregnancy" && !pregnancyStart(c.data)) return reply.status(400).send({ error: "Give the LMP, or the EDD from a dating scan." });
      data = compute(def.sections, c.data, { recordedOn: todayIst(), patient: ep.patient });
    }
    if (body.partnerId) {
      const partner = await prisma.patientRelation.findFirst({ where: { id: body.partnerId, patientId: ep.patientId } });
      if (!partner) return reply.status(400).send({ error: "That partner is not linked to this patient." });
    }
    const start = def.key === "pregnancy" ? pregnancyStart(data) : null;
    return prisma.careEpisode.update({
      where: { id },
      data: { data: data as never, formVersion: def.version, ...(body.partnerId !== undefined ? { partnerId: body.partnerId || null } : {}), ...(start ? { startedOn: atNoonIst(start) } : {}) },
    });
  });

  app.post("/api/clinic/episodes/:id/close", async (request, reply) => {
    const auth = requireRoles(request, reply, DOCTOR, "Only a doctor can close a pregnancy or treatment record.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const ep = await prisma.careEpisode.findUnique({ where: { id } });
    if (!ep) return reply.status(404).send({ error: "Not found" });
    if (ep.status === "CLOSED") return reply.status(409).send({ error: "This record is already closed." });
    const def = (await formLibrary()).find((f) => f.key === ep.formKey);
    const { data, errors } = cleanData(def?.closeSections ?? [], (request.body as { outcome?: unknown } | null)?.outcome ?? {});
    if (errors.length) return reply.status(400).send({ error: errors[0], errors });
    if (!data.outcome) return reply.status(400).send({ error: "Say how it ended." });
    const ended = typeof data.ended_on === "string" ? data.ended_on : todayIst();
    // Conditional, so two closes at once cannot both write an outcome.
    const { count } = await prisma.careEpisode.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "CLOSED", closedOn: atNoonIst(ended), outcome: data as never } });
    if (!count) return reply.status(409).send({ error: "This record is already closed." });
    return prisma.careEpisode.findUnique({ where: { id } });
  });

  app.post("/api/clinic/episodes/:id/reopen", async (request, reply) => {
    const auth = requireRoles(request, reply, DOCTOR, "Only a doctor can reopen a record.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const ep = await prisma.careEpisode.findUnique({ where: { id } });
    if (!ep) return reply.status(404).send({ error: "Not found" });
    const open = await prisma.careEpisode.findFirst({ where: { patientId: ep.patientId, formKey: ep.formKey, status: "ACTIVE", id: { not: id } } });
    if (open) return reply.status(409).send({ error: "Another record of this kind is open for the patient." });
    return prisma.careEpisode.update({ where: { id }, data: { status: "ACTIVE", closedOn: null, outcome: Prisma.DbNull } });
  });

  // ── Filled-in forms ─────────────────────────────────────────────────

  app.post("/api/clinic/patients/:id/records", async (request, reply) => {
    const auth = requireRoles(request, reply, RECORD_ROLES, "Only doctors and nurses can record specialty forms.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { formKey?: string; episodeId?: string | null; appointmentId?: string | null; recordedOn?: string; data?: unknown };
    const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true, age: true, dob: true } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });
    const def = (await formLibrary()).find((f) => f.key === body.formKey && f.kind !== "episode");
    if (!def) return reply.status(400).send({ error: "Choose a form." });
    if (!def.isActive) return reply.status(400).send({ error: `${def.title} is switched off for this clinic.` });

    let episode: { id: string; data: unknown } | null = null;
    if (def.episodeKey) {
      if (!body.episodeId) return reply.status(400).send({ error: `${def.title} is recorded within an open ${def.episodeKey} record.` });
      // The patient's own episode, or their partner's where they are the
      // linked partner -- a husband's semen analysis on the couple's record.
      const ep = await prisma.careEpisode.findFirst({
        where: { id: body.episodeId, formKey: def.episodeKey, OR: [{ patientId: id }, { partner: { relatedPatientId: id } }] },
      });
      if (!ep) return reply.status(400).send({ error: "That record is not this patient's." });
      if (ep.status !== "ACTIVE") return reply.status(409).send({ error: "That record is closed. Reopen it to add a visit." });
      episode = ep;
    }
    if (body.appointmentId) {
      const appt = await prisma.appointment.findFirst({ where: { id: body.appointmentId, patientId: id }, select: { id: true } });
      if (!appt) return reply.status(400).send({ error: "That visit is not this patient's." });
    }
    const recordedOn = body.recordedOn && DAY_RE.test(body.recordedOn) ? body.recordedOn : todayIst();
    if (recordedOn > todayIst()) return reply.status(400).send({ error: "A visit cannot be recorded for a day that has not happened." });
    const { data, errors } = cleanData(def.sections, body.data);
    if (errors.length) return reply.status(400).send({ error: errors[0], errors });
    if (!Object.keys(data).length) return reply.status(400).send({ error: "Nothing has been filled in." });
    const filled = compute(def.sections, data, { recordedOn, episode: episode?.data as Record<string, unknown> | undefined, patient });
    const me = await staff(auth.clinicUserId);

    // A history is one per patient: saving it again brings it up to date.
    if (def.kind === "history") {
      const existing = await prisma.specialtyRecord.findFirst({ where: { patientId: id, formKey: def.key, scope: "HISTORY" } });
      if (existing) {
        const updated = await prisma.specialtyRecord.update({
          where: { id: existing.id },
          data: { data: filled as never, formVersion: def.version, recordedOn: atNoonIst(recordedOn), recordedById: auth.clinicUserId, recordedByName: me?.name ?? "Staff" },
        });
        return reply.status(200).send(updated);
      }
    }
    const record = await prisma.specialtyRecord.create({
      data: {
        patientId: id, formKey: def.key, formVersion: def.version, scope: def.kind === "history" ? "HISTORY" : "VISIT",
        episodeId: episode?.id ?? null, appointmentId: body.appointmentId || null, recordedOn: atNoonIst(recordedOn),
        data: filled as never, recordedById: auth.clinicUserId, recordedByName: me?.name ?? "Staff",
      },
    });
    return reply.status(201).send(record);
  });

  app.put("/api/clinic/records/:id", async (request, reply) => {
    const auth = requireRoles(request, reply, RECORD_ROLES, "Only doctors and nurses can change specialty forms.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { data?: unknown; recordedOn?: string };
    const rec = await prisma.specialtyRecord.findUnique({ where: { id }, include: { episode: true, patient: { select: { age: true, dob: true } } } });
    if (!rec) return reply.status(404).send({ error: "Not found" });
    const def = (await formLibrary()).find((f) => f.key === rec.formKey);
    if (!def) return reply.status(409).send({ error: "This record's form no longer exists." });
    const recordedOn = body.recordedOn && DAY_RE.test(body.recordedOn) && body.recordedOn <= todayIst() ? body.recordedOn : dayOf(rec.recordedOn);
    const { data, errors } = cleanData(def.sections, body.data);
    if (errors.length) return reply.status(400).send({ error: errors[0], errors });
    const filled = compute(def.sections, data, { recordedOn, episode: rec.episode?.data as Record<string, unknown> | undefined, patient: rec.patient });
    const me = await staff(auth.clinicUserId);
    return prisma.specialtyRecord.update({
      where: { id },
      data: { data: filled as never, formVersion: def.version, recordedOn: atNoonIst(recordedOn), recordedById: auth.clinicUserId, recordedByName: me?.name ?? "Staff" },
    });
  });

  /**
   * Removing a record is for a mistake caught the same day -- the wrong
   * patient, a form opened by accident. After that it is part of the
   * record and is corrected, not erased; the audit log keeps both.
   */
  app.delete("/api/clinic/records/:id", async (request, reply) => {
    const auth = requireRoles(request, reply, DOCTOR, "Only a doctor can remove a specialty record.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const rec = await prisma.specialtyRecord.findUnique({ where: { id } });
    if (!rec) return reply.status(404).send({ error: "Not found" });
    if (Date.now() - rec.createdAt.getTime() > 24 * 3_600_000) {
      return reply.status(409).send({ error: "Records older than a day are corrected, not removed." });
    }
    await prisma.specialtyRecord.delete({ where: { id } });
    return { ok: true };
  });
}

