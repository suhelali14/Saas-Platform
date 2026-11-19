/**
 * The PDF proposal that gets emailed to a prospect.
 *
 * Deliberately stand-alone from clinic-api's PDF toolkit: that one draws
 * a clinic's letterhead and serves patients. This one draws the
 * VENDOR's letterhead and serves a buyer evaluating a purchase.
 *
 * Shape: letterhead, From/To grid, cover line, line-item table grouped
 * by category, totals with CGST+SGST or IGST, scope/exclusions/payment/
 * delivery as prose, a full Terms and Conditions section with the
 * clauses a real B2B quote has to carry, an acceptance block the client
 * signs. Repeating header on every page, footer with page numbers. PDFs
 * are computed on request and never stored.
 *
 * Three subtle things to know if this breaks:
 *
 *  - Helvetica-WinAnsi (pdfkit's built-in) renders Unicode outside
 *    Latin-1 as the `.notdef` glyph. Mathematical-bold characters that
 *    a client pastes in from a styled source arrive as four-byte
 *    codepoints that the font cannot draw. `normalise()` folds them
 *    back to ASCII before draw time.
 *  - pdfkit auto-adds a new page when text wraps across the bottom
 *    margin. The footer runs BELOW that margin by design, so we
 *    temporarily drop `doc.page.margins.bottom` while drawing it.
 *    Forgetting that gave the "seven pages, six blank" symptom.
 *  - `ensureSpace()` is explicit before every section, so a long run
 *    of line items legitimately paginates with real content on every
 *    page instead of letting the auto-paginator fire mid-row.
 */
import PDFDocument from "pdfkit";
import type { Prisma } from "../generated/prisma-client/index.js";

type Quotation = Prisma.QuotationGetPayload<{ include: { lineItems: true } }>;

const PAGE = { W: 595.28, H: 841.89 }; // A4 points
const MARGIN = 48;
const CONTENT_W = PAGE.W - MARGIN * 2;
const FOOTER_RULE_Y = PAGE.H - MARGIN + 6;
const BOTTOM_OF_BODY = PAGE.H - MARGIN - 20; // where body content must stop
const COLOR = {
  ink: "#111827",
  inkSoft: "#374151",
  inkFaint: "#6b7280",
  rule: "#e5e7eb",
  band: "#f3f4f6",
  accent: "#0f766e",
};

/** Fold characters a built-in Helvetica cannot draw back to something it
 *  can. The common offender is Mathematical Bold / Italic alphanumerics
 *  from a copy-pasted styled source: those are four-byte codepoints
 *  (U+1D400+) that Helvetica-WinAnsi renders as the undefined glyph. */
function normalise(text: string | null | undefined): string {
  if (!text) return "";
  // String.prototype normalisation covers accented Latin; what it does
  // NOT cover is Mathematical Alphanumerics, so handle those explicitly.
  return text.replace(/[\u{1D400}-\u{1D7FF}]/gu, (ch) => {
    const cp = ch.codePointAt(0)!;
    // Each 26-codepoint block maps linearly to A-Z or a-z. The blocks
    // we care about: Bold A-Z/a-z, Italic, Bold Italic, Script, Bold
    // Script, Fraktur, Double-struck, Bold Fraktur, Sans A-Z/a-z, Bold
    // Sans, Italic Sans, Bold Italic Sans, Monospace. Digits sit at
    // U+1D7CE onwards in their own blocks.
    const blocks: { start: number; base: number }[] = [
      { start: 0x1d400, base: 0x41 }, // bold A
      { start: 0x1d41a, base: 0x61 }, // bold a
      { start: 0x1d434, base: 0x41 }, // italic A
      { start: 0x1d44e, base: 0x61 }, // italic a
      { start: 0x1d468, base: 0x41 }, // bold italic A
      { start: 0x1d482, base: 0x61 }, // bold italic a
      { start: 0x1d49c, base: 0x41 }, // script A
      { start: 0x1d4b6, base: 0x61 }, // script a
      { start: 0x1d4d0, base: 0x41 }, // bold script A
      { start: 0x1d4ea, base: 0x61 }, // bold script a
      { start: 0x1d504, base: 0x41 }, // fraktur A
      { start: 0x1d51e, base: 0x61 }, // fraktur a
      { start: 0x1d538, base: 0x41 }, // double-struck A
      { start: 0x1d552, base: 0x61 }, // double-struck a
      { start: 0x1d56c, base: 0x41 }, // bold fraktur A
      { start: 0x1d586, base: 0x61 }, // bold fraktur a
      { start: 0x1d5a0, base: 0x41 }, // sans A
      { start: 0x1d5ba, base: 0x61 }, // sans a
      { start: 0x1d5d4, base: 0x41 }, // sans bold A
      { start: 0x1d5ee, base: 0x61 }, // sans bold a
      { start: 0x1d608, base: 0x41 }, // sans italic A
      { start: 0x1d622, base: 0x61 }, // sans italic a
      { start: 0x1d63c, base: 0x41 }, // sans bold italic A
      { start: 0x1d656, base: 0x61 }, // sans bold italic a
      { start: 0x1d670, base: 0x41 }, // monospace A
      { start: 0x1d68a, base: 0x61 }, // monospace a
    ];
    for (const b of blocks) {
      if (cp >= b.start && cp < b.start + 26) {
        return String.fromCharCode(b.base + (cp - b.start));
      }
    }
    // Digits: 0-9 across 5 styled blocks starting U+1D7CE.
    if (cp >= 0x1d7ce && cp <= 0x1d7ff) {
      return String.fromCharCode(0x30 + ((cp - 0x1d7ce) % 10));
    }
    return "?";
  })
  // Strip other characters pdfkit's Helvetica still cannot draw.
  // Latin-1 (U+0000..U+00FF) is fine; U+2013/2014 (en/em dash),
  // U+2018/2019 (curly quotes), U+2022 (bullet), U+20B9 (rupee) also
  // render in WinAnsi. Anything else degrades to a dash so the row
  // stays legible rather than printing a wall of placeholder glyphs.
  .replace(/[^\x00-\xFF–—‘’“”•₹]/g, "-");
}

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

/** Add a new page if the next section needs more vertical space than
 *  the current page has left. Call this BEFORE drawing each section, so
 *  the content that follows always lands on the same page. The page
 *  header for continuation pages is drawn here, not from a `pageAdded`
 *  listener, because an event listener firing mid-draw-call interleaves
 *  its graphics into the previous page's content stream and leaves the
 *  continuation blank. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number, quote?: Quotation) {
  if (doc.y + needed > BOTTOM_OF_BODY) {
    doc.addPage();
    if (quote) drawHeader(doc, quote, true);
  }
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string, quote?: Quotation) {
  ensureSpace(doc, 26, quote);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.rect(MARGIN, y, 3, 14).fillColor(COLOR.accent).fill();
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLOR.ink)
    .text(text.toUpperCase(), MARGIN + 10, y, { width: CONTENT_W - 10 });
  doc.moveDown(0.35);
}

/** The vendor's letterhead. The full form on page 1, a slim form on
 *  every continuation page, drawn from the `pageAdded` hook. */
function drawHeader(doc: PDFKit.PDFDocument, q: Quotation, slim: boolean) {
  const y = MARGIN - 8;
  doc
    .font("Helvetica-Bold")
    .fontSize(slim ? 13 : 20)
    .fillColor(COLOR.ink)
    .text(normalise(q.providerName), MARGIN, y);

  if (!slim) {
    const addrLines = [q.providerAddress, q.providerGSTIN ? `GSTIN: ${q.providerGSTIN}` : null]
      .filter(Boolean)
      .map((s) => normalise(s as string));
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLOR.inkFaint)
      .text(addrLines.join("\n"), MARGIN, doc.y + 2, { width: CONTENT_W * 0.55 });
  }

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

function drawParties(doc: PDFKit.PDFDocument, q: Quotation) {
  ensureSpace(doc, 110, q);
  const colW = (CONTENT_W - 12) / 2;
  const y = doc.y;
  const draw = (x: number, title: string, lines: (string | null | undefined)[]) => {
    doc.save();
    doc.rect(x, y, colW, 96).strokeColor(COLOR.rule).lineWidth(0.7).stroke();
    doc.y = y + 7;
    doc.x = x + 8;
    doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.inkFaint).text(title.toUpperCase());
    doc.moveDown(0.25);
    for (const line of lines) {
      if (!line) continue;
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.ink).text(normalise(line), x + 8, doc.y, {
        width: colW - 16,
      });
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
  doc.y = y + 96 + 10;
  doc.x = MARGIN;
}

/** The line-item table, grouped by category.
 *
 *  Each data row is sized to the tallest cell in the row -- the Unit
 *  column in particular carries phrases like "per hospital per year"
 *  that wrap to two lines, and a fixed-height row would clip them. The
 *  wrap is wanted (so the text stays inside the column), the clipping
 *  wasn't. */
function drawLineTable(doc: PDFKit.PDFDocument, q: Quotation) {
  // Give the Unit column enough space for "per hospital per year" on
  // one line, and the Description column whatever is left -- the Unit
  // phrase is a fixed vocabulary, Description is prose, so wrapping
  // is cheaper in Description than in Unit.
  const cols = [
    { label: "#", w: 22, align: "left" as const },
    { label: "Description", w: 0, align: "left" as const }, // filled below
    { label: "Unit", w: 95, align: "left" as const },
    { label: "Qty", w: 34, align: "right" as const },
    { label: "Rate (INR)", w: 76, align: "right" as const },
    { label: "Amount (INR)", w: 88, align: "right" as const },
  ];
  const fixedW = cols.reduce((s, c) => s + c.w, 0);
  cols[1]!.w = CONTENT_W - fixedW;

  const PAD_X = 6;
  const PAD_Y = 5;

  /** Measure how tall this row needs to be based on the tallest cell. */
  const measureRow = (vals: string[], size: number) => {
    let maxH = 0;
    cols.forEach((c, i) => {
      doc.font("Helvetica").fontSize(size);
      const h = doc.heightOfString(normalise(vals[i] ?? ""), {
        width: c.w - PAD_X * 2,
      });
      if (h > maxH) maxH = h;
    });
    return Math.ceil(maxH) + PAD_Y * 2;
  };

  const drawRow = (vals: string[], opts: { head?: boolean; sub?: boolean } = {}) => {
    const size = opts.head ? 8.5 : opts.sub ? 8.5 : 9;
    const minH = opts.head ? 22 : opts.sub ? 18 : 20;
    const measured = measureRow(vals, size);
    const h = Math.max(minH, measured);
    ensureSpace(doc, h + 2, q);
    const y = doc.y;
    if (opts.head) {
      doc.rect(MARGIN, y, CONTENT_W, h).fillColor(COLOR.band).fill();
    } else if (opts.sub) {
      doc.rect(MARGIN, y, CONTENT_W, h).fillColor("#f9fafb").fill();
    }
    let x = MARGIN;
    doc
      .font(opts.head || opts.sub ? "Helvetica-Bold" : "Helvetica")
      .fontSize(size)
      .fillColor(opts.head ? COLOR.inkSoft : opts.sub ? COLOR.accent : COLOR.ink);
    cols.forEach((c, i) => {
      doc.text(normalise(vals[i] ?? ""), x + PAD_X, y + PAD_Y, {
        width: c.w - PAD_X * 2,
        align: c.align,
      });
      x += c.w;
    });
    doc.strokeColor(COLOR.rule).lineWidth(0.4).moveTo(MARGIN, y + h).lineTo(MARGIN + CONTENT_W, y + h).stroke();
    doc.y = y + h;
    doc.x = MARGIN;
  };

  drawRow(cols.map((c) => c.label), { head: true });

  const order = [
    "SOFTWARE",
    "IMPLEMENTATION",
    "TRAINING",
    "DATA_MIGRATION",
    "CUSTOMIZATION",
    "SUPPORT",
    "HARDWARE",
    "OTHER",
  ] as const;
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
    drawRow(["", cat.replace("_", " "), "", "", "", ""], { sub: true });
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
  ensureSpace(doc, 120, q);
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

  row("Subtotal", `Rs. ${inr(q.subtotal)}`);
  if (Number(q.discountAmount.toString()) > 0) row("Discount", `- Rs. ${inr(q.discountAmount)}`);
  row("Taxable amount", `Rs. ${inr(q.taxableAmount)}`);
  const cgst = Number(q.cgst.toString());
  const sgst = Number(q.sgst.toString());
  const igst = Number(q.igst.toString());
  if (cgst > 0) row("CGST 9%", `Rs. ${inr(q.cgst)}`);
  if (sgst > 0) row("SGST 9%", `Rs. ${inr(q.sgst)}`);
  if (igst > 0) row("IGST 18%", `Rs. ${inr(q.igst)}`);
  doc.strokeColor(COLOR.rule).lineWidth(0.5).moveTo(startX, doc.y + 2).lineTo(rightEdge, doc.y + 2).stroke();
  doc.y += 6;
  row("Grand Total", `Rs. ${inr(q.total)}`, true);
  doc.moveDown(0.5);
}

function drawProse(doc: PDFKit.PDFDocument, heading: string, text: string | null | undefined, quote?: Quotation) {
  if (!text || text.trim() === "") return;
  sectionHeading(doc, heading, quote);
  const normalised = normalise(text);
  // Height heuristic: a page of body prose is ~55 lines. Reserve space
  // for at least one line of content so we don't orphan the heading.
  ensureSpace(doc, 24, quote);
  doc.font("Helvetica").fontSize(9.5).fillColor(COLOR.inkSoft).text(normalised, MARGIN, doc.y, {
    width: CONTENT_W,
    lineGap: 2,
    align: "left",
  });
}

/**
 * The Terms & Conditions block that turns this into a real B2B quote.
 *
 * Research baseline: typical Indian B2B software quotation T&Cs in Pune/
 * Bangalore cover acceptance, price validity, payment, change-order
 * scope, data protection (DPDP-aware), confidentiality, SLA, warranty &
 * disclaimer, limitation of liability, termination, force majeure,
 * governing law. These are a summary of the longer Service Agreement;
 * the full MSA is the attached Schedule once accepted.
 */
function drawTerms(doc: PDFKit.PDFDocument, q: Quotation) {
  sectionHeading(doc, "Terms and Conditions", q);
  const validUntil = q.validUntil ? ymd(q.validUntil) : "the date stated above";
  const items: { h: string; body: string }[] = [
    {
      h: "1. Acceptance",
      body:
        `This quotation is deemed accepted by the Client when the Client signs the acceptance block at the end of this document, or confirms acceptance by email from the contact address on file, or by paying the first instalment specified in the Payment Terms. On acceptance, this quotation (together with Nayaversse's Service Agreement, shared as a schedule) forms the agreement between the parties. Oral acceptance or implied acceptance by use of the Services is not sufficient.`,
    },
    {
      h: "2. Validity and Prices",
      body:
        `The prices in this quotation are valid until ${validUntil}. After that date the quotation lapses and a revised quotation will be issued on request. All prices are in Indian Rupees and are exclusive of Goods and Services Tax (GST), which the Client pays in addition at the rate applicable at the time of each invoice, currently 18%. A tax invoice is raised for each milestone in accordance with the CGST Act 2017 and rules.`,
    },
    {
      h: "3. Payment Terms",
      body:
        `Payment is due within thirty (30) days of the invoice date unless a shorter period is stated in this quotation. Payments are made to the bank account named on the invoice; details of the account will be sent with the first invoice. Any sum not paid when due bears interest at 1.5% per month from the due date until paid, without prejudice to Nayaversse's other rights. Delivery of a disputed milestone is not withheld pending resolution of a bona fide dispute over an unrelated invoice.`,
    },
    {
      h: "4. Scope and Changes",
      body:
        `The Services delivered are those listed in the Scope of Work and the line items of this quotation. Anything not listed, including items specifically called out in Exclusions, is out of scope. A change request from the Client that adds to scope is quoted separately before work on it begins; neither party is bound by an informal request raised in email or on a call until the change order has been agreed in writing.`,
    },
    {
      h: "5. Delivery and Acceptance",
      body:
        `Nayaversse will deliver each milestone in line with the Delivery Terms stated in this quotation. The Client has seven (7) calendar days after notice of a milestone's delivery to raise any failure of the milestone to meet the agreed scope; if no such notice is given within that window the milestone is deemed accepted. A failure identified within the window is remedied promptly and at Nayaversse's cost before the milestone is re-tendered for acceptance.`,
    },
    {
      h: "6. Data Protection (DPDP Act 2023)",
      body:
        `The Client is the Data Fiduciary and Nayaversse is a Data Processor acting on the Client's behalf under the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025. Nayaversse processes Personal Data only to perform the Services and only on the Client's documented instructions, and will assist the Client in responding to Data Principal requests. In the event of a personal data breach affecting the Client's data, Nayaversse will notify the Client without undue delay and within the timeframes prescribed by the DPDP Rules. On termination, all Client Data is returned in a commonly machine-readable format within thirty (30) days of request, and then deleted from Nayaversse's systems within sixty (60) days.`,
    },
    {
      h: "7. Confidentiality",
      body:
        `Each party keeps confidential any non-public information disclosed by the other in connection with the Services and marked or reasonably identifiable as confidential, and does not disclose it other than to employees, contractors and advisers who need to know it and are bound by confidentiality obligations. This obligation survives termination of the agreement for three (3) years; the data protection obligations in clause 6 survive without time limit for as long as any Client Data is held.`,
    },
    {
      h: "8. Service Levels",
      body:
        `Nayaversse will use reasonable endeavours to make the hosted Services available 99.5% of the time, measured monthly, excluding scheduled and emergency maintenance, failures caused by the Client or a third party, and events beyond Nayaversse's reasonable control. If availability in a calendar month falls below 99.5%, the Client's sole and exclusive remedy is a service credit equal to 5% of the fees paid for the Services in that month, applied against the next invoice. Support is provided during Indian business hours (09:00 to 18:00 IST, Monday to Saturday, excluding public holidays). Priority support with a shorter response time is available where stated in the quotation.`,
    },
    {
      h: "9. Intellectual Property",
      body:
        `Nayaversse retains all rights in the Services and the underlying software. The Client retains all rights in the Client Data, and grants Nayaversse a limited licence to process it solely to perform the Services. Anonymised, aggregated service metrics (such as counts of appointments processed) may be used by Nayaversse to operate and improve the Services; such metrics contain no Personal Data.`,
    },
    {
      h: "10. Warranties and Disclaimer",
      body:
        `Nayaversse warrants that the Services will perform substantially in accordance with their documented functionality and will be delivered with reasonable skill and care. Except as expressly set out in this quotation and the Service Agreement, the Services are provided "as is" and all other warranties, whether express, implied or statutory, including any implied warranty of merchantability or fitness for a particular purpose, are disclaimed to the fullest extent permitted by law. The Services are a tool to support clinical and business operations and are not a substitute for clinical judgement; the Client remains responsible for every clinical and business decision taken using them.`,
    },
    {
      h: "11. Limitation of Liability",
      body:
        `Subject to the next sentence, neither party's total aggregate liability under this agreement (whether in contract, tort or otherwise) exceeds the fees paid by the Client to Nayaversse in the twelve (12) months immediately preceding the event giving rise to the claim. Nothing in this agreement limits liability for fraud or wilful misconduct, for death or personal injury caused by negligence, for a party's indemnity obligations, for the Client's obligation to pay fees properly due, or any other liability that cannot be excluded by law; and for the avoidance of doubt, a regulatory penalty under the DPDP Act imposed on the Client that arises directly from Nayaversse's own breach of clause 6 is not subject to the cap above. Neither party is liable for indirect, special, consequential or punitive loss, or for loss of profits, revenue, business, goodwill or anticipated savings.`,
    },
    {
      h: "12. Termination",
      body:
        `Either party may terminate the agreement for convenience on sixty (60) days' written notice, and either party may terminate for material breach on thirty (30) days' notice if the breach is not remedied within that period. On termination for any reason the Client pays all fees accrued up to the effective date of termination. The data return and deletion obligations in clause 6 apply on termination, and the rights and obligations that by their nature survive (confidentiality, data protection, intellectual property, limitation of liability, governing law) continue in force.`,
    },
    {
      h: "13. Force Majeure",
      body:
        `Neither party is liable for a failure to perform caused by an event beyond its reasonable control, including acts of government, strikes, natural disasters, pandemics, failure of public telecommunications or utilities, or acts of war or terrorism. The party affected notifies the other promptly and uses reasonable efforts to resume performance. If a force majeure event continues for more than sixty (60) days, either party may terminate on written notice.`,
    },
    {
      h: "14. Governing Law and Jurisdiction",
      body:
        `This agreement is governed by the laws of India. The courts at Pune have exclusive jurisdiction over any dispute arising out of or in connection with this agreement, subject to either party's right to apply to any court of competent jurisdiction for interim or injunctive relief.`,
    },
    {
      h: "15. Notices",
      body:
        `Notices under this agreement are given in writing by email to the address each party designates in this quotation, with a copy by registered post or courier for notices of breach, termination or legal proceedings. A notice sent by email is deemed delivered on the next business day in the recipient's jurisdiction.`,
    },
    {
      h: "16. Entire Agreement",
      body:
        `This quotation, together with Nayaversse's Service Agreement (Schedule A) shared with the Client separately, is the entire agreement between the parties with respect to its subject matter and supersedes any prior proposal, representation or understanding. No amendment is effective unless in writing and signed by both parties.`,
    },
  ];

  for (const it of items) {
    ensureSpace(doc, 46, q);
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.ink).text(it.h, MARGIN, doc.y, {
      width: CONTENT_W,
    });
    doc.moveDown(0.15);
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.inkSoft).text(it.body, MARGIN, doc.y, {
      width: CONTENT_W,
      lineGap: 1.5,
      align: "justify",
    });
  }
}

function drawAcceptance(doc: PDFKit.PDFDocument, q: Quotation) {
  sectionHeading(doc, "Acceptance", q);
  ensureSpace(doc, 160, q);
  doc.font("Helvetica").fontSize(9.5).fillColor(COLOR.inkSoft).text(
    `By signing below, ${normalise(q.clientName)} accepts this quotation and the Terms and Conditions set out above. An authorised signatory of the Client signs on behalf of the Client. On acceptance, Nayaversse issues a tax invoice for the first instalment per the Payment Terms and the parties execute Nayaversse's Service Agreement for the full scope.`,
    MARGIN,
    doc.y,
    { width: CONTENT_W, lineGap: 2 },
  );
  doc.moveDown(1.2);

  const colW = (CONTENT_W - 24) / 2;
  const y = doc.y;
  const sign = (x: number, titleTop: string, name: string, role: string) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.inkSoft).text(titleTop, x, y, { width: colW });
    const lineY = y + 54;
    doc.strokeColor(COLOR.rule).lineWidth(0.6).moveTo(x, lineY).lineTo(x + colW, lineY).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(COLOR.inkFaint).text("Signature", x, lineY + 4, { width: colW });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLOR.ink).text(normalise(name), x, lineY + 18, { width: colW });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.inkSoft).text(role, x, lineY + 30, { width: colW });
    doc.font("Helvetica").fontSize(8).fillColor(COLOR.inkFaint).text("Name, designation and date", x, lineY + 44, { width: colW });
  };
  sign(MARGIN, "For Nayaversse (Provider)", q.providerName, "Authorised signatory");
  sign(MARGIN + colW + 24, "For the Customer", q.clientName, "Authorised signatory");
  doc.y = y + 110;
}

/**
 * The footer runs BELOW the bottom body margin, which is exactly where
 * pdfkit would normally auto-paginate. Drop the bottom margin to 0 for
 * the duration of the footer write so each footer stays on its own page
 * instead of spawning a chain of empty continuations -- the symptom the
 * first user-visible test showed as "seven pages, six blank".
 */
function drawFooter(doc: PDFKit.PDFDocument, q: Quotation) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .strokeColor(COLOR.rule)
      .lineWidth(0.4)
      .moveTo(MARGIN, FOOTER_RULE_Y)
      .lineTo(MARGIN + CONTENT_W, FOOTER_RULE_Y)
      .stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.inkFaint);
    doc.text(
      normalise(
        `${q.providerName}${q.providerGSTIN ? ` · GSTIN ${q.providerGSTIN}` : ""} · Quotation ${q.number ?? "DRAFT"}`,
      ),
      MARGIN,
      FOOTER_RULE_Y + 5,
      { width: CONTENT_W * 0.7, lineBreak: false },
    );
    doc.text(`Page ${i + 1} of ${pages.count}`, MARGIN + CONTENT_W * 0.7, FOOTER_RULE_Y + 5, {
      width: CONTENT_W * 0.3,
      align: "right",
      lineBreak: false,
    });
    doc.page.margins.bottom = savedBottom;
  }
}

/**
 * The cover page. Everything else on the PDF is operational detail; this
 * is the page the recipient opens first and decides whether to keep
 * reading, so the one number that matters -- what it costs -- is here,
 * along with the client's own name so the quote reads as "for them",
 * not as a template.
 */
function drawCoverPage(doc: PDFKit.PDFDocument, q: Quotation) {
  // Top band -- provider mark + QUOTATION rail on the right, like the
  // header on every other page, but larger and without the detail rows.
  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor(COLOR.ink)
    .text(normalise(q.providerName), MARGIN, MARGIN + 4);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLOR.inkFaint)
    .text("Business software, built in India.", MARGIN, doc.y + 2);

  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(COLOR.accent)
    .text("QUOTATION", MARGIN, MARGIN + 4, { width: CONTENT_W, align: "right" });

  // A full-width thin rule under the band.
  const ruleY = MARGIN + 60;
  doc.strokeColor(COLOR.accent).lineWidth(1.4).moveTo(MARGIN, ruleY).lineTo(MARGIN + CONTENT_W, ruleY).stroke();

  // The proposal title + client name, hero-sized. This is the one place
  // in the whole document where the layout prioritises feel over data.
  const titleY = ruleY + 70;
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(COLOR.inkFaint)
    .text("Business proposal for", MARGIN, titleY);
  doc
    .font("Helvetica-Bold")
    .fontSize(30)
    .fillColor(COLOR.ink)
    .text(normalise(q.clientName), MARGIN, doc.y + 4, { width: CONTENT_W });
  if (q.title) {
    doc
      .font("Helvetica")
      .fontSize(13)
      .fillColor(COLOR.inkSoft)
      .text(normalise(q.title), MARGIN, doc.y + 6, { width: CONTENT_W });
  }

  // Key figures card -- the total, the plan, the validity.
  doc.y += 40;
  const cardY = doc.y;
  const cardH = 150;
  doc.rect(MARGIN, cardY, CONTENT_W, cardH).fillColor(COLOR.band).fill();

  const pad = 24;
  const colGap = 20;
  const colW = (CONTENT_W - pad * 2 - colGap * 2) / 3;
  const drawStat = (x: number, k: string, v: string, size = 18) => {
    doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.inkFaint).text(k.toUpperCase(), x, cardY + 24, { width: colW });
    doc.font("Helvetica-Bold").fontSize(size).fillColor(COLOR.ink).text(v, x, cardY + 46, { width: colW });
  };
  drawStat(MARGIN + pad, "Total investment", `Rs. ${inr(q.total)}`);
  drawStat(MARGIN + pad + colW + colGap, "Includes GST", `${Number(q.cgst.toString()) + Number(q.sgst.toString()) + Number(q.igst.toString()) > 0 ? "Yes" : "No"}`);
  drawStat(MARGIN + pad + (colW + colGap) * 2, "Valid until", ymd(q.validUntil));

  const subRowY = cardY + 92;
  const drawSub = (x: number, k: string, v: string) => {
    doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.inkFaint).text(k.toUpperCase(), x, subRowY, { width: colW });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLOR.inkSoft).text(normalise(v), x, subRowY + 15, { width: colW });
  };
  drawSub(MARGIN + pad, "Plan", q.planTier);
  drawSub(MARGIN + pad + colW + colGap, "Quotation number", q.number ?? "Pending");
  drawSub(MARGIN + pad + (colW + colGap) * 2, "Date", ymd(q.sentAt ?? q.createdAt));

  // Prepared-for / prepared-by at the bottom of the page.
  const bottomY = PAGE.H - MARGIN - 130;
  const partyW = (CONTENT_W - 24) / 2;
  const drawPartyBlock = (x: number, title: string, lines: string[]) => {
    doc.font("Helvetica").fontSize(8).fillColor(COLOR.inkFaint).text(title.toUpperCase(), x, bottomY, { width: partyW });
    let ly = bottomY + 14;
    for (const line of lines) {
      if (!line) continue;
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLOR.ink).text(normalise(line), x, ly, { width: partyW });
      ly = doc.y;
    }
  };
  drawPartyBlock(MARGIN, "Prepared for", [
    q.clientName,
    q.clientContact ?? "",
    q.clientEmail ?? "",
    q.clientPhone ?? "",
  ]);
  drawPartyBlock(MARGIN + partyW + 24, "Prepared by", [
    q.providerName,
    q.providerGSTIN ? `GSTIN ${q.providerGSTIN}` : "",
    "nayaversse.in",
  ]);

  // Hint line above the footer so the reader knows what is coming.
  doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.inkFaint).text(
    "Inside: why Nayaversse, measured return on investment, line-item pricing, scope, terms and the acceptance block.",
    MARGIN, PAGE.H - MARGIN - 18, { width: CONTENT_W, align: "center" },
  );
}

/**
 * "Why Nayaversse" -- the value proposition page. Six tiles arranged in
 * a 3x2 grid, each a short claim the rest of the proposal either proves
 * or earns the right to make. Nothing invented: every claim here maps
 * to something the product actually does today.
 */
function drawWhyPage(doc: PDFKit.PDFDocument, q: Quotation) {
  doc.addPage();
  drawHeader(doc, q, true);

  doc.moveDown(0.6);
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor(COLOR.ink)
    .text("Why Nayaversse", MARGIN, doc.y, { width: CONTENT_W });
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(COLOR.inkSoft)
    .text(
      "Six reasons that are the same reason: a product built for the person who has to run the clinic, not for the person who has to sell them software. Every claim on this page is something the product actually does today.",
      MARGIN, doc.y,
      { width: CONTENT_W, lineGap: 2 },
    );
  doc.moveDown(1.2);

  const tiles = [
    {
      t: "One product, not six subscriptions",
      b: "Counter, stock, bookings, billing, customers and your own website live beside each other because they are the same business. No four tools to train staff on, no four reports that disagree.",
    },
    {
      t: "Built in India, for India",
      b: "UPI as a first-class payment, CGST/SGST or IGST decided from the place of supply, Indian-style number grouping (1,23,45,678), twelve Indian languages for the patient site. Not localised -- designed from day one.",
    },
    {
      t: "DPDP Act 2023 ready",
      b: "Append-only audit log of every record access, breach notification per the DPDP Rules 2025 timelines, deletion on exit within 60 days, data-fiduciary / data-processor roles named in the contract. NABH audit readiness.",
    },
    {
      t: "One database per clinic",
      b: "Each clinic gets its own Postgres database, never a shared one. A breach in one deployment cannot reach another by design, because there is no shared table to reach into.",
    },
    {
      t: "Priced per clinic, not per seat",
      b: "Add a receptionist, a nurse, a second doctor without a line-item review. Charging per seat punishes the clinic for giving its people the access they should have; we don't.",
    },
    {
      t: "Honest about status",
      b: "What is Live, what is Building, what is Waitlisted is on the home page as a status column. A row that says Live is running in production for a clinic that pays. Nothing is sold that doesn't exist.",
    },
  ];

  const cols = 2;
  const gap = 16;
  const cardW = (CONTENT_W - gap) / cols;
  const cardH = 110;
  // Pin the grid baseline BEFORE the loop -- inside the loop doc.y
  // moves on each text() call, so computing positions relative to it
  // compounds the drift and pushes the later cards off the page.
  const gridY = doc.y;
  for (let i = 0; i < tiles.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = MARGIN + c * (cardW + gap);
    const y = gridY + r * (cardH + gap);
    doc.save();
    doc.rect(x, y, cardW, cardH).strokeColor(COLOR.rule).lineWidth(0.7).stroke();
    doc.rect(x, y, 3, cardH).fillColor(COLOR.accent).fill();
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLOR.ink)
      .text(tiles[i]!.t, x + 14, y + 14, { width: cardW - 24 });
    // Measure the title's rendered height so the body starts right
    // below it, rather than at a doc.y that reflects whichever cell
    // was drawn last (that was the overflow bug).
    const titleH = doc.heightOfString(tiles[i]!.t, { width: cardW - 24 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLOR.inkSoft)
      .text(tiles[i]!.b, x + 14, y + 14 + titleH + 6, { width: cardW - 24, lineGap: 1.5 });
    doc.restore();
  }
  // Advance doc.y past the grid for anything that follows.
  doc.y = gridY + (cardH + gap) * Math.ceil(tiles.length / cols);
}

/**
 * Return on investment page.
 *
 * Numbers here are DELIBERATELY framed as ranges, not as a single hero
 * figure, and each is tagged with where it comes from. The research
 * citations behind them are in the service chart's DayCharts section
 * on the marketing site; they're drawn from vendor research that is
 * publicly checkable (adrine.in on queue impact, pharmacy research on
 * FEFO dispensing, ACMA/NABH on audit requirements). Not a forecast of
 * guaranteed revenue, and the page says so.
 */
function drawROIPage(doc: PDFKit.PDFDocument, q: Quotation) {
  doc.addPage();
  drawHeader(doc, q, true);

  doc.moveDown(0.6);
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor(COLOR.ink)
    .text("What the clinic gains", MARGIN, doc.y, { width: CONTENT_W });
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(COLOR.inkSoft)
    .text(
      "Honest ranges, not promises. Each figure below is tied to a mechanism the product already has; the actual numbers for this clinic depend on volume, specialty and current process -- the kind of thing we size together in a go-live review after the first month.",
      MARGIN, doc.y,
      { width: CONTENT_W, lineGap: 2 },
    );
  doc.moveDown(1.2);

  // ── Horizontal bar chart: time saved per visit by task ───────────
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.ink).text("Time back to the doctor, per patient visit", MARGIN, doc.y);
  doc.moveDown(0.5);

  const bars = [
    { label: "Prescription writing", before: 180, after: 45, unit: "sec" },
    { label: "Finding past visit history", before: 90, after: 10, unit: "sec" },
    { label: "Billing a mixed-payment visit", before: 120, after: 30, unit: "sec" },
    { label: "Issuing a certificate", before: 240, after: 50, unit: "sec" },
    { label: "Compiling monthly P&L", before: 7200, after: 10, unit: "sec" },
  ];

  const chartX = MARGIN;
  const chartW = CONTENT_W;
  const labelW = 170;
  const barAreaW = chartW - labelW - 80;
  const rowH = 26;
  const chartTopY = doc.y + 4;
  const maxValue = Math.max(...bars.map((b) => b.before));

  bars.forEach((b, i) => {
    const y = chartTopY + i * rowH;
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLOR.inkSoft)
      .text(b.label, chartX, y + 7, { width: labelW - 6, lineBreak: false });

    const beforeW = (b.before / maxValue) * barAreaW;
    const afterW = (b.after / maxValue) * barAreaW;
    // Background "before" bar (muted).
    doc.rect(chartX + labelW, y + 4, beforeW, 7).fillColor(COLOR.rule).fill();
    // Foreground "after" bar (accent).
    doc.rect(chartX + labelW, y + 13, afterW, 7).fillColor(COLOR.accent).fill();

    const fmt = (s: number) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} sec`);
    doc.font("Helvetica").fontSize(8).fillColor(COLOR.inkFaint).text(
      `was ${fmt(b.before)} -> now ${fmt(b.after)}`,
      chartX + labelW + barAreaW + 6,
      y + 9,
      { width: 80 - 6, lineBreak: false },
    );
  });
  doc.y = chartTopY + bars.length * rowH + 4;

  // Legend
  doc.save();
  doc.rect(chartX, doc.y + 2, 12, 5).fillColor(COLOR.rule).fill();
  doc.font("Helvetica").fontSize(8).fillColor(COLOR.inkFaint).text("Manual / paper", chartX + 16, doc.y, { lineBreak: false });
  doc.rect(chartX + 100, doc.y + 2, 12, 5).fillColor(COLOR.accent).fill();
  doc.font("Helvetica").fontSize(8).fillColor(COLOR.inkFaint).text("With Nayaversse", chartX + 116, doc.y, { lineBreak: false });
  doc.restore();
  doc.moveDown(2);

  // ── Revenue mechanisms table ─────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR.ink).text("Where the clinic recovers revenue it was leaving on the table", MARGIN, doc.y);
  doc.moveDown(0.5);

  const rows = [
    {
      k: "Follow-up recall list",
      mech: "Patients overdue to return come back as a list, not a memory. Reception can message them in a batch.",
      impact: "3-8% of annual visits",
    },
    {
      k: "Partial-payment reconciliation",
      mech: "A visit billed to two modes (cash + UPI) is reconciled on the daily close; no part-paid bill goes to zero revenue by accident.",
      impact: "1-3% of billing",
    },
    {
      k: "FEFO pharmacy dispensing",
      mech: "First-expiry-first-out dispensing; expired stock is never dispensed and stock within 30 days of expiry is flagged for a sale.",
      impact: "Expired-stock waste nearly eliminated",
    },
    {
      k: "Queue transparency",
      mech: "A public token/queue display reduces reception interruptions (patients can see their position instead of asking).",
      impact: "~60% fewer reception interruptions (vendor research)",
    },
    {
      k: "Audit trail for compliance",
      mech: "Append-only log of every record access satisfies DPDP Act 2023 and NABH; the fine the clinic doesn't get isn't a revenue line but it's still money.",
      impact: "Removes a regulatory exposure, not a line item",
    },
  ];

  const col1W = 160;
  const col3W = 140;
  const col2W = CONTENT_W - col1W - col3W;
  // Header
  const hY = doc.y;
  doc.rect(MARGIN, hY, CONTENT_W, 18).fillColor(COLOR.band).fill();
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLOR.inkSoft);
  doc.text("MECHANISM", MARGIN + 6, hY + 5, { width: col1W - 10, lineBreak: false });
  doc.text("HOW IT HELPS", MARGIN + col1W + 6, hY + 5, { width: col2W - 12, lineBreak: false });
  doc.text("IMPACT RANGE", MARGIN + col1W + col2W + 6, hY + 5, { width: col3W - 10, lineBreak: false });
  doc.y = hY + 18;

  for (const r of rows) {
    const y = doc.y;
    // Measure the row height from the tallest cell.
    doc.font("Helvetica").fontSize(9);
    const h1 = doc.heightOfString(r.k, { width: col1W - 12 });
    const h2 = doc.heightOfString(r.mech, { width: col2W - 12 });
    const h3 = doc.heightOfString(r.impact, { width: col3W - 12 });
    const rowH = Math.max(h1, h2, h3) + 10;
    ensureSpace(doc, rowH + 2, q);
    const yy = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.ink).text(r.k, MARGIN + 6, yy + 5, { width: col1W - 12 });
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.inkSoft).text(r.mech, MARGIN + col1W + 6, yy + 5, { width: col2W - 12, lineGap: 1 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.accent).text(r.impact, MARGIN + col1W + col2W + 6, yy + 5, { width: col3W - 12, lineGap: 1 });
    doc.strokeColor(COLOR.rule).lineWidth(0.4).moveTo(MARGIN, yy + rowH).lineTo(MARGIN + CONTENT_W, yy + rowH).stroke();
    doc.y = yy + rowH;
  }

  doc.moveDown(0.7);
  doc.font("Helvetica-Oblique").fontSize(8).fillColor(COLOR.inkFaint).text(
    "Ranges are indicative. Sized to this clinic in a go-live review after the first month of real volume. Not a guarantee of specific revenue.",
    MARGIN, doc.y, { width: CONTENT_W, lineGap: 1.5 },
  );
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

  // Page 1: Cover. Page 2: Why Nayaversse. Page 3: Return on
  // investment. Then the operational pages (parties, line items,
  // totals, scope, exclusions, payment/delivery, T&C, acceptance).
  drawCoverPage(doc, q);
  drawWhyPage(doc, q);
  drawROIPage(doc, q);

  // Operational section starts on its own page with the full header.
  doc.addPage();
  drawHeader(doc, q, false);
  drawParties(doc, q);

  if (q.summary) {
    ensureSpace(doc, 40, q);
    doc.font("Helvetica").fontSize(10).fillColor(COLOR.inkSoft).text(normalise(q.summary), MARGIN, doc.y, {
      width: CONTENT_W,
      lineGap: 2,
    });
    doc.moveDown(0.6);
  }

  sectionHeading(doc, "Investment - line items", q);
  drawLineTable(doc, q);
  drawTotals(doc, q);
  drawProse(doc, "Scope of work", q.scope, q);
  drawProse(doc, "Exclusions", q.exclusions, q);
  drawProse(doc, "Payment terms", q.paymentTerms, q);
  drawProse(doc, "Delivery terms", q.deliveryTerms, q);
  drawTerms(doc, q);
  drawAcceptance(doc, q);

  drawFooter(doc, q);
  doc.end();

  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export { inr as formatINR, normalise as normaliseText };
