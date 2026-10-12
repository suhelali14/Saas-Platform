import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A row of mutually exclusive choices.
 *
 * The portal had seventeen of these, hand-rolled as plain buttons in six
 * screens: Billing's Invoices/Daily Closing, Settings' six tabs,
 * Analytics' date range, Pharmacy's Dispensing/Inventory, the Queue's
 * doctor filter. Visually they matched. Functionally they were not tabs
 * at all -- a screen reader announced "button, button, button" with no
 * indication which was current, and Tab moved through every one of them
 * instead of arrow keys moving between them.
 *
 * ── Why not Radix Tabs ──────────────────────────────────────────────
 *
 * Radix Tabs owns the panels too, which would mean restructuring each
 * screen's `{tab === 'invoices' && <Invoices/>}` into TabsContent. Some
 * of these are not tabs over panels at all -- Analytics' date range and
 * the Queue's doctor filter change the data in one panel rather than
 * swapping panels -- so forcing them into that shape would be wrong as
 * well as a large diff.
 *
 * This keeps the control and leaves the content to the caller, while
 * implementing the tablist keyboard contract properly: arrow keys move,
 * Home and End jump, and only the selected tab is in the tab order, so
 * Tab enters the group once and leaves it once.
 */

export type Segment<T extends string> = {
  value: T;
  label: React.ReactNode;
  /** Announced when the label alone is not descriptive (an icon, "30d"). */
  title?: string;
};

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Segment<T>[];
  /** Describes the group, since a tablist with no name is announced as
   *  an unlabelled group. */
  label: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value, onChange, options, label, className,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next]!.value);
    // Focus follows selection, which is the expected behaviour for a
    // tablist whose panels are already loaded.
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        move(index, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        move(index, -1);
        break;
      case 'Home':
        event.preventDefault();
        move(index, -index);
        break;
      case 'End':
        event.preventDefault();
        move(index, options.length - 1 - index);
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={selected}
            // Only the current tab is reachable by Tab; the arrow keys
            // move within the group. Without this, Tab walks through all
            // six Settings tabs before reaching the form.
            tabIndex={selected ? 0 : -1}
            title={option.title}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              selected
                ? 'bg-foreground text-background'
                : 'bg-foreground/5 text-foreground/80 hover:bg-foreground/10',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
