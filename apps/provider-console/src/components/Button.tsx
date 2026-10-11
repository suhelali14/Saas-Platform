import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * A button that manages its own pending state.
 *
 * The app had 136 buttons, 30 of which disabled themselves during an async
 * call, and not one spinner anywhere. So a receptionist tapping "Dispense"
 * on a slow connection got no feedback at all and tapped it again -- which
 * is a double submit, not just a cosmetic problem.
 *
 * Passing an async `onClick` is enough: this awaits the returned promise,
 * shows a spinner and blocks re-entry for its duration. No caller needs to
 * thread a `saving` boolean through their component, which is exactly why
 * most of them never did.
 *
 * A caller that already tracks its own state can still pass `busy`; the two
 * are ORed, so adopting this incrementally never fights existing code.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  variant?: Variant;
  size?: Size;
  /** Externally-controlled pending state, ORed with the internal one. */
  busy?: boolean;
  /** Replaces the label while pending. Without it the label stays and only
   * the spinner appears -- which is right for icon-ish or short buttons. */
  busyLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-emerald-500 text-black font-semibold hover:bg-emerald-400',
  secondary: 'bg-white/10 text-gray-200 hover:bg-white/20',
  ghost: 'text-gray-400 hover:text-white hover:bg-white/10',
  danger: 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
};

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-lg',
};

export function Button({
  onClick,
  variant = 'secondary',
  size = 'md',
  busy,
  busyLabel,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const [pending, setPending] = useState(false);
  // A component can unmount while its request is still in flight (deleting
  // the row the button lives in is the common case), and setting state
  // afterwards is a no-op React warns about.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const isBusy = pending || Boolean(busy);

  const handle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick || isBusy) return;
    const result = onClick(event);
    // Synchronous handlers should not flash a spinner for one frame.
    if (!(result instanceof Promise)) return;
    setPending(true);
    try {
      await result;
    } finally {
      if (mounted.current) setPending(false);
    }
  };

  return (
    <button
      {...rest}
      onClick={handle}
      disabled={disabled || isBusy}
      aria-busy={isBusy || undefined}
      className={`inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {isBusy ? <Loader2 size={size === 'sm' ? 12 : 15} className="animate-spin shrink-0" /> : icon}
      {isBusy && busyLabel ? busyLabel : children}
    </button>
  );
}

/**
 * Spinner for a whole panel that is still loading, so a screen does not sit
 * blank with no indication anything is happening.
 */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
      <Loader2 size={15} className="animate-spin" />
      {label}
    </div>
  );
}

/** Inline spinner for a row or a field. */
export function Spinner({ size = 13, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}
