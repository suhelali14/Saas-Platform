// OPD triage priority categories -- mirrors the backend's PatientCategory
// enum and PRIORITY_TIER sort exactly (apps/clinic-api/src/routes/clinic-appointments.ts).
export const PATIENT_CATEGORIES = [
  { id: 'GENERAL', label: 'General' },
  { id: 'PREGNANT', label: 'Pregnant' },
  { id: 'SENIOR_CITIZEN', label: 'Senior Citizen' },
  { id: 'CHILD', label: 'Child' },
  { id: 'EMERGENCY', label: 'Emergency' },
];

// GENERAL gets no badge -- the common case shouldn't be visually noisy.
export const CATEGORY_BADGES: Record<string, { label: string; color: string }> = {
  EMERGENCY: { label: 'Emergency', color: 'tone-danger' },
  PREGNANT: { label: 'Pregnant', color: 'tone-pink' },
  SENIOR_CITIZEN: { label: 'Senior', color: 'tone-warning' },
  CHILD: { label: 'Child', color: 'tone-info' },
};
