/**
 * What else a consultation calls for, besides the note.
 *
 * A consultation is more than a case sheet and a prescription. In an
 * antenatal visit the doctor says the weight, the blood pressure and the
 * fetal heart rate, and those belong on the clinic's antenatal form. A
 * patient mentions that her husband has diabetes and the doctor says to
 * put him on the file. Somebody needs three days' leave.
 *
 * So when the listening stops, the consultation is read once more for
 * those: the clinic's own forms that fit this patient, a family member
 * to add, a certificate to issue. Each comes back as a card, exactly as
 * if the doctor had asked for it at the bar -- and like those, nothing
 * is done until the doctor presses Confirm on it.
 *
 * ── Keeping it cheap ─────────────────────────────────────────────────
 *
 * This is a model call, and most consultations call for none of these
 * things. So it is only made when there is something it could find: a
 * form that fits the patient, or words in the transcript that point at a
 * family member or a certificate. An ordinary fever consultation at a
 * general practice never reaches it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { actionNamed, actionsFor, type RunContext } from "./actions.js";
import { formActions } from "./forms.js";
import type { Action, Reply } from "./registry.js";

const FAMILY = /\b(?:husband|wife|mother|father|son|daughter|brother|sister|family|pati|patni|aai|vadil|mulga|mulgi|bhau|bahin|beta|beti|bhai|behen)\b|पती|पत्नी|नवरा|बायको|आई|वडील|मुलगा|मुलगी|भाऊ|बहीण|पति|माँ|पिता|बेटा|बेटी|भाई|बहन|कुटुंब|परिवार/iu;
const CERTIFICATE = /\b(?:certificate|sick leave|medical leave|fitness|referral|refer(?:red|ring)?)\b|सर्टिफिकेट|प्रमाणपत्र|रजा|छुट्टी|रेफर/iu;

const SYSTEM = `You are the assistant in a doctor's consulting room in India. You are given the text of one consultation between a doctor and a patient, produced by a speech-to-text engine, in a mix of Marathi, Hindi and English. The patient's name has been removed where the clinic had it on file.

The clinical note and the prescription for this consultation are written elsewhere. Your job is only the other things this consultation calls for, and you have a tool for each kind:

- A form: fill it in when the consultation gave values for its fields. Set a field only when its value was actually said. Something said about a subject is not a finding on it. Leave every other field out. If fewer than two of a form's fields were said, do not call that form.
- A family member: call it only when the doctor said to add or note a relative on the patient's record, or a relative's own illness was discussed as something to record. A relative merely being mentioned ("come with your husband") is not a reason. You need the relative's actual name. Where the text reads "a relative" in place of a name, that person is already on the patient's file: do not call the tool for them, and never invent or describe a name.
- A certificate: call it only when the doctor agreed to give one in this consultation.

Call every tool the consultation gives real grounds for, each at most once. If it gives grounds for none, call no tool and reply with the single word: none.

A doctor will be shown each thing you propose and must confirm it. Propose only what was said; never fill a gap from your own knowledge.`;

export interface Proposed {
  cards: Reply[];
  usage: { model: string; inputTokens: number; outputTokens: number } | null;
}

export function proposingAvailable(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY) && env.SCRIBE_PROPOSE_ACTIONS;
}

/**
 * The cards a consultation calls for. `transcript` must already have the
 * patient's identifiers removed (lib/scribe/checks.ts, removeIdentifiers).
 */
export async function proposeFromConsultation(transcript: string, context: RunContext): Promise<Proposed> {
  const forms = await formActions(context).catch(() => [] as Action[]);
  const mine = new Set(actionsFor(context.asker).map((a) => a.name));
  const extras = [
    FAMILY.test(transcript) ? actionNamed("add_family_member") : undefined,
    CERTIFICATE.test(transcript) ? actionNamed("issue_certificate") : undefined,
  ].filter((a): a is Action => Boolean(a) && mine.has(a!.name));

  const offered = [...forms, ...extras];
  // Nothing it could find: no call, no cost.
  if (offered.length === 0) return { cards: [], usage: null };

  const now = context.today;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY!, maxRetries: 1, timeout: 30_000 });
  const model = env.SCRIBE_MODEL;
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: { effort: "low" },
    tools: offered.map((a) => ({ name: a.name, description: a.summary, input_schema: a.jsonSchema as Anthropic.Tool.InputSchema })),
    // The clinic's own date. toISOString() is the date in UTC, which for
    // the first five and a half hours of every Indian day is yesterday --
    // and "come back in a month" was then worked out a day short.
    messages: [{ role: "user", content: `Today is ${today}.\n\nThe consultation:\n\n${transcript.slice(0, 40_000)}` }],
  });
  const usage = { model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };

  const cards: Reply[] = [];
  const seen = new Set<string>();
  for (const block of response.content) {
    if (block.type !== "tool_use" || seen.has(block.name)) continue;
    seen.add(block.name);
    const action = offered.find((a) => a.name === block.name);
    if (!action?.preview || !action.allowed(context.asker)) continue;
    const parsed = action.schema.safeParse(block.input ?? {});
    if (!parsed.success) continue;
    try {
      // The same preview a request at the bar gets: looked up, checked,
      // nothing changed. Only a card that could really be confirmed is
      // offered; "tell me more" is not something to show unasked.
      const card = await action.preview(context, parsed.data as never);
      // A relative with a described name rather than a real one ("elder
      // brother, name not given") is not somebody to put on a file.
      const unnamed = block.name === "add_family_member" && /not given|unknown|unnamed|a relative|the patient/i.test(String((parsed.data as { name?: string }).name ?? ""));
      if (card.kind === "confirm" && !unnamed) cards.push(card);
    } catch {
      // One proposal that could not be drawn up does not cost the others.
    }
  }
  return { cards, usage };
}
