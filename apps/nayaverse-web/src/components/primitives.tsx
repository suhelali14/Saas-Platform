/**
 * The world's parts, drawn once.
 *
 * Everything on this site is a panel in a steel frame or a painted board, so
 * those two live here along with the band, the stamp and the two drawn marks
 * the page needs. Icons are drawn, in one stroke weight; no glyph stands in
 * for a mark.
 */
import type { ReactNode } from 'react';
import { useInView } from '@/components/useInView';

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');

/* ---------------------------------------------------------------- marks --- */

/** The separator between stations on a route. One stroke, 1.5, round caps. */
export function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={cx('shrink-0', className)}
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2.5 8 6l-4 3.5" />
    </svg>
  );
}

export function Caret({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={cx('shrink-0 transition-transform', open && 'rotate-90', className)}
      style={{ transitionDuration: 'var(--dur)', transitionTimingFunction: 'var(--ease)' }}
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2.5 8 6l-4 3.5" />
    </svg>
  );
}

/* --------------------------------------------------------------- frames --- */

export function Panel({
  children,
  id,
  punched = true,
  className,
}: {
  children: ReactNode;
  id?: string;
  punched?: boolean;
  className?: string;
}) {
  return (
    <div id={id} className={cx('panel on-chart', punched && 'punched', className)}>
      {children}
    </div>
  );
}

/**
 * The metadata strip across the top of a panel: which chart this is, its date,
 * its serial. Functional chrome carrying data — the panel's heading is inside
 * the panel, never up here as a label above it.
 */
export function Band({ children }: { children: ReactNode }) {
  return <div className="band t-label">{children}</div>;
}

export function BandItem({ children, grow }: { children: ReactNode; grow?: boolean }) {
  return <span className={cx(grow && 'flex-1')}>{children}</span>;
}

export function Board({
  children,
  className,
  bolts = true,
}: {
  children: ReactNode;
  className?: string;
  bolts?: boolean;
}) {
  return (
    <div className={cx('board overflow-hidden', className)}>
      {bolts && (
        <>
          <span className="bolt left-3 top-3" aria-hidden="true" />
          <span className="bolt right-3 top-3" aria-hidden="true" />
          <span className="bolt left-3 bottom-3" aria-hidden="true" />
          <span className="bolt right-3 bottom-3" aria-hidden="true" />
        </>
      )}
      {children}
    </div>
  );
}

/** A rubber stamp. `pressed` plays the ink pressing down, once. */
export function Stamp({
  children,
  pressed,
  rotate = true,
  tone = 'stamp',
}: {
  children: ReactNode;
  pressed?: boolean;
  rotate?: boolean;
  tone?: 'stamp' | 'confirmed' | 'priority';
}) {
  return (
    <span
      className={cx('stamp', rotate && 'stamp-rotate', pressed && 'stamp-pressed')}
      style={{ color: `var(--${tone})` }}
    >
      {children}
    </span>
  );
}

/**
 * A ruled line that lays itself down the first time you reach it, left to
 * right, the way a ruling pen does. The one piece of motion on this site that
 * is neither the chart re-ranking nor a stamp pressing — and it is the
 * material behaving, not a section arriving.
 *
 * It is an element rather than a border because a border cannot be drawn, and
 * because a `scaleX` on a table row would stretch the cells inside it.
 */
export function Ruling({ weight = 1.5 }: { weight?: number }) {
  const { ref, seen } = useInView<HTMLDivElement>(0.6);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cx('w-full', seen && 'rule-draw')}
      style={{
        height: `${weight}px`,
        backgroundColor: `color-mix(in srgb, var(--rule) 52%, transparent)`,
      }}
    />
  );
}

/**
 * A section heading. One heading per section and nothing above it: the band's
 * data strip is chrome, not a label this is subordinate to.
 */
export function Heading({
  children,
  as: As = 'h2',
  className,
}: {
  children: ReactNode;
  as?: 'h1' | 'h2';
  className?: string;
}) {
  return <As className={cx('t-board t-heading text-balance', className)}>{children}</As>;
}
