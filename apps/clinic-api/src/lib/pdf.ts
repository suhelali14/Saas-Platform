import PDFDocument from "pdfkit";
import { ACCENTS, DEFAULT_TEMPLATE, mmToPt, type DocumentTemplate } from "./document-template.js";

/**
 * Document toolkit for every PDF this clinic issues: prescriptions,
 * certificates, invoices, patient reports.
 *
 * These are the clinic's public face -- a prescription is handed to a
 * patient, taken to a pharmacy, sometimes filed with an insurer. The
 * previous version printed centred plain-text lines with no logo, no
 * columns and no page furniture, which read as a database dump rather than
 * a medical document.
 *
 * pdfkit rather than a headless browser: these are templated documents, not
 * HTML renders, and this keeps each clinic's deployment free of a Chromium
 * dependency.
 *
 * Layout constants are in points (1/72") because that is pdfkit's unit.
 */

// A4 is 595.28 x 841.89pt. Margins are deliberately generous: a printed
// prescription is written on, stamped, and sometimes hole-punched.
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { top: 42, bottom: 58, left: 46, right: 46 };
const CONTENT = { left: MARGIN.left, right: PAGE.width - MARGIN.right };
const CONTENT_WIDTH = CONTENT.right - CONTENT.left;

/** Reserved for the footer, so body content never collides with it. */
const BODY_BOTTOM = PAGE.height - MARGIN.bottom - 18;

const COLOR = {
  ink: "#111827",
  body: "#1f2937",
  muted: "#6b7280",
  faint: "#9ca3af",
  rule: "#d1d5db",
  ruleLight: "#e5e7eb",
  accent: "#0f766e",
  accentSoft: "#f0fdfa",
  zebra: "#f9fafb",
  alertBg: "#fef2f2",
  alertBorder: "#fca5a5",
  alertInk: "#991b1b",
};

/** Per-document palette: the fixed greys plus the clinic's chosen accent. */
function paletteFor(template: DocumentTemplate) {
  const accent = ACCENTS[template.accentColor] ?? ACCENTS.teal;
  return { ...COLOR, accent: accent.ink, accentSoft: template.showTints ? accent.soft : "#ffffff" };
}

/** pdfkit has no user-data slot, so the template rides on the document
 * object. Typed once here rather than cast at every use site. */
type DocWithTemplate = PDFKit.PDFDocument & {
  __template?: DocumentTemplate;
  __palette?: ReturnType<typeof paletteFor>;
};

function pal(doc: PDFKit.PDFDocument) {
  return (doc as DocWithTemplate).__palette ?? paletteFor(DEFAULT_TEMPLATE);
}

function tpl(doc: PDFKit.PDFDocument): DocumentTemplate {
  return (doc as DocWithTemplate).__template ?? DEFAULT_TEMPLATE;
}

/**
 * Watermark, drawn before anything else so every later mark sits on top.
 *
 * Rotated 45 degrees about the page centre at very low opacity: legible
 * enough to still mean something on a photocopy, faint enough never to
 * compete with a dosage. 0.06 is about the most that stays out of the way.
 */
function drawWatermark(doc: PDFKit.PDFDocument, text: string) {
  const clean = text.trim();
  if (!clean) return;
  doc.save();
  doc.rotate(-45, { origin: [PAGE.width / 2, PAGE.height / 2] });
  doc.font("Helvetica-Bold").fontSize(62).fillColor("#000000").fillOpacity(0.06);
  doc.text(clean.toUpperCase(), 0, PAGE.height / 2 - 38, {
    width: PAGE.width,
    align: "center",
    lineBreak: false,
  });
  doc.fillOpacity(1);
  doc.restore();
}

export interface ClinicBranding {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  doctorName?: string | null;
  registrationNumber?: string | null;
  /** Absolute path on disk, already resolved by the caller. */
  logoPath?: string | null;
}

export interface DocumentMeta {
  /** "Prescription", "Medical Certificate", "Invoice"… */
  title: string;
  /** Short human reference printed in the title bar, e.g. a UHID or bill no. */
  reference?: string | null;
  date?: Date;
  /** Footer note, e.g. "Not valid for legal purposes". */
  footerNote?: string | null;
}

/**
 * Creates the document and installs the repeating header/footer.
 *
 * The letterhead is redrawn on every page via pdfkit's `pageAdded` hook,
 * so a three-page patient report carries the clinic's identity on each
 * sheet -- pages get separated, and an unbranded page two is useless to a
 * pharmacist or an insurer.
 */
export function createDocument(
  clinic: ClinicBranding,
  meta: DocumentMeta,
  template: DocumentTemplate = DEFAULT_TEMPLATE,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.left, right: MARGIN.right },
    bufferPages: true,
    info: {
      Title: `${meta.title} - ${clinic.name}`,
      Author: clinic.name,
      Creator: "Clinic Management System",
    },
  });

  (doc as DocWithTemplate).__template = template;
  (doc as DocWithTemplate).__palette = paletteFor(template);

  if (template.watermarkEnabled) drawWatermark(doc, template.watermarkText);
  drawLetterhead(doc, clinic, { template });
  drawTitleBar(doc, meta);

  doc.on("pageAdded", () => {
    if (template.watermarkEnabled) drawWatermark(doc, template.watermarkText);
    drawLetterhead(doc, clinic, { continuation: true, template });
  });

  return doc;
}

/**
 * Logo, clinic name, contact details.
 *
 * With a logo the block is left-aligned (logo, then a text column beside
 * it) because that is how a real letterhead reads; without one everything
 * centres, which looks deliberate rather than like a missing image.
 */
function drawLetterhead(
  doc: PDFKit.PDFDocument,
  clinic: ClinicBranding,
  opts?: { continuation?: boolean; template?: DocumentTemplate },
) {
  const template = opts?.template ?? DEFAULT_TEMPLATE;
  const palette = paletteFor(template);
  const top = MARGIN.top;

  // Pre-printed stationery: leave the clinic's own printed letterhead alone
  // and simply start the body below it. The most-requested printing option
  // in real clinic software, and not a cosmetic one -- without it the
  // software prints over paper the practice already paid for.
  if (template.headerMode === "none") {
    doc.y = mmToPt(template.topOffsetMm);
    doc.x = CONTENT.left;
    doc.fillColor(COLOR.body);
    return;
  }

  const compact = template.headerMode === "compact";
  let logoDrawn = false;
  const LOGO = compact ? 34 : 52;

  if (clinic.logoPath) {
    try {
      doc.image(clinic.logoPath, CONTENT.left, top, { fit: [LOGO, LOGO] });
      logoDrawn = true;
    } catch {
      // A missing or corrupt logo must never fail a prescription. Fall
      // through to the centred, logo-less letterhead.
    }
  }

  const textLeft = logoDrawn ? CONTENT.left + LOGO + 14 : CONTENT.left;
  const textWidth = CONTENT.right - textLeft;
  const align: "left" | "center" = logoDrawn ? "left" : "center";

  doc.fillColor(COLOR.ink).font("Helvetica-Bold").fontSize(compact ? 13 : logoDrawn ? 17 : 19);
  doc.text(clinic.name, textLeft, top + (logoDrawn ? 2 : 0), { width: textWidth, align });

  doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted);
  if (clinic.address && !compact) {
    doc.text(clinic.address, textLeft, doc.y + 1, { width: textWidth, align });
  }
  const contact = [clinic.phone, clinic.email].filter(Boolean).join("   ·   ");
  if (contact) doc.text(contact, textLeft, doc.y + 0.5, { width: textWidth, align });
  if (clinic.registrationNumber && !compact) {
    doc.fillColor(COLOR.faint).text(`Regn. No. ${clinic.registrationNumber}`, textLeft, doc.y + 0.5, { width: textWidth, align });
  }

  // The rule sits below whichever is taller -- the logo or the text column.
  const ruleY = Math.max(doc.y + 8, logoDrawn ? top + LOGO + 8 : doc.y + 8);
  doc.moveTo(CONTENT.left, ruleY).lineTo(CONTENT.right, ruleY).lineWidth(1.2).strokeColor(palette.accent).stroke();
  doc.moveTo(CONTENT.left, ruleY + 2.5).lineTo(CONTENT.right, ruleY + 2.5).lineWidth(0.4).strokeColor(COLOR.rule).stroke();

  doc.y = ruleY + (opts?.continuation ? 14 : 12);
  doc.x = CONTENT.left;
  doc.fillColor(COLOR.body);
}

/** Document type on the left, reference and date on the right. */
function drawTitleBar(doc: PDFKit.PDFDocument, meta: DocumentMeta) {
  const y = doc.y;
  const date = meta.date ?? new Date();

  doc.font("Helvetica-Bold").fontSize(12.5).fillColor(pal(doc).accent);
  doc.text(meta.title.toUpperCase(), CONTENT.left, y, { width: CONTENT_WIDTH * 0.55, characterSpacing: 0.6 });

  const rightLines = [
    meta.reference ? `No. ${meta.reference}` : null,
    date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
  ].filter(Boolean) as string[];

  doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted);
  doc.text(rightLines.join("\n"), CONTENT.left + CONTENT_WIDTH * 0.55, y + 1, {
    width: CONTENT_WIDTH * 0.45,
    align: "right",
  });

  doc.y = Math.max(doc.y, y + 26);
  doc.x = CONTENT.left;
  doc.fillColor(COLOR.body);
}

/**
 * A bordered grid of labelled fields -- patient identity, invoice parties.
 *
 * Labelled and boxed rather than run-on text lines: whoever reads this is
 * looking for one specific value (the UHID, the age) and should find it by
 * position, not by reading a sentence.
 */
export function drawInfoGrid(
  doc: PDFKit.PDFDocument,
  fields: { label: string; value: string }[],
  opts?: { columns?: number },
) {
  const present = fields.filter((f) => f.value && f.value.trim().length > 0);
  if (present.length === 0) return;

  const columns = opts?.columns ?? 3;
  const rows = Math.ceil(present.length / columns);
  const colWidth = CONTENT_WIDTH / columns;
  const ROW_H = 26;
  const boxTop = doc.y;
  const boxHeight = rows * ROW_H + 8;

  doc.roundedRect(CONTENT.left, boxTop, CONTENT_WIDTH, boxHeight, 3)
    .lineWidth(0.7).strokeColor(COLOR.rule).fillAndStroke(tpl(doc).showTints ? COLOR.zebra : "#ffffff", COLOR.rule);

  present.forEach((field, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = CONTENT.left + col * colWidth + 9;
    const y = boxTop + 6 + row * ROW_H;
    const w = colWidth - 16;

    doc.font("Helvetica").fontSize(6.8).fillColor(COLOR.faint);
    doc.text(field.label.toUpperCase(), x, y, { width: w, characterSpacing: 0.4 });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLOR.ink);
    doc.text(field.value, x, y + 9, { width: w, ellipsis: true, lineBreak: false });
  });

  doc.y = boxTop + boxHeight + 12;
  doc.x = CONTENT.left;
  doc.fillColor(COLOR.body);
}

/**
 * Allergy / critical-warning banner.
 *
 * On a prescription this is the most important thing on the page. It is
 * drawn immediately under the patient block, before the medicines, because
 * a pharmacist reading top-to-bottom must hit it before they read what to
 * dispense.
 */
export function drawAlertBanner(doc: PDFKit.PDFDocument, lines: { label: string; text: string }[]) {
  const present = lines.filter((l) => l.text && l.text.trim().length > 0);
  if (present.length === 0) return;

  const PAD = 8;
  doc.font("Helvetica").fontSize(9);
  const textWidth = CONTENT_WIDTH - PAD * 2 - 4;
  const height =
    present.reduce((sum, l) => sum + doc.heightOfString(`${l.label}: ${l.text}`, { width: textWidth }), 0) + PAD * 2;

  const top = doc.y;
  doc.roundedRect(CONTENT.left, top, CONTENT_WIDTH, height, 3)
    .lineWidth(0.9).fillAndStroke(COLOR.alertBg, COLOR.alertBorder);
  // Left bar, so it still reads as a warning after a monochrome photocopy.
  doc.rect(CONTENT.left, top, 3, height).fill(COLOR.alertBorder);

  let y = top + PAD;
  for (const line of present) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.alertInk);
    doc.text(`${line.label}: `, CONTENT.left + PAD + 4, y, { continued: true });
    doc.font("Helvetica").text(line.text);
    y = doc.y + 1;
  }

  doc.y = top + height + 12;
  doc.x = CONTENT.left;
  doc.fillColor(COLOR.body);
}

/** A small caps section heading with a hairline under it. */
export function drawSectionHeading(doc: PDFKit.PDFDocument, label: string) {
  ensureSpace(doc, 34);
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(pal(doc).accent);
  doc.text(label.toUpperCase(), CONTENT.left, y, { characterSpacing: 0.7 });
  const ruleY = doc.y + 2.5;
  doc.moveTo(CONTENT.left, ruleY).lineTo(CONTENT.right, ruleY).lineWidth(0.5).strokeColor(COLOR.ruleLight).stroke();
  doc.y = ruleY + 7;
  doc.x = CONTENT.left;
  doc.fillColor(COLOR.body);
}

export interface TableColumn {
  header: string;
  /** Fraction of the content width, 0-1. Must sum to ~1 across columns. */
  width: number;
  align?: "left" | "right" | "center";
}

/**
 * A real table: header band, column rules, zebra rows, and page breaks
 * that repeat the header.
 *
 * Medicines were previously printed as one run-on line per item
 * ("1. Dolo 650   1-0-1   BD   5 days"), which a pharmacist has to parse
 * rather than scan. Columns are the entire point of a prescription.
 *
 * `subRow` renders under a row spanning the full width, for instructions
 * that belong to the medicine above them.
 */
export function drawTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: (string | null | undefined)[][],
  opts?: { subRows?: (string | null | undefined)[]; zebra?: boolean },
) {
  const widths = columns.map((c) => c.width * CONTENT_WIDTH);

  // Cumulative left offsets. Written as a plain loop: the `reduce` this
  // replaced emitted an array one longer than the column count with a
  // duplicate at the head, so column 0 and column 1 both drew at the same
  // x and every later column was shifted one slot -- which printed the
  // index, the medicine name and the dosage stacked on top of each other.
  const xs: number[] = [];
  let cursor = CONTENT.left;
  for (const w of widths) {
    xs.push(cursor);
    cursor += w;
  }
  const PAD_X = 6;
  const PAD_Y = 5;

  const drawHeader = () => {
    const top = doc.y;
    doc.rect(CONTENT.left, top, CONTENT_WIDTH, 20).fill(pal(doc).accentSoft);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(pal(doc).accent);
    columns.forEach((c, i) => {
      doc.text(c.header.toUpperCase(), xs[i]! + PAD_X, top + 6.5, {
        width: widths[i]! - PAD_X * 2,
        align: c.align ?? "left",
        lineBreak: false,
        ellipsis: true,
      });
    });
    doc.moveTo(CONTENT.left, top + 20).lineTo(CONTENT.right, top + 20).lineWidth(0.6).strokeColor(COLOR.rule).stroke();
    doc.y = top + 20;
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    doc.font("Helvetica").fontSize(9);
    // Measure the tallest cell before drawing, so the row background and
    // the text can never disagree about the row's height.
    const cellHeights = row.map((cell, i) =>
      doc.heightOfString(String(cell ?? "—"), { width: widths[i]! - PAD_X * 2 }),
    );
    const sub = opts?.subRows?.[rowIndex];
    const subHeight = sub ? doc.fontSize(8).heightOfString(sub, { width: CONTENT_WIDTH - PAD_X * 2 - 10 }) + 2 : 0;
    doc.fontSize(9);
    const rowHeight = Math.max(...cellHeights, 11) + PAD_Y * 2 + subHeight;

    if (doc.y + rowHeight > BODY_BOTTOM) {
      doc.addPage();
      drawHeader();
    }

    const top = doc.y;
    if ((opts?.zebra ?? true) && tpl(doc).showTints && rowIndex % 2 === 1) {
      doc.rect(CONTENT.left, top, CONTENT_WIDTH, rowHeight).fill(COLOR.zebra);
    }

    row.forEach((cell, i) => {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.body);
      doc.text(String(cell ?? "—"), xs[i]! + PAD_X, top + PAD_Y, {
        width: widths[i]! - PAD_X * 2,
        align: columns[i]?.align ?? "left",
      });
    });

    if (sub) {
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(COLOR.muted);
      doc.text(sub, xs[0]! + PAD_X + 10, top + rowHeight - subHeight - PAD_Y + 2, {
        width: CONTENT_WIDTH - PAD_X * 2 - 10,
      });
    }

    doc.moveTo(CONTENT.left, top + rowHeight).lineTo(CONTENT.right, top + rowHeight)
      .lineWidth(0.4).strokeColor(COLOR.ruleLight).stroke();
    doc.y = top + rowHeight;
  });

  doc.y += 12;
  doc.x = CONTENT.left;
  doc.fillColor(COLOR.body);
}

/** Label/value pairs stacked as prose -- diagnosis, complaint, notes. */
export function drawFieldList(doc: PDFKit.PDFDocument, fields: { label: string; value?: string | null }[]) {
  const present = fields.filter((f) => f.value && String(f.value).trim().length > 0);
  for (const field of present) {
    ensureSpace(doc, 30);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.faint);
    doc.text(field.label.toUpperCase(), CONTENT.left, doc.y, { characterSpacing: 0.3 });
    doc.font("Helvetica").fontSize(10).fillColor(COLOR.body);
    doc.text(String(field.value), CONTENT.left, doc.y + 1.5, { width: CONTENT_WIDTH, align: "left" });
    doc.moveDown(0.55);
  }
}

/** Free paragraph text, e.g. certificate body copy. */
export function drawParagraph(doc: PDFKit.PDFDocument, text: string, opts?: { size?: number; lineGap?: number }) {
  ensureSpace(doc, 40);
  doc.font("Helvetica").fontSize(opts?.size ?? 10.5).fillColor(COLOR.body);
  doc.text(text, CONTENT.left, doc.y, { width: CONTENT_WIDTH, align: "left", lineGap: opts?.lineGap ?? 3 });
  doc.moveDown(0.6);
}

/** Right-aligned totals block for invoices. */
export function drawTotals(
  doc: PDFKit.PDFDocument,
  rows: { label: string; value: string; emphasis?: boolean }[],
) {
  ensureSpace(doc, rows.length * 17 + 16);
  const boxWidth = 220;
  const left = CONTENT.right - boxWidth;
  let y = doc.y;

  for (const row of rows) {
    if (row.emphasis) {
      doc.moveTo(left, y - 3).lineTo(CONTENT.right, y - 3).lineWidth(0.6).strokeColor(COLOR.rule).stroke();
      y += 3;
    }
    doc.font(row.emphasis ? "Helvetica-Bold" : "Helvetica").fontSize(row.emphasis ? 11 : 9.5);
    doc.fillColor(row.emphasis ? COLOR.ink : COLOR.muted);
    doc.text(row.label, left, y, { width: boxWidth * 0.55 });
    doc.fillColor(row.emphasis ? COLOR.ink : COLOR.body);
    doc.text(row.value, left + boxWidth * 0.55, y, { width: boxWidth * 0.45, align: "right" });
    y += row.emphasis ? 17 : 15;
  }

  doc.y = y + 6;
  doc.x = CONTENT.left;
  doc.fillColor(COLOR.body);
}

/**
 * Signing block, right-aligned.
 *
 * Stamps the doctor's uploaded signature image when there is one -- that
 * upload is what makes the signature real rather than a decorative field
 * in the database. Without one it prints a ruled line, which is what a
 * doctor who signs by hand actually needs on a printed sheet.
 */
/**
 * Prefixes a doctor's name with "Dr." only when it is not already there.
 *
 * `ClinicUser.name` is stored bare ("Sharma") but `Clinic.doctorName` is
 * stored with the honorific ("Dr. Sharma"), and blindly prefixing both
 * printed "Dr. Dr. Sharma" on the patient history report.
 */
export function doctorName(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

export function drawSignature(
  doc: PDFKit.PDFDocument,
  doctorName: string,
  options?: { signatureImagePath?: string | null; qualifications?: string | null; registrationNumber?: string | null },
) {
  const BLOCK_W = 190;
  const NEEDED = 92;

  // Keep the whole block together: a signature orphaned onto its own page,
  // separated from what it signs, is worse than a page break elsewhere.
  if (doc.y + NEEDED > BODY_BOTTOM) doc.addPage();
  else doc.y += 24;

  const left = CONTENT.right - BLOCK_W;
  const imageTop = doc.y;
  let drewImage = false;

  if (options?.signatureImagePath) {
    try {
      doc.image(options.signatureImagePath, left, imageTop, { fit: [BLOCK_W - 10, 38], align: "center" });
      drewImage = true;
    } catch {
      // Unreadable image -- fall through to the ruled line rather than
      // failing the document over a signature graphic.
    }
  }

  const lineY = imageTop + (drewImage ? 42 : 34);
  doc.moveTo(left, lineY).lineTo(CONTENT.right, lineY).lineWidth(0.7).strokeColor(COLOR.rule).stroke();

  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.ink);
  doc.text(doctorName, left, lineY + 5, { width: BLOCK_W, align: "center" });

  doc.font("Helvetica").fontSize(8).fillColor(COLOR.muted);
  if (options?.qualifications) doc.text(options.qualifications, left, doc.y + 0.5, { width: BLOCK_W, align: "center" });
  if (options?.registrationNumber) {
    doc.text(`Regn. No. ${options.registrationNumber}`, left, doc.y + 0.5, { width: BLOCK_W, align: "center" });
  }
  if (!options?.qualifications && !options?.registrationNumber) {
    doc.text("Signature", left, doc.y + 0.5, { width: BLOCK_W, align: "center" });
  }

  doc.y = doc.y + 6;
  doc.x = CONTENT.left;
}

/**
 * Footer on every page: clinic name, a generated-on stamp, an optional
 * document-specific note, and "Page n of m".
 *
 * Called once, immediately before `doc.end()`. It walks the buffered pages
 * because the total page count is not known until the body is finished --
 * which is exactly why `bufferPages` is on.
 */
export function finalizeDocument(doc: PDFKit.PDFDocument, clinic: ClinicBranding, meta: DocumentMeta) {
  if (!tpl(doc).showFooter) {
    doc.end();
    return;
  }

  const range = doc.bufferedPageRange();
  const generated = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    // The footer sits BELOW the bottom margin by design. pdfkit treats any
    // text written past that margin as overflow and silently adds a new
    // page -- which is why a one-page prescription was coming out as three.
    // Dropping the margin for the duration of the write is the documented
    // way to place page furniture in the margin area.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = PAGE.height - MARGIN.bottom + 6;

    doc.moveTo(CONTENT.left, y - 8).lineTo(CONTENT.right, y - 8).lineWidth(0.4).strokeColor(COLOR.ruleLight).stroke();

    doc.font("Helvetica").fontSize(7).fillColor(COLOR.faint);
    const leftText = [clinic.name, tpl(doc).footerNote || meta.footerNote].filter(Boolean).join("  ·  ");
    doc.text(leftText, CONTENT.left, y, { width: CONTENT_WIDTH * 0.62, lineBreak: false, ellipsis: true });
    doc.text(
      `Generated ${generated}    Page ${i - range.start + 1} of ${range.count}`,
      CONTENT.left + CONTENT_WIDTH * 0.62,
      y,
      { width: CONTENT_WIDTH * 0.38, align: "right", lineBreak: false },
    );

    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
}

/** Starts a new page when less than `needed` points remain, so a heading
 * never sits alone at the bottom of a sheet. */
export function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > BODY_BOTTOM) doc.addPage();
}

export const PDF_LAYOUT = { PAGE, MARGIN, CONTENT, CONTENT_WIDTH, BODY_BOTTOM, COLOR };

// ── Backwards compatibility ─────────────────────────────────────────────
// Existing routes call these three. Kept as thin adapters so the new
// toolkit can be adopted route by route rather than in one risky sweep,
// and so nothing that currently works breaks while that happens.

export function newLetterheadDoc(clinic: ClinicBranding, title: string): PDFKit.PDFDocument {
  return createDocument(clinic, { title });
}

export function patientInfoBlock(
  doc: PDFKit.PDFDocument,
  patient: { name: string; age?: number | null; gender?: string | null; uhid?: string | null },
  date: Date,
) {
  drawInfoGrid(doc, [
    { label: "Patient", value: patient.name },
    { label: "UHID", value: patient.uhid ?? "" },
    { label: "Age / Sex", value: [patient.age != null ? String(patient.age) : null, patient.gender].filter(Boolean).join(" / ") },
    { label: "Date", value: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) },
  ]);
}

export function signatureBlock(
  doc: PDFKit.PDFDocument,
  doctorName: string,
  options?: { signatureImagePath?: string | null; qualifications?: string | null; registrationNumber?: string | null },
) {
  drawSignature(doc, doctorName, options);
}
