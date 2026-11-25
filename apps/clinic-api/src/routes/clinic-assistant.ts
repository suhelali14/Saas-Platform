import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireClinicAuth } from "../plugins/auth.js";
import { ask, runConfirmed, type Answered } from "../lib/assistant/ask.js";
import { contextFor, sealed } from "../lib/assistant/context.js";
import { pickerAvailable } from "../lib/assistant/pick.js";
import { speechAvailable, transcribe, SpeechUnavailable } from "../lib/scribe/stt.js";
import { count, listeningIsCapped } from "../lib/assistant/meter.js";
import { sealIsValid } from "../lib/assistant/seal.js";

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
const MAX_ASK_BYTES = 256 * 1024;
const AUDIO_TYPES = /^audio\/(webm|ogg|mp4|wav|mpeg|x-m4a|aac)/;

const askSchema = z.object({
  text: z.string().trim().min(1).max(600),
  patientId: z.string().max(60).optional(),
  appointmentId: z.string().max(60).optional(),
  /** The address of the screen they are on. */
  screen: z.string().max(200).optional(),
  /** A card is waiting on their screen for a yes or a no. */
  card: z.boolean().optional(),
  /** The question the assistant asked last, when this is the answer to it. */
  pending: z.object({ request: z.string().max(600), question: z.string().max(600) }).optional(),
});

const runSchema = z.object({
  action: z.string().min(1).max(80),
  params: z.record(z.unknown()).default({}),
  /** From the card itself, not from whatever is on screen now. */
  patientId: z.string().max(60).nullable().optional(),
  appointmentId: z.string().max(60).nullable().optional(),
  seal: z.string().max(200),
});

/**
 * A yes or a no, said to a card that is waiting.
 *
 * The card is on the person's own screen and only their browser can send
 * it back, so all the server says is which of the two was meant. It costs
 * nothing: a spoken "haan, kar do" never reaches a model.
 */
const YES = /^(?:ok(?:ay)?[,. ]*)?(?:yes|yeah|yep|confirm(?: it)?|do it|go ahead|save(?: it)?|correct|right|haan?|ha|ji|ji haan?|kar ?do|kar ?de|theek hai|thik hai|sahi hai|ho|hoy|kara|karun taka|barobar|chalel)(?:[,. ]+(?:yes|confirm(?: it)?|do it|save(?: it)?|kar ?do|kara|please|haan?|ji|theek hai))*[.!।]?$|^(?:हाँ|हां|हा|जी|जी हाँ|ठीक है|सही है|कर दो|करो|हो|होय|करा|बरोबर|चालेल)(?:[,. ]+(?:कर दो|करो|करा|ठीक है|हाँ|हां))*[.!।]?$/iu;
const NO = /^(?:no|nope|cancel(?: it)?|stop|leave it|don'?t|not now|nahi|nahin|nako|rehne do|rahu de|mat karo)[.!।]?$|^(?:नहीं|नही|नको|रहने दो|राहू दे|मत करो|कैंसल)[.!।]?$/iu;
function yesOrNo(text: string): "yes" | "no" | null {
  const said = text.trim();
  return YES.test(said) ? "yes" : NO.test(said) ? "no" : null;
}

const perPerson = (request: FastifyRequest) => (typeof request.headers.authorization === "string" && request.headers.authorization.length > 20 ? request.headers.authorization.slice(-48) : request.ip);

export async function clinicAssistantRoutes(app: FastifyInstance) {
  function record(request: FastifyRequest, answered: Answered) {
    // What it cost and what did the work, per request, in the log the
    // clinic's server already keeps. No words of the request, and no
    // patient: a count, not a transcript.
    request.log.info({ assistant: { by: answered.by, action: answered.action, kind: answered.reply.kind, tokensIn: answered.usage?.inputTokens ?? 0, tokensOut: answered.usage?.outputTokens ?? 0 } }, "assistant request");
    void count({
      modelCalls: answered.usage ? 1 : 0,
      tokensIn: answered.usage?.inputTokens ?? 0,
      tokensOut: answered.usage?.outputTokens ?? 0,
      ruleAnswers: answered.by === "rule" ? 1 : 0,
    }, request.clinicUserId);
  }

  app.get("/api/clinic/assistant/status", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    return { canHear: speechAvailable(), canThink: pickerAvailable() };
  });

  // Sixty a minute is a person talking to it without pause. Past that it
  // is a loop, and each one may be a paid model call.
  app.post("/api/clinic/assistant/ask", { config: { rateLimit: { max: 60, timeWindow: "1 minute", keyGenerator: perPerson } } }, async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const parsed = askSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Say or type what you need." });
    if (parsed.data.card) {
      const decided = yesOrNo(parsed.data.text);
      if (decided) return { decided, by: "rule" };
    }
    const context = await contextFor(app, request, parsed.data);
    const answered = await ask(parsed.data.text, context, parsed.data.pending);
    record(request, answered);
    return { reply: sealed(answered.reply, context), by: answered.by, action: answered.action };
  });

  /** The same, spoken. The audio is transcribed and gone; it is not kept. */
  app.post("/api/clinic/assistant/voice", { config: { rateLimit: { max: 30, timeWindow: "1 minute", keyGenerator: perPerson } } }, async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: "Nothing was heard." });
    if (!AUDIO_TYPES.test(file.mimetype)) return reply.status(400).send({ error: "That is not an audio recording." });
    const audio = await file.toBuffer();
    if (audio.length === 0) return reply.status(400).send({ error: "Nothing was heard." });
    if (audio.length > MAX_ASK_BYTES) return reply.status(413).send({ error: "That was too long. Say it in one sentence." });
    const field = (name: string) => (file.fields[name] as { value?: string } | undefined)?.value;
    if (await listeningIsCapped(auth.clinicUserId)) return reply.status(429).send({ error: "The assistant has reached today's limit for listening. Type what you need." });
    // Recorded at about four kilobytes a second; near enough for a meter.
    void count({ audioSeconds: Math.max(1, Math.round(audio.length / 4000)) }, auth.clinicUserId);

    let heard: string;
    try {
      heard = await transcribe(audio, file.mimetype);
    } catch (error) {
      if (error instanceof SpeechUnavailable) return reply.status(error.status).send({ error: error.message });
      throw error;
    }
    if (heard.trim().length < 2) {
      return { reply: { kind: "sorry", say: "I did not hear anything. Tap the microphone and say it again." }, by: "none", heard: "" };
    }
    if (field("card") === "1") {
      const decided = yesOrNo(heard);
      if (decided) return { decided, by: "rule", heard };
    }
    const pendingRequest = field("pendingRequest");
    const pendingQuestion = field("pendingQuestion");
    const context = await contextFor(app, request, { patientId: field("patientId"), appointmentId: field("appointmentId"), screen: field("screen") });
    const answered = await ask(
      heard,
      context,
      pendingRequest && pendingQuestion ? { request: pendingRequest.slice(0, 600), question: pendingQuestion.slice(0, 600) } : undefined,
    );
    record(request, answered);
    return { reply: sealed(answered.reply, context), by: answered.by, action: answered.action, heard };
  });

  /** A change the person pressed Confirm on. */
  app.post("/api/clinic/assistant/run", { config: { rateLimit: { max: 60, timeWindow: "1 minute", keyGenerator: perPerson } } }, async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const parsed = runSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "That could not be read." });
    const card = {
      action: parsed.data.action,
      params: parsed.data.params,
      patientId: parsed.data.patientId ?? null,
      appointmentId: parsed.data.appointmentId ?? null,
      userId: auth.clinicUserId,
    };
    // The card as this server drew it up: this action, these details,
    // this patient, this person. Anything else is not a card it issued.
    if (!sealIsValid(card, parsed.data.seal)) {
      return { reply: { kind: "sorry", say: "That card is out of date. Ask me again and I will draw it up afresh." }, by: "none" };
    }
    // The patient and visit come from the card. A visit names its
    // patient, so only the visit is passed on when there is one.
    const context = await contextFor(app, request, card.appointmentId ? { appointmentId: card.appointmentId } : { patientId: card.patientId ?? undefined });
    if (context.patientId !== card.patientId || context.appointmentId !== card.appointmentId) {
      return { reply: { kind: "sorry", say: "That patient's record is no longer where it was. Ask me again." }, by: "none" };
    }
    const answered = await runConfirmed(parsed.data.action, parsed.data.params, context);
    record(request, answered);
    return { reply: answered.reply, by: answered.by };
  });
}
