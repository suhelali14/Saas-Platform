import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { describeDateInput, fromDateInput, toDateInput, todayInput } from '../lib/date';

/**
 * A date field, as a button that opens a month grid.
 *
 * ── Why not keep `<input type="date">` ───────────────────────────────
 *
 * On a phone the native control is excellent and this is a step back
 * from it. On the desktop at the front desk it is the opposite: the
 * widget differs per browser, the text segments are fiddly to drive with
 * a mouse, and it shows "14/10/2026" with no weekday -- when "which
 * Tuesday" is precisely the question being asked while booking a
 * follow-up. So: a readable label, a real month grid, and the quick
 * answers ("Today", "Tomorrow") as one tap.
 *
 * The value contract is deliberately identical to the native input --
 * a `YYYY-MM-DD` string, or '' for empty -- so this drops into the
 * twelve places that used one without any caller changing how it stores
 * or submits a date. Every conversion goes through lib/date, which is
 * where the local-vs-UTC rule lives.
 */

interface Props {
  value: string;
  onChange: (iso: string) => void;
  /** Shown when nothing is chosen. */
  placeholder?: string;
  label?: string;
  /** Blocks days before this `YYYY-MM-DD`. Booking cannot be in the past. */
  min?: string;
  /** Blocks days after this. A date of birth cannot be in the future. */
  max?: string;
  /** Offer "Today" / "Tomorrow". Off for a date of birth, where neither helps. */
  quickDays?: boolean;
  /** Allow clearing back to ''. */
  clearable?: boolean;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  label,
  min,
  max,
  quickDays = true,
  clearable = false,
  className,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = fromDateInput(value);
  const minDate = fromDateInput(min);
  const maxDate = fromDateInput(max);

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label ?? placeholder}
          className={cn(
            'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs',
            'bg-foreground/5 border border-border/10 outline-none transition-colors',
            'hover:border-border/30 focus-visible:border-emerald-400',
            'disabled:opacity-40 disabled:pointer-events-none',
            className,
          )}
        >
          <CalendarDays size={13} className="shrink-0 text-muted-foreground/70" aria-hidden />
          <span className={cn('truncate', !value && 'text-muted-foreground/50')}>
            {value ? describeDateInput(value) : placeholder}
          </span>
          {clearable && value && (
            // A span, not a nested button: a button inside the trigger is
            // invalid HTML and the click would open the popover anyway.
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                }
              }}
              className="ml-auto shrink-0 text-muted-foreground/50 hover:text-red-400"
            >
              <X size={12} aria-hidden />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto">
        {quickDays && (
          <div className="flex gap-1 mb-2 pb-2 border-b border-border/10">
            {[
              { label: 'Today', iso: todayInput() },
              { label: 'Tomorrow', iso: toDateInput(new Date(Date.now() + 86_400_000)) },
            ].map((q) => {
              // Respect the same bounds the grid does, so a disabled day
              // is not reachable through a shortcut.
              const blocked = (min && q.iso < min) || (max && q.iso > max);
              if (blocked) return null;
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => pick(q.iso)}
                  className="px-2 py-1 rounded-lg text-[11px] bg-foreground/5 border border-border/10 hover:border-emerald-400/50 hover:text-emerald-300 transition-colors"
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        )}
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate ?? new Date()}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          onSelect={(d) => {
            if (d) pick(toDateInput(d));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
