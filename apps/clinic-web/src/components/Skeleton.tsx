/**
 * Shimmer placeholders.
 *
 * Screens previously showed the word "Loading..." — which tells you nothing
 * about what is coming, and makes the page jump when real content replaces
 * a single line of text with a table.
 *
 * A skeleton that matches the shape of what is loading does two things a
 * spinner cannot: it reserves the layout so nothing shifts on arrival, and
 * it tells you at a glance whether you are waiting for a list, a form or a
 * chart. The shapes below are deliberately specific to this app's screens
 * rather than generic boxes, because a generic box reserves the wrong
 * height and the jump happens anyway.
 *
 * The shimmer itself is defined once in theme.css and respects
 * prefers-reduced-motion.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden="true" />;
}

/** Wraps a loading region so assistive tech announces it once rather than
 * reading out a wall of empty boxes. */
export function SkeletonRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Rows of a card list — patients, prescriptions, lab orders, clinics. */
export function SkeletonList({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl border border-border/10 bg-foreground/[0.02]">
            <div className="flex-1 min-w-0">
              {/* Varying widths so it reads as content rather than a grid. */}
              <Skeleton className={`h-3.5 mb-2 ${['w-40', 'w-52', 'w-36', 'w-48', 'w-44'][i % 5]}`} />
              <Skeleton className={`h-2.5 ${['w-64', 'w-52', 'w-72', 'w-56', 'w-60'][i % 5]}`} />
            </div>
            <Skeleton className="h-6 w-16 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** A real table, so column positions do not shift when data lands. */
export function SkeletonTable({ rows = 6, columns = 5, label = 'Loading' }: { rows?: number; columns?: number; label?: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className="rounded-xl border border-border/10 overflow-hidden">
        <div className="bg-foreground/[0.03] px-3 py-2.5 flex gap-4">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-2.5 flex-1" />
          ))}
        </div>
        <div className="divide-y divide-border/5">
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="px-3 py-3 flex gap-4">
              {Array.from({ length: columns }, (_, c) => (
                <Skeleton key={c} className={`h-3 flex-1 ${c === 0 ? 'max-w-[80px]' : ''}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** The stat tiles at the top of Analytics, Expenses and the console. */
export function SkeletonStats({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className="grid sm:grid-cols-3 gap-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
            <Skeleton className="h-2.5 w-24 mb-2.5" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** A settings or detail form. */
export function SkeletonForm({ fields = 6, label = 'Loading' }: { fields?: number; label?: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
        <Skeleton className="h-3.5 w-40 mb-1.5" />
        <Skeleton className="h-2.5 w-64 mb-5" />
        <div className="grid md:grid-cols-2 gap-3">
          {Array.from({ length: fields }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-20 mb-1.5" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Panels on a detail page — patient history, clinic detail sidebars. */
export function SkeletonPanels({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className="flex flex-col gap-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
            <Skeleton className="h-3 w-32 mb-3" />
            <Skeleton className="h-2.5 w-full mb-2" />
            <Skeleton className="h-2.5 w-4/5 mb-2" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** Full-page shell while auth resolves. */
export function SkeletonPage({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1600px]">
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-3 w-72 mb-6" />
      <SkeletonList rows={4} label={label} />
    </div>
  );
}
