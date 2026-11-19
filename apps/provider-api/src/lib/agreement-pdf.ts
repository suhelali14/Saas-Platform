/**
 * The signed service agreement PDF.
 *
 * A legal document, not a sales doc, so the layout is austere: a title
 * block identifying the parties and the number, every clause with its
 * heading, and a two-signature block at the end. No colour bars beyond
 * one thin rule under the title; no "proposal" marketing lede.
 *
 * Reads clauses from the Agreement.clauses Json, written by
 * buildAgreementClauses() in agreement-terms.ts. Rendering them from
 * the stored value (rather than regenerating on each PDF call) is
 * deliberate: the agreement text is the thing that was signed, and it
 * must not shift when the clause-builder is edited later.
 */
import PDFDocument from "pdfkit";
import type { Prisma } from "../generated/prisma-client/index.js";
import type { Clause } from "./agreement-terms.js";
import { normaliseText as normalise } from "./quotation-pdf.js";

type Agreement = Prisma.AgreementGetPayload<{ include: { quotation: true } }>;

const PAGE = { W: 595.28, H: 841.89 };
const MARGIN = 56;
const CONTENT_W = PAGE.W - MARGIN * 2;
const COLOR = {
  ink: "#111827",
  inkSoft: "#374151",
  inkFaint: "#6b7280",
  rule: "#d1d5db",
  accent: "#0f766e",
};

function ymd(d: Date | null | undefined): string {
  if (!d) return "____________";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
}

/** Add a new page if the next section won't fit, and (because this doc
 *  has no repeating header mid-body) just advance to the top margin
 *  there. If a header is needed on continuation pages later, draw it
 *  here rather than in a pageAdded listener -- see quotation-pdf.ts
 *  for why the listener approach left continuation pages blank. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > PAGE.H - MARGIN - 36) {
    doc.addPage();
  }
}

function drawTitleBlock(doc: PDFKit.PDFDocument, a: Agreement) {
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(COLOR.ink)
    .text("SERVICE AGREEMENT", MARGIN, MARGIN, { width: CONTENT_W, align: "center" });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLOR.inkSoft)
    .text(normalise(a.title), MARGIN, doc.y + 2, { width: CONTENT_W, align: "center" });

  // A thin rule under the title; the rest of the page is prose.
  const y = doc.y + 10;
  doc.strokeColor(COLOR.accent).lineWidth(1.2).moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).stroke();

  // Meta row: number, effective date
  doc.y = y + 10;
  const rows: [string, string][] = [
    ["Agreement Number", a.number ?? "DRAFT"],
    ["Effective Date", ymd(a.effectiveFrom)],
    ["Term", `${a.termMonths} months${a.autoRenew ? ", auto-renewing" : ""}`],
  ];
  const colW = CONTENT_W / 3;
  for (let i = 0; i < rows.length; i++) {
    const [k, v] = rows[i]!;
    const x = MARGIN + i * colW;
    doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.inkFaint).text(k.toUpperCase(), x, doc.y, { width: colW, continued: false });
  }
  const after = doc.y + 10;
  for (let i = 0; i < rows.length; i++) {
    const [, v] = rows[i]!;
    const x = MARGIN + i * colW;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.ink).text(v, x, after, { width: colW });
  }
  doc.y = after + 24;
  doc.x = MARGIN;
}

function drawClause(doc: PDFKit.PDFDocument, c: Clause) {
  ensureSpace(doc, 46);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLOR.ink).text(normalise(c.heading), MARGIN, doc.y, {
    width: CONTENT_W,
  });
  doc.moveDown(0.25);
  for (const p of c.paragraphs) {
    ensureSpace(doc, 24);
    doc.font("Helvetica").fontSize(10).fillColor(COLOR.inkSoft).text(normalise(p), MARGIN, doc.y, {
      width: CONTENT_W,
      lineGap: 2,
      align: "justify",
    });
    doc.moveDown(0.3);
  }
}

function drawSignatures(doc: PDFKit.PDFDocument, a: Agreement) {
  ensureSpace(doc, 180);
  doc.moveDown(1.2);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLOR.ink)
    .text("IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.", MARGIN, doc.y, {
      width: CONTENT_W,
      align: "left",
    });
  doc.moveDown(1.6);

  const colW = (CONTENT_W - 30) / 2;
  const y0 = doc.y;
  const draw = (x: number, titleTop: string, name: string, role: string, signedAt: Date | null | undefined) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.inkSoft).text(titleTop, x, y0, { width: colW });
    const lineY = y0 + 44;
    doc.strokeColor(COLOR.rule).lineWidth(0.8).moveTo(x, lineY).lineTo(x + colW, lineY).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(COLOR.inkFaint).text("Signature", x, lineY + 4, { width: colW });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.ink).text(name, x, lineY + 20, { width: colW });
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.inkSoft).text(role, x, lineY + 34, { width: colW });
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLOR.inkFaint)
      .text(`Date: ${ymd(signedAt)}`, x, lineY + 50, { width: colW });
  };

  draw(MARGIN, "For the Provider", normalise(a.providerSignedBy ?? a.providerName), "Authorised signatory", a.providerSignedAt);
  draw(
    MARGIN + colW + 30,
    "For the Customer",
    normalise(a.clientSignedByName ?? a.clientName),
    normalise(a.clientSignedByRole ?? "Authorised signatory"),
    a.clientSignedAt,
  );
  doc.y = y0 + 140;
}

/**
 * Drop the page bottom margin to 0 for the duration of the footer
 * write, same reason as quotation-pdf: writing below the body margin
 * triggers pdfkit's auto-paginator and yields a chain of blank pages.
 */
function drawFooter(doc: PDFKit.PDFDocument, a: Agreement) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = PAGE.H - MARGIN + 12;
    doc.strokeColor(COLOR.rule).lineWidth(0.4).moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).stroke();
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(COLOR.inkFaint)
      .text(
        normalise(`${a.providerName} & ${a.clientName} - Agreement ${a.number ?? "DRAFT"}`),
        MARGIN,
        y + 5,
        { width: CONTENT_W * 0.7, lineBreak: false },
      );
    doc.text(`Page ${i + 1} of ${pages.count}`, MARGIN + CONTENT_W * 0.7, y + 5, {
      width: CONTENT_W * 0.3,
      align: "right",
      lineBreak: false,
    });
    doc.page.margins.bottom = savedBottom;
  }
}

export async function renderAgreementPdf(a: Agreement): Promise<Buffer> {
  const clauses = (a.clauses as unknown as Clause[]) ?? [];
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `Service Agreement ${a.number ?? a.id}`,
      Author: a.providerName,
      Subject: a.title,
    },
  });

  drawTitleBlock(doc, a);
  for (const c of clauses) drawClause(doc, c);
  drawSignatures(doc, a);
  drawFooter(doc, a);
  doc.end();

  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
