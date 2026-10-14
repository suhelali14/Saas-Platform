/**
 * Dates, in the clinic's own timezone.
 *
 * ── The trap this exists to close ────────────────────────────────────
 *
 * `new Date("2026-10-14")` is parsed as UTC midnight. Read back in IST
 * (UTC+5:30) that is still 14 October, but `toISOString()` on a local
 * date goes the other way: at 02:00 IST on the 14th, `new Date()`
 * is 20:30 UTC on the 13th, so `toISOString().slice(0, 10)` returns
 * "2026-10-13".
 *
 * That is not theoretical in this codebase. It has been fixed twice --
 * once in the queue's date picker and once for patient dates of birth --
 * and `Analytics.tsx` was still sending UTC dates, so an analytics range
 * opened before about 5:30am reported the wrong days. A clinic's day
 * boundary is local midnight, always.
 *
 * Two rules, and every date in the portal goes through them:
 *
 *   1. A date-only value is a LOCAL calendar date. Serialise it from
 *      getFullYear/getMonth/getDate, never from toISOString().
 *   2. Parse it back anchored at local NOON, so a daylight-saving shift
 *      or an off-by-a-few-hours timezone can never move it to the
 *      neighbouring day. India has no DST, but the clinic software is
 *      not the place to bet on that staying true everywhere it runs.
 *
 * Previously `toDateInput` was copy-pasted into Queue.tsx and
 * Expenses.tsx, and the noon anchor lived inline in one of them. One
 * copy now, so the next screen cannot get a different answer.
 */

/** A local calendar date as the `YYYY-MM-DD` that inputs and APIs use. */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today, as `YYYY-MM-DD`, in the clinic's timezone. */
export function todayInput(): string {
  return toDateInput(new Date());
}

/**
 * `YYYY-MM-DD` back to a Date at local noon.
 *
 * Returns undefined for an empty or malformed value rather than an
 * Invalid Date, so a caller can render "no date" instead of "NaN".
 */
export function fromDateInput(iso: string | null | undefined): Date | undefined {
  const v = (iso ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d, 12, 0, 0, 0);
  // Reject a date the calendar rolled over -- "2026-02-30" would
  // otherwise come back as 2 March and look deliberate.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return undefined;
  }
  return date;
}

/** Add days to a `YYYY-MM-DD`, staying on local calendar days. */
export function shiftDateInput(iso: string, days: number): string {
  const d = fromDateInput(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

/**
 * "Wed, 14 Oct 2026" -- for a control showing a chosen date.
 *
 * Assembled from parts rather than handed to `toLocaleDateString` with
 * every option at once, which under en-IN returns "Wed, 14 Oct, 2026" --
 * a comma before the year that reads like a typo. Only the weekday and
 * month names come from the locale, which is the part that should.
 */
export function formatDateLong(iso: string | null | undefined): string {
  const d = fromDateInput(iso);
  if (!d) return '';
  const weekday = d.toLocaleDateString('en-IN', { weekday: 'short' });
  const month = d.toLocaleDateString('en-IN', { month: 'short' });
  return `${weekday}, ${d.getDate()} ${month} ${d.getFullYear()}`;
}

/** "14 Oct" -- for a dense list or a column. */
export function formatDateShort(iso: string | null | undefined): string {
  const d = fromDateInput(iso);
  if (!d) return '';
  return `${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;
}

/**
 * "Today" / "Tomorrow" / "Yesterday", else a short date.
 *
 * Reception navigating the queue is almost always within a day or two of
 * now, and reading a relative word is faster than parsing a number.
 */
export function describeDateInput(iso: string): string {
  const today = todayInput();
  if (iso === today) return 'Today';
  if (iso === shiftDateInput(today, 1)) return 'Tomorrow';
  if (iso === shiftDateInput(today, -1)) return 'Yesterday';
  return formatDateLong(iso);
}
