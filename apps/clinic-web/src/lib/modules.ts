/**
 * The modules a plan can include, as the portal shows them.
 *
 * The API is the authority on which are on (it never registers a module
 * that is off); this only names them and says which plan first includes
 * each, for the "not in your plan" screen. Keep in step with
 * apps/clinic-api/src/config/features.ts.
 */

export type PlanTier = 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';

export const PLAN_LABELS: Record<PlanTier, string> = {
  BASIC: 'Clinic',
  STANDARD: 'Polyclinic',
  PREMIUM: 'Hospital',
  ENTERPRISE: 'Multi-specialty',
};

export interface ModuleInfo {
  label: string;
  from: PlanTier;
  /** One line on what it does, for someone deciding whether to ask for it. */
  what: string;
}

export const MODULE_INFO: Record<string, ModuleInfo> = {
  staff: { label: 'Staff accounts', from: 'BASIC', what: 'A login for each person, so the audit log says who did what.' },
  billing: { label: 'Billing', from: 'BASIC', what: 'Bills, part payments and the daily cash closing.' },
  labs: { label: 'Lab orders', from: 'BASIC', what: 'Order tests during a visit and record the results.' },
  pharmacy: { label: 'Pharmacy & stock', from: 'STANDARD', what: 'Dispensing, batch stock, expiry and low-stock alerts.' },
  analytics: { label: 'Reports', from: 'STANDARD', what: 'Visits over time, common diagnoses, each doctor’s workload.' },
  expenses: { label: 'Expenses & profit', from: 'STANDARD', what: 'The clinic’s spending, and profit against what was collected.' },
  multilingual: { label: 'Website languages', from: 'STANDARD', what: 'Your website in up to 12 Indian languages.' },
  aitranslate: { label: 'Machine translation', from: 'PREMIUM', what: 'First drafts of website translations, for you to check.' },
  departments: { label: 'Departments', from: 'PREMIUM', what: 'Specialities and service points, each person seeing only their own work.' },
  cashcounter: { label: 'Cash counter', from: 'PREMIUM', what: 'Counter sessions, deposits, refunds and the day’s close.' },
  ipd: { label: 'Inpatients', from: 'PREMIUM', what: 'Wards and beds, admission, transfer and discharge.' },
  ot: { label: 'Operation theatre', from: 'PREMIUM', what: 'Theatre bookings and surgery records.' },
  insurance: { label: 'Insurance desk', from: 'PREMIUM', what: 'Pre-authorisation, claims and settlements with insurers and TPAs.' },
  schemes: { label: 'Government schemes', from: 'ENTERPRISE', what: 'PM-JAY, MJPJAY, CGHS and ECHS patients, packages and claims.' },
  radiology: { label: 'Radiology', from: 'ENTERPRISE', what: 'X-ray, ultrasound and scan orders and reports.' },
  nursing: { label: 'Nursing stations', from: 'ENTERPRISE', what: 'Ward rounds, vitals charts and medicine given.' },
  scribe: { label: 'Clinic assistant', from: 'ENTERPRISE', what: 'Listens to the consultation and drafts the note and prescription for the doctor to confirm.' },
};
