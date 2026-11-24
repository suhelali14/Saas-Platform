import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth } from "../plugins/auth.js";
import { ask, runConfirmed, type Answered } from "../lib/assistant/ask.js";
import type { Call, RunContext } from "../lib/assistant/actions.js";
import { pickerAvailable } from "../lib/assistant/pick.js";
import { speechAvailable, transcribe, SpeechUnavailable } from "../lib/scribe/stt.js";

/**
 * The assistant that is asked for things.
 *
 * Anybody signed in may ask; what they can be given is decided action by
 * action, by the same role rules as the screens (lib/assistant/actions.ts).
 *
 * ── How it stays inside the asker's own permissions ──────────────────
 *
 * Every change the assistant makes, and several things it reads, go
 * through the app's own routes -- called from inside this process, with
 * the asker's own sign-in (`call`, below). So there is no second set of
 * permission rules to keep in step with the first: a receptionist asking
 * the assistant to issue a certificate is refused by the certificate
 * route, in that route's own words, exactly as the button would be.
 */

/** One spoken request: a sentence, not a consultation. */
const MAX_ASK_BYTES = 1024 * 1024;
const AUDIO_TYPES = /^audio\/(webm|ogg|mp4|wav|mpeg|x-m4a|aac)/;

const askSchema = z.object({
  text: z.string().trim().min(1).max(600),
  patientId: z.string().max(60).optional(),
  appointmentId: z.string().max(60).optional(),
  /** The question the assistant asked last, when this is the answer to it. */
  pending: z.object({ request: z.string().max(600), question: z.string().max(600) }).optional(),
});

const runSchema = z.object({
  action: z.string().min(1).max(80),
  params: z.record(z.unknown()).default({}),
  patientId: z.string().max(60).optional(),
  appointmentId: z.string().max(60).optional(),
});

export async function clinicAssistantRoutes(app: FastifyInstance) {
  /** The app's own routes, called as the person who is asking. */
  function callAs(request: FastifyRequest): Call {
    return async (method, url, payload) => {
      const res = await app.inject({
        method,
        url,
        headers: { authorization: request.headers.authorization ?? "", ...(payload === undefined ? {} : { "content-type": "application/json" }) },
        ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
      });
      let body: unknown = null;
      try { body = res.json(); } catch { /* not JSON: a PDF, or nothing */ }
      return { status: res.statusCode, body };
    };
  }

  /** Who is asking, and what is on their screen. */
  async function contextFor(request: FastifyRequest, on: { patientId?: string; appointmentId?: string }): Promise<RunContext> {
    let patientId: string | null = null;
    let appointmentId: string | null = null;
    // What the browser says is on screen is looked up, not taken on
    // trust: an id that names nothing is simply no patient.
    if (on.appointmentId) {
      const visit = await prisma.appointment.findUnique({ where: { id: on.appointmentId }, select: { id: true, patientId: true } });
      if (visit) { appointmentId = visit.id; patientId = visit.patientId; }
    } else if (on.patientId) {
      const patient = await prisma.patient.findUnique({ where: { id: on.patientId }, select: { id: true } });
      if (patient) patientId = patient.id;
    }
    if (patientId) request.auditPatientId = patientId;
    return {
      asker: { userId: request.clinicUserId!, role: request.clinicUserRole!, isAdmin: request.clinicUserIsAdmin === true, name: request.clinicUserName ?? "" },
      patientId,
      appointmentId,
      today: new Date(),
      call: callAs(request),
    };
  }

  function record(request: FastifyRequest, answered: Answered) {
    // What it cost and what did the work, per request, in the log the
    // clinic's server already keeps. No words of the request, and no
    // patient: a count, not a transcript.
    request.log.info({ assistant: { by: answered.by, action: answered.action, kind: answered.reply.kind, tokensIn: answered.usage?.inputTokens ?? 0, tokensOut: answered.usage?.outputTokens ?? 0 } }, "assistant request");
  }

  app.get("/api/clinic/assistant/status", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    return { canHear: speechAvailable(), canThink: pickerAvailable() };
  });

  // Sixty a minute is a person talking to it without pause. Past that it
  // is a loop, and each one may be a paid model call.
  app.post("/api/clinic/assistant/ask", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const parsed = askSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Say or type what you need." });
    const answered = await ask(parsed.data.text, await contextFor(request, parsed.data), parsed.data.pending);
    record(request, answered);
    return { reply: answered.reply, by: answered.by };
  });

  /** The same, spoken. The audio is transcribed and gone; it is not kept. */
  app.post("/api/clinic/assistant/voice", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: "Nothing was heard." });
    if (!AUDIO_TYPES.test(file.mimetype)) return reply.status(400).send({ error: "That is not an audio recording." });
    const audio = await file.toBuffer();
    if (audio.length === 0) return reply.status(400).send({ error: "Nothing was heard." });
    if (audio.length > MAX_ASK_BYTES) return reply.status(413).send({ error: "That was too long. Say it in one sentence." });
    const field = (name: string) => (file.fields[name] as { value?: string } | undefined)?.value;

    let heard: string;
    try {
      heard = await transcribe(audio, file.mimetype);
    } catch (error) {
      if (error instanceof SpeechUnavailable) return reply.status(error.status).send({ error: error.message });
      throw error;
    }
    if (heard.trim().length < 2) {
      return { reply: { kind: "sorry", say: "I did not hear anything. Hold the microphone, speak, then let go." }, by: "none", heard: "" };
    }
    const pendingRequest = field("pendingRequest");
    const pendingQuestion = field("pendingQuestion");
    const answered = await ask(
      heard,
      await contextFor(request, { patientId: field("patientId"), appointmentId: field("appointmentId") }),
      pendingRequest && pendingQuestion ? { request: pendingRequest.slice(0, 600), question: pendingQuestion.slice(0, 600) } : undefined,
    );
    record(request, answered);
    return { reply: answered.reply, by: answered.by, heard };
  });

  /** A change the person pressed Confirm on. */
  app.post("/api/clinic/assistant/run", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const parsed = runSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "That could not be read." });
    const answered = await runConfirmed(parsed.data.action, parsed.data.params, await contextFor(request, parsed.data));
    record(request, answered);
    return { reply: answered.reply, by: answered.by };
  });
}
