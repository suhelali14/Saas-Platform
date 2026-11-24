import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { DrugFrequency, Prisma } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireClinicalWriteAuth } from "../plugins/auth.js";
import { env } from "../config/env.js";
import { isFeatureEnabled } from "../config/features.js";
import { buildDraft, carryOver } from "../lib/scribe/engine.js";
import type { Draft } from "../lib/scribe/checks.js";
import { clinicHost, doctorHabits } from "../lib/scribe/clinic-host.js";
import { createReader, modelAvailable } from "../lib/scribe/model.js";
import { speechAvailable, transcribe, SpeechUnavailable } from "../lib/scribe/stt.js";

/**
 * The clinic assistant.
 *
 * A session is one consultation as the assistant heard it. It is opened
 * on a visit, fed audio in short pieces or text, turned into a draft, and
 * ends when the doctor confirms that draft or throws it away.
 *
 * ── Who ──────────────────────────────────────────────────────────────
 *
 * Doctors only, and only the doctor who opened the session. What comes
 * out of this is a case sheet and a prescription, so it carries the same
 * gate those do; and a recording of a consultation is nobody else's to
 * read back.
 *
 * ── What is never done here ──────────────────────────────────────────
 *
 * Nothing is written to a patient's record until /confirm, and /confirm
 * is only ever a doctor pressing a button with the draft in front of
 * them. The engine proposes. It does not prescribe.
 */

/** A piece of audio is under thirty seconds; this is generous for one. */
const MAX_PIECE_BYTES = 2 * 1024 * 1024;
const AUDIO_TYPES = /^audio\/(webm|ogg|mp4|wav|mpeg|x-m4a|aac)/;
/** The longest transcript a session may hold. An hour of fast speech is
 *  well under this; past it something is feeding the session in a loop. */
const MAX_TRANSCRIPT_CHARS = 60_000;

const vitals = z.object({
  bp: z.string().max(20).optional(),
  temp: z.string().max(20).optional(),
  spo2: z.string().max(10).optional(),
  weight: z.string().max(20).optional(),
  pulse: z.string().max(20).optional(),
});

/** The confirmed note: the same limits the case-sheet, prescription and
 *  lab-order routes set, because it is written to the same tables. */
const confirmSchema = z.object({
  chiefComplaint: z.string().max(1000).optional(),
  hopi: z.string().max(2000).optional(),
  diagnosis: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  vitals: vitals.optional(),
  followUpDate: z.string().datetime().optional(),
  remindDoctor: z.boolean().optional(),
  medicines: z
    .array(
      z.object({
        drugId: z.string().optional(),
        drugName: z.string().min(1).max(200),
        dosage: z.string().min(1).max(50),
        frequency: z.nativeEnum(DrugFrequency),
        duration: z.string().min(1).max(50),
        instructions: z.string().max(200).optional(),
      }),
    )
    .max(30)
    .default([]),
  labTests: z.array(z.string().min(1).max(200)).max(30).default([]),
});

export async function clinicScribeRoutes(app: FastifyInstance) {
  /** The caller's own open session, or a refusal already sent. */
  async function ownSession(id: string, doctorId: string, reply: FastifyReply) {
    const session = await prisma.scribeSession.findUnique({ where: { id } });
    if (!session || session.doctorId !== doctorId) {
      reply.status(404).send({ error: "Not found" });
      return null;
    }
    if (session.status === "CONFIRMED" || session.status === "DISCARDED") {
      reply.status(409).send({ error: "This note has already been finished." });
      return null;
    }
    return session;
  }

  /** What this deployment can do, so the screen offers only that. */
  app.get("/api/clinic/scribe/status", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    return {
      canListen: speechAvailable(),
      canSummarise: modelAvailable(),
      maxMinutes: env.SCRIBE_MAX_MINUTES,
    };
  });

  /**
   * Opens a session on a visit, or returns the one already open.
   *
   * One open session per visit and doctor: a page reloaded mid
   * consultation comes back to the transcript it had, rather than to an
   * empty one with the first half of the conversation orphaned.
   */
  app.post("/api/clinic/scribe/sessions", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const body = z.object({ appointmentId: z.string().min(1), consent: z.boolean().optional() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const appointment = await prisma.appointment.findUnique({ where: { id: body.data.appointmentId }, select: { id: true, patientId: true } });
    if (!appointment) return reply.status(404).send({ error: "Visit not found" });
    request.auditPatientId = appointment.patientId;

    const open = await prisma.scribeSession.findFirst({
      where: { appointmentId: appointment.id, doctorId: auth.clinicUserId, status: { in: ["OPEN", "DRAFTED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (open) {
      const session = body.data.consent && !open.consentAt
        ? await prisma.scribeSession.update({ where: { id: open.id }, data: { consentAt: new Date() } })
        : open;
      return session;
    }

    const session = await prisma.scribeSession.create({
      data: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: auth.clinicUserId,
        consentAt: body.data.consent ? new Date() : null,
      },
    });
    return reply.status(201).send(session);
  });

  /**
   * One piece of the consultation, as audio.
   *
   * Transcribed and discarded: the buffer is not written anywhere. Refused
   * without recorded consent -- the tick on the screen is what makes this
   * a recording the patient agreed to, so it is checked here and not only
   * in the browser.
   */
  app.post("/api/clinic/scribe/sessions/:id/audio", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const session = await ownSession(id, auth.clinicUserId, reply);
    if (!session) return;
    request.auditPatientId = session.patientId;

    if (!session.consentAt) {
      return reply.status(403).send({ error: "The patient's consent to being recorded has not been ticked for this visit." });
    }
    if (session.audioSeconds >= env.SCRIBE_MAX_MINUTES * 60) {
      return reply.status(409).send({ error: `Listening stops after ${env.SCRIBE_MAX_MINUTES} minutes for one visit. Make the note from what has been heard.`, limit: true });
    }

    const file = await request.file();
    if (!file) return reply.status(400).send({ error: "No audio was sent." });
    if (!AUDIO_TYPES.test(file.mimetype)) return reply.status(400).send({ error: "That is not an audio recording." });
    const audio = await file.toBuffer();
    if (audio.length === 0) return reply.status(400).send({ error: "That recording was empty." });
    if (audio.length > MAX_PIECE_BYTES) return reply.status(413).send({ error: "That piece of audio is too long." });

    // Sent by the browser, which timed the piece. Capped at the
    // provider's own limit so a wrong value cannot run the meter.
    const seconds = Math.min(30, Math.max(1, Math.round(Number((file.fields.seconds as { value?: string } | undefined)?.value ?? 25))));

    let text: string;
    const habits = await doctorHabits(auth.clinicUserId);
    try {
      text = await transcribe(audio, file.mimetype, habits.map((h) => h.drugName));
    } catch (error) {
      if (error instanceof SpeechUnavailable) return reply.status(error.status).send({ error: error.message, retry: error.status === 429 || error.status === 503 });
      throw error;
    }

    // Appended in the database, not read-modify-written: pieces are sent
    // one after another, but a retry can overlap the next piece.
    const updated = await prisma.$queryRaw<{ transcript: string }[]>`
      UPDATE "ScribeSession"
      SET transcript = left(CASE WHEN transcript = '' THEN ${text}::text ELSE transcript || E'\n' || ${text}::text END, ${MAX_TRANSCRIPT_CHARS}::int),
          "audioSeconds" = "audioSeconds" + ${seconds}::int,
          "updatedAt" = now()
      WHERE id = ${id}
      RETURNING transcript
    `;
    const transcript = updated[0]?.transcript ?? "";

    /*
     * The note so far, sent back with every piece.
     *
     * This is what lets the screen fill in while the doctor is still
     * talking, the way a person taking notes writes as they listen. Each
     * piece is read by rule, which is free and takes milliseconds; every
     * SCRIBE_LIVE_SECONDS of new speech the language model reads it too,
     * so the complaint and history appear mid-consultation rather than
     * all at once at the end.
     *
     * A failure here never fails the piece: the audio was heard and its
     * words are saved, and the note is rebuilt on the next one.
     */
    let live: Draft | null = null;
    try {
      const patient = await prisma.patient.findUnique({
        where: { id: session.patientId },
        select: { name: true, phone: true, age: true, gender: true, allergies: true, chronicConditions: true },
      });
      if (patient && transcript.trim().length >= 10) {
        const previous = (session.draft as unknown as (Draft & { modelAtSeconds?: number }) | null) ?? null;
        const heardSeconds = session.audioSeconds + seconds;
        const sinceModel = heardSeconds - (previous?.modelAtSeconds ?? 0);
        const useModel = env.SCRIBE_LIVE_SECONDS > 0 && sinceModel >= env.SCRIBE_LIVE_SECONDS;
        const { draft, usage } = await buildDraft({
          transcript,
          patient,
          host: clinicHost(auth.clinicUserId, habits),
          reader: useModel ? createReader() : null,
          quiet: true,
        });
        live = carryOver(previous, draft, { transcript, allergies: patient.allergies });
        await prisma.scribeSession.update({
          where: { id },
          data: {
            draft: { ...live, modelAtSeconds: usage ? heardSeconds : (previous?.modelAtSeconds ?? 0) } as unknown as Prisma.InputJsonValue,
            model: usage?.model ?? session.model,
            inputTokens: { increment: usage?.inputTokens ?? 0 },
            outputTokens: { increment: usage?.outputTokens ?? 0 },
          },
        });
      }
    } catch (error) {
      request.log.warn({ err: error instanceof Error ? error.message : String(error) }, "the live note could not be rebuilt for this piece");
    }

    return { text, transcript, live };
  });

  /** Replaces the transcript: text typed, pasted, or corrected by hand. */
  app.put("/api/clinic/scribe/sessions/:id/transcript", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const session = await ownSession(id, auth.clinicUserId, reply);
    if (!session) return;
    request.auditPatientId = session.patientId;

    const body = z.object({ transcript: z.string().max(MAX_TRANSCRIPT_CHARS) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "That is too long to make one note from." });
    return prisma.scribeSession.update({ where: { id }, data: { transcript: body.data.transcript } });
  });

  /**
   * Builds the draft from what has been heard or typed so far.
   *
   * Can be asked for again -- after more is said, or after the transcript
   * is corrected -- and each time replaces the last draft. Nothing here
   * touches the patient's record.
   */
  app.post("/api/clinic/scribe/sessions/:id/draft", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const session = await ownSession(id, auth.clinicUserId, reply);
    if (!session) return;
    request.auditPatientId = session.patientId;

    if (session.transcript.trim().length < 10) {
      return reply.status(400).send({ error: "Nothing has been heard or typed yet." });
    }
    const patient = await prisma.patient.findUnique({
      where: { id: session.patientId },
      select: { name: true, phone: true, age: true, gender: true, allergies: true, chronicConditions: true },
    });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    const built = await buildDraft({
      transcript: session.transcript,
      patient,
      host: clinicHost(auth.clinicUserId),
      reader: createReader(),
    });
    const usage = built.usage;
    // The final pass reads the whole consultation and stands on its own.
    // Only when the model did not answer is what it wrote earlier, while
    // listening, kept -- rather than handing back a note with the history
    // it had a minute ago now missing.
    const draft = usage || built.draft.engine.model === null && built.draft.flags.every((f) => f.kind !== "engine")
      ? built.draft
      : carryOver((session.draft as unknown as Draft | null) ?? null, built.draft, { transcript: session.transcript, allergies: patient.allergies });

    await prisma.scribeSession.update({
      where: { id },
      data: {
        status: "DRAFTED",
        draft: draft as unknown as Prisma.InputJsonValue,
        model: usage?.model ?? session.model,
        // Added, not replaced: a draft built twice was paid for twice.
        inputTokens: { increment: usage?.inputTokens ?? 0 },
        outputTokens: { increment: usage?.outputTokens ?? 0 },
      },
    });
    return { draft, transcript: session.transcript };
  });

  /**
   * The doctor confirms, and the visit's records are written.
   *
   * One transaction: a case sheet without the prescription that went
   * with it is half a consultation, and somebody would have to notice.
   * What is saved is what the doctor sent back, not the draft -- every
   * field was theirs to change, and the two are kept side by side so the
   * difference can be measured.
   */
  app.post("/api/clinic/scribe/sessions/:id/confirm", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const session = await ownSession(id, auth.clinicUserId, reply);
    if (!session) return;
    request.auditPatientId = session.patientId;

    const parsed = confirmSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Every medicine needs a name, a dose, a frequency and a duration before the note can be saved." });
    }
    const note = parsed.data;
    const hasCaseSheet = Boolean(note.chiefComplaint || note.hopi || note.diagnosis || note.notes || note.followUpDate);
    if (!hasCaseSheet && note.medicines.length === 0 && note.labTests.length === 0) {
      return reply.status(400).send({ error: "There is nothing in this note to save." });
    }
    const labsOn = isFeatureEnabled("labs");

    const result = await prisma.$transaction(async (tx) => {
      const caseSheet = hasCaseSheet
        ? await tx.caseSheet.create({
            data: {
              patientId: session.patientId,
              appointmentId: session.appointmentId,
              doctorId: auth.clinicUserId,
              chiefComplaint: note.chiefComplaint || undefined,
              hopi: note.hopi || undefined,
              vitals: note.vitals,
              diagnosis: note.diagnosis || undefined,
              notes: note.notes || undefined,
              followUpDate: note.followUpDate ? new Date(note.followUpDate) : undefined,
              remindDoctor: note.followUpDate ? (note.remindDoctor ?? false) : false,
            },
          })
        : null;

      const prescription = note.medicines.length > 0
        ? await tx.prescription.create({
            data: {
              patientId: session.patientId,
              appointmentId: session.appointmentId,
              caseSheetId: caseSheet?.id,
              doctorId: auth.clinicUserId,
              items: { create: note.medicines.map((m) => ({ ...m, instructions: m.instructions || undefined })) },
            },
          })
        : null;

      const labOrder = labsOn && note.labTests.length > 0
        ? await tx.labOrder.create({
            data: {
              patientId: session.patientId,
              appointmentId: session.appointmentId,
              doctorId: auth.clinicUserId,
              items: { create: note.labTests.map((testName) => ({ testName })) },
            },
          })
        : null;

      // Vitals said in the room belong on the visit too, where the queue
      // and the trend chart read them. Merged, so reception's earlier
      // numbers are kept where the doctor said nothing new.
      if (note.vitals && Object.values(note.vitals).some(Boolean)) {
        const visit = await tx.appointment.findUnique({ where: { id: session.appointmentId }, select: { vitals: true } });
        const before = (visit?.vitals ?? {}) as Record<string, string>;
        const said = Object.fromEntries(Object.entries(note.vitals).filter(([, v]) => v));
        await tx.appointment.update({ where: { id: session.appointmentId }, data: { vitals: { ...before, ...said } } });
      }

      // A saved case sheet finishes the visit, as it does when typed
      // (routes/clinic-case-sheets.ts); the finishing time is set once.
      if (caseSheet) {
        await tx.appointment.updateMany({ where: { id: session.appointmentId }, data: { status: "COMPLETED" } });
        await tx.appointment.updateMany({ where: { id: session.appointmentId, completedAt: null }, data: { completedAt: new Date() } });
      }

      await tx.scribeSession.update({
        where: { id },
        data: { status: "CONFIRMED", confirmed: note as unknown as Prisma.InputJsonValue },
      });

      return { caseSheetId: caseSheet?.id ?? null, prescriptionId: prescription?.id ?? null, labOrderId: labOrder?.id ?? null };
    });

    return reply.status(201).send({ ...result, labTestsSkipped: !labsOn && note.labTests.length > 0 });
  });

  /** Throws the session away. The row is kept, marked; nothing was saved
   *  to the patient's record, so there is nothing else to undo. */
  app.post("/api/clinic/scribe/sessions/:id/discard", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const session = await ownSession(id, auth.clinicUserId, reply);
    if (!session) return;
    request.auditPatientId = session.patientId;
    // The transcript goes with it: a conversation the doctor chose not to
    // keep a note of is not kept as text either.
    await prisma.scribeSession.update({ where: { id }, data: { status: "DISCARDED", transcript: "", draft: Prisma.DbNull } });
    return { ok: true };
  });
}
