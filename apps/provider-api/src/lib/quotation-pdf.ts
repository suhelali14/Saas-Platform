/**
 * The PDF proposal that gets emailed to a prospect.
 *
 * Deliberately stand-alone from clinic-api's PDF toolkit: that one draws
 * a clinic's letterhead and serves patients. This one draws the
 * VENDOR's letterhead and serves a buyer evaluating a purchase.
 *
 * The layout is the Indian-invoice convention adapted to pre-sale: a
 * header band with number and date, a from/to grid, the scope and
 * exclusions as prose, a line-item table grouped by category, totals
 * with CGST+SGST or IGST as applicable, the payment and delivery terms,
 * and a signature line. A short cover paragraph goes on page 1 only.
 *
 * The caller passes a buffer destination; this module does not care
 * whether the result is streamed to the client or written to disk. Pdfs
 * are computed on request and never stored.
 */
import PDFDocument from "pdfkit";
import type { Prisma } from "../generated/prisma-client/index.js";

type Quotation = Prisma.QuotationGetPayload<{ include: { lineItems: true } }>;

const PAGE = { W: 595.28, H: 841.89 }; // A4 points
const MARGIN = 48;
const CONTENT_W = PAGE.W - MARGIN * 2;
const COLOR = {
  ink: "#111827",
  inkSoft: "#374151",
  inkFaint: "#6b7280",
  rule: "#e5e7eb",
  band: "#f3f4f6",
  accent: "#0f766e", // teal, same hue as nayaversse.in hero
};

/** Group amounts the Indian way: 1,23,45,678.00 — not 12,345,678.00. */
function inr(amount: number | string | Prisma.Decimal): string {
  const n = typeof amount === "number" ? amount : Number(amount.toString());
  if (!Number.isFinite(n)) return "0.00";
  const [whole = "0", frac = "00"] = n.toFixed(2).split(".");
  const lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree : lastThree;
  return `${grouped}.${frac.padEnd(2, "0")}`;
}

function ymd(d: Date | null | undefined): string {
  if (!d) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
}

function label(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.inkFaint).text(text.toUpperCase());
}

function body(doc: PDFKit.PDFDocument, text: string, opts?: { size?: number; bold?: boolean }) {
  doc
    .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(opts?.size ?? 10)
    .fillColor(COLOR.ink)
    .text(text);
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.6);
  const y = doc.y;
  doc
    .rect(MARGIN, y, 3, 14)
    .fillColor(COLOR.accent)
    .fill();
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLOR.ink)
    .text(text.toUpperCase(), MARGIN + 10, y, { width: CONTENT_W - 10 });
  doc.moveDown(0.35);
}

/** The vendor's letterhead at the top of page 1. Repeated at the top of
 *  continuation pages in a slimmer form. */
function drawHeader(doc: PDFKit.PDFDocument, q: Quotation, slim: boolean) {
  const y = MARGIN - 8;
  // Brand mark
  doc
    .font("Helvetica-Bold")
    .fontSize(slim ? 13 : 20)
    .fillColor(COLOR.ink)
    .text(q.providerName, MARGIN, y);

  if (!slim) {
    const addrLines = [q.providerAddress, q.providerGSTIN ? `GSTIN: ${q.providerGSTIN}` : null]
      .filter(Boolean) as string[];
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLOR.inkFaint)
      .text(addrLines.join("\n"), MARGIN, doc.y + 2, { width: CONTENT_W * 0.55 });
  }

  // Right-hand document block
  const rightX = MARGIN + CONTENT_W * 0.6;
  const rightW = CONTENT_W * 0.4;
  let ry = MARGIN - 8;
  doc
    .font("Helvetica-Bold")
    .fontSize(slim ? 11 : 14)
    .fillColor(COLOR.ink)
    .text("QUOTATION", rightX, ry, { width: rightW, align: "right" });
  ry = doc.y + 2;

  if (!slim) {
    const rows: [string, string][] = [
      ["Number", q.number ?? "DRAFT"],
      ["Date", ymd(q.sentAt ?? q.createdAt)],
      ["Valid until", ymd(q.validUntil)],
    ];
    for (const [k, v] of rows) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLOR.inkFaint)
        .text(k, rightX, ry, { width: rightW * 0.5, align: "right" });
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLOR.ink)
        .text(v, rightX + rightW * 0.5 + 4, ry, { width: rightW * 0.5 - 4, align: "right" });
      ry += 12;
    }
  }

  const bottomY = Math.max(doc.y, ry) + 6;
  doc.strokeColor(COLOR.rule).lineWidth(0.5).moveTo(MARGIN, bottomY).lineTo(MARGIN + CONTENT_W, bottomY).stroke();
  doc.x = MARGIN;
  doc.y = bottomY + 10;
  doc.fillColor(COLOR.ink);
}

/** Two-column "From / To" grid under the header. */
function drawParties(doc: PDFKit.PDFDocument, q: Quotation) {
  const colW = (CONTENT_W - 12) / 2;
  const y = doc.y;
  const draw = (x: number, title: string, lines: (string | null | undefined)[]) => {
    doc.save();
    doc.rect(x, y, colW, 86).strokeColor(COLOR.rule).lineWidth(0.7).stroke();
    doc.y = y + 7;
    doc.x = x + 8;
    label(doc, title);
    doc.moveDown(0.25);
    for (const line of lines) {
      if (!line) continue;
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.ink).text(line, x + 8, doc.y, { width: colW - 16 });
    }
    doc.restore();
  };

  draw(MARGIN, "From", [
    q.providerName,
    q.providerAddress,
    q.providerGSTIN ? `GSTIN: ${q.providerGSTIN}` : null,
    q.providerState ? `State: ${q.providerState}` : null,
  ]);
  draw(MARGIN + colW + 12, "To", [
    q.clientName,
    q.clientAddress,
    q.clientGSTIN ? `GSTIN: ${q.clientGSTIN}` : null,
    q.clientState ? `State: ${q.clientState}` : null,
    q.clientContact,
    q.clientEmail,
  ]);
  doc.y = y + 86 + 10;
  doc.x = MARGIN;
}

/** The line-item table, grouped by category. */
function drawLineTable(doc: PDFKit.PDFDocument, q: Quotation) {
  const cols = [
    { label: "#", w: 24, align: "left" as const },
    { label: "Description", w: CONTENT_W - 24 - 70 - 60 - 60 - 70, align: "left" as const },
    { label: "Unit", w: 70, align: "left" as const },
    { label: "Qty", w: 40, align: "right" as const },
    { label: "Rate (INR)", w: 80, align: "right" as const },
    { label: "Amount (INR)", w: 90, align: "right" as const },
  ];

  const drawRow = (vals: string[], opts: { head?: boolean; bold?: boolean } = {}) => {
    const h = opts.head ? 22 : 18;
    const y = doc.y;
    if (opts.head) {
      doc.rect(MARGIN, y, CONTENT_W, h).fillColor(COLOR.band).fill();
    }
    let x = MARGIN;
    doc
      .font(opts.head || opts.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(opts.head ? 8.5 : 9)
      .fillColor(opts.head ? COLOR.inkSoft : COLOR.ink);
    cols.forEach((c, i) => {
      doc.text(vals[i] ?? "", x + 5, y + (opts.head ? 7 : 4), {
        width: c.w - 10,
        align: c.align,
      });
      x += c.w;
    });
    doc.strokeColor(COLOR.rule).lineWidth(0.4).moveTo(MARGIN, y + h).lineTo(MARGIN + CONTENT_W, y + h).stroke();
    doc.y = y + h;
    doc.x = MARGIN;
  };

  drawRow(cols.map((c) => c.label), { head: true });

  // Group rows by category in a fixed order; the client reads SOFTWARE
  // first because the licence is the main thing they are buying.
  const order = ["SOFTWARE", "IMPLEMENTATION", "TRAINING", "DATA_MIGRATION", "CUSTOMIZATION", "SUPPORT", "HARDWARE", "OTHER"] as const;
  const byCat = new Map<string, typeof q.lineItems>();
  for (const li of q.lineItems) {
    const arr = byCat.get(li.category) ?? [];
    arr.push(li);
    byCat.set(li.category, arr);
  }
  let n = 0;
  for (const cat of order) {
    const items = byCat.get(cat);
    if (!items || items.length === 0) continue;
    // sub-header
    const y = doc.y;
    doc.rect(MARGIN, y, CONTENT_W, 15).fillColor("#f9fafb").fill();
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(COLOR.accent)
      .text(cat.replace("_", " "), MARGIN + 5, y + 4, { width: CONTENT_W - 10 });
    doc.y = y + 15;
    doc.x = MARGIN;

    for (const li of items) {
      n += 1;
      drawRow([
        String(n),
        li.description,
        li.unit,
        Number(li.quantity.toString()).toString(),
        inr(li.unitPrice),
        inr(li.lineTotal),
      ]);
    }
  }
  doc.moveDown(0.5);
}

function drawTotals(doc: PDFKit.PDFDocument, q: Quotation) {
  const rightEdge = MARGIN + CONTENT_W;
  const labelW = 130;
  const valueW = 110;
  const startX = rightEdge - labelW - valueW;

  const row = (k: string, v: string, bold = false) => {
    const y = doc.y;
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(bold ? 10.5 : 9.5)
      .fillColor(bold ? COLOR.ink : COLOR.inkSoft)
      .text(k, startX, y, { width: labelW, align: "right" });
    doc
      .font("Helvetica-Bold")
      .fontSize(bold ? 11 : 9.5)
      .fillColor(COLOR.ink)
      .text(v, startX + labelW + 6, y, { width: valueW - 6, align: "right" });
    doc.y = y + 15;
  };

  row("Subtotal", `₹ ${inr(q.subtotal)}`);
  if (Number(q.discountAmount.toString()) > 0) row("Discount", `- ₹ ${inr(q.discountAmount)}`);
  row("Taxable amount", `₹ ${inr(q.taxableAmount)}`);
  const cgst = Number(q.cgst.toString());
  const sgst = Number(q.sgst.toString());
  const igst = Number(q.igst.toString());
  if (cgst > 0) row("CGST 9%", `₹ ${inr(q.cgst)}`);
  if (sgst > 0) row("SGST 9%", `₹ ${inr(q.sgst)}`);
  if (igst > 0) row("IGST 18%", `₹ ${inr(q.igst)}`);
  doc
    .strokeColor(COLOR.rule)
    .lineWidth(0.5)
    .moveTo(startX, doc.y + 2)
    .lineTo(rightEdge, doc.y + 2)
    .stroke();
  doc.y += 6;
  row("Grand Total", `₹ ${inr(q.total)}`, true);
}

function drawProse(doc: PDFKit.PDFDocument, heading: string, text: string | null | undefined) {
  if (!text || text.trim() === "") return;
  sectionHeading(doc, heading);
  doc.font("Helvetica").fontSize(9.5).fillColor(COLOR.inkSoft).text(text, MARGIN, doc.y, {
    width: CONTENT_W,
    lineGap: 2,
  });
}

function drawSignBlock(doc: PDFKit.PDFDocument, q: Quotation) {
  doc.moveDown(2);
  const colW = (CONTENT_W - 24) / 2;
  const y = doc.y;
  const draw = (x: number, name: string, role: string) => {
    doc.save();
    doc
      .strokeColor(COLOR.rule)
      .lineWidth(0.6)
      .moveTo(x, y + 36)
      .lineTo(x + colW, y + 36)
      .stroke();
    doc.font("Helvetica").fontSize(8).fillColor(COLOR.inkFaint).text("Signature", x, y + 40, { width: colW });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLOR.ink).text(name, x, y + 56, { width: colW });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.inkSoft).text(role, x, y + 68, { width: colW });
    doc.restore();
  };
  draw(MARGIN, q.providerName, "For Nayaversse / Provider");
  draw(MARGIN + colW + 24, q.clientName, "Authorised signatory, Customer");
  doc.y = y + 90;
}

function drawFooter(doc: PDFKit.PDFDocument, q: Quotation) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const y = PAGE.H - MARGIN + 10;
    doc
      .strokeColor(COLOR.rule)
      .lineWidth(0.4)
      .moveTo(MARGIN, y)
      .lineTo(MARGIN + CONTENT_W, y)
      .stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.inkFaint);
    doc.text(
      `${q.providerName}${q.providerGSTIN ? ` · GSTIN ${q.providerGSTIN}` : ""} · Quotation ${q.number ?? "DRAFT"}`,
      MARGIN,
      y + 5,
      { width: CONTENT_W * 0.7 },
    );
    doc.text(`Page ${i + 1} of ${pages.count}`, MARGIN + CONTENT_W * 0.7, y + 5, {
      width: CONTENT_W * 0.3,
      align: "right",
    });
  }
}

export async function renderQuotationPdf(q: Quotation): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `Quotation ${q.number ?? q.id}`,
      Author: q.providerName,
      Subject: q.title,
    },
  });

  // Continuation-page header
  let onFirstPage = true;
  doc.on("pageAdded", () => {
    drawHeader(doc, q, !onFirstPage);
    onFirstPage = false;
  });

  drawHeader(doc, q, false);
  drawParties(doc, q);

  // A short cover line, if provided.
  if (q.summary) {
    doc.font("Helvetica").fontSize(10).fillColor(COLOR.inkSoft).text(q.summary, MARGIN, doc.y, {
      width: CONTENT_W,
      lineGap: 2,
    });
    doc.moveDown(0.6);
  }

  sectionHeading(doc, "Line items");
  drawLineTable(doc, q);
  drawTotals(doc, q);
  drawProse(doc, "Scope of work", q.scope);
  drawProse(doc, "Exclusions", q.exclusions);
  drawProse(doc, "Payment terms", q.paymentTerms);
  drawProse(doc, "Delivery terms", q.deliveryTerms);
  drawSignBlock(doc, q);

  drawFooter(doc, q);
  doc.end();

  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export { inr as formatINR };
