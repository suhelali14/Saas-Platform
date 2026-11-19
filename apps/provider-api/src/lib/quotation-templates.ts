/**
 * Pre-filled line items for a quotation, by plan tier and by common
 * clinic kind. Everything here is a *starting point* for the owner to
 * edit on a call, not a fixed rate card -- a stored price would get
 * out of date the week the first clinic negotiated, and the whole
 * reason the quotation feature exists is to agree the number for THIS
 * deal rather than publish one.
 *
 * Figures come from the rupee bands on
 * https://www.adrine.in/blog/hospital-software-cost-india -- the owner
 * can slide them per client without touching code.
 *
 * Line categories are deliberately coarser than the invoice SAC codes:
 * what a client reads ("Implementation") is not what the tax column
 * wants ("998313"). The SAC is attached when the line hits the invoice
 * adapter, see billing.ts.
 */
import type { PlanTier } from "./plans.js";

export type LineCategory =
  | "SOFTWARE"
  | "IMPLEMENTATION"
  | "TRAINING"
  | "CUSTOMIZATION"
  | "DATA_MIGRATION"
  | "SUPPORT"
  | "HARDWARE"
  | "OTHER";

export interface TemplateLine {
  category: LineCategory;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  /** A line note shown under the description in the PDF, not required. */
  hint?: string;
}

export interface QuotationTemplate {
  /** The owner picks one of these on new-quote. */
  id: string;
  /** Shown in the picker. */
  label: string;
  /** One line under the label. */
  summary: string;
  planTier: PlanTier;
  lines: TemplateLine[];
  /** Section text seeded into the quotation. */
  scope: string;
  exclusions: string;
  paymentTerms: string;
  deliveryTerms: string;
}

/**
 * Small clinic — the Vadgaonkar-shaped deal. One or two doctors, up to
 * five staff logins, patient website on a subdomain, basic forms.
 * The band on adrine.in puts total year-one at ₹24,000 to ₹1,55,000; the
 * numbers below sit inside that band for a clinic at the small end.
 */
export const SMALL_CLINIC_TEMPLATE: QuotationTemplate = {
  id: "small-clinic",
  label: "Small Clinic (1-2 doctors)",
  summary: "Nayaversse BASIC for a solo or two-chair clinic.",
  planTier: "BASIC",
  lines: [
    {
      category: "SOFTWARE",
      description: "Nayaversse BASIC - clinic management licence",
      unit: "per clinic per year",
      quantity: 1,
      unitPrice: 36000,
      hint: "Patients, appointments, case sheets, prescriptions, certificates, billing, public website.",
    },
    {
      category: "IMPLEMENTATION",
      description: "Setup and go-live",
      unit: "one-time",
      quantity: 1,
      unitPrice: 15000,
      hint: "Clinic database, domain, letterhead, signature upload, first-run check.",
    },
    {
      category: "TRAINING",
      description: "Staff training",
      unit: "sessions",
      quantity: 2,
      unitPrice: 2500,
      hint: "Two 90-minute sessions, remote; one for reception, one for the doctor.",
    },
    {
      category: "DATA_MIGRATION",
      description: "Import existing patient records",
      unit: "one-time",
      quantity: 0,
      unitPrice: 8000,
      hint: "Optional. Priced at zero by default; set a quantity if the clinic has a prior system to migrate from.",
    },
  ],
  scope:
    "Nayaversse BASIC covers patient registration, appointments and queue, case sheets, prescriptions on the clinic letterhead, medical certificates, cash billing with receipts, and a public clinic website on a subdomain. Up to 5 staff logins. Hosted and maintained by Nayaversse on managed infrastructure in India.",
  exclusions:
    "Hardware (computers, printers, scanners). On-site staff time beyond the agreed training sessions. SMS, WhatsApp or email delivery of documents to patients (available on a higher plan). Custom medical forms beyond the ten starter templates. Integrations with external labs or insurance.",
  paymentTerms:
    "50% on signing the agreement, 50% on go-live. Yearly service fee is invoiced on the go-live anniversary thereafter. All amounts in INR. GST as applicable.",
  deliveryTerms:
    "Go-live within 10 working days of signed agreement and the clinic providing a logo, signature image, address, registration number and doctor profile.",
};

/**
 * Polyclinic / small hospital — two to four doctors, reception, maybe a
 * pharmacy counter. Standard plan, with first-year implementation that
 * touches more.
 */
export const POLYCLINIC_TEMPLATE: QuotationTemplate = {
  id: "polyclinic",
  label: "Polyclinic (2-4 doctors)",
  summary: "Nayaversse STANDARD for a polyclinic or small hospital.",
  planTier: "STANDARD",
  lines: [
    {
      category: "SOFTWARE",
      description: "Nayaversse STANDARD - multi-doctor clinic licence",
      unit: "per clinic per year",
      quantity: 1,
      unitPrice: 96000,
      hint: "Everything in BASIC, plus staff management, pharmacy inventory with FEFO, lab orders, expenses and P&L, audit log.",
    },
    {
      category: "IMPLEMENTATION",
      description: "Setup, data migration and go-live",
      unit: "one-time",
      quantity: 1,
      unitPrice: 60000,
    },
    {
      category: "TRAINING",
      description: "Staff training - on-site + remote",
      unit: "one-time",
      quantity: 1,
      unitPrice: 35000,
      hint: "One on-site day for reception, pharmacy and the nursing team; two remote sessions for the doctors.",
    },
    {
      category: "DATA_MIGRATION",
      description: "Patient record and drug inventory import",
      unit: "one-time",
      quantity: 1,
      unitPrice: 30000,
    },
    {
      category: "CUSTOMIZATION",
      description: "Custom specialty forms",
      unit: "forms",
      quantity: 3,
      unitPrice: 5000,
      hint: "Built with the form builder. Standard templates are free of charge.",
    },
  ],
  scope:
    "Nayaversse STANDARD for a polyclinic: all BASIC modules, plus multi-doctor support with per-doctor queues and the daily closing broken down by doctor. Pharmacy module with batch inventory, FEFO dispensing, expiry alerts. Lab orders with external-report upload. Expenses ledger and monthly P&L. Append-only audit log for DPDP/NABH. Up to 15 staff logins.",
  exclusions:
    "Hardware. Integration with external pharmacy wholesaler systems. HL7 / FHIR integration with a hospital information system. Custom analytics reports beyond the five that ship standard. Insurance TPA integration.",
  paymentTerms:
    "40% on signing, 40% on go-live, 20% on 60-day acceptance. Yearly service fee invoiced annually on the anniversary. INR. GST applicable.",
  deliveryTerms:
    "Go-live within 20 working days of signed agreement, client-provided artefacts and a confirmed training window.",
};

/**
 * Small hospital — four to ten doctors, in-patient beds. Premium plan.
 * The adrine.in band for a 50-bed hospital is ₹2,80,000-8,20,000 year
 * one; these numbers sit mid-band.
 */
export const HOSPITAL_TEMPLATE: QuotationTemplate = {
  id: "hospital-small",
  label: "Small Hospital (50 beds)",
  summary: "Nayaversse PREMIUM for a 20-50 bed hospital.",
  planTier: "PREMIUM",
  lines: [
    {
      category: "SOFTWARE",
      description: "Nayaversse PREMIUM - hospital licence",
      unit: "per hospital per year",
      quantity: 1,
      unitPrice: 240000,
    },
    {
      category: "IMPLEMENTATION",
      description: "Full implementation incl. on-site rollout",
      unit: "one-time",
      quantity: 1,
      unitPrice: 125000,
    },
    {
      category: "TRAINING",
      description: "Role-based training",
      unit: "role tracks",
      quantity: 4,
      unitPrice: 15000,
      hint: "Reception, nursing, pharmacy, admin. One on-site day per track + follow-up.",
    },
    {
      category: "DATA_MIGRATION",
      description: "Patient, inventory and ledger migration",
      unit: "one-time",
      quantity: 1,
      unitPrice: 85000,
    },
    {
      category: "CUSTOMIZATION",
      description: "Custom reports and specialty forms",
      unit: "items",
      quantity: 8,
      unitPrice: 8000,
    },
    {
      category: "SUPPORT",
      description: "Priority support - 4-hour response, business hours",
      unit: "per year",
      quantity: 1,
      unitPrice: 48000,
    },
  ],
  scope:
    "Nayaversse PREMIUM for a hospital: all STANDARD modules, plus in-patient beds and ward view, discharge summary composed from the case sheet, role-based access with narrower permissions per role, custom analytics, and priority support with a 4-hour first response during business hours. Unlimited staff logins.",
  exclusions:
    "Hardware (servers if client requires on-premise; printers, barcode scanners). HL7/FHIR interfaces to external HIS or diagnostic equipment. Insurance TPA integration. Any migration from a legacy HIS beyond flat-file export; if the legacy system exports only screen-dumps, a bespoke scraping line item is quoted separately.",
  paymentTerms:
    "30% on signing, 40% on UAT, 20% on go-live, 10% on 90-day acceptance. Yearly service invoiced annually on the anniversary. INR. GST applicable.",
  deliveryTerms:
    "Go-live within 10 weeks of signed agreement, client-confirmed training windows and data readiness.",
};

export const QUOTATION_TEMPLATES: QuotationTemplate[] = [
  SMALL_CLINIC_TEMPLATE,
  POLYCLINIC_TEMPLATE,
  HOSPITAL_TEMPLATE,
];

export function findTemplate(id: string): QuotationTemplate | undefined {
  return QUOTATION_TEMPLATES.find((t) => t.id === id);
}
