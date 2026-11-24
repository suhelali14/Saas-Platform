/**
 * The assistant's engine: a transcript in, a checked draft out.
 *
 * ── Independent of the clinic on purpose ─────────────────────────────
 *
 * Nothing in this directory imports the database, the web framework or a
 * model SDK. The engine asks its HOST for the three things it cannot know
 * -- the list of tests, this person's habits, and how to look a medicine
 * up -- and asks a READER for the one thing rules cannot do. Both are
 * interfaces passed in.
 *
 * That is what lets the same engine sit behind a different screen, or be
 * lifted out and run as a service of its own, by writing a new host
 * rather than by untangling this one. The clinic's host is
 * lib/scribe/clinic-host.ts.
 *
 * ── The order things happen in, and why ──────────────────────────────
 *
 *   1. RULES     read everything that has a shape (structure.ts). Free.
 *   2. READER    a language model, only when the rules could not account
 *                for the transcript. A note that named its own sections
 *                stops at step 1 and costs nothing.
 *   3. MERGE     the model's medicines and the rules', as one list.
 *   4. RESOLVE   each medicine against the doctor's own habits, then the
 *                catalogue. The model proposes a name; the list decides.
 *   5. CHECK     allergy, missing dose, untraceable source (checks.ts).
 *
 * The draft that comes out is a proposal. Saving it is the host's job and
 * happens only when a person confirms it.
 */

import {
  structureLocally, readSchedule, readDuration, readInstructions, sentences,
  type Frequency, type LocalMedicine,
} from "./structure.js";
import {
  checkDraft, mergeMedicines, nameKey, removeIdentifiers,
  type Draft, type DraftMedicine, type DrugCandidate, type Flag, type Identifiers,
} from "./checks.js";

/** What this doctor usually writes for a medicine. */
export interface Habit {
  drugId: string | null;
  drugName: string;
  composition: string | null;
  dosage: string;
  frequency: Frequency;
  duration: string;
  /** How many times it has been prescribed; the list arrives sorted by it. */
  count: number;
}

export interface AssistantHost {
  /** The names of the tests this clinic can order. */
  labCatalogue(): Promise<string[]>;
  habits(): Promise<Habit[]>;
  /** Best matches for a medicine as it was said, best first. */
  searchMedicine(spoken: string): Promise<{ hits: DrugCandidate[]; approximate: boolean }>;
}

/** Who the patient is (never sent to a model) and what is clinically
 *  relevant about them (sent, because a note cannot be written without). */
export interface PatientContext extends Identifiers {
  age?: number | null;
  gender?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
}

/** What a reader returns. Every string is empty when the thing was not said. */
export interface ModelNote {
  chiefComplaint: string;
  hopi: string;
  diagnosis: string;
  advice: string;
  vitals: { bp: string; temp: string; spo2: string; weight: string; pulse: string };
  medicines: { spoken: string; dosage: string; frequency: string; duration: string; instructions: string; quote: string }[];
  labTests: string[];
  /** 0 when no follow-up was mentioned. */
  followUpInDays: number;
  unplaced: string[];
}

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelReader {
  readonly model: string;
  read(input: {
    transcript: string;
    patient: Pick<PatientContext, "age" | "gender" | "allergies" | "chronicConditions">;
    labCatalogue: string[];
    /** The medicine names this doctor writes most, to steady a misheard one. */
    usualMedicines: string[];
  }): Promise<{ note: ModelNote; usage: ModelUsage }>;
}

export interface DraftResult {
  draft: Draft;
  usage: ModelUsage | null;
}

const FREQUENCIES = new Set<string>(["OD", "BD", "TDS", "QID", "SOS", "STAT"]);

/** How complete the rules' reading must be for the model to be skipped. */
const RULES_ARE_ENOUGH = 0.8;

function clip(text: string, max: number): string {
  const t = (text ?? "").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Numbers of two or more digits in a name: its strength. */
function strengths(name: string): string[] {
  return name.match(/\d{2,}/g) ?? [];
}

/**
 * Is this habit the medicine that was said?
 *
 * The first word must match, and so must the strength when both carry
 * one: "Dolo 650" is not this doctor's usual "Dolo 500".
 */
function matchesHabit(spoken: string, habit: Habit): boolean {
  const key = nameKey(spoken);
  if (!key || key !== nameKey(habit.drugName)) return false;
  const said = strengths(spoken);
  const usual = strengths(habit.drugName);
  if (said.length === 0 || usual.length === 0) return true;
  return said.some((s) => usual.includes(s));
}

/**
 * Medicines named without "tab" or "cap" in front.
 *
 * "Dolo 650 twice a day" has no form word for the rules to hang a name
 * on. This doctor's own past prescriptions do: a name they have written
 * before, heard in the transcript, is a medicine.
 */
function habitMentions(transcript: string, habits: Habit[], already: LocalMedicine[]): LocalMedicine[] {
  const found: LocalMedicine[] = [];
  const taken = new Set(already.map((m) => nameKey(m.spoken)));
  const lines = sentences(transcript);
  for (const habit of habits) {
    const key = nameKey(habit.drugName);
    // Short keys ("pan", "zen") are also ordinary syllables.
    if (key.length < 4 || taken.has(key)) continue;
    const line = lines.find((s) => new RegExp(`(?<![\\p{L}\\d])${key}(?![\\p{L}])`, "iu").test(s));
    if (!line) continue;
    taken.add(key);
    const schedule = readSchedule(line);
    found.push({
      spoken: habit.drugName,
      dosage: schedule.dosage,
      frequency: schedule.frequency,
      duration: readDuration(line),
      instructions: readInstructions(line),
      source: line,
    });
  }
  return found;
}

export async function resolveMedicine(medicine: LocalMedicine, habits: Habit[], host: AssistantHost): Promise<DraftMedicine> {
  const base: DraftMedicine = {
    spoken: medicine.spoken,
    drugId: null,
    drugName: medicine.spoken,
    composition: null,
    match: "none",
    approximate: false,
    alternatives: [],
    dosage: clip(medicine.dosage, 50),
    frequency: medicine.frequency,
    duration: clip(medicine.duration, 50),
    instructions: clip(medicine.instructions, 200),
    source: medicine.source,
    notes: [],
  };

  const habit = habits.find((h) => matchesHabit(medicine.spoken, h));
  if (habit) {
    base.drugId = habit.drugId;
    base.drugName = habit.drugName;
    base.composition = habit.composition;
    base.match = "habit";
    // The doctor's own usual, offered where nothing was heard -- and said
    // to be exactly that, so it is read as a suggestion and not as what
    // was dictated.
    const filled: string[] = [];
    if (!base.dosage && habit.dosage) { base.dosage = habit.dosage; filled.push("dose"); }
    if (!base.frequency) { base.frequency = habit.frequency; filled.push("frequency"); }
    if (!base.duration && habit.duration) { base.duration = habit.duration; filled.push("duration"); }
    if (filled.length > 0) {
      base.notes.push(`The ${filled.join(", ")} ${filled.length === 1 ? "is" : "are"} your usual for this medicine; ${filled.length === 1 ? "it was" : "they were"} not heard.`);
    }
    return base;
  }

  const { hits, approximate } = await host.searchMedicine(medicine.spoken);
  const best = hits[0];
  if (best) {
    base.drugId = best.id;
    base.drugName = best.name;
    base.composition = best.composition;
    base.match = "catalogue";
    base.approximate = approximate;
    base.alternatives = hits.slice(1, 5);
  }
  return base;
}

/** "Tab Azithromycin 500" is looked up as "Azithromycin 500": no name in
 *  the catalogue starts with the word for its own form. */
function withoutForm(spoken: string): string {
  return spoken.replace(/^\s*(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syrup|inj(?:ection)?)\b\.?\s*/i, "").trim() || spoken.trim();
}

/**
 * The model's medicines, with the rules run over each one's own quote.
 *
 * The model is asked to copy the words a medicine was prescribed in, and
 * those words are exactly what the rules read best. So a field the model
 * left empty is read from its quote: it wrote "TDS" for "din mein teen
 * baar" and no pattern, and the rules know that is 1-1-1. Nothing is
 * taken from anywhere but the sentence the model itself pointed at.
 */
function fromModel(note: ModelNote): LocalMedicine[] {
  return note.medicines
    .filter((m) => m.spoken.trim().length >= 2)
    .map((m) => {
      const quote = m.quote.trim();
      const said = readSchedule(quote);
      const frequency = (FREQUENCIES.has(m.frequency) ? m.frequency : "") as Frequency | "";
      // The rules' pattern is used only when it agrees with the model's
      // frequency, or the model gave none: two readers disagreeing is a
      // reason to leave the field for the doctor.
      const agrees = !frequency || !said.frequency || said.frequency === frequency;
      return {
        spoken: withoutForm(m.spoken),
        dosage: m.dosage.trim() || (agrees ? said.dosage : ""),
        frequency: frequency || said.frequency,
        duration: readDuration(m.duration) || m.duration.trim() || readDuration(quote),
        instructions: m.instructions.trim() || readInstructions(quote),
        source: quote,
      };
    });
}

/**
 * A note that keeps what it already had.
 *
 * While a consultation is being listened to, the note is rebuilt after
 * every few seconds of speech. Most of those rebuilds are by rule alone,
 * because a model call on every breath would cost more than the note is
 * worth -- and a rules-only rebuild knows nothing of the complaint the
 * model wrote a moment ago. Without this, the screen would show a history
 * being written and then wiped.
 *
 * So what an earlier pass wrote stays until a later pass writes something
 * in its place. Numbers and medicines read from the newest transcript
 * win; anything only the earlier pass had is kept.
 */
export function carryOver(previous: Draft | null, next: Draft, context: { transcript: string; allergies: string | null }): Draft {
  if (!previous) return next;
  const have = new Set(next.medicines.map((m) => m.drugId ?? nameKey(m.drugName)));
  const medicines = [
    ...next.medicines,
    ...previous.medicines.filter((m) => !have.has(m.drugId ?? nameKey(m.drugName))),
  ];
  return {
    ...next,
    chiefComplaint: next.chiefComplaint || previous.chiefComplaint,
    hopi: next.hopi || previous.hopi,
    diagnosis: next.diagnosis || previous.diagnosis,
    notes: next.notes || previous.notes,
    vitals: { ...previous.vitals, ...next.vitals },
    medicines,
    labTests: [...new Set([...previous.labTests, ...next.labTests])],
    followUpInDays: next.followUpInDays ?? previous.followUpInDays,
    // Checked again over the joined list: a flag points at a medicine by
    // its position, and the positions have just changed.
    flags: [
      ...next.flags.filter((f) => f.kind === "engine"),
      ...checkDraft({ medicines, transcript: context.transcript, allergies: context.allergies }),
    ],
    engine: { ...next.engine, model: next.engine.model ?? previous.engine.model },
  };
}

export async function buildDraft(input: {
  transcript: string;
  patient: PatientContext;
  host: AssistantHost;
  reader: ModelReader | null;
  /** A pass made while still listening: by rule alone is expected, so
   *  the draft does not apologise for having no model. */
  quiet?: boolean;
}): Promise<DraftResult> {
  const transcript = input.transcript.trim();
  const [labCatalogue, habits] = await Promise.all([input.host.labCatalogue(), input.host.habits()]);

  const rules = structureLocally(transcript, labCatalogue);
  const flags: Flag[] = [];

  // ── Is a model needed at all? ──────────────────────────────────────
  // Enough only when nothing was left over. A dictated note whose first
  // word was clipped ("...fever and dry cough for three days. Diagnosis
  // viral fever") names a section and covers most of the text, and still
  // has a complaint the rules could not place -- which is what the model
  // is for.
  const rulesAreEnough = rules.hasSections && rules.coverage >= RULES_ARE_ENOUGH && rules.leftover.length === 0;
  let note: ModelNote | null = null;
  let usage: ModelUsage | null = null;
  let reason: string;

  if (rulesAreEnough) {
    reason = "The note named its own sections, so no model was used.";
  } else if (!input.reader && input.quiet) {
    reason = "Still listening.";
  } else if (!input.reader) {
    reason = "No language model is set up, so only what could be read by rule is filled in.";
    flags.push({ level: "info", kind: "engine", message: "The complaint and history were not summarised: the assistant's language model is not set up on this deployment. Type them in, or dictate them starting with the words \"complaint\" and \"diagnosis\"." });
  } else {
    try {
      const scrubbed = removeIdentifiers(transcript, input.patient);
      const result = await input.reader.read({
        transcript: scrubbed,
        patient: {
          age: input.patient.age,
          gender: input.patient.gender,
          allergies: input.patient.allergies,
          chronicConditions: input.patient.chronicConditions,
        },
        labCatalogue,
        usualMedicines: habits.slice(0, 40).map((h) => h.drugName),
      });
      note = result.note;
      usage = result.usage;
      reason = "A conversation, read by the language model and checked by rule.";
    } catch (error) {
      // The rules' reading is still a useful draft, and a consultation
      // must never wait on a provider being up.
      reason = "The language model could not be reached, so only what could be read by rule is filled in.";
      flags.push({ level: "warning", kind: "engine", message: `The assistant's language model did not answer (${error instanceof Error ? error.message : "unknown error"}). The numbers and medicines below were read by rule; the complaint and history need typing.` });
    }
  }

  // ── Medicines: one list from every reader ──────────────────────────
  let medicines = mergeMedicines(note ? fromModel(note) : [], rules.medicines);
  medicines = [...medicines, ...habitMentions(transcript, habits, medicines)];
  const resolved = await Promise.all(medicines.map((m) => resolveMedicine(m, habits, input.host)));

  // ── Everything else ────────────────────────────────────────────────
  // A number read by rule was matched exactly; the model's is used only
  // where the rules found none.
  const vitals = { ...rules.vitals };
  if (note) {
    for (const key of ["bp", "temp", "spo2", "weight", "pulse"] as const) {
      const value = note.vitals[key]?.trim();
      if (!vitals[key] && value && value.length <= 20) vitals[key] = value;
    }
  }

  const labTests = new Set(rules.labTests);
  // Only tests this clinic can actually order; a model's own wording for
  // one is not a test on the list.
  for (const name of note?.labTests ?? []) if (labCatalogue.includes(name)) labTests.add(name);

  const modelFollowUp = note && note.followUpInDays >= 1 && note.followUpInDays <= 365 ? Math.round(note.followUpInDays) : null;

  const draft: Draft = {
    chiefComplaint: clip(note?.chiefComplaint || rules.chiefComplaint, 1000),
    hopi: clip(note?.hopi || rules.hopi, 2000),
    diagnosis: clip(note?.diagnosis || rules.diagnosis, 1000),
    notes: clip(note?.advice || rules.advice, 2000),
    vitals,
    medicines: resolved,
    labTests: [...labTests],
    followUpInDays: rules.followUpInDays ?? modelFollowUp,
    flags: [
      ...flags,
      ...checkDraft({ medicines: resolved, transcript, allergies: input.patient.allergies ?? null }),
    ],
    leftover: (note ? note.unplaced : rules.leftover).map((s) => clip(s, 300)).filter(Boolean).slice(0, 20),
    sources: rules.sources,
    engine: { rules: true, model: usage?.model ?? null, reason },
  };

  return { draft, usage };
}
