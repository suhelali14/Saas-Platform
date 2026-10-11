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
  EMERGENCY: { label: 'Emergency', color: 'bg-red-500/20 text-red-400' },
  PREGNANT: { label: 'Pregnant', color: 'bg-pink-500/20 text-pink-400' },
  SENIOR_CITIZEN: { label: 'Senior', color: 'bg-amber-500/20 text-amber-400' },
  CHILD: { label: 'Child', color: 'bg-blue-500/20 text-blue-400' },
};
