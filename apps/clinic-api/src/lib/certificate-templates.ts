/**
 * Placeholder resolution for CertificateTemplate.body.
 *
 * Templates use `{{token}}` or `{{token|fallback}}` shaped placeholders
 * that get substituted with real patient / doctor / clinic data at the
 * moment the certificate is issued. The RESOLVED content is what gets
 * stored on the Certificate row; the template's raw body is not, so an
 * edit to a template later doesn't rewrite the history of certificates
 * already issued -- the clinic can audit what was given exactly as it
 * was given.
 *
 * Unknown tokens render as `[missing]` rather than the raw `{{token}}`,
 * because a typo in a template ("{{patietnName}}") is a bug in the
 * template that an issuing doctor should SEE in the preview before
 * signing, not something that silently prints as `{{patietnName}}` on
 * the paper.
 */

export interface CertificateContext {
  patient: {
    name: string;
    age?: number | null;
    gender?: string | null;
    uhid?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  doctor: {
    name: string;
    qualifications?: string | null;
    registrationNumber?: string | null;
  };
  clinic: {
    name: string;
    address?: string | null;
  };
  /** The `fromDate` / `toDate` picked on the issue form, if any. */
  fromDate?: Date | null;
  toDate?: Date | null;
  /** Anything extra the issue form captured -- for REFERRAL this
   *  is typically `{ referredTo, reason }`. Values are strings only
   *  at the placeholder boundary, so complex structures are
   *  pre-flattened by the caller. */
  extras?: Record<string, string>;
}

function readableDate(d: Date | null | undefined): string {
  if (!d) return "___";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(a: Date | null | undefined, b: Date | null | undefined): string {
  if (!a || !b) return "___";
  const ms = b.getTime() - a.getTime();
  const days = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1); // inclusive
  return String(days);
}

/**
 * All the tokens a template can use. The set is intentionally small;
 * adding a token is a schema change the whole clinic sees, not a
 * one-off, so keep the catalogue readable.
 */
export const CERTIFICATE_TOKENS: Record<string, string> = {
  "patientName": "The patient's full name.",
  "patientAge": "The patient's age in years, as stored.",
  "patientGender": "The patient's gender.",
  "patientUHID": "The clinic's UHID / file number for this patient.",
  "patientPhone": "The patient's primary phone.",
  "patientAddress": "The patient's address on file.",
  "doctorName": "The doctor's name, with the 'Dr.' prefix.",
  "doctorQualifications": "The doctor's qualifications (e.g. MBBS, MD).",
  "doctorRegistration": "The doctor's medical council registration number.",
  "clinicName": "The clinic's name as on its Settings.",
  "clinicAddress": "The clinic's address.",
  "fromDate": "The 'valid from' date picked on the issue form (DD Mon YYYY).",
  "toDate": "The 'valid to' date picked on the issue form.",
  "days": "The number of days between fromDate and toDate, inclusive.",
  "today": "Today's date, in DD Mon YYYY format.",
  "referredTo": "Referral only: the doctor / hospital being referred to.",
  "reason": "Referral only: the reason for referral, as typed on the form.",
};

/**
 * Resolve a template body against the given context.
 *
 * Supports `{{token}}` and `{{token|fallback}}` syntax. An unknown
 * token renders as `[unknown: <token>]` so a typo is visible in the
 * preview rather than leaking through to the printed document.
 */
export function resolveCertificateTemplate(
  body: string,
  ctx: CertificateContext,
): string {
  const doctorNameFull = ctx.doctor.name.toLowerCase().startsWith("dr")
    ? ctx.doctor.name
    : `Dr. ${ctx.doctor.name}`;

  const lookup: Record<string, string | null | undefined> = {
    patientName: ctx.patient.name,
    patientAge: ctx.patient.age != null ? String(ctx.patient.age) : null,
    patientGender: ctx.patient.gender,
    patientUHID: ctx.patient.uhid,
    patientPhone: ctx.patient.phone,
    patientAddress: ctx.patient.address,
    doctorName: doctorNameFull,
    doctorQualifications: ctx.doctor.qualifications,
    doctorRegistration: ctx.doctor.registrationNumber,
    clinicName: ctx.clinic.name,
    clinicAddress: ctx.clinic.address,
    fromDate: readableDate(ctx.fromDate),
    toDate: readableDate(ctx.toDate),
    days: daysBetween(ctx.fromDate, ctx.toDate),
    today: readableDate(new Date()),
    ...(ctx.extras ?? {}),
  };

  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|\s*([^}]*?))?\s*\}\}/g, (_, token, fallback) => {
    const val = lookup[token];
    if (val != null && val !== "") return String(val);
    if (fallback != null) return String(fallback).trim();
    // An unknown token renders visibly rather than silently -- a typo
    // is a template bug to catch at preview, not on the printed paper.
    if (!(token in lookup) && !(token in (ctx.extras ?? {}))) return `[unknown: ${token}]`;
    return "___";
  });
}

/**
 * Seed templates every clinic starts with. These exactly mirror what
 * the hardcoded `defaultContent()` used to emit, so a clinic that has
 * been running on this software gets no behaviour change -- the
 * machinery underneath is just data now.
 */
export const SEED_TEMPLATES: Array<{
  type: "SICK_LEAVE" | "FITNESS" | "REFERRAL";
  name: string;
  description: string;
  body: string;
  isDefault: boolean;
}> = [
  {
    type: "SICK_LEAVE",
    name: "Standard Sick Leave",
    description: "Generic medical leave for illness; from/to dates required.",
    body: "This is to certify that {{patientName}}{{patientAge|}} was examined on {{today}} and advised rest from {{fromDate}} to {{toDate}} ({{days}} day(s)) due to medical illness.",
    isDefault: true,
  },
  {
    type: "FITNESS",
    name: "Standard Fitness Certificate",
    description: "Returning to normal duties / activities after illness.",
    body: "This is to certify that {{patientName}} was examined on {{today}} and is found fit to resume regular duties and activities.",
    isDefault: true,
  },
  {
    type: "FITNESS",
    name: "Pre-employment Fitness",
    description: "Fitness certificate for a new job appointment.",
    body: "This is to certify that {{patientName}} was medically examined on {{today}} for pre-employment fitness and is found to be in good health, fit for regular employment, with no evident medical condition that would prevent them from carrying out the duties expected.",
    isDefault: false,
  },
  {
    type: "REFERRAL",
    name: "Standard Referral",
    description: "General referral for further evaluation and management.",
    body: "{{patientName}}{{patientAge|}}{{patientGender|}} is being referred to {{referredTo|a specialist}} for further evaluation and management. {{reason|Kindly assess and advise.}}\n\nRegards,\n{{doctorName}}",
    isDefault: true,
  },
];
