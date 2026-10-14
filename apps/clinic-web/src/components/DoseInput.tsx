import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COMMON_PATTERNS,
  SLOT_LABELS,
  SLOT_LABELS_4,
  formatDose,
  isCompleteSlot,
  isDoseChar,
  isPatternDose,
  parseDose,
} from '../lib/dose';

/**
 * The morning-afternoon-night dose, entered as numbers with the dashes
 * already drawn.
 *
 * The doctor used to type "1-0-1" into a text box, separators included,
 * on every row of every prescription. Now the separators are part of the
 * control and only the numbers are typed -- or the whole pattern is one
 * tap, because six patterns cover most of general practice.
 *
 * ── Why it can fall back to a text box ───────────────────────────────
 *
 * Not every dose is a pattern. "5 ml", "apply locally" and "as directed"
 * are real, and a clinic may already have them inside a saved
 * prescription template. `parseDose` refuses anything that is not a
 * pattern and this renders a plain input for it, unchanged. A dose
 * silently reshaped into a grid would be a clinical error, so the grid
 * is never forced on a value it does not fit.
 *
 * ── Keyboard, because this is the highest-volume screen ──────────────
 *
 * Typing a digit moves to the next slot. Typing "/" or "." does not, because
 * the cell is not finished -- "1/" is what "1/2" looks like halfway
 * through. Backspace in an empty slot steps back. Arrows move. Focus
 * selects, so overwriting is one keystroke rather than select-then-type.
 */

interface Props {
  value: string;
  onChange: (dosage: string) => void;
  /** Announced on the first slot, so a screen reader names the row. */
  label?: string;
  className?: string;
}

const emptySlots = (n: number) => Array.from({ length: n }, () => '');

export function DoseInput({ value, onChange, label = 'Dose', className }: Props) {
  // A pattern value is edited in the grid; anything else in a text box.
  // `forceText` lets someone with a pattern value type free text instead,
  // and `forceGrid` lets someone with free text switch to the grid --
  // both deliberate actions, never automatic.
  const [forceText, setForceText] = useState(false);
  const parsed = parseDose(value);
  const usesGrid = !forceText && isPatternDose(value);

  const [slots, setSlots] = useState<string[]>(() => parsed ?? emptySlots(3));
  // What we last told the parent. An incoming value equal to this is our
  // own echo and must not clobber a half-typed cell.
  const emitted = useRef<string>(value);
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (value === emitted.current) return;
    const next = parseDose(value);
    setSlots(next ?? emptySlots(slots.length === 4 ? 4 : 3));
    // Intentionally not depending on slots: this runs for EXTERNAL
    // changes only -- a loaded template, or a quick pattern tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = useCallback(
    (next: string[]) => {
      setSlots(next);
      const out = formatDose(next);
      emitted.current = out;
      onChange(out);
    },
    [onChange],
  );

  const focusCell = (i: number) => {
    const el = cells.current[i];
    if (el) {
      el.focus();
      el.select();
    }
  };

  function onCellChange(i: number, raw: string) {
    const kept = Array.from(raw).filter(isDoseChar).join('').slice(0, 4);
    const next = [...slots];
    next[i] = kept;
    commit(next);
    // Advance only on a finished single digit. A "/" or "." means the
    // cell is still being typed.
    if (/^\d$/.test(kept) && i < slots.length - 1) focusCell(i + 1);
  }

  function onCellKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !slots[i] && i > 0) {
      e.preventDefault();
      focusCell(i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      focusCell(i - 1);
    } else if (e.key === 'ArrowRight' && i < slots.length - 1) {
      e.preventDefault();
      focusCell(i + 1);
    } else if (e.key === '-' || e.key === ' ') {
      // Muscle memory from typing "1-0-1". Treat it as "next slot"
      // rather than letting a dash into a cell.
      e.preventDefault();
      if (i < slots.length - 1) focusCell(i + 1);
    }
  }

  /** Clear anything half-typed on the way out, so nothing invalid saves. */
  function onCellBlur(i: number) {
    if (isCompleteSlot(slots[i]!)) return;
    const next = [...slots];
    next[i] = '';
    commit(next);
  }

  if (!usesGrid) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <input
          aria-label={label}
          placeholder="Dose, e.g. 5 ml"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-emerald-400"
        />
        <button
          type="button"
          onClick={() => {
            setForceText(false);
            // Only safe to open the grid on a value it fits; otherwise
            // start it empty rather than guessing at a conversion.
            if (!isPatternDose(value)) {
              setSlots(emptySlots(3));
              emitted.current = '';
              onChange('');
            }
          }}
          className="self-start text-[11px] text-muted-foreground/70 hover:text-emerald-400"
        >
          Use 1-0-1 grid
        </button>
      </div>
    );
  }

  const labels = slots.length === 4 ? SLOT_LABELS_4 : SLOT_LABELS;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-1">
        {slots.map((slot, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="text-muted-foreground/50 text-xs select-none">–</span>}
            <input
              ref={(el) => {
                cells.current[i] = el;
              }}
              inputMode="decimal"
              aria-label={`${label}: ${labels[i] ?? `slot ${i + 1}`}`}
              title={labels[i]}
              value={slot}
              onChange={(e) => onCellChange(i, e.target.value)}
              onKeyDown={(e) => onCellKeyDown(i, e)}
              onBlur={() => onCellBlur(i)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="0"
              className={cn(
                'w-9 py-2 rounded-lg bg-foreground/5 border border-border/10',
                'text-center text-xs tabular-nums outline-none focus:border-emerald-400',
                'placeholder:text-muted-foreground/30',
              )}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setForceText(true)}
          title="Enter a dose that is not a morning-afternoon-night pattern, like 5 ml"
          className="ml-0.5 p-1 rounded text-muted-foreground/50 hover:text-emerald-400"
        >
          <Pencil size={11} />
        </button>
      </div>

      {/* One tap for the patterns that cover most of general practice. */}
      <div className="flex flex-wrap gap-1">
        {COMMON_PATTERNS.map((p) => {
          const text = p.slots.join('-');
          const active = formatDose(slots) === text;
          return (
            <button
              key={text}
              type="button"
              title={p.hint}
              onClick={() => commit([...p.slots])}
              className={cn(
                'px-1.5 py-0.5 rounded text-[11px] tabular-nums border transition-colors',
                active
                  ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                  : 'border-border/10 bg-foreground/5 text-muted-foreground/70 hover:text-foreground hover:border-border/30',
              )}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
