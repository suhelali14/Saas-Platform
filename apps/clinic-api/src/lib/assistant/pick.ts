/**
 * The model's part in the assistant: choosing an action.
 *
 * Called only for a request no rule recognised (lib/assistant/router.ts).
 * It is shown the list of actions this person may use and the request,
 * and it answers with one action and its parameters -- or with a short
 * question back, when the request does not say enough.
 *
 * It does not run anything and is given no records. What it returns is
 * checked against the action's own schema before anything happens, and a
 * change is shown to the person as a card first (lib/assistant/registry.ts).
 *
 * What it IS given is the request, word for word. A request that names
 * somebody -- "add her husband Rajesh", "register Kiran Deshpande,
 * 98220..." -- reaches the model with that name and number in it,
 * because they are the request. The everyday ones that name a patient
 * ("find patient Ramesh Joshi") are read by rule and reach no model.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import type { Action } from "./registry.js";
import type { Intent } from "./router.js";

export interface Picked {
  intent: Intent | null;
  /** What the model said instead of choosing: a question, or that it cannot. */
  said: string;
  usage: { model: string; inputTokens: number; outputTokens: number };
}

const SYSTEM = `You are the assistant built into a clinic's management software in India. A doctor or a member of the clinic's staff has asked you for something, by voice or by typing, in English, Hindi or Marathi, often mixed. Speech-to-text may have misheard a word.

You have a list of tools. Each one is something this software can do for the person who is asking. Work out which single tool does what they asked, and call it with the parameters their request gives you.

How to choose:
- Call exactly one tool when the request clearly matches one. Do not explain first; just call it.
- When the request is about "this patient", "her", "him" and the context says a patient is on screen, the tool already knows who that is. Do not ask for the name.
- When they name a patient and ask for something about or for that patient (their last prescription, record their BP, book them, order a test), call the tool for that thing and put the name they said in its for_patient field. One step: do not open the patient first. Leave for_patient out when they mean the patient on screen.
- The context tells you which screen they are looking at and how today's queue stands. "Here", "this", "this one", "the one with the doctor", "the first one" mean what that context shows. A patient in the queue can be opened by token number.
- When a tool needs something the request did not give (which test, which date, which relative), do not invent it. Reply in one short sentence asking for exactly that, in the language they used.
- When nothing on the list does what they asked, say so in one short sentence and, if something on the list comes close, say in plain words what you can do instead. Never pretend to have done something.
- Requests are often spoken, with filler ("okay so now", "theek hai") and misheard words ("cube" for "queue"). Act on what they plainly meant. When they name a patient to open, see or start, find that patient, even if the name looks misspelt: the software matches names by sound.
- Opening a screen and looking something up change nothing, so do them without asking leave. If they ask where something is or which screen shows it, open that screen.
- When they want to do something you have no tool for, but the software has a screen where it is done (adding a staff login, changing a fee, editing the website, adding stock), open that screen and tell them in a few words that it is done there. Say you cannot only when no screen does it either.
- When filling in a form, set a field only when its value was actually said. Something said about a subject is not a finding on it: "he checks his feet daily" does not mean the feet were examined and found normal. Leave that field out.
- Your list holds only what the person asking is allowed to do. If they ask for something a clinic's software plainly does but your list lacks (a receptionist asking to prescribe), say it is not available to their login. Do not suggest another way for them to do it.
- Speak as a person would to a colleague. Never mention a tool's name, the word "tool", or anything about how you work.
- Dates: today's date is given in the context. Write every date as YYYY-MM-DD.
- Write names of people exactly as they were said. Write clinical text in short English, the way an Indian doctor writes a note.

You only choose. The software checks what you chose, and anything that changes a record is shown to the person to confirm before it happens.`;

/**
 * Any action about a patient can be asked for somebody who is not on
 * screen, by naming them. The name travels beside the action's own
 * parameters and is settled by code (actions.ts, patientNamed) before the
 * action is looked at.
 */
export const FOR_PATIENT = "for_patient";
function withPatient(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = (schema.properties ?? {}) as Record<string, unknown>;
  return {
    ...schema,
    properties: { ...properties, [FOR_PATIENT]: { type: "string", description: "The name of the patient this is for, exactly as it was said. Only when they named somebody; leave out for the patient on screen." } },
  };
}

export function pickerAvailable(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

export async function pickAction(input: {
  text: string;
  actions: Action[];
  hasPatient: boolean;
  hasVisit: boolean;
  today: string;
  role: string;
  /** The screen they are looking at, in words. */
  screen?: string;
  /** Today's queue, with nobody named. */
  queue?: string;
  /** A question this assistant asked a moment ago, which this request answers. */
  pending?: { request: string; question: string };
}): Promise<Picked> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY!, maxRetries: 1, timeout: 30_000 });
  const model = env.SCRIBE_MODEL;

  const response = await client.messages.create({
    model,
    max_tokens: 1200,
    system: SYSTEM,
    output_config: { effort: "low" },
    tools: input.actions.map((a, i, all) => ({
      name: a.name,
      description: a.summary,
      // The fixed actions are the same on every request from one role,
      // so everything up to the last of them is cached by the provider
      // and read back at a tenth of the price. The clinic's own forms
      // differ by patient and come after the mark.
      ...(!a.loose && (i === all.length - 1 || all[i + 1]!.loose) ? { cache_control: { type: "ephemeral" as const } } : {}),
      // Not strict tools. The provider caps how many strict tools and how
      // many optional parameters one request may carry, and this list is
      // past both; nothing is lost, because what the model returns is
      // validated by the action's own schema before anything happens.
      input_schema: (a.needsPatient && !a.loose ? withPatient(a.jsonSchema) : a.jsonSchema) as Anthropic.Tool.InputSchema,
    })),
    messages: [
      {
        role: "user",
        content:
          `Context: today is ${input.today}. The person asking is a ${input.role.toLowerCase().replace(/_/g, " ")}. ` +
          `${input.hasPatient ? "A patient's record is open on their screen." : "No patient's record is open on their screen."} ` +
          `${input.hasVisit ? "A visit (consultation) for that patient is open." : ""} ` +
          `${input.screen ? `They are looking at: ${input.screen}. ` : ""}${input.queue ?? ""}\n\n` +
          (input.pending
            ? `A moment ago they asked:\n${input.pending.request}\n\nYou asked them back:\n${input.pending.question}\n\nTheir answer, which completes that request:\n${input.text}`
            : `The request:\n${input.text}`),
      },
    ],
  });

  const usage = { model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  const call = response.content.find((b) => b.type === "tool_use");
  const said = response.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join(" ").trim();
  if (call?.type === "tool_use") {
    return { intent: { action: call.name, params: (call.input ?? {}) as Record<string, unknown> }, said, usage };
  }
  return { intent: null, said, usage };
}
