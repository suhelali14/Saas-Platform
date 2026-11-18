/**
 * Specialty records: one engine for every specialty.
 *
 * A gynaecologist asks about the last period at every visit; an antenatal
 * clinic keeps weight, BP, fundal height and Hb visit after visit for nine
 * months; an eye clinic records vision and refraction for each eye; a
 * paediatrician plots weight against age. Built as a screen per specialty,
 * that is twenty screens to keep working. Built as data, it is one: a form
 * is a versioned definition (the FHIR Questionnaire idea), a filled form is
 * a record of answers against it (QuestionnaireResponse), and a pregnancy
 * or an infertility treatment is an episode the visits belong to
 * (EpisodeOfCare).
 *
 * The rule that keeps old records readable: a field's key is never reused
 * or renamed. A field that should no longer be asked is marked `retired`,
 * so a record made with it still shows what was written.
 */

export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "multi" | "yesno" | "computed" | "table";
export type Formula = "edd" | "ga" | "bmi" | "cycle_day" | "age_at_visit";

export interface FormField {
  key: string;
  label: string;
  /** The card's own abbreviation (LMP, FH, Hb), for summaries and table
   *  columns. An empty string shows the answer without a label. */
  short?: string;
  type: FieldType;
  hint?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** select and multi */
  options?: string[];
  /** choices a clinic has since removed: still accepted on old records,
   *  no longer offered */
  retiredOptions?: string[];
  /** computed */
  formula?: Formula;
  /** table: its columns, simple types only */
  columns?: FormField[];
  /** table: fixed row labels (Right eye / Left eye, a vaccine schedule) */
  rows?: string[];
  /** table: whether rows beyond the fixed ones may be added */
  addRows?: boolean;
  /** takes a full line in the form */
  wide?: boolean;
  /** must be answered before the record can be saved */
  required?: boolean;
  /** group the field under a named section heading. A field with no
   *  section goes in the form's first (unnamed) section. */
  section?: string;
  /** show this field only when another field's answer matches. Hidden
   *  fields never fail required-ness and never count in compute(). */
  showIf?: { field: string; equals: string | boolean | number };
  /** kept so old records still read; not offered for new entry */
  retired?: boolean;
}

export interface FormSection {
  title: string;
  fields: FormField[];
}

/** history: one per patient, kept up to date. visit: one per visit.
 *  episode: a stretch of care with a start and an end. */
export type FormKind = "history" | "visit" | "episode";

export interface FormDef {
  key: string;
  version: number;
  title: string;
  specialty: string;
  kind: FormKind;
  /** Words matched against a doctor's speciality and department. */
  tags: string[];
  /** Who it is offered for, beyond the doctor's speciality. */
  suggest?: {
    gender?: "Female" | "Male";
    minAge?: number;
    maxAge?: number;
    category?: string;
    /** words matched against the patient's long-term conditions */
    conditions?: string[];
    /** not offered while one of these episodes is open */
    unlessOpen?: string[];
  };
  /** visit forms that are recorded within an episode */
  episodeKey?: string;
  /** episode: the visit forms recorded during it */
  visitForms?: string[];
  /** episode: concerns a couple, so a partner is linked */
  couple?: boolean;
  sections: FormSection[];
  /** episode: filled in when it ends */
  closeSections?: FormSection[];
  /** keys that make up its one-line summary and table columns */
  summary?: string[];
  /** numeric keys worth charting over time */
  trend?: string[];
  /** shown under the title */
  note?: string;
  custom?: boolean;
}

export interface ComputeContext {
  /** the visit's date, YYYY-MM-DD */
  recordedOn: string;
  /** the episode's own answers, for a visit inside one */
  episode?: Record<string, unknown> | null;
  patient?: { dob?: Date | string | null; age?: number | null };
}

// ── Dates ──────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(v: unknown): Date | null {
  if (typeof v !== "string" || !ISO.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y >= 1900 && y <= 2100 && d.toISOString().slice(0, 10) === v ? d : null;
}
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** A real calendar day as YYYY-MM-DD: not 30 February, not month 13. */
export const isValidDay = (v: unknown): v is string => parseDay(v) !== null;
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

/** Naegele's rule: the first day of the last period plus 280 days. */
export function eddFromLmp(lmp: string): string | null {
  const d = parseDay(lmp);
  return d ? isoDay(new Date(d.getTime() + 280 * DAY)) : null;
}

/**
 * Weeks and days of pregnancy on a given day. Dated from an early scan's
 * EDD when there is one (it corrects for an irregular cycle), otherwise
 * from the LMP.
 */
export function gestationalAge(on: string, episode: Record<string, unknown> | null | undefined): { weeks: number; days: number; text: string } | null {
  if (!episode) return null;
  const at = parseDay(on);
  const usg = parseDay(episode.usg_edd);
  const start = usg ? new Date(usg.getTime() - 280 * DAY) : parseDay(episode.lmp);
  if (!at || !start) return null;
  const total = daysBetween(start, at);
  if (total < 0 || total > 315) return null;
  const weeks = Math.floor(total / 7);
  const days = total % 7;
  return { weeks, days, text: `${weeks}w ${days}d` };
}

function ageAt(on: string, patient: ComputeContext["patient"]): string | null {
  const at = parseDay(on);
  const dob = patient?.dob ? new Date(patient.dob) : null;
  if (at && dob && !Number.isNaN(dob.getTime())) {
    let months = (at.getUTCFullYear() - dob.getUTCFullYear()) * 12 + (at.getUTCMonth() - dob.getUTCMonth());
    if (at.getUTCDate() < dob.getUTCDate()) months -= 1;
    if (months < 0) return null;
    if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
    const y = Math.floor(months / 12);
    const m = months % 12;
    return m ? `${y} years ${m} month${m === 1 ? "" : "s"}` : `${y} years`;
  }
  return patient?.age != null ? `${patient.age} years` : null;
}

/** Fills every computed field from the answers around it. */
export function compute(sections: FormSection[], data: Record<string, unknown>, ctx: ComputeContext): Record<string, unknown> {
  const out = { ...data };
  for (const f of sections.flatMap((s) => s.fields)) {
    if (f.type !== "computed") continue;
    let v: unknown = null;
    switch (f.formula) {
      case "edd":
        v = typeof out.lmp === "string" ? eddFromLmp(out.lmp) : null;
        break;
      case "ga":
        v = gestationalAge(ctx.recordedOn, ctx.episode ?? out)?.text ?? null;
        break;
      case "bmi": {
        const w = Number(out.weight ?? out.pre_weight);
        const h = Number(out.height) / 100;
        v = w > 0 && h > 0.3 ? Math.round((w / (h * h)) * 10) / 10 : null;
        break;
      }
      case "cycle_day": {
        const lmp = parseDay(out.cycle_lmp ?? out.lmp);
        const at = parseDay(ctx.recordedOn);
        const n = lmp && at ? daysBetween(lmp, at) + 1 : null;
        v = n && n >= 1 && n <= 120 ? n : null;
        break;
      }
      case "age_at_visit":
        v = ageAt(ctx.recordedOn, ctx.patient);
        break;
    }
    if (v === null || v === undefined) delete out[f.key];
    else out[f.key] = v;
  }
  return out;
}

// ── Cleaning what was sent ─────────────────────────────────────────────

const MAX_TEXT = 2000;
const MAX_LONG = 8000;
const MAX_ROWS = 60;
const MAX_BYTES = 60_000;

function cleanValue(f: FormField, v: unknown, errors: string[]): unknown {
  if (v === undefined || v === null || v === "") return undefined;
  switch (f.type) {
    case "text":
    case "textarea": {
      const s = String(v).trim();
      if (!s) return undefined;
      const max = f.type === "textarea" ? MAX_LONG : MAX_TEXT;
      if (s.length > max) errors.push(`${f.label} is too long.`);
      return s.slice(0, max);
    }
    case "number": {
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
      if (!Number.isFinite(n)) { errors.push(`${f.label} must be a number.`); return undefined; }
      if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
        errors.push(`${f.label} must be between ${f.min ?? "any"} and ${f.max ?? "any"}${f.unit ? ` ${f.unit}` : ""}.`);
        return undefined;
      }
      return n;
    }
    case "date": {
      if (!parseDay(v)) { errors.push(`${f.label} is not a valid date.`); return undefined; }
      return v;
    }
    case "select": {
      const s = String(v);
      if (!f.options?.includes(s) && !f.retiredOptions?.includes(s)) { errors.push(`${f.label}: "${s.slice(0, 40)}" is not one of the choices.`); return undefined; }
      return s;
    }
    case "multi": {
      if (!Array.isArray(v)) { errors.push(`${f.label} must be a list.`); return undefined; }
      const picked = [...new Set(v.map(String))];
      const bad = picked.filter((x) => !f.options?.includes(x) && !f.retiredOptions?.includes(x));
      if (bad.length) { errors.push(`${f.label}: "${bad[0]!.slice(0, 40)}" is not one of the choices.`); return undefined; }
      return picked.length ? picked : undefined;
    }
    case "yesno":
      if (typeof v === "boolean") return v;
      if (v === "yes" || v === "true") return true;
      if (v === "no" || v === "false") return false;
      errors.push(`${f.label} must be yes or no.`);
      return undefined;
    case "table": {
      if (!Array.isArray(v)) { errors.push(`${f.label} must be a list of rows.`); return undefined; }
      const cols = f.columns ?? [];
      const clean = (row: unknown) => {
        const o: Record<string, unknown> = {};
        if (row && typeof row === "object") {
          for (const c of cols) {
            const cv = cleanValue(c, (row as Record<string, unknown>)[c.key], errors);
            if (cv !== undefined) o[c.key] = cv;
          }
        }
        return o;
      };
      const out: Record<string, unknown>[] = [];
      const fixed = f.rows ?? [];
      const given = v.slice(0, MAX_ROWS + fixed.length);
      for (const label of fixed) {
        const src = given.find((r) => r && typeof r === "object" && (r as { row?: unknown }).row === label);
        const o = clean(src);
        if (Object.keys(o).length) out.push({ row: label, ...o });
      }
      if (!fixed.length || f.addRows) {
        for (const r of given) {
          const label = r && typeof r === "object" ? (r as { row?: unknown }).row : undefined;
          if (typeof label === "string" && fixed.includes(label)) continue;
          const o = clean(r);
          if (!Object.keys(o).length) continue;
          if (fixed.length && typeof label === "string" && label.trim()) o.row = label.trim().slice(0, 80);
          out.push(o);
          if (out.length >= MAX_ROWS + fixed.length) break;
        }
      }
      return out.length ? out : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Keeps only the answers the form asks for, in the shape it asks for them.
 * A retired field is still accepted, so editing an old record does not
 * silently drop what it holds. Computed fields are never taken from the
 * client; compute() fills them.
 */
export function cleanData(sections: FormSection[], raw: unknown): { data: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { data, errors: ["The answers must be an object."] };
  const answers = raw as Record<string, unknown>;
  const visible = (f: FormField) => !f.showIf || answerMatches(answers[f.showIf.field], f.showIf.equals);
  for (const f of sections.flatMap((s) => s.fields)) {
    if (f.type === "computed") continue;
    if (!visible(f)) continue; // hidden field: never required, never stored
    const v = cleanValue(f, answers[f.key], errors);
    if (v !== undefined) data[f.key] = v;
    // Required check: cleanValue returns undefined for blank/empty, so
    // this catches "nothing was entered" without having to know what
    // each type's empty looks like.
    else if (f.required && !f.retired) errors.push(`${f.label}: this is required.`);
  }
  if (JSON.stringify(data).length > MAX_BYTES) errors.push("This record is too large to save.");
  return { data, errors };
}

/** Does the viewer's answer match the rule's expected value?
 *  Yes-no fields store boolean; most others store string. Compared loosely
 *  so `showIf: { field: 'pregnant', equals: true }` and the raw answer
 *  `"true"` from a form that hasn't coerced yet still match. */
function answerMatches(answer: unknown, equals: string | boolean | number): boolean {
  if (answer === equals) return true;
  if (answer === null || answer === undefined) return false;
  return String(answer) === String(equals);
}

// ── Reading a record back as a line ────────────────────────────────────

export function longDay(v: string): string {
  const d = new Date(`${v}T12:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function show(f: FormField, v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (f.type === "yesno") return v ? "yes" : "no";
  if ((f.type === "date" || f.formula === "edd") && typeof v === "string") return longDay(v);
  if (Array.isArray(v)) return f.type === "table" ? `${v.length} ${f.short || (v.length === 1 ? "entry" : "entries")}` : v.join(", ");
  return `${v}${f.unit ? ` ${f.unit}` : ""}`;
}

/**
 * The record as one line -- "24w 3d · Weight 58 kg · BP 110/70 mmHg" --
 * for the day-by-day history and the episode card. Systolic and diastolic
 * read as one blood pressure, the way it is written on paper.
 */
export function describe(def: FormDef, data: Record<string, unknown>, limit = 7): string {
  const fields = def.sections.flatMap((s) => s.fields);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const keys = def.summary?.length ? def.summary : fields.filter((f) => f.type !== "table").map((f) => f.key);
  const parts: string[] = [];
  for (const k of keys) {
    if (parts.length >= limit) break;
    if (k === "bp_diastolic") continue;
    if (k === "bp_systolic") {
      if (data.bp_systolic != null && data.bp_diastolic != null) parts.push(`BP ${data.bp_systolic}/${data.bp_diastolic} mmHg`);
      continue;
    }
    const f = byKey.get(k);
    if (!f) continue;
    const s = show(f, data[k]);
    if (s === null) continue;
    const name = f.short ?? f.label.replace(/\s*\(.*?\)\s*/g, " ").trim();
    if (f.type === "table" || name === "" || (f.type === "computed" && (f.formula === "ga" || f.formula === "age_at_visit"))) parts.push(s);
    else if (f.type === "yesno") parts.push(`${name}: ${s}`);
    else parts.push(`${name} ${s}`);
  }
  return parts.join(" · ");
}

// ── PC-PNDT ────────────────────────────────────────────────────────────

// `\b` only knows Latin letters, so the Devanagari words sit outside it.
const SEX_WORD = /\b(sex|gender|male|female|boy|girl|ling)\b|लिंग/i;
const FETAL_WORD = /\b(f(o)?etus|f(o)?etal|unborn|baby|babies|pregnan\w*|usg|ultrasound|sonograph\w*|scan|garbh\w*)\b|गर्भ/i;

/**
 * A clinic adding its own fields cannot add one that records the sex of a
 * fetus. The PC-PNDT Act prohibits determining or disclosing it, a record
 * of it is evidence of exactly that, and a clinic's registration is what
 * is at risk. On a pregnancy form any mention of sex is refused; anywhere
 * else, a mention of sex alongside a fetus or a scan.
 */
export function pcpndtRefusal(text: string, form?: { key: string; tags: string[] }): string | null {
  if (!SEX_WORD.test(text)) return null;
  const obstetric = !!form && (form.key === "pregnancy" || form.key === "antenatal" || form.tags.some((t) => t.startsWith("obstet")));
  if (obstetric || FETAL_WORD.test(text)) {
    return `"${text.slice(0, 60)}" cannot be added: recording the sex of a fetus is prohibited under the PC-PNDT Act.`;
  }
  return null;
}

// ── A clinic's own fields ──────────────────────────────────────────────

const OWN_TYPES = new Set<FieldType>(["text", "textarea", "number", "date", "select", "multi", "yesno"]);

/**
 * Checks fields a clinic defines for itself, and gives each a key that is
 * then never changed: `c_` and the label, so it cannot collide with a
 * built-in key and stays readable in an export.
 *
 * A key sent back by the client is kept only if it is one of this form's
 * own earlier fields; a new field never gets a key that was ever used on
 * the form, retired or not, so an old record's answer can never be read
 * as the answer to a different question.
 */
export function cleanOwnFields(raw: unknown, form?: { key: string; tags: string[] }, previous: FormField[] = []): { fields: FormField[]; errors: string[] } {
  const earlier = new Set(previous.map((f) => f.key));
  const errors: string[] = [];
  const fields: FormField[] = [];
  if (!Array.isArray(raw)) return { fields, errors: ["Fields must be a list."] };
  if (raw.length > 40) errors.push("A form can have at most 40 of your own fields.");
  const used = new Set<string>();
  for (const r of raw.slice(0, 40)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const label = String(o.label ?? "").trim().slice(0, 80);
    const type = String(o.type ?? "text") as FieldType;
    if (!label) { errors.push("Every field needs a label."); continue; }
    if (!OWN_TYPES.has(type)) { errors.push(`${label}: unknown field type.`); continue; }
    const options = Array.isArray(o.options) ? [...new Set(o.options.map((x) => String(x).trim().slice(0, 60)).filter(Boolean))].slice(0, 30) : undefined;
    for (const t of [label, ...(options ?? [])]) {
      const no = pcpndtRefusal(t, form);
      if (no) errors.push(no);
    }
    if ((type === "select" || type === "multi") && !options?.length) { errors.push(`${label}: give the choices.`); continue; }
    const given = typeof o.key === "string" && earlier.has(o.key) ? o.key : null;
    let key = given ?? `c_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 36) || "field"}`;
    if (!given) { let n = 2; const base = key; while (used.has(key) || earlier.has(key)) key = `${base}_${n++}`; }
    if (used.has(key)) { errors.push(`${label}: two fields share a key.`); continue; }
    used.add(key);
    const f: FormField = { key, label, type };
    if (type === "number") {
      const unit = String(o.unit ?? "").trim().slice(0, 15);
      if (unit) f.unit = unit;
      if (Number.isFinite(Number(o.min)) && o.min !== "" && o.min !== null && o.min !== undefined) f.min = Number(o.min);
      if (Number.isFinite(Number(o.max)) && o.max !== "" && o.max !== null && o.max !== undefined) f.max = Number(o.max);
    }
    if (options && (type === "select" || type === "multi")) f.options = options;
    const hint = String(o.hint ?? "").trim().slice(0, 160);
    if (hint) f.hint = hint;
    if (o.required === true) f.required = true;
    if (o.wide === true) f.wide = true;
    const section = String(o.section ?? "").trim().slice(0, 60);
    if (section) f.section = section;
    // showIf: { field: string; equals: string|boolean|number }. Validated
    // but not resolved here -- the "does the referenced field exist?"
    // check happens in the route against the whole field list, because
    // this function runs on the custom fields in isolation.
    if (o.showIf && typeof o.showIf === "object" && !Array.isArray(o.showIf)) {
      const si = o.showIf as Record<string, unknown>;
      const fkey = typeof si.field === "string" ? si.field : "";
      const equals = si.equals;
      if (fkey && (typeof equals === "string" || typeof equals === "boolean" || typeof equals === "number")) {
        f.showIf = { field: fkey, equals };
      }
    }
    if (o.retired === true) f.retired = true;
    fields.push(f);
  }
  return { fields, errors };
}

/**
 * Lines a clinic's edited fields up against the ones it had, so no record
 * is ever stranded:
 *   - a field whose answer type changed becomes a new field with a new key,
 *     and the old one is kept, retired, for the records that used it;
 *   - choices taken off a list stay accepted on old records;
 *   - a field left out is kept, retired.
 */
export function reconcileFields(next: FormField[], previous: FormField[] | null | undefined): FormField[] {
  const prev = new Map((previous ?? []).map((f) => [f.key, f]));
  const taken = new Set([...prev.keys(), ...next.map((f) => f.key)]);
  const out: FormField[] = [];
  for (const f of next) {
    const old = prev.get(f.key);
    if (old && old.type !== f.type) {
      let n = 2;
      let key = `${f.key}_${n}`;
      while (taken.has(key)) key = `${f.key}_${++n}`;
      taken.add(key);
      out.push({ ...f, key });
      continue;
    }
    if (old && (f.type === "select" || f.type === "multi")) {
      const dropped = [...(old.options ?? []), ...(old.retiredOptions ?? [])].filter((o) => !f.options?.includes(o));
      out.push(dropped.length ? { ...f, retiredOptions: [...new Set(dropped)] } : f);
      continue;
    }
    out.push(f);
  }
  const kept = new Set(out.map((f) => f.key));
  for (const old of previous ?? []) if (!kept.has(old.key)) out.push({ ...old, retired: true });
  return out;
}
