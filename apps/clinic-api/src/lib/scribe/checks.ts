/**
 * What a draft is made of, and the checks on it that are code, not a model.
 *
 * A model's output is a proposal. These are the things about it that can
 * be verified without asking another model: that the sentence a line
 * claims to come from is really in the transcript, that a medicine does
 * not match the patient's allergies, that a line has a dose. Each failure
 * becomes a flag the doctor reads before confirming -- never a silent
 * correction, and never a refusal to show the draft.
 *
 * Pure, like structure.ts, and tested with it.
 */

import type { Frequency, LocalMedicine } from "./structure.js";

export interface DrugCandidate {
  id: string;
  name: string;
  composition: string | null;
}

export interface DraftMedicine {
  /** The name as it was heard. Kept beside the matched name on screen. */
  spoken: string;
  drugId: string | null;
  drugName: string;
  composition: string | null;
  /** Where the name was matched: the doctor's own past prescriptions,
   *  the medicine catalogue, or nowhere. */
  match: "habit" | "catalogue" | "none";
  /** A spelling-tolerant match rather than a literal one. */
  approximate: boolean;
  alternatives: DrugCandidate[];
  dosage: string;
  frequency: Frequency | "";
  duration: string;
  instructions: string;
  source: string;
  /** Things said about this line that are not problems: "dose is your
   *  usual for this medicine, it was not heard". */
  notes: string[];
}

export interface Flag {
  level: "danger" | "warning" | "info";
  kind: "allergy" | "missing" | "unmatched" | "duplicate" | "unverified" | "conflict" | "engine";
  message: string;
  /** Index into the draft's medicines, when the flag is about one. */
  medicine?: number;
}

export interface Draft {
  chiefComplaint: string;
  hopi: string;
  diagnosis: string;
  notes: string;
  vitals: { bp?: string; temp?: string; spo2?: string; weight?: string; pulse?: string };
  medicines: DraftMedicine[];
  labTests: string[];
  followUpInDays: number | null;
  flags: Flag[];
  /** Said, but placed nowhere above. */
  leftover: string[];
  /** Field -> the transcript text it was read from. */
  sources: Record<string, string>;
  /** What did the work, so the cost of a note is never a guess. */
  engine: { rules: true; model: string | null; reason: string };
}

/** Lowercased words of three letters or more, for loose comparison. */
function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9ऀ-ॿ]+/u).filter((w) => w.length >= 3);
}

/** The first meaningful word of a medicine's name: how two mentions of
 *  the same medicine are recognised as one. */
export function nameKey(name: string): string {
  const skip = new Set(["tab", "tablet", "tablets", "cap", "capsule", "capsules", "syp", "syrup", "inj", "injection"]);
  return words(name).find((w) => !skip.has(w)) ?? "";
}

/**
 * One list from two readers.
 *
 * The model reads names well and the rules read doses exactly. Where both
 * found the same medicine the model's line is kept and any field it left
 * empty is filled from the rules; a medicine only the rules found is
 * added, because a missed medicine is the error that is hardest to notice
 * on a draft.
 */
export function mergeMedicines(fromModel: LocalMedicine[], fromRules: LocalMedicine[]): LocalMedicine[] {
  const merged = fromModel.map((m) => ({ ...m }));
  for (const rule of fromRules) {
    const key = nameKey(rule.spoken);
    const twin = key ? merged.find((m) => nameKey(m.spoken) === key) : undefined;
    if (!twin) {
      merged.push({ ...rule });
      continue;
    }
    twin.dosage ||= rule.dosage;
    twin.frequency ||= rule.frequency;
    twin.duration ||= rule.duration;
    twin.instructions ||= rule.instructions;
    twin.source ||= rule.source;
  }
  return merged;
}

/** Whitespace and case ignored: a model may tidy a quote's spacing. */
function squash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function quoteIsInTranscript(quote: string, transcript: string): boolean {
  const q = squash(quote);
  if (!q) return false;
  const t = squash(transcript);
  if (t.includes(q)) return true;
  // A quote trimmed or lightly reworded still shares nearly all its words.
  const qw = words(quote);
  if (qw.length === 0) return false;
  const tw = new Set(words(transcript));
  return qw.filter((w) => tw.has(w)).length / qw.length >= 0.8;
}

/**
 * The patient's allergies against one medicine.
 *
 * Compared with the brand name AND the composition: an allergy is written
 * as a salt ("penicillin", "sulfa") and a prescription as a brand, so a
 * check on the name alone would pass almost everything it exists to stop.
 */
/**
 * Allergies are recorded as a family far more often than as a salt:
 * "penicillin", "sulfa drugs", "NSAIDs". A patient whose file says
 * penicillin must be flagged for amoxycillin, which does not contain the
 * word. Each family is the word on the file against what marks its
 * members in a composition.
 *
 * Short and deliberately conservative: the families a general practice
 * meets, where membership is not in dispute. It widens a warning; it
 * never clears one. A match here is worded as "may be related".
 */
const ALLERGY_FAMILIES: { onFile: RegExp; member: RegExp }[] = [
  { onFile: /penicillin/, member: /cillin|amoxyclav|co-amoxiclav/ },
  { onFile: /sul(?:f|ph)a/, member: /sul(?:f|ph)a|cotrimoxazole|co-trimoxazole/ },
  { onFile: /nsaid|pain ?killer|aspirin|brufen/, member: /ibuprofen|diclofenac|aceclofenac|naproxen|ketorolac|piroxicam|mefenamic|nimesulide|aspirin|etoricoxib|indomethacin/ },
  { onFile: /cephalosporin/, member: /\bcef|\bceph/ },
  { onFile: /quinolone|floxacin/, member: /floxacin/ },
];

/** Words on an allergy line that name no substance. */
const ALLERGY_FILLER = new Set(["drug", "drugs", "group", "class", "allergy", "allergic", "tablet", "tablets", "medicine", "medicines", "injection", "based"]);

function allergyHit(allergies: string, medicine: DraftMedicine): { allergen: string; related: boolean } | null {
  const haystack = `${medicine.drugName} ${medicine.composition ?? ""} ${medicine.spoken}`.toLowerCase();
  for (const allergen of allergies.split(/[,;/\n]+/)) {
    const term = allergen.trim().toLowerCase();
    if (term.length < 4) continue;
    // Each substance word on the line, so "sulfa drugs" is checked as
    // "sulfa". "Penicillins" on file, "Penicillin" in a composition.
    for (const word of term.split(/\s+/)) {
      const stem = word.replace(/[^a-z0-9-]/g, "").replace(/s$/, "");
      if (stem.length < 4 || ALLERGY_FILLER.has(stem) || ALLERGY_FILLER.has(word)) continue;
      if (haystack.includes(stem)) return { allergen: allergen.trim(), related: false };
    }
    for (const family of ALLERGY_FAMILIES) {
      if (family.onFile.test(term) && family.member.test(haystack)) return { allergen: allergen.trim(), related: true };
    }
  }
  return null;
}

const PER_DAY: Record<string, number> = { OD: 1, BD: 2, TDS: 3, QID: 4 };

/** How many times a day a "1-0-1" pattern says, or null if it is not one. */
function timesPerDay(dosage: string): number | null {
  const slots = dosage.split("-").map((s) => s.trim());
  if (slots.length < 2 || slots.length > 4 || !slots.every((s) => /^(?:\d{1,2}(?:\.\d)?|\d\/\d)$/.test(s))) return null;
  return slots.filter((s) => s !== "0").length;
}

/**
 * The salts in a medicine: "Paracetamol (650mg) + Caffeine (30mg)".
 *
 * A medicine a doctor added by hand has no composition on file, and is
 * usually named for its salt ("Paracetamol 650mg Tablet"). For those the
 * first word of the name stands in -- only for those, because the first
 * word of a brand ("Pan 40", "Pan D") is not a salt and two brands
 * sharing one are not the same medicine.
 */
function salts(medicine: { composition: string | null; drugName: string }): string[] {
  const listed = (medicine.composition ?? "")
    .split(/\+|,/)
    .map((part) => part.replace(/\(.*?\)/g, "").trim().toLowerCase())
    .filter((s) => s.length >= 4);
  if (listed.length > 0) return listed;
  const named = nameKey(medicine.drugName);
  return named.length >= 6 ? [named] : [];
}

export function checkDraft(input: { medicines: DraftMedicine[]; transcript: string; allergies: string | null }): Flag[] {
  const flags: Flag[] = [];
  const seen = new Map<string, number>();

  input.medicines.forEach((m, i) => {
    const label = m.drugName || m.spoken;

    if (input.allergies) {
      const hit = allergyHit(input.allergies, m);
      if (hit) {
        flags.push({
          level: "danger", kind: "allergy", medicine: i,
          message: hit.related
            ? `${label}: this patient's file lists an allergy to ${hit.allergen}, and this medicine may be related to it.`
            : `${label}: this patient's file lists an allergy to ${hit.allergen}.`,
        });
      }
    }

    if (m.match === "none") {
      flags.push({ level: "warning", kind: "unmatched", medicine: i, message: `"${m.spoken}" was not found in the medicine list. Check the name.` });
    } else if (m.approximate) {
      flags.push({ level: "warning", kind: "unmatched", medicine: i, message: `"${m.spoken}" was matched to ${m.drugName} by a close spelling. Check it is the one you meant.` });
    }

    const missing = [!m.dosage && "dose", !m.frequency && "frequency", !m.duration && "duration"].filter(Boolean);
    if (missing.length > 0) {
      flags.push({ level: "warning", kind: "missing", medicine: i, message: `${label}: the ${missing.join(" and ")} ${missing.length === 1 ? "was" : "were"} not heard.` });
    }

    // "1-0-1" beside "TDS": two readings of the same sentence that do not
    // agree. One of them is wrong and only the doctor knows which.
    const perDay = timesPerDay(m.dosage);
    if (perDay !== null && PER_DAY[m.frequency] !== undefined && PER_DAY[m.frequency] !== perDay) {
      flags.push({ level: "warning", kind: "conflict", medicine: i, message: `${label}: the dose ${m.dosage} and the frequency ${m.frequency} do not agree. Check which was meant.` });
    }

    if (!quoteIsInTranscript(m.source, input.transcript)) {
      flags.push({ level: "warning", kind: "unverified", medicine: i, message: `${label}: this line could not be traced to what was said. Check it carefully.` });
    }

    const key = m.drugId ?? nameKey(label);
    if (key) {
      if (seen.has(key)) flags.push({ level: "warning", kind: "duplicate", medicine: i, message: `${label} appears twice.` });
      else seen.set(key, i);
    }

    // Two brands of one salt. "Paracetamol and Dolo" is paracetamol
    // twice, and nothing about the two names says so.
    for (const salt of salts(m)) {
      const other = input.medicines.findIndex((o, x) => x < i && (o.drugId ?? o.drugName) !== (m.drugId ?? m.drugName) && salts(o).includes(salt));
      if (other >= 0) {
        const name = salt.charAt(0).toUpperCase() + salt.slice(1);
        flags.push({ level: "warning", kind: "duplicate", medicine: i, message: `${label} and ${input.medicines[other]!.drugName || input.medicines[other]!.spoken} both contain ${name}. Check both are meant.` });
        break;
      }
    }
  });

  return flags;
}

/** Everything on file that says WHO this is, as opposed to what is wrong. */
export interface Identifiers {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  uhid?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  /** Other people in the room by name: the doctor, most often. */
  otherNames?: (string | null | undefined)[];
}

/** Words in an address that are not a place, and may well be said about
 *  an illness ("admitted to hospital"). Left alone. */
const ADDRESS_FILLER = new Set([
  "hospital", "clinic", "road", "street", "lane", "near", "opposite", "behind", "main", "nagar", "colony", "society",
  "house", "flat", "floor", "building", "apartment", "post", "taluka", "district", "dist", "city", "village", "gaon",
  "east", "west", "north", "south", "chowk", "peth", "galli", "wadi", "plot", "block", "room", "number", "india",
]);

function removeWord(text: string, word: string, replacement: string): string {
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu"), replacement);
}

/**
 * Who the patient is, taken out of the transcript before it is sent to a
 * language model.
 *
 * The model needs what was said about the illness, not who it was said
 * to. So everything the clinic has on file that identifies a person is
 * removed wherever it was said aloud: each word of their name, their
 * phone number, where they live, their file number, their emergency
 * contact, and the doctor's own name. Then the shapes an identifier
 * takes whoever it belongs to -- an email address, any long run of
 * digits -- so a relative's phone number read out in the room goes too.
 *
 * ── What this cannot do ──────────────────────────────────────────────
 *
 * Remove a name it was never told. A relative greeted by name, or an
 * employer mentioned in passing, is not on the patient's file and stays
 * in. It makes the text hard to tie to a person; it does not make it
 * anonymous, and nothing in the product should say that it does.
 */
export function removeIdentifiers(transcript: string, patient: Identifiers): string {
  let out = transcript;

  const names: [string, string][] = [
    [patient.name, "the patient"],
    [patient.emergencyContactName ?? "", "a relative"],
    ...(patient.otherNames ?? []).map((n): [string, string] => [(n ?? "").replace(/^\s*dr\.?\s+/i, ""), "the doctor"]),
  ];
  for (const [name, as] of names) {
    for (const part of name.split(/\s+/)) {
      const word = part.replace(/[^\p{L}]/gu, "");
      if (word.length >= 3) out = removeWord(out, word, as);
    }
  }

  for (const part of (patient.address ?? "").split(/[\s,./-]+/)) {
    const word = part.replace(/[^\p{L}]/gu, "");
    if (word.length >= 4 && !ADDRESS_FILLER.has(word.toLowerCase())) out = removeWord(out, word, "[place]");
  }

  if (patient.uhid) out = out.split(patient.uhid).join("[file number]");
  if (patient.email) out = out.split(patient.email).join("[email]");
  out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]");

  // Any run of ten or more digits, however it is spaced, is a phone
  // number or an identity number. Neither belongs in the prompt.
  out = out.replace(/(?:\d[\s-]?){10,}/g, "[number] ");
  for (const phone of [patient.phone, patient.emergencyContactPhone]) {
    const digits = (phone ?? "").replace(/\D/g, "");
    if (digits.length >= 6) out = out.split(digits).join("[number]");
  }
  return out;
}
