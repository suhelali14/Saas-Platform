/**
 * OPD triage priority, split by how long it stays true.
 *
 * Mirrors apps/clinic-api/src/lib/triage.ts, which carries the reasoning.
 * The short version: EMERGENCY describes a visit and PREGNANT is true for
 * about nine months, so neither belongs on a patient record that is read
 * for years. They are chosen when booking. CHILD and SENIOR_CITIZEN are
 * facts about a person and are remembered as that patient's usual case,
 * so an eighty-year-old is not re-entered at every visit.
 */

export interface Category {
  id: string;
  label: string;
  /** What it means, for the person choosing it with a patient waiting. */
  hint: string;
}

/** What a PATIENT record may hold: their usual case. */
export const DURABLE_CATEGORIES: Category[] = [
  { id: 'GENERAL', label: 'General', hint: 'The usual case.' },
  { id: 'CHILD', label: 'Child', hint: 'Seen ahead of general patients.' },
  { id: 'SENIOR_CITIZEN', label: 'Senior citizen', hint: '60 and over. Seen early.' },
];

/** What a VISIT may be. Everything above, plus the two that are only
 *  true today. Ordered most urgent first, which is the order someone
 *  scanning for the right one reads in. */
export const VISIT_PRIORITIES: Category[] = [
  { id: 'EMERGENCY', label: 'Emergency', hint: 'Seen before everyone.' },
  { id: 'PREGNANT', label: 'Pregnant', hint: 'Seen early, with senior citizens.' },
  { id: 'SENIOR_CITIZEN', label: 'Senior citizen', hint: '60 and over.' },
  { id: 'CHILD', label: 'Child', hint: 'Ahead of general patients.' },
  { id: 'GENERAL', label: 'General', hint: 'Normal order, by booking time.' },
];

/** Kept for call sites that still offer the patient-level list. */
export const PATIENT_CATEGORIES = DURABLE_CATEGORIES;

// GENERAL gets no badge -- the common case shouldn't be visually noisy.
export const CATEGORY_BADGES: Record<string, { label: string; color: string }> = {
  EMERGENCY: { label: 'Emergency', color: 'tone-danger' },
  PREGNANT: { label: 'Pregnant', color: 'tone-pink' },
  SENIOR_CITIZEN: { label: 'Senior', color: 'tone-warning' },
  CHILD: { label: 'Child', color: 'tone-info' },
};

/**
 * The priority a queue row should show and sort by.
 *
 * The visit's own value wins; the patient's usual case is the fallback.
 * Exactly what the API does -- if these two ever disagree, the badge a
 * receptionist reads stops matching the order the list is in.
 */
export function effectivePriority(row: {
  priority?: string | null;
  patient?: { category?: string | null } | null;
}): string {
  return row.priority ?? row.patient?.category ?? 'GENERAL';
}
