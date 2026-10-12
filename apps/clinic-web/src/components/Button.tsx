import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The app's button. One component, one import path.
 *
 * ── The behaviour, which predates the styling ────────────────────────
 *
 * This app had 136 buttons, 30 of which disabled themselves during an
 * async call, and not one spinner anywhere. So a receptionist tapping
 * "Dispense" on a slow connection got no feedback and tapped it again --
 * a double submit against real stock, not a cosmetic miss.
 *
 * Passing an async `onClick` is enough: this awaits the returned promise,
 * shows a spinner and blocks re-entry for its duration. No caller has to
 * thread a `saving` boolean through their component, which is exactly why
 * most of them never did. A caller that already tracks its own state can
 * still pass `busy`; the two are ORed, so adoption never fights existing
 * code.
 *
 * ── The styling, which changed ───────────────────────────────────────
 *
 * Variants were hardcoded Tailwind strings (`bg-primary text-primary-foreground`).
 * They are now cva variants over the design tokens, so the light theme
 * is a token swap rather than another entry in theme.css's remap table.
 *
 * Both vocabularies are accepted on purpose. `primary`/`secondary`/
 * `ghost`/`danger` are what the 15 existing call sites pass, and
 * `default`/`destructive`/`outline`/`link` are what shadcn code expects.
 * Having one button answer to both is what avoids a second Button
 * component with a different dialect -- which is how a codebase ends up
 * with two of everything and no way to tell which is current.
 */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // shadcn's names.
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive/15 text-destructive hover:bg-destructive/25',
        outline: 'border border-border/20 bg-transparent hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // This app's existing names, kept so no call site has to change.
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        danger: 'bg-destructive/15 text-destructive hover:bg-destructive/25',
      },
      size: {
        // 36px. Reception works standing, on a phone, with a patient
        // waiting -- a target smaller than this gets mis-tapped, and a
        // mis-tap on these screens is a clinical record.
        default: 'h-9 px-4 text-sm rounded-md',
        md: 'h-9 px-4 text-sm rounded-md',
        sm: 'h-8 px-3 text-xs rounded-md',
        lg: 'h-10 px-6 text-sm rounded-md',
        icon: 'h-9 w-9 rounded-md',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'default' },
  },
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>,
    VariantProps<typeof buttonVariants> {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  /** Externally-controlled pending state, ORed with the internal one. */
  busy?: boolean;
  /** shadcn's name for the same thing. */
  loading?: boolean;
  /** Replaces the label while pending. Without it the label stays and
   *  only the spinner appears -- right for short or icon-ish buttons. */
  busyLabel?: string;
  icon?: React.ReactNode;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, busy, loading, busyLabel, icon, asChild = false, onClick, children, disabled, ...rest },
  ref,
) {
  const [pending, setPending] = React.useState(false);
  // A component can unmount while its request is still in flight --
  // deleting the row the button lives in is the common case -- and
  // setting state afterwards is a no-op React warns about.
  const alive = React.useRef(true);
  React.useEffect(() => () => { alive.current = false; }, []);

  const isBusy = pending || Boolean(busy) || Boolean(loading);

  const handle = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!onClick || pending) return;
      const result = onClick(event) as unknown;
      // A synchronous handler should not flash a spinner for one frame
      // and read as a glitch.
      if (!result || typeof (result as Promise<unknown>).then !== 'function') return;
      setPending(true);
      try {
        await result;
      } finally {
        if (alive.current) setPending(false);
      }
    },
    [onClick, pending],
  );

  if (asChild) {
    return (
      <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...rest}>
        {children}
      </Slot>
    );
  }

  const iconPx = size === 'sm' ? 12 : 15;

  return (
    <button
      ref={ref}
      {...rest}
      onClick={handle}
      disabled={disabled || isBusy}
      aria-busy={isBusy || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {isBusy ? <Loader2 size={iconPx} className="animate-spin shrink-0" aria-hidden="true" /> : icon}
      {isBusy && busyLabel ? busyLabel : children}
    </button>
  );
});

export { buttonVariants };

/**
 * Spinner for a whole panel that is still loading, so a screen does not
 * sit blank with no indication anything is happening.
 */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Inline spinner for a row or a field. */
export function Spinner({ size = 13, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn('animate-spin', className)} aria-hidden="true" />;
}
