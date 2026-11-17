/**
 * What a clinic owes Nayaversse, and the GST on it.
 *
 * Pure functions, so the arithmetic can be tested without a database.
 * Amounts are handled in paise and only turned back into rupees at the
 * end: adding Decimal strings in floating point is how an invoice ends up
 * ₹0.01 off its own lines, which an auditor notices.
 *
 * ── The three ways a clinic can pay ──────────────────────────────────
 *
 *   SETUP_YEARLY  the default. A one-time setup fee (installation, data
 *                 import, training, domain) and a yearly service fee
 *                 (hosting, updates, support), billed a year ahead.
 *   SUBSCRIPTION  a monthly fee, billed monthly, quarterly or yearly.
 *   LICENCE_AMC   a one-time licence, then yearly maintenance as a
 *                 percentage of it, plus hosting at cost -- because the
 *                 software still runs on our servers.
 *
 * Yearly billing is the default for a reason beyond cash flow: under
 * RBI's e-mandate rules a recurring debit above ₹15,000 needs the payer's
 * OTP every time, so monthly autopay does not work at hospital prices.
 *
 * ── GST ───────────────────────────────────────────────────────────────
 *
 * 18% on all of it. Within the provider's own state it is split 9% CGST +
 * 9% SGST; to any other state it is 18% IGST, decided by the place of
 * supply, which for a registered business is where it is registered.
 * The SAC codes are defaults to be confirmed with a CA -- published
 * guidance disagrees on which 9983xx heading SaaS belongs under.
 */

export type PricingModel = "SETUP_YEARLY" | "SUBSCRIPTION" | "LICENCE_AMC";
export type BillingCycle = "MONTHLY" | "QUARTERLY" | "ANNUAL";

export const GST_RATE_PERCENT = 18;

export const SAC = {
  setup: "998313", // IT consulting, installation and support
  service: "998315", // hosting and IT infrastructure provisioning
  licence: "997331", // licensing the right to use software
  amc: "998713", // maintenance and repair of computers and software
} as const;

export interface Contract {
  pricingModel: PricingModel;
  billingCycle: BillingCycle;
  setupFee: number | null;
  yearlyFee: number | null;
  monthlyFee: number | null;
  licenceFee: number | null;
  amcPercent: number | null;
  /** Licence model only: hosting charged each year, at cost. */
  hostingFee: number | null;
}

export interface InvoiceLine {
  description: string;
  sac: string;
  /** Rupees, before GST. */
  amount: number;
}

export interface InvoiceTotals {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

const paise = (rupees: number) => Math.round(rupees * 100);
const rupees = (p: number) => p / 100;

const MONTHS: Record<BillingCycle, number> = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12 };

function periodLabel(start: Date, months: number): string {
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  end.setDate(end.getDate() - 1);
  const f = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${f(start)} to ${f(end)}`;
}

/**
 * The lines for one invoice.
 *
 * `first` is the invoice that starts the contract: it carries the one-time
 * charge (setup fee or licence). Every later one is a renewal for the next
 * period. Lines with no amount are left out rather than printed as ₹0.
 */
export function invoiceLines(c: Contract, opts: { first: boolean; periodStart: Date; planLabel: string }): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  const add = (description: string, sac: string, amount: number | null) => {
    if (amount && amount > 0) lines.push({ description, sac, amount: rupees(paise(amount)) });
  };

  if (c.pricingModel === "SETUP_YEARLY") {
    if (opts.first) add(`One-time setup: installation, data import, training (${opts.planLabel} plan)`, SAC.setup, c.setupFee);
    add(`Yearly service fee, ${opts.planLabel} plan: hosting, updates and support, ${periodLabel(opts.periodStart, 12)}`, SAC.service, c.yearlyFee);
  } else if (c.pricingModel === "SUBSCRIPTION") {
    const months = MONTHS[c.billingCycle];
    const fee = c.monthlyFee === null ? null : rupees(paise(c.monthlyFee) * months);
    if (opts.first) add(`One-time setup (${opts.planLabel} plan)`, SAC.setup, c.setupFee);
    add(`Subscription, ${opts.planLabel} plan, ${periodLabel(opts.periodStart, months)}`, SAC.service, fee);
  } else {
    if (opts.first) add(`Software licence, ${opts.planLabel} plan (one-time)`, SAC.licence, c.licenceFee);
    if (!opts.first && c.licenceFee && c.amcPercent) {
      add(`Annual maintenance (${c.amcPercent}% of licence), ${periodLabel(opts.periodStart, 12)}`, SAC.amc, (c.licenceFee * c.amcPercent) / 100);
    }
    add(`Hosting, ${periodLabel(opts.periodStart, 12)}`, SAC.service, c.hostingFee);
  }
  return lines;
}

/**
 * GST on a set of lines. `sameState` is true when the clinic's place of
 * supply is the provider's own state.
 *
 * Tax is worked out on the subtotal, not line by line, and CGST and SGST
 * are each half of the rounded total tax -- so they can never add up to a
 * paisa more or less than 18%.
 */
export function invoiceTotals(lines: InvoiceLine[], sameState: boolean): InvoiceTotals {
  const sub = lines.reduce((s, l) => s + paise(l.amount), 0);
  const tax = Math.round((sub * GST_RATE_PERCENT) / 100);
  if (sameState) {
    const cgst = Math.floor(tax / 2);
    const sgst = tax - cgst;
    return { subtotal: rupees(sub), cgst: rupees(cgst), sgst: rupees(sgst), igst: 0, total: rupees(sub + tax) };
  }
  return { subtotal: rupees(sub), cgst: 0, sgst: 0, igst: rupees(tax), total: rupees(sub + tax) };
}

/** The date as it is in India, whatever the server's own time zone. */
function istParts(d: Date): { y: number; m: number } {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth() };
}

/**
 * The Indian financial year an invoice date falls in, as "2627" for
 * 1 April 2026 to 31 March 2027.
 *
 * Worked out in IST explicitly: on a server running UTC, an invoice issued
 * at 00:30 IST on 1 April is still 31 March there, and took the old
 * year's prefix and serial.
 */
export function financialYear(d: Date): string {
  const { y: year, m } = istParts(d);
  const y = m >= 3 ? year : year - 1;
  return `${String(y % 100).padStart(2, "0")}${String((y + 1) % 100).padStart(2, "0")}`;
}

/**
 * An invoice number: PREFIX/FY/0001.
 *
 * GST requires a consecutive serial, unique within the financial year, of
 * at most 16 characters. The prefix is capped so the whole stays inside
 * that: "NV/2627/0001" is twelve.
 */
export function invoiceNumber(prefix: string, d: Date, serial: number): string {
  const p = prefix.replace(/[^A-Za-z0-9-]/g, "").slice(0, 6) || "INV";
  return `${p}/${financialYear(d)}/${String(serial).padStart(4, "0")}`;
}

/** When the next period starts, after one that started at `from`. */
export function nextPeriodStart(c: Contract, from: Date): Date {
  const months = c.pricingModel === "SUBSCRIPTION" ? MONTHS[c.billingCycle] : 12;
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Indian state GST codes, for the place-of-supply picker. */
export const STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

/** The state code a GSTIN starts with, or null if it is not one. */
export function stateFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const g = gstin.trim().toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return null;
  const code = g.slice(0, 2);
  return STATE_CODES[code] ? code : null;
}
