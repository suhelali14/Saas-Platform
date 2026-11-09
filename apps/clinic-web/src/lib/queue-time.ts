/**
 * How long people have waited, and roughly when they will be called.
 *
 * The estimate is the clinic's own: the middle consultation length among
 * visits finished today. A fixed "10 minutes a patient" would be wrong for
 * every clinic but one, and an average is dragged out by the one forty-
 * minute visit. With fewer than three finished visits there is nothing to
 * go on, so no estimate is shown at all rather than a guess.
 */

export interface TimedVisit {
  id: string;
  status: string;
  doctorId: string | null;
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

const MIN = 60_000;

export function minutesBetween(from: string | Date, to: Date | number): number {
  const a = typeof from === 'string' ? new Date(from).getTime() : from.getTime();
  const b = typeof to === 'number' ? to : to.getTime();
  return Math.max(0, Math.round((b - a) / MIN));
}

/** "4 min", "1 h 05 min". */
export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}

/** The middle consultation length today, or null with fewer than three. */
export function typicalConsultMinutes(visits: TimedVisit[]): number | null {
  const lengths = visits
    .filter((v) => v.status === 'COMPLETED' && v.startedAt && v.completedAt)
    .map((v) => (new Date(v.completedAt!).getTime() - new Date(v.startedAt!).getTime()) / MIN)
    .filter((m) => m > 0 && m < 180)
    .sort((a, b) => a - b);
  if (lengths.length < 3) return null;
  const mid = Math.floor(lengths.length / 2);
  const median = lengths.length % 2 ? lengths[mid]! : (lengths[mid - 1]! + lengths[mid]!) / 2;
  return Math.max(1, Math.round(median));
}

/**
 * Minutes until each waiting visit is likely to be called, keyed by id.
 *
 * Per doctor, because two doctors drain two lines. `waiting` must already
 * be in the order they will be seen (the API's triage order). A visit with
 * no doctor is counted against everyone without one.
 *
 * Someone already with the doctor counts as the remainder of a typical
 * consultation, never less than zero, so a visit running long does not
 * produce a negative wait for the next person.
 */
export function estimateCalls(
  waiting: TimedVisit[],
  inRoom: TimedVisit[],
  typical: number | null,
  now: number,
): Map<string, number> {
  const out = new Map<string, number>();
  if (typical == null) return out;
  const ahead = new Map<string, number>();
  for (const v of inRoom) {
    const key = v.doctorId ?? '';
    const elapsed = v.startedAt ? minutesBetween(v.startedAt, now) : 0;
    ahead.set(key, (ahead.get(key) ?? 0) + Math.max(0, typical - elapsed));
  }
  for (const v of waiting) {
    const key = v.doctorId ?? '';
    const mins = ahead.get(key) ?? 0;
    out.set(v.id, mins);
    ahead.set(key, mins + typical);
  }
  return out;
}

/** "next", "about 5 min", "about 1 h 10 min" -- rounded to five minutes,
 *  because a wait stated to the minute is a promise. */
export function describeEstimate(mins: number): string {
  if (mins < 3) return 'next';
  const rounded = Math.max(5, Math.round(mins / 5) * 5);
  return `about ${formatMinutes(rounded)}`;
}
