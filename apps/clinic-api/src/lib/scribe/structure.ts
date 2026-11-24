/**
 * The assistant's own structuring layer: rules, no model, no network.
 *
 * ── Why this exists ──────────────────────────────────────────────────
 *
 * A language model can turn a consultation into a note, and every call to
 * one costs money. A large part of what a doctor says is not prose that
 * needs understanding, though. "BP 130 by 80", "Tab Dolo 650 twice a day
 * for five days", "come back after one week" are the same few shapes said
 * the same few ways, in three languages, and a pattern reads them exactly
 * and for nothing.
 *
 * So everything that has a shape is read here first. The model, when it
 * is called at all, is left with the part that actually needs judgment --
 * what the complaint was, what the history is -- and its answer about a
 * number is checked against this one. A dictated note that names its own
 * sections is finished here and never reaches a model.
 *
 * ── What it must never do ────────────────────────────────────────────
 *
 * Guess. Every value returned was matched in the text, and carries the
 * text it came from. A dose that was not said is an empty string. Nothing
 * here knows what a medicine "usually" is.
 *
 * Pure on purpose: text in, structure out, so the rules that decide what
 * lands on a prescription can be tested against real sentences.
 */

export type Frequency = "OD" | "BD" | "TDS" | "QID" | "SOS" | "STAT";

export interface LocalVitals {
  bp?: string;
  temp?: string;
  spo2?: string;
  weight?: string;
  pulse?: string;
}

export interface LocalMedicine {
  /** The name as it was said, form word removed: "dolo 650". */
  spoken: string;
  dosage: string;
  frequency: Frequency | "";
  duration: string;
  instructions: string;
  /** The stretch of transcript this was read from. */
  source: string;
}

export interface LocalDraft {
  chiefComplaint: string;
  hopi: string;
  diagnosis: string;
  advice: string;
  vitals: LocalVitals;
  medicines: LocalMedicine[];
  labTests: string[];
  followUpInDays: number | null;
  /** Field name -> the text it was read from. */
  sources: Record<string, string>;
  /** Sentences nothing above accounts for. */
  leftover: string[];
  /** The speaker labelled their own sections ("complaint ...", "diagnosis ..."). */
  hasSections: boolean;
  /** Share of the transcript that was placed somewhere, 0 to 1. */
  coverage: number;
}

// ── Numbers, in the three languages a consultation here is spoken in ──

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/** Number words that are unambiguous wherever they appear. */
const NUMBER_WORDS: Record<string, number> = {
  // English
  // Zero is how a skipped slot is said: "one zero one".
  zero: 0, "शून्य": 0,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twelve: 12, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30,
  // Hindi and Marathi, Devanagari
  "एक": 1, "दो": 2, "दोन": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "पाच": 5,
  "छह": 6, "छे": 6, "सहा": 6, "सात": 7, "आठ": 8, "नौ": 9, "नऊ": 9, "दस": 10, "दहा": 10,
  "पंद्रह": 15, "पंधरा": 15, "बीस": 20, "वीस": 20, "तीस": 30,
  // Hindi in Latin script, only the ones that are not also English words
  ek: 1, teen: 3, paanch: 5, panch: 5, saat: 7, aath: 8, das: 10,
};

/**
 * Latin-script Hindi numbers that are ALSO ordinary English words.
 *
 * "do" is two and "char" is four, and "do an ECG" must not become "2 an
 * ECG". These convert only directly before a word that makes the meaning
 * certain.
 */
const AMBIGUOUS_NUMBER_WORDS: Record<string, number> = { do: 2, char: 4, chhe: 6, nau: 9 };
const UNIT_AFTER = "(?:din|dino|baar|bar|hafte|hafta|mahine|mahina|goli|goliyan|tablet|tablets|vela|divas|days?|weeks?|times?)";

/** The same text with every number as digits. Length is not preserved. */
export function normaliseNumbers(text: string): string {
  let out = text.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
  out = out.replace(
    new RegExp(`\\b(${Object.keys(AMBIGUOUS_NUMBER_WORDS).join("|")})(\\s+${UNIT_AFTER})\\b`, "gi"),
    (_m, word: string, rest: string) => `${AMBIGUOUS_NUMBER_WORDS[word.toLowerCase()]}${rest}`,
  );
  // Token by token: \b does not see Devanagari letters as word characters,
  // so a regex alternation would match inside longer words.
  out = out
    .split(/(\s+)/)
    .map((token) => {
      const bare = token.replace(/[.,;:!?।]+$/u, "");
      const tail = token.slice(bare.length);
      const n = NUMBER_WORDS[bare.toLowerCase()];
      return n === undefined ? token : `${n}${tail}`;
    })
    .join("");
  return out;
}

// ── Sentences ─────────────────────────────────────────────────────────

/** Split on full stops, question marks, the danda and line breaks. A full
 *  stop between digits ("98.6") or after a form word ("Tab.") is not one. */
export function sentences(text: string): string[] {
  return text
    .replace(/(\d)\.(\d)/g, "$1<DOT>$2")
    .replace(/\b(tab|cap|syp|inj|dr|mr|mrs)\./gi, "$1<DOT>")
    .split(/[.?!।\n]+/u)
    .map((s) => s.replace(/<DOT>/g, ".").trim())
    .filter(Boolean);
}

// ── Vitals ────────────────────────────────────────────────────────────

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Vitals said aloud.
 *
 * Each is range-checked, and a number outside what a living patient can
 * have is dropped rather than recorded: "pulse 650" is the speech engine
 * joining "pulse" to the "650" of the medicine said next.
 */
export function readVitals(text: string): { vitals: LocalVitals; sources: Record<string, string> } {
  const t = normaliseNumbers(text);
  const vitals: LocalVitals = {};
  const sources: Record<string, string> = {};

  const bp = /(?:\b(?:bp|b\.p\.|blood pressure)\b|बीपी|ब्लड प्रेशर)[^\d]{0,20}(\d{2,3})\s*(?:\/|by|over|बाय|बटा)\s*(\d{2,3})/iu.exec(t);
  if (bp && inRange(Number(bp[1]), 60, 260) && inRange(Number(bp[2]), 30, 160)) {
    vitals.bp = `${bp[1]}/${bp[2]}`;
    sources.bp = bp[0];
  }

  const temp = /(?:\b(?:temp|temperature)\b|तापमान|टेम्परेचर)[^\d]{0,20}(\d{2,3}(?:\.\d)?)/iu.exec(t);
  if (temp) {
    const v = Number(temp[1]);
    // Fahrenheit or Celsius; anything else is not a body temperature.
    if (inRange(v, 94, 108) || inRange(v, 34, 42)) {
      vitals.temp = temp[1]!;
      sources.temp = temp[0];
    }
  }

  const spo2 = /(?:\b(?:spo2|sp o2|spo 2|saturation|oxygen)\b|ऑक्सीजन|ऑक्सिजन|सैचुरेशन)[^\d]{0,20}(\d{2,3})/iu.exec(t);
  if (spo2 && inRange(Number(spo2[1]), 50, 100)) {
    vitals.spo2 = spo2[1]!;
    sources.spo2 = spo2[0];
  }

  const pulse = /(?:\b(?:pulse|heart rate|hr)\b|नाडी|नब्ज़|नब्ज|पल्स)[^\d]{0,20}(\d{2,3})(?!\s*(?:mg|ml|mcg))/iu.exec(t);
  if (pulse && inRange(Number(pulse[1]), 30, 220)) {
    vitals.pulse = pulse[1]!;
    sources.pulse = pulse[0];
  }

  const weight = /(?:\b(?:weight|wt)\b|वजन|वज़न)[^\d]{0,20}(\d{1,3}(?:\.\d)?)/iu.exec(t);
  if (weight && inRange(Number(weight[1]), 1, 300)) {
    vitals.weight = weight[1]!;
    sources.weight = weight[0];
  }

  return { vitals, sources };
}

// ── How a medicine is to be taken ─────────────────────────────────────

const SLOT = "(?:\\d|½|1\\/2)";

interface Schedule {
  frequency: Frequency | "";
  dosage: string;
}

/**
 * Frequency phrases, most specific first. The first that matches wins, so
 * "morning and night" is read as twice a day before "morning" alone can
 * make it once.
 */
const SCHEDULES: { pattern: RegExp; frequency: Frequency; dosage: string }[] = [
  { pattern: /\b(?:bd|bid|b\.d|twice|2 times|2 baar|2 bar)\b|2 बार|दोनदा|2 वेळा|सुबह[- ]?शाम|सकाळ[- ]?संध्याकाळ|morning and (?:night|evening)/iu, frequency: "BD", dosage: "1-0-1" },
  { pattern: /\b(?:tds|tid|t\.d\.s|thrice|3 times|3 baar|3 bar)\b|3 बार|तीनदा|3 वेळा/iu, frequency: "TDS", dosage: "1-1-1" },
  { pattern: /\b(?:qid|qds|4 times|4 baar)\b|4 बार|4 वेळा/iu, frequency: "QID", dosage: "1-1-1-1" },
  // As needed and at once are not times-per-day, so they set no pattern.
  { pattern: /\b(?:sos|prn|if needed|when needed|as needed|when required|if required)\b|जरूरत|ज़रूरत|गरज|लागल्यास/iu, frequency: "SOS", dosage: "" },
  { pattern: /\b(?:stat|immediately|right now)\b|अभी तुरंत|लगेच/iu, frequency: "STAT", dosage: "" },
  { pattern: /\b(?:hs|at night|at bedtime|bedtime|night only|raat ko|ratri)\b|रात को|रात में|रात्री|झोपताना|सोते समय/iu, frequency: "OD", dosage: "0-0-1" },
  { pattern: /\b(?:morning only|in the morning|every morning|subah)\b|सुबह|सकाळी/iu, frequency: "OD", dosage: "1-0-0" },
  { pattern: /\b(?:od|o\.d|once|1 time|1 baar|1 bar|daily)\b|1 बार|एकदा|1 वेळा|रोज/iu, frequency: "OD", dosage: "1-0-0" },
];

const SLOT_COUNT_TO_FREQUENCY: Record<number, Frequency> = { 1: "OD", 2: "BD", 3: "TDS", 4: "QID" };

export function readSchedule(clause: string): Schedule {
  const t = normaliseNumbers(clause).toLowerCase();

  // "1-0-1", and "1 0 1" as a speech engine writes "one zero one".
  const explicit =
    new RegExp(`(?<![\\d/])(${SLOT})\\s*[-–]\\s*(${SLOT})\\s*[-–]\\s*(${SLOT})(?:\\s*[-–]\\s*(${SLOT}))?(?![\\d/])`).exec(t) ??
    /(?<![\d.\/])([0-2])\s+([0-2])\s+([0-2])(?![\d.\/]|\s*(?:mg|ml|days?|din|दिन|दिवस))/u.exec(t);
  let dosage = "";
  let frequency: Frequency | "" = "";
  if (explicit) {
    const slots = explicit.slice(1).filter((s): s is string => s !== undefined).map((s) => (s === "½" ? "1/2" : s));
    dosage = slots.join("-");
    const active = slots.filter((s) => s !== "0").length;
    frequency = SLOT_COUNT_TO_FREQUENCY[active] ?? "";
  }

  for (const s of SCHEDULES) {
    if (!s.pattern.test(t)) continue;
    // A stated pattern is the dose; a phrase beside it only settles the
    // frequency when the pattern did not ("1-0-1 if needed" is SOS).
    if (s.frequency === "SOS" || s.frequency === "STAT") frequency = s.frequency;
    else if (!frequency) frequency = s.frequency;
    if (!dosage) dosage = s.dosage;
    break;
  }
  return { frequency, dosage };
}

const DURATION = /(\d{1,3})\s*(days?|din|dino|दिन|दिवस|weeks?|wk|hafte|hafta|हफ्ते|हफ़्ते|हफ्ता|सप्ताह|आठवडे|आठवडा|months?|mahine|mahina|महीने|महीना|महिने|महिना)/iu;

function unitOf(word: string): "day" | "week" | "month" {
  const w = word.toLowerCase();
  if (/^(week|wk|haft|हफ|सप्ताह|आठवड)/u.test(w)) return "week";
  if (/^(month|mahin|महीन|महिन)/u.test(w)) return "month";
  return "day";
}

/** "5 days", in the form the pharmacy's quantity rule already reads. */
export function readDuration(clause: string): string {
  const m = DURATION.exec(normaliseNumbers(clause));
  if (!m) return "";
  const n = Number(m[1]);
  if (n <= 0) return "";
  const unit = unitOf(m[2]!);
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function durationInDays(duration: string): number | null {
  const m = /^(\d+) (day|week|month)s?$/.exec(duration);
  if (!m) return null;
  return Number(m[1]) * (m[2] === "week" ? 7 : m[2] === "month" ? 30 : 1);
}

export function readInstructions(clause: string): string {
  const t = clause.toLowerCase();
  if (/before (?:food|meal|meals|breakfast|lunch|dinner)|empty stomach|खाने से पहले|खाली पेट|जेवणापूर्वी|जेवणाआधी|उपाशी/u.test(t)) return "Before food";
  if (/after (?:food|meal|meals|eating|breakfast|lunch|dinner)|खाने के बाद|खाना खाने के बाद|जेवणानंतर|जेवल्यानंतर/u.test(t)) return "After food";
  return "";
}

// ── Medicines ─────────────────────────────────────────────────────────

/** Words that announce a medicine. Latin ones need a word boundary;
 *  Devanagari ones cannot have one (see normaliseNumbers). */
const FORM = "(?:\\b(?:tab|tablet|tablets|cap|capsule|capsules|syp|syrup|inj|injection|drops|ointment|cream|gel|lotion|inhaler|sachet)\\b\\.?|गोली|गोळी|टैबलेट|टॅबलेट|कैप्सूल|कॅप्सूल|सिरप|सीरप|इंजेक्शन)";

/** Where a medicine's name stops and how to take it begins. */
const NAME_STOP = new Set([
  "for", "x", "into", "to", "twice", "thrice", "once", "daily", "after", "before", "at", "in", "and", "with",
  "bd", "bid", "od", "tds", "tid", "qid", "sos", "stat", "hs", "if", "when", "as", "morning", "night", "every",
  "times", "time", "baar", "bar", "din", "days", "day", "subah", "raat", "then", "also", "is", "the", "take", "give",
  "की", "का", "के", "को", "दिन", "दिवस", "बार", "वेळा", "सुबह", "रात", "सकाळी", "रात्री", "रोज", "और", "आणि", "लेना", "घ्या", "दो", "एक",
]);

const STRENGTH = /^\d+(?:\.\d+)?(?:mg|ml|mcg|g|iu)?$/i;

/**
 * The name that follows a form word: up to three words and one strength.
 *
 * Stops at the first word that begins the instructions, and at a bare
 * small number, which is a dose ("Tab Pan 1 0 0") and not a strength.
 */
function nameAfter(rest: string): string {
  const tokens = rest.trim().split(/[\s,]+/).filter(Boolean);
  const name: string[] = [];
  let strength = false;
  for (const raw of tokens) {
    const token = raw.replace(/[.,;:]+$/, "");
    if (!token) break;
    const lower = token.toLowerCase();
    if (NAME_STOP.has(lower)) break;
    if (STRENGTH.test(token)) {
      const bare = Number.parseFloat(token);
      const hasUnit = /[a-z]/i.test(token);
      // "650" is a strength; "1" is the start of "1-0-1".
      if (strength || name.length === 0 || (!hasUnit && bare < 5)) break;
      name.push(token);
      strength = true;
      continue;
    }
    if (/^[-–]/.test(token) || /^\d/.test(token)) break;
    if (name.length >= 3) break;
    name.push(token);
  }
  return name.join(" ");
}

export function readMedicines(text: string): LocalMedicine[] {
  const out: LocalMedicine[] = [];
  for (const sentence of sentences(text)) {
    const finder = new RegExp(FORM, "giu");
    const starts: { at: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = finder.exec(sentence))) starts.push({ at: m.index, end: m.index + m[0].length });

    starts.forEach((start, i) => {
      // One medicine's words run until the next medicine is named.
      const clause = sentence.slice(start.at, starts[i + 1]?.at ?? sentence.length).trim();
      const spoken = nameAfter(normaliseNumbers(sentence.slice(start.end, starts[i + 1]?.at ?? sentence.length)));
      if (spoken.length < 3) return;
      const schedule = readSchedule(clause);
      out.push({
        spoken,
        dosage: schedule.dosage,
        frequency: schedule.frequency,
        duration: readDuration(clause),
        instructions: readInstructions(clause),
        source: clause,
      });
    });
  }
  return out;
}

// ── Follow-up ─────────────────────────────────────────────────────────

const FOLLOW_UP = /follow[- ]?up|review|come back|revisit|next visit|फॉलो ?अप|वापस आ|फिर से आ|फिर आ|दोबारा आ|परत या|पुन्हा या|दिखाना|दिखाइए|दाखवा|दाखवायला/iu;

export function readFollowUp(text: string): { days: number | null; source: string } {
  for (const sentence of sentences(text)) {
    if (!FOLLOW_UP.test(sentence)) continue;
    // A medicine's course is not a follow-up, even in the same breath.
    if (new RegExp(FORM, "iu").test(sentence)) continue;
    const days = durationInDays(readDuration(sentence));
    if (days !== null && days <= 365) return { days, source: sentence };
  }
  return { days: null, source: "" };
}

// ── Lab tests ─────────────────────────────────────────────────────────

/** How a test is said, against the word that identifies it in the
 *  clinic's own catalogue. Matched to the catalogue, never added to it. */
const LAB_ALIASES: { said: RegExp; catalogue: RegExp }[] = [
  { said: /\b(?:cbc|complete blood count|hemogram|haemogram)\b/i, catalogue: /cbc|complete blood count/i },
  { said: /\b(?:lft|liver function)\b/i, catalogue: /lft|liver function/i },
  { said: /\b(?:kft|rft|kidney function|renal function)\b/i, catalogue: /kft|kidney function/i },
  { said: /\b(?:lipid profile|lipid)\b/i, catalogue: /lipid/i },
  { said: /\b(?:thyroid|tsh|t3 t4)\b/i, catalogue: /thyroid|tsh/i },
  { said: /\bhba1c\b|\bhb a1c\b|glycated/i, catalogue: /hba1c/i },
  { said: /\b(?:fasting sugar|fasting blood sugar|fbs|sugar fasting)\b/i, catalogue: /sugar.*fasting|fasting/i },
  { said: /\b(?:pp sugar|ppbs|post ?prandial|sugar pp)\b/i, catalogue: /postprandial/i },
  { said: /\b(?:urine routine|urine test|urine r\/?m)\b/i, catalogue: /urine routine/i },
  { said: /\b(?:chest x[- ]?ray|x[- ]?ray chest|cxr)\b/i, catalogue: /chest x-?ray/i },
  { said: /\b(?:ecg|ekg)\b/i, catalogue: /^ecg$/i },
  { said: /\b(?:usg|ultrasound|sonography)\b/i, catalogue: /ultrasound/i },
  { said: /\bwidal\b/i, catalogue: /widal/i },
  { said: /\bdengue\b/i, catalogue: /dengue/i },
  { said: /\bmalaria\b/i, catalogue: /malaria/i },
  { said: /\besr\b/i, catalogue: /^esr$/i },
  { said: /\bcrp\b/i, catalogue: /^crp$/i },
  { said: /\b(?:vitamin d|vit d|d3)\b/i, catalogue: /vitamin d/i },
  { said: /\b(?:vitamin b12|vit b12|b12)\b/i, catalogue: /b12/i },
  { said: /\b(?:hemoglobin|haemoglobin|hb)\b/i, catalogue: /^hemoglobin$/i },
  { said: /\bstool\b/i, catalogue: /stool/i },
];

/** The clinic's own tests that were named. `catalogue` is its test list. */
export function readLabTests(text: string, catalogue: readonly string[]): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const name of catalogue) {
    if (name.length >= 4 && lower.includes(name.toLowerCase())) found.add(name);
  }
  for (const alias of LAB_ALIASES) {
    if (!alias.said.test(text)) continue;
    const hit = catalogue.find((name) => alias.catalogue.test(name));
    if (hit) found.add(hit);
  }
  return [...found];
}

// ── Sections a speaker names themselves ───────────────────────────────

const SECTION_CUES: { field: "chiefComplaint" | "hopi" | "diagnosis" | "advice"; cue: RegExp }[] = [
  { field: "chiefComplaint", cue: /(?:^|\s)(?:chief complaints?|complaints?|c\/o|complains? of|presenting with|तक्रार|शिकायत)\s*(?:is|are|of)?\s*[:\-]?\s*/iu },
  { field: "hopi", cue: /(?:^|\s)(?:history|hopi|h\/o|इतिहास)\s*(?:is|of)?\s*[:\-]?\s*/iu },
  { field: "diagnosis", cue: /(?:^|\s)(?:provisional diagnosis|diagnosis|impression|dx|निदान)\s*(?:is)?\s*[:\-]?\s*/iu },
  { field: "advice", cue: /(?:^|\s)(?:advice|advised|plan|सल्ला|सलाह)\s*(?:is)?\s*[:\-]?\s*/iu },
];

function readSections(text: string): { fields: Partial<Record<"chiefComplaint" | "hopi" | "diagnosis" | "advice", string>>; sources: Record<string, string> } {
  const fields: Partial<Record<"chiefComplaint" | "hopi" | "diagnosis" | "advice", string>> = {};
  const sources: Record<string, string> = {};
  for (const sentence of sentences(text)) {
    for (const { field, cue } of SECTION_CUES) {
      if (fields[field]) continue;
      const m = cue.exec(sentence);
      // The label has to open the sentence, or it is just a word in it:
      // "no history of diabetes" is not the history section.
      if (!m || m.index > 2) continue;
      const value = sentence.slice(m.index + m[0].length).trim();
      if (value.length < 2) continue;
      fields[field] = value.charAt(0).toUpperCase() + value.slice(1);
      sources[field] = sentence;
      break;
    }
  }
  return { fields, sources };
}

// ── The whole thing ───────────────────────────────────────────────────

export function structureLocally(transcript: string, labCatalogue: readonly string[] = []): LocalDraft {
  const text = transcript.trim();
  const { vitals, sources: vitalSources } = readVitals(text);
  const medicines = readMedicines(text);
  const followUp = readFollowUp(text);
  const labTests = readLabTests(text, labCatalogue);
  const sections = readSections(text);

  const sources: Record<string, string> = { ...vitalSources, ...sections.sources };
  if (followUp.days !== null) sources.followUp = followUp.source;

  // A sentence is accounted for when something above was read from it.
  const used = [...Object.values(sources), ...medicines.map((m) => m.source)];
  const all = sentences(text);
  const leftover = all.filter((s) => {
    if (s.length < 12) return false;
    if (used.some((u) => u.includes(s) || s.includes(u))) return false;
    if (readLabTests(s, labCatalogue).length > 0) return false;
    return true;
  });

  const total = all.reduce((n, s) => n + s.length, 0);
  const unplaced = leftover.reduce((n, s) => n + s.length, 0);

  return {
    chiefComplaint: sections.fields.chiefComplaint ?? "",
    hopi: sections.fields.hopi ?? "",
    diagnosis: sections.fields.diagnosis ?? "",
    advice: sections.fields.advice ?? "",
    vitals,
    medicines,
    labTests,
    followUpInDays: followUp.days,
    sources,
    leftover,
    hasSections: Boolean(sections.fields.chiefComplaint || sections.fields.diagnosis),
    coverage: total === 0 ? 0 : (total - unplaced) / total,
  };
}
