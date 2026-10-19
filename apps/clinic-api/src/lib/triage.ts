/**
 * OPD triage priority: who is seen before whom, and why.
 *
 * ── The bug this file exists to fix ─────────────────────────────────
 *
 * Priority used to live only on the Patient, set once at registration,
 * and every queue sorted on it. Two of the five values are not facts
 * about a person at all:
 *
 *   EMERGENCY is true of a VISIT. Someone who came in once bleeding was
 *     then sorted ahead of everybody on every routine visit for the rest
 *     of their life, including ahead of whoever was actually bleeding
 *     that morning.
 *   PREGNANT is true for about nine months. It stayed set afterwards.
 *
 * The other two have the opposite problem. CHILD and SENIOR_CITIZEN are
 * facts about a person, but they were typed in by hand and never
 * revisited, so they go stale in the other direction -- a child
 * registered at ten is still CHILD at thirty, and nobody who turns
 * sixty-five is ever promoted.
 *
 * So priority is split by how long it is true for:
 *
 *   Appointment.priority  what is true TODAY, chosen when booking.
 *   Patient.category      the usual case, remembered so an eighty-year-
 *                         old is not re-entered at every visit. Limited
 *                         to the durable values.
 *
 * A queue reads the appointment's, falling back to the patient's. That
 * way an emergency applies to the visit it describes and nothing else,
 * while a senior citizen keeps their place without anyone retyping it.
 */

/** Lower is seen sooner. */
export const PRIORITY_TIER: Record<string, number> = {
  EMERGENCY: 0,
  // Tied deliberately: both are the groups Indian OPD guidance names, and
  // ranking one above the other would be inventing a rule nobody set.
  PREGNANT: 1,
  SENIOR_CITIZEN: 1,
  CHILD: 2,
  GENERAL: 3,
};

export const DEFAULT_TIER = 3;

/**
 * What a PATIENT record may carry.
 *
 * Deliberately excludes EMERGENCY and PREGNANT. A field that can store
 * them is a field that will, and then the queue is wrong for years.
 */
export const DURABLE_CATEGORIES = ["GENERAL", "CHILD", "SENIOR_CITIZEN"] as const;

/** What an APPOINTMENT may carry: anything, because a visit is a moment. */
export const VISIT_PRIORITIES = [
  "GENERAL",
  "CHILD",
  "SENIOR_CITIZEN",
  "PREGNANT",
  "EMERGENCY",
] as const;

export function isDurableCategory(value: unknown): boolean {
  return typeof value === "string" && (DURABLE_CATEGORIES as readonly string[]).includes(value);
}

interface Triageable {
  priority?: string | null;
  patient?: { category?: string | null; dob?: Date | null; age?: number | null } | null;
}

/** India's own thresholds: a senior citizen is 60+, a child is under 12
 *  for OPD purposes. Used only to SUGGEST, never to overwrite. */
const SENIOR_FROM = 60;
const CHILD_UNDER = 12;

/**
 * The age-based tier a patient qualifies for, or null when their age is
 * not known.
 *
 * A suggestion for the booking screen, not an override. Reception can see
 * the person; the date of birth on file may be wrong or absent, and on
 * the live clinic most records have neither a dob nor an age.
 */
export function categoryFromAge(patient: { dob?: Date | null; age?: number | null } | null | undefined): string | null {
  if (!patient) return null;
  let years = patient.age ?? null;
  if (years === null && patient.dob) {
    const ms = Date.now() - patient.dob.getTime();
    years = Math.floor(ms / (365.2425 * 24 * 60 * 60 * 1000));
  }
  if (years === null || years < 0 || years > 130) return null;
  if (years >= SENIOR_FROM) return "SENIOR_CITIZEN";
  if (years < CHILD_UNDER) return "CHILD";
  return null;
}

/**
 * The priority a queue should sort this appointment by.
 *
 * The appointment's own value wins because it is the more specific
 * statement: somebody looked at this visit and said what it was.
 */
export function effectivePriority(item: Triageable): string {
  return item.priority ?? item.patient?.category ?? "GENERAL";
}

export function tierOf(item: Triageable): number {
  return PRIORITY_TIER[effectivePriority(item)] ?? DEFAULT_TIER;
}

/**
 * The one comparator every queue uses.
 *
 * There were three sort sites and two copies of the tier table. They
 * agreed, which is how nobody noticed -- the same way the section labels
 * and SECTION_KEYS each went wrong once they were edited in one place and
 * not the others. A queue that disagrees with the waiting-room display
 * about who is next is worse than either being wrong alone.
 */
export function byTriage(a: Triageable, b: Triageable): number {
  return tierOf(a) - tierOf(b);
}
