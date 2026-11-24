/**
 * The assistant's language-model reader.
 *
 * Called only for what the rules could not account for (see engine.ts),
 * and handed a transcript with the patient's name and phone already
 * removed. It returns a fixed JSON shape and nothing else; every claim in
 * it is checked afterwards by code that is not a model.
 *
 * The model is the small, cheap one by default. Reading a consultation
 * into a fixed shape is extraction, the answer is checked, and the cost
 * of this call is multiplied by every patient a doctor sees. A deployment
 * that measures better results from a larger model sets SCRIBE_MODEL.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import type { ModelNote, ModelReader } from "./engine.js";

const text = { type: "string" } as const;

/** Every property required and no extras: the shape is the contract. */
const NOTE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["chiefComplaint", "hopi", "diagnosis", "advice", "vitals", "medicines", "labTests", "followUpInDays", "unplaced"],
  properties: {
    chiefComplaint: text,
    hopi: text,
    diagnosis: text,
    advice: text,
    vitals: {
      type: "object",
      additionalProperties: false,
      required: ["bp", "temp", "spo2", "weight", "pulse"],
      properties: { bp: text, temp: text, spo2: text, weight: text, pulse: text },
    },
    medicines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["spoken", "dosage", "frequency", "duration", "instructions", "quote"],
        properties: {
          spoken: text,
          dosage: text,
          frequency: { type: "string", enum: ["OD", "BD", "TDS", "QID", "SOS", "STAT", ""] },
          duration: text,
          instructions: text,
          quote: text,
        },
      },
    },
    labTests: { type: "array", items: text },
    followUpInDays: { type: "integer" },
    unplaced: { type: "array", items: text },
  },
} as const;

const SYSTEM = `You are the note-taker in a doctor's consulting room in India. You are given the text of one consultation, produced by a speech-to-text engine, and you turn it into the doctor's clinical note.

About the text you receive. It is a conversation between a doctor and a patient, sometimes with a relative, in a mix of Marathi, Hindi and English. The speakers are not labelled; work out who is speaking from what is said. The speech engine makes mistakes, especially with medicine names, so a word may be a near-miss of what was actually said. The patient's name and phone number have been removed.

What to write. Write the note in English, in the short clinical style an Indian general practitioner writes by hand: "Fever x 3 days, dry cough, worse at night." Translate what the patient said in Marathi or Hindi into that style.

- chiefComplaint: what the patient came in for, with how long.
- hopi: the history the patient gave and what the doctor found on asking or examining. Medicines the patient is already taking belong here.
- diagnosis: only a diagnosis the doctor stated. If the doctor did not state one, leave it empty. Do not infer one from the symptoms.
- advice: what the doctor told the patient to do other than take medicines: rest, diet, warning signs, when to return.
- vitals: only numbers that were said aloud.
- medicines: only what the doctor prescribes in THIS consultation. For each one:
  - spoken: the name as said, with its strength if said. If the text has a near-miss of one of the doctor's usual medicines listed below, use the usual medicine's name.
  - dosage: the morning-afternoon-night pattern, like "1-0-1" or "1/2-0-1/2". For liquids or anything else, the amount as said, like "5 ml". Empty if not said.
  - frequency: OD, BD, TDS, QID, SOS or STAT. Empty if not said.
  - duration: like "5 days" or "2 weeks". Empty if not said.
  - instructions: like "After food". Empty if not said.
  - quote: the exact words from the text where the doctor prescribed it, copied character for character.
- labTests: tests the doctor orders now, each written exactly as it appears in the clinic's test list below. Leave out any test that is not on that list, and put it in unplaced instead.
- followUpInDays: when the doctor asked the patient to return, in days. 0 if not mentioned.
- unplaced: anything clinically relevant that was said and that you could not place in a field above, one short item each. Leave out greetings and small talk.

The rule that matters most. A doctor will read this note and sign it, and a patient will take these medicines. Write only what was said. When something was not said, or you could not make it out, leave the field empty: an empty field is seen and filled in by the doctor, while a plausible guess is read as fact. Never supply a dose, a duration or a diagnosis from your own medical knowledge.`;

export class ModelUnavailable extends Error {}

function isNote(value: unknown): value is ModelNote {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.chiefComplaint === "string" &&
    typeof v.hopi === "string" &&
    typeof v.diagnosis === "string" &&
    typeof v.advice === "string" &&
    typeof v.vitals === "object" && v.vitals !== null &&
    Array.isArray(v.medicines) &&
    Array.isArray(v.labTests) &&
    typeof v.followUpInDays === "number" &&
    Array.isArray(v.unplaced)
  );
}

export function modelAvailable(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/** Null when this deployment has no key: the engine then works by rule alone. */
export function createReader(): ModelReader | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 });
  const model = env.SCRIBE_MODEL;

  return {
    model,
    async read(input) {
      const context = [
        `Patient: ${[input.patient.age != null ? `${input.patient.age} years` : null, input.patient.gender].filter(Boolean).join(", ") || "age and sex not recorded"}.`,
        input.patient.allergies ? `Known allergies: ${input.patient.allergies}.` : "",
        input.patient.chronicConditions ? `Chronic conditions on file: ${input.patient.chronicConditions}.` : "",
        input.usualMedicines.length > 0 ? `The doctor's usual medicines: ${input.usualMedicines.join("; ")}.` : "",
        `The clinic's test list: ${input.labCatalogue.join("; ") || "(none)"}.`,
      ].filter(Boolean).join("\n");

      let response;
      try {
        response = await client.messages.create({
          model,
          max_tokens: 4000,
          system: SYSTEM,
          output_config: { effort: "low", format: { type: "json_schema", schema: NOTE_SCHEMA } },
          messages: [{ role: "user", content: `${context}\n\nThe consultation:\n\n${input.transcript}` }],
        });
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError) throw new ModelUnavailable("the API key was rejected");
        if (error instanceof Anthropic.RateLimitError) throw new ModelUnavailable("the provider is rate-limiting this key");
        if (error instanceof Anthropic.APIError) throw new ModelUnavailable(`the provider returned ${error.status ?? "an error"}`);
        throw new ModelUnavailable("the provider could not be reached");
      }

      if (response.stop_reason === "refusal") throw new ModelUnavailable("the model declined this transcript");
      if (response.stop_reason === "max_tokens") throw new ModelUnavailable("the note was too long to finish");

      const block = response.content.find((b) => b.type === "text");
      let parsed: unknown;
      try {
        parsed = JSON.parse(block?.type === "text" ? block.text : "");
      } catch {
        throw new ModelUnavailable("the model's answer could not be read");
      }
      if (!isNote(parsed)) throw new ModelUnavailable("the model's answer was not in the expected shape");

      return {
        note: parsed,
        usage: { model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      };
    },
  };
}
