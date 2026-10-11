/**
 * How this clinic's printed documents look.
 *
 * Every option here came out of looking at what real clinic software
 * actually exposes ([Clinicia](https://clinicia.com/features/prescription/),
 * [DocHealth](https://www.dochealth.co/),
 * [Praxis printouts](https://www.praxisemr.com/printouts.htm)) rather than
 * from guessing at what looks configurable:
 *
 * - **Pre-printed stationery** is the standout. A practice that already has
 *   letterhead paper needs the software to *skip* its own header and start
 *   lower down, or it prints on top of theirs. This is the single most
 *   requested printing option in Indian clinic software and it is nothing
 *   like a cosmetic setting.
 * - Logo/letterhead upload, accent colour, footer branding, watermark.
 * - Per-document footer notes, for disclaimers.
 *
 * Deliberately NOT offered: arbitrary fonts and a free colour picker. A
 * prescription is read under fluorescent light by a pharmacist in a hurry;
 * an 8pt script face in pale yellow is a safety problem, not a preference.
 * Colours are a curated, contrast-checked set.
 */

export type HeaderMode = "full" | "compact" | "none";

export interface DocumentTemplate {
  /** full = logo + name + address; compact = one line; none = leave the
   * space blank for pre-printed stationery. */
  headerMode: HeaderMode;
  /** Blank space reserved at the top, in millimetres, for pre-printed
   * letterhead. Ignored unless headerMode is "none". */
  topOffsetMm: number;
  accentColor: AccentKey;
  watermarkEnabled: boolean;
  watermarkText: string;
  showFooter: boolean;
  footerNote: string;
  /** Prescriptions only: print the computed dispense quantity column. */
  showQty: boolean;
  /** Draw a light band behind table headers and the patient block. Off
   * gives a plainer, more ink-frugal document. */
  showTints: boolean;
}

export type AccentKey = "teal" | "blue" | "indigo" | "green" | "slate" | "maroon";

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
};

/** Millimetres to PDF points. 1mm = 72/25.4pt. */
export const mmToPt = (mm: number): number => (mm * 72) / 25.4;

/**
 * Normalizes whatever is stored in the database into a complete template.
 *
 * Unknown keys are dropped and out-of-range values are clamped rather than
 * trusted: this JSON is written by an API and read by the code that draws
 * a legal document, so a hand-edited row must not be able to push the body
 * off the page.
 */
export function resolveTemplate(stored: unknown): DocumentTemplate {
  const t = { ...DEFAULT_TEMPLATE };
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
  if (typeof s.footerNote === "string") t.footerNote = s.footerNote.slice(0, 200);
  if (typeof s.showQty === "boolean") t.showQty = s.showQty;
  if (typeof s.showTints === "boolean") t.showTints = s.showTints;

  return t;
}
