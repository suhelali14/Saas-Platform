/**
 * How this clinic's printed documents look.
 *
 * ── The shape of the problem ─────────────────────────────────────────
 *
 * A clinic's printed output is its most public artefact. The prescription
 * goes to a pharmacist, the certificate to an employer, the invoice to an
 * insurer -- and every one of them is photocopied, faxed and read under
 * fluorescent light by someone in a hurry. So two things have to be true
 * at once: the clinic must be able to change essentially everything, and
 * no setting may be able to produce a document that cannot be read.
 *
 * Those pull against each other, and the resolution is the whole design:
 * the clinic composes from a fixed vocabulary of blocks rather than
 * positioning anything freely. It can reorder, rename, hide, add its own
 * text blocks, choose which fields print and in what order, and define
 * its own table columns. It cannot set 6pt type in pale yellow, overlap
 * two fields, or push the body off the page -- because no setting
 * expresses those.
 *
 * Nothing rendered is ever stored. A PDF is computed from this config and
 * the live record each time it is asked for. That is deliberate: a
 * generated prescription sitting on disk is a file that gets backed up,
 * emailed and left on desktops, and it goes stale the moment the record
 * behind it is corrected.
 *
 * ── What real products expose ────────────────────────────────────────
 *
 * Surveyed rather than guessed:
 *
 * - **Pre-printed stationery** is the standout, and is not cosmetic. A
 *   practice with its own letterhead paper needs the software to skip its
 *   own header and start lower down, or it prints over stationery they
 *   paid for. Reported as the most-requested printing option in Indian
 *   clinic software.
 *   ([Clinicia](https://clinicia.com/features/prescription/),
 *   [Praxis printouts](https://www.praxisemr.com/printouts.htm))
 * - **Add, remove, rename and reorder every field** is the bar
 *   competitors set ([DocEdge](https://docedge.in/)), along with logo,
 *   signature and registration-number upload, and footer disclaimers.
 * - **Per-document templates**, including specialty-specific ones, rather
 *   than one setting for everything
 *   ([Eka Care](https://www.eka.care/eka-for-doctors/emr-ehr-medical-software)).
 *
 * The architecture follows the pattern these converge on: a JSON layout
 * tree, a data-binding layer that maps block fields to the record, and a
 * deterministic renderer that does not involve a browser.
 *
 * Deliberately NOT offered: arbitrary fonts, a free colour picker, and
 * absolute positioning. A prescription is read by a pharmacist deciding
 * what to dispense; an 8pt script face in pale yellow is a safety
 * problem, not a preference. Accents are a curated, contrast-checked set.
 */

export type HeaderMode = "full" | "compact" | "none";

export type AccentKey = "teal" | "blue" | "indigo" | "green" | "slate" | "maroon";

/** The document kinds this clinic prints. Each can be templated on its own. */
export const DOC_KINDS = ["prescription", "certificate", "invoice", "report"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

/**
 * The identity lines a letterhead can carry.
 *
 * A clinic decides which of these print and in what order. Keys name the
 * source field, so adding one later does not need a migration -- an
 * unknown key in stored config is dropped on read.
 */
export const LETTERHEAD_FIELDS: readonly { key: string; label: string; always?: boolean }[] = [
  { key: "name", label: "Clinic name", always: true },
  { key: "tagline", label: "Tagline" },
  { key: "doctorName", label: "Doctor's name" },
  { key: "qualifications", label: "Qualifications" },
  { key: "registrationNumber", label: "Registration number" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
];
export type LetterheadKey = string;

/**
 * The blocks each kind of document is built from.
 *
 * Fixed, because a block is a drawing routine -- the clinic chooses which
 * ones appear, in what order, and what they are called. `custom` is the
 * escape hatch: a clinic-authored heading and paragraph, which covers the
 * long tail ("bring your previous reports", consent wording, a
 * pharmacy's address) without opening up the layout.
 */
export const BLOCK_TYPES = {
  prescription: [
    { key: "patientInfo", label: "Patient details" },
    { key: "allergyBanner", label: "Allergy warning", critical: true },
    { key: "diagnosis", label: "Diagnosis" },
    { key: "medicines", label: "Medicines table", required: true },
    { key: "advice", label: "Advice / instructions" },
    { key: "followUp", label: "Follow-up date" },
    { key: "vitals", label: "Vitals" },
    { key: "signature", label: "Signature block" },
  ],
  certificate: [
    { key: "patientInfo", label: "Patient details" },
    { key: "body", label: "Certificate text", required: true },
    { key: "period", label: "From / to dates" },
    { key: "signature", label: "Signature block" },
  ],
  invoice: [
    { key: "patientInfo", label: "Patient details" },
    { key: "items", label: "Line items table", required: true },
    { key: "totals", label: "Totals" },
    { key: "payments", label: "Payments received" },
    { key: "signature", label: "Signature block" },
  ],
  report: [
    { key: "patientInfo", label: "Patient details" },
    { key: "allergyBanner", label: "Allergy warning", critical: true },
    { key: "history", label: "Visit history", required: true },
    { key: "signature", label: "Signature block" },
  ],
} as const satisfies Record<DocKind, readonly { key: string; label: string; required?: boolean; critical?: boolean }[]>;

/** Columns the clinic may compose its medicines table from. */
export const MEDICINE_COLUMNS = [
  { key: "index", label: "#", defaultWidth: 22 },
  { key: "name", label: "Medicine", defaultWidth: 150 },
  { key: "composition", label: "Composition", defaultWidth: 110 },
  { key: "dosage", label: "Dosage", defaultWidth: 70 },
  { key: "frequency", label: "Frequency", defaultWidth: 60 },
  { key: "duration", label: "Duration", defaultWidth: 60 },
  { key: "qty", label: "Qty", defaultWidth: 40 },
  { key: "instructions", label: "Instructions", defaultWidth: 110 },
] as const;
export type MedicineColumnKey = (typeof MEDICINE_COLUMNS)[number]["key"];

export interface BlockConfig {
  /** Which drawing routine. Unknown keys are dropped on read. */
  key: string;
  /** Overrides the block's built-in heading. Blank keeps the default. */
  label?: string;
  show: boolean;
  /** `custom` blocks only. */
  text?: string;
}

export interface ColumnConfig {
  key: string;
  label?: string;
  show: boolean;
  /** Points. Clamped on read; the renderer redistributes any remainder. */
  width?: number;
}

export interface KindTemplate {
  /** Replaces the printed document title. A clinic that calls it a
   *  "Treatment Advice" rather than a "Prescription" can say so. */
  title?: string;
  /** This document's own disclaimer, which differs by kind far more than
   *  the clinic's name does -- a certificate's wording is a legal matter
   *  and an invoice's is a tax one. */
  footerNote?: string;
  blocks: BlockConfig[];
  /** Prescriptions only today. */
  columns?: ColumnConfig[];
}

export interface DocumentTemplate {
  /** full = logo + identity lines; compact = one line; none = leave the
   *  space blank for pre-printed stationery. */
  headerMode: HeaderMode;
  /** Blank space reserved at the top, in millimetres, for pre-printed
   *  letterhead. Ignored unless headerMode is "none". */
  topOffsetMm: number;
  accentColor: AccentKey;
  watermarkEnabled: boolean;
  watermarkText: string;
  showFooter: boolean;
  /** Fallback disclaimer, used by any kind that has not set its own. */
  footerNote: string;
  /** Prescriptions: print the computed dispense quantity column. Kept as
   *  a top-level flag because it predates per-kind columns and existing
   *  rows carry it; it is applied as a default for the `qty` column. */
  showQty: boolean;
  /** Draw a light band behind table headers and the patient block. Off
   *  gives a plainer, more ink-frugal document. */
  showTints: boolean;
  /** Which identity lines the letterhead prints, in order. */
  letterhead: { key: string; label?: string; show: boolean }[];
  /** Per-document-kind layout. A kind absent here uses its defaults. */
  kinds: Partial<Record<DocKind, KindTemplate>>;
}

/**
 * Curated accents. Each is dark enough to clear WCAG AA against white for
 * body-size text, so a heading never becomes unreadable on a photocopy --
 * and these documents *are* photocopied, constantly.
 */
export const ACCENTS: Record<AccentKey, { label: string; ink: string; soft: string }> = {
  teal: { label: "Teal", ink: "#0f766e", soft: "#f0fdfa" },
  blue: { label: "Blue", ink: "#1d4ed8", soft: "#eff6ff" },
  indigo: { label: "Indigo", ink: "#4338ca", soft: "#eef2ff" },
  green: { label: "Green", ink: "#15803d", soft: "#f0fdf4" },
  slate: { label: "Slate", ink: "#334155", soft: "#f8fafc" },
  maroon: { label: "Maroon", ink: "#9f1239", soft: "#fff1f2" },
};

/** Every block of a kind, shown, in its declared order. */
export function defaultBlocks(kind: DocKind): BlockConfig[] {
  return BLOCK_TYPES[kind].map((b) => ({ key: b.key, show: true }));
}

export function defaultColumns(showQty: boolean): ColumnConfig[] {
  return MEDICINE_COLUMNS.map((c) => ({
    key: c.key,
    // Two are offered rather than assumed.
    //
    // Composition is useful to a pharmacist but makes the table too wide
    // for most prescriptions.
    //
    // Instructions stay a sub-row under each medicine, which is what
    // every clinic has been printing and is markedly more readable for
    // real instruction text -- "Take after food, avoid dairy products"
    // does not belong in a 108pt column. Turning it into a column is a
    // choice a clinic can make; it is not something a new capability
    // should impose on documents already in use.
    show: c.key === "composition" || c.key === "instructions"
      ? false
      : c.key === "qty" ? showQty : true,
    width: c.defaultWidth,
  }));
}

export const DEFAULT_TEMPLATE: DocumentTemplate = {
  headerMode: "full",
  topOffsetMm: 45,
  accentColor: "teal",
  watermarkEnabled: false,
  watermarkText: "",
  showFooter: true,
  footerNote: "",
  showQty: true,
  showTints: true,
  letterhead: LETTERHEAD_FIELDS.map((f) => ({
    key: f.key,
    // Qualifications are off by default: they belong on the signature
    // block, and repeating them in the header crowds it.
    show: f.key !== "qualifications",
  })),
  kinds: {},
};

/** Millimetres to PDF points. 1mm = 72/25.4pt. */
export const mmToPt = (mm: number): number => (mm * 72) / 25.4;

/**
 * Normalizes whatever is stored into a complete, safe template.
 *
 * Unknown keys are dropped and out-of-range values clamped rather than
 * trusted: this JSON is written by an API and read by the code that draws
 * a legal document, so a hand-edited row must not be able to push the
 * body off the page, hide a required block, or name a block that has no
 * drawing routine.
 *
 * Also the migration path. Rows written before per-kind templates existed
 * carry only the nine original flags; they resolve to those flags plus
 * the defaults, so no stored row needs rewriting and an older API reading
 * a newer row simply ignores what it does not know.
 */
export function resolveTemplate(stored: unknown): DocumentTemplate {
  const t: DocumentTemplate = {
    ...DEFAULT_TEMPLATE,
    letterhead: DEFAULT_TEMPLATE.letterhead.map((f) => ({ ...f })),
    kinds: {},
  };
  if (!stored || typeof stored !== "object") return t;
  const s = stored as Record<string, unknown>;

  if (s.headerMode === "full" || s.headerMode === "compact" || s.headerMode === "none") {
    t.headerMode = s.headerMode;
  }
  if (typeof s.topOffsetMm === "number" && Number.isFinite(s.topOffsetMm)) {
    // Capped at 120mm: beyond that there is no usable body left on A4.
    t.topOffsetMm = Math.min(120, Math.max(0, s.topOffsetMm));
  }
  if (typeof s.accentColor === "string" && s.accentColor in ACCENTS) {
    t.accentColor = s.accentColor as AccentKey;
  }
  if (typeof s.watermarkEnabled === "boolean") t.watermarkEnabled = s.watermarkEnabled;
  if (typeof s.watermarkText === "string") t.watermarkText = s.watermarkText.slice(0, 40);
  if (typeof s.showFooter === "boolean") t.showFooter = s.showFooter;
  if (typeof s.footerNote === "string") t.footerNote = s.footerNote.slice(0, 300);
  if (typeof s.showQty === "boolean") t.showQty = s.showQty;
  if (typeof s.showTints === "boolean") t.showTints = s.showTints;

  // ── Letterhead: keep the clinic's order, drop unknown keys, and never
  //    let the clinic's own name be removed. A document with no issuer is
  //    not a document.
  if (Array.isArray(s.letterhead)) {
    const known = new Set(LETTERHEAD_FIELDS.map((f) => f.key));
    const seen = new Set<string>();
    const out: DocumentTemplate["letterhead"] = [];
    for (const raw of s.letterhead) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.key !== "string" || !known.has(r.key) || seen.has(r.key)) continue;
      seen.add(r.key);
      const always = LETTERHEAD_FIELDS.find((f) => f.key === r.key)?.always;
      out.push({
        key: r.key,
        label: typeof r.label === "string" && r.label.trim() ? r.label.slice(0, 60) : undefined,
        show: always ? true : r.show !== false,
      });
    }
    // Anything the stored order did not mention keeps its default, at the
    // end -- so a field added to this list later appears rather than
    // silently vanishing for every clinic that saved before it existed.
    for (const f of DEFAULT_TEMPLATE.letterhead) {
      if (!seen.has(f.key)) out.push({ ...f });
    }
    if (out.length) t.letterhead = out;
  }

  // ── Per-kind layouts ───────────────────────────────────────────────
  if (s.kinds && typeof s.kinds === "object") {
    const kinds = s.kinds as Record<string, unknown>;
    for (const kind of DOC_KINDS) {
      const raw = kinds[kind];
      if (!raw || typeof raw !== "object") continue;
      const k = raw as Record<string, unknown>;
      const resolved: KindTemplate = { blocks: [] };

      if (typeof k.title === "string" && k.title.trim()) resolved.title = k.title.trim().slice(0, 80);
      if (typeof k.footerNote === "string") resolved.footerNote = k.footerNote.slice(0, 300);

      resolved.blocks = resolveBlocks(kind, k.blocks);
      if (kind === "prescription") resolved.columns = resolveColumns(k.columns, t.showQty);

      t.kinds[kind] = resolved;
    }
  }

  return t;
}

/**
 * A kind's block list: the clinic's order, unknown keys dropped, required
 * blocks forced back on.
 *
 * Forcing them matters. A prescription with its medicines table hidden is
 * a sheet of paper with a patient's name on it, and the person who
 * unticked it would not find out until a pharmacist called.
 */
function resolveBlocks(kind: DocKind, stored: unknown): BlockConfig[] {
  const spec = BLOCK_TYPES[kind] as readonly { key: string; required?: boolean }[];
  const known = new Map(spec.map((b) => [b.key, b]));
  if (!Array.isArray(stored)) return defaultBlocks(kind);

  const out: BlockConfig[] = [];
  const seen = new Set<string>();
  let customCount = 0;

  for (const raw of stored) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.key !== "string") continue;

    if (r.key === "custom") {
      // Capped: a document is not a word processor, and an unbounded list
      // of free-text blocks is how one becomes forty pages.
      if (customCount >= 6) continue;
      customCount++;
      out.push({
        key: "custom",
        label: typeof r.label === "string" ? r.label.slice(0, 80) : undefined,
        show: r.show !== false,
        text: typeof r.text === "string" ? r.text.slice(0, 2000) : "",
      });
      continue;
    }

    const known_block = known.get(r.key);
    if (!known_block || seen.has(r.key)) continue;
    seen.add(r.key);
    out.push({
      key: r.key,
      label: typeof r.label === "string" && r.label.trim() ? r.label.slice(0, 80) : undefined,
      show: known_block.required ? true : r.show !== false,
    });
  }

  // Blocks the stored order never mentioned keep their default position
  // at the end. A required one that was dropped entirely comes back.
  for (const b of spec) {
    if (!seen.has(b.key)) out.push({ key: b.key, show: true });
  }

  return out;
}

function resolveColumns(stored: unknown, showQty: boolean): ColumnConfig[] {
  const known = new Map(MEDICINE_COLUMNS.map((c) => [c.key, c]));
  if (!Array.isArray(stored)) return defaultColumns(showQty);

  const out: ColumnConfig[] = [];
  const seen = new Set<string>();
  for (const raw of stored) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.key !== "string" || !known.has(r.key as MedicineColumnKey) || seen.has(r.key)) continue;
    seen.add(r.key);
    const def = known.get(r.key as MedicineColumnKey)!;
    out.push({
      key: r.key,
      label: typeof r.label === "string" && r.label.trim() ? r.label.slice(0, 40) : undefined,
      show: r.show !== false,
      // 18pt is about two characters; 260 is most of the page. Outside
      // that a column is either unreadable or pushes the others off.
      width: typeof r.width === "number" && Number.isFinite(r.width)
        ? Math.min(260, Math.max(18, r.width))
        : def.defaultWidth,
    });
  }
  for (const c of MEDICINE_COLUMNS) {
    if (!seen.has(c.key)) out.push({ key: c.key, show: false, width: c.defaultWidth });
  }

  // The medicine name is the one column a prescription cannot be read
  // without. Forced on for the same reason the medicines table is.
  const name = out.find((c) => c.key === "name");
  if (name) name.show = true;
  else out.unshift({ key: "name", show: true, width: 150 });

  // And at least one column besides it, or the table is a list.
  if (!out.some((c) => c.show && c.key !== "name")) {
    const dosage = out.find((c) => c.key === "dosage");
    if (dosage) dosage.show = true;
  }

  return out;
}

/** The effective layout for one kind, merging defaults with any overrides. */
export function layoutFor(template: DocumentTemplate, kind: DocKind): Required<Pick<KindTemplate, "blocks">> & KindTemplate {
  const stored = template.kinds[kind];
  return {
    title: stored?.title,
    footerNote: stored?.footerNote ?? template.footerNote,
    blocks: stored?.blocks?.length ? stored.blocks : defaultBlocks(kind),
    columns: kind === "prescription"
      ? (stored?.columns?.length ? stored.columns : defaultColumns(template.showQty))
      : undefined,
  };
}

/** Whether a block prints, honouring the kind's configured order. */
export function blockEnabled(template: DocumentTemplate, kind: DocKind, key: string): boolean {
  return layoutFor(template, kind).blocks.some((b) => b.key === key && b.show);
}

/** A block's heading, the clinic's wording winning over the built-in. */
export function blockLabel(template: DocumentTemplate, kind: DocKind, key: string, fallback: string): string {
  const b = layoutFor(template, kind).blocks.find((x) => x.key === key);
  return b?.label?.trim() || fallback;
}
