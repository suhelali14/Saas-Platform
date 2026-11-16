import { Baby, HeartPulse, Droplets } from 'lucide-react';

/**
 * The chip beside a patient's name on the queue and patient list, saying
 * what they are open on in two or three characters: "ANC 32w", "DM
 * review". Same shape the API returns from chipsForPatients; this
 * component owns only its look.
 *
 * `overdue` is drawn in amber to catch the eye without claiming the red
 * that the allergy banner uses. The chip is informational -- clicking the
 * row still goes to the patient's record.
 */
export interface SpecialtyChipData {
  key: string;
  short: string;
  episodeId: string;
  urgency: 'due' | 'overdue' | null;
}

function iconFor(key: string) {
  if (key === 'pregnancy') return Baby;
  if (key === 'diabetes') return Droplets;
  if (key === 'cardiac') return HeartPulse;
  return null;
}

/**
 * The booking reason to pre-fill when a patient has one obvious open
 * episode. Null when the episode kind doesn't have a clear repeat visit
 * -- a general diabetes review is too open to default, better the
 * receptionist writes "Tired, breathless" than the system assumes.
 */
export function reasonForChip(chip: SpecialtyChipData | null | undefined): string | null {
  if (!chip) return null;
  if (chip.key === 'pregnancy') return `Antenatal check -- ${chip.short}`;
  if (chip.key === 'infertility') return `Fertility follow-up -- ${chip.short}`;
  return null;
}

export function SpecialtyChip({ chip }: { chip: SpecialtyChipData | null | undefined }) {
  if (!chip) return null;
  const Icon = iconFor(chip.key);
  const tone =
    chip.urgency === 'overdue'
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
      : chip.urgency === 'due'
      ? 'bg-amber-400/10 text-amber-700 dark:text-amber-300'
      : 'bg-foreground/[0.07] text-foreground/80';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-medium ${tone}`}
      title={
        chip.urgency === 'overdue'
          ? `${chip.short} -- due now`
          : chip.urgency === 'due'
          ? `${chip.short} -- due this week`
          : chip.short
      }
    >
      {Icon ? <Icon size={11} aria-hidden="true" /> : null}
      {chip.short}
    </span>
  );
}
