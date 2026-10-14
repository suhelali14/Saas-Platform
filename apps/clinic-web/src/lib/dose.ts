/**
 * The morning-afternoon-night dose pattern Indian prescriptions are
 * written in, as data rather than as a string the doctor types.
 *
 * ── The problem this solves ──────────────────────────────────────────
 *
 * The dose field was one text input with the placeholder "Dosage
 * (1-0-1)", so the doctor typed the separators by hand, every row, every
 * prescription. Next to it sat a frequency dropdown. "1-0-1" and "BD"
 * are the same fact: twice a day. Entering both is duplicate work on the
 * highest-volume screen in the product, and nothing stopped a row from
 * saying "1-1-1" and "BD" at the same time -- a prescription that
 * contradicts itself, printed and handed to a pharmacist.
 *
 * So the pattern becomes the input, the separators are drawn rather than
 * typed, and the frequency is derived from it.
 *
 * ── What stays the same ──────────────────────────────────────────────
 *
 * The stored value is still the same string, "1-0-1". `dosage` and
 * `frequency` are separate columns on the printed prescription, and a
 * clinic may have reordered or resized them in its own document
 * template. Changing the stored shape would have meant a migration and a
 * different-looking prescription for a clinic that never asked for one.
 *
 * ── Fractions are not an edge case ───────────────────────────────────
 *
 * Half a tablet is everyday practice, so a slot has to hold "1/2", "0.5"
 * and "½", not one digit. That is also why typing a digit advances to
 * the next slot but typing "/" or "." does not -- the cell is not
 * finished yet.
 */

/** Morning, afternoon, night. A fourth slot appears for four-times-daily. */
export const SLOT_LABELS = ['Morning', 'Afternoon', 'Night'] as const;
export const SLOT_LABELS_4 = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;

/** What one slot may contain: a count, a decimal, a fraction, or blank. */
const SLOT = /^(?:\d{1,2}(?:\.\d{1,2})?|\d{1,2}\/\d{1,2}|[½¼¾])$/;

/** Characters a slot will accept as they are typed. */
export function isDoseChar(ch: string): boolean {
  return /^[0-9./½¼¾]$/.test(ch);
}

/**
 * Is this slot finished?
 *
 * Half-typed fractions are legal on the way to a value -- "1/" is what
 * "1/2" looks like after two keystrokes -- so the input allows them while
 * the cell has focus and clears them on the way out. Without that, a row
 * could be saved reading "1/-0-0", and whatever is in the dose field is
 * printed verbatim on the prescription.
 */
export function isCompleteSlot(slot: string): boolean {
  const v = (slot ?? '').trim();
  return !v || SLOT.test(v);
}

/**
 * Reads a stored dose string back into slots.
 *
 * Returns null for anything that is not a slot pattern -- "5 ml", "apply
 * locally", "as directed". Those are real values a clinic may already
 * have in a saved template, and the caller falls back to a plain text
 * box rather than mangling them into a grid. Refusing to parse is the
 * safe answer here: a dose silently rewritten is a clinical error.
 */
export function parseDose(dosage: string): string[] | null {
  const raw = (dosage ?? '').trim();
  if (!raw) return null;
  const parts = raw.split('-').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 4) return null;
  if (!parts.every((p) => SLOT.test(p))) return null;
  return parts;
}

/** True when this stored value can be edited in the grid. Blank counts. */
export function isPatternDose(dosage: string): boolean {
  return !(dosage ?? '').trim() || parseDose(dosage) !== null;
}

/**
 * Slots back to the stored string.
 *
 * A blank slot becomes "0", because a pattern with a gap in it -- "1--1"
 * -- is not a dose anyone can read. An entirely empty grid stays empty,
 * so a row the doctor has not filled in yet does not become "0-0-0" and
 * pass the form's own required check.
 */
export function formatDose(slots: string[]): string {
  if (slots.every((s) => !s.trim())) return '';
  return slots.map((s) => (s.trim() ? s.trim() : '0')).join('-');
}

/** How many doses a day the pattern describes, ignoring blanks and zeros. */
function activeSlots(slots: string[]): number {
  return slots.filter((s) => {
    const v = s.trim();
    if (!v) return false;
    if (v === '0') return false;
    // "0.0" and "0/2" are zero too, awkward as they are to type.
    const asNumber = v.includes('/')
      ? Number(v.split('/')[0]) / Number(v.split('/')[1])
      : Number(v);
    if (Number.isFinite(asNumber)) return asNumber > 0;
    return true; // ½ ¼ ¾ are all non-zero
  }).length;
}

/**
 * The frequency a pattern implies, or null when it implies nothing.
 *
 * Only the unambiguous counts map. SOS (as needed) and STAT (at once)
 * are not patterns of times-per-day at all, so a doctor who picks either
 * of those keeps it -- see `shouldDeriveFrequency`.
 */
export function frequencyFromDose(slots: string[]): string | null {
  switch (activeSlots(slots)) {
    case 1:
      return 'OD';
    case 2:
      return 'BD';
    case 3:
      return 'TDS';
    case 4:
      return 'QID';
    default:
      return null;
  }
}

/** Frequencies that describe a daily pattern, so a pattern may set them. */
const PATTERN_FREQUENCIES = new Set(['OD', 'BD', 'TDS', 'QID']);

/**
 * Whether typing a pattern should overwrite the frequency already there.
 *
 * It should not overwrite SOS or STAT: a doctor who chose "as needed"
 * meant it, and a pattern of "1-0-1" alongside it is describing the dose
 * to take when needed, not a twice-daily schedule.
 */
export function shouldDeriveFrequency(current: string): boolean {
  return !current || PATTERN_FREQUENCIES.has(current);
}

/**
 * Does the chosen frequency contradict the pattern?
 *
 * Used to warn, never to block. A doctor may have a reason, and refusing
 * to save a prescription because this disagreed would be far worse than
 * printing it. Returns null when there is nothing to say.
 */
export function doseConflict(dosage: string, frequency: string): string | null {
  const slots = parseDose(dosage);
  if (!slots) return null;
  if (!PATTERN_FREQUENCIES.has(frequency)) return null;
  const implied = frequencyFromDose(slots);
  if (!implied || implied === frequency) return null;
  return `${dosage} is ${implied.toLowerCase() === 'od' ? 'once' : implied} a day, but the frequency says ${frequency}.`;
}

/**
 * The patterns worth one tap.
 *
 * Chosen as the ones that cover most of general practice, so the common
 * case is a single click and the keyboard is for the rest. Ordered by how
 * often they come up, not numerically.
 */
export const COMMON_PATTERNS: { slots: string[]; hint: string }[] = [
  { slots: ['1', '0', '1'], hint: 'Morning and night' },
  { slots: ['1', '1', '1'], hint: 'Three times a day' },
  { slots: ['1', '0', '0'], hint: 'Morning only' },
  { slots: ['0', '0', '1'], hint: 'Night only' },
  { slots: ['1', '1', '0'], hint: 'Morning and afternoon' },
  { slots: ['1/2', '0', '1/2'], hint: 'Half, morning and night' },
];
