import { useEffect, useRef, useState } from 'react';

/**
 * The chart primitives.
 *
 * ── Why these are measured rather than scaled ───────────────────────
 *
 * The trend chart used to be `<svg viewBox="0 0 640 160"
 * preserveAspectRatio="none">`. That stretches the coordinate space
 * independently on each axis to fill the container, which means the "2px"
 * line renders at two different thicknesses depending on which way it is
 * travelling, and every circular marker becomes an ellipse. It looked
 * fine at one width and wrong at every other.
 *
 * So the container is measured and the SVG is drawn at real pixels. A
 * stroke is the width it says it is, a dot is round, and the geometry
 * does not depend on the viewport happening to match a hardcoded aspect
 * ratio.
 *
 * ── Colour ──────────────────────────────────────────────────────────
 *
 * Marks use `--chart-1` / `--chart-2`, never the ink tokens and never a
 * literal. The chart used to be `const ACCENT = '#34d399'` with a comment
 * calling it "this app's single accent hue throughout" -- emerald, from
 * before the app moved to blue, hardcoded for both themes, and about
 * 2.1:1 against the white panel that is now the default. See index.css
 * for what the chart tokens are and how they were validated.
 */

/** The width of an element, tracked. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // ResizeObserver rather than a window resize listener: this element
    // also changes width when the sidebar drawer opens or a panel beside
    // it grows, neither of which resizes the window.
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

export interface TrendPoint {
  /** `YYYY-MM-DD`. */
  date: string;
  count: number;
}

const PAD = { top: 14, right: 14, bottom: 22, left: 30 };
const HEIGHT = 170;

/**
 * Visits over time.
 *
 * One series, so there is no legend -- the panel heading names it, and a
 * legend box for a single line is furniture. The hover layer is not
 * optional: an HTML chart is interactive by nature, and a date-by-date
 * reading is the question this chart exists to answer. A `<title>` on a
 * 6px circle, which is what this had, is a 6px hit target.
 */
export function TrendChart({ data, label = 'visits' }: { data: TrendPoint[]; label?: string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);

  // The one authored moment in the app: the line draws itself, once, on
  // arrival. It earns it because the subject IS change over time, so the
  // motion carries the meaning rather than decorating it. Everything
  // else on screen is already in place and stays there.
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 30);
    return () => clearTimeout(t);
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex h-[170px] items-center justify-center text-xs text-muted-foreground">
        No visits in this range.
      </div>
    );
  }

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;

  const pts = data.map((d, i) => ({
    ...d,
    x: PAD.left + (data.length > 1 ? i * stepX : plotW / 2),
    y: PAD.top + plotH - (d.count / max) * plotH,
  }));

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${pts[pts.length - 1]!.x} ${PAD.top + plotH} L ${pts[0]!.x} ${PAD.top + plotH} Z`;

  // Three ticks is enough to read a magnitude; more is grid for its own
  // sake. Whole numbers only -- these are counts of people.
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const active = hover !== null ? pts[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          className="block touch-none"
          role="img"
          aria-label={`${label} per day. ${data.length} days, highest ${max}.`}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - box.left;
            // Nearest point, not the one under the cursor: the hit target
            // has to be larger than the mark, so the whole column belongs
            // to its point.
            let best = 0;
            let bestD = Infinity;
            pts.forEach((p, i) => {
              const d = Math.abs(p.x - x);
              if (d < bestD) { bestD = d; best = i; }
            });
            setHover(best);
          }}
          onPointerLeave={() => setHover(null)}
        >
          {/* Grid: structure, not data, so it sits far back. Drawn before
              everything else so marks are never crossed by a rule. */}
          {ticks.map((t) => {
            const y = PAD.top + plotH - (t / max) * plotH;
            return (
              <g key={t}>
                <line
                  x1={PAD.left} y1={y} x2={width - PAD.right} y2={y}
                  stroke="hsl(var(--chart-grid))" strokeOpacity={0.1} strokeWidth={1}
                />
                <text
                  x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* A whisper of fill under the line. It communicates "this is a
              quantity over time" without competing with the line itself. */}
          <path d={area} fill="hsl(var(--chart-1))" fillOpacity={0.08} />

          <path
            d={path}
            fill="none"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            // The draw-on. pathLength normalises the dash maths so it does
            // not depend on how long the path happens to be.
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={drawn ? 0 : 1}
            style={{ transition: `stroke-dashoffset var(--dur-slow) var(--ease-out)` }}
          />

          {/*
            The time axis.
            
            Checked against the anti-pattern catalog and this was missing:
            the dates existed only in the tooltip, which makes hovering the
            only way to know what range you are looking at. The bottom
            padding was already reserved for a band that drew nothing.
            
            First and last, plus the middle when there is room -- enough to
            read the span without a label under every point.
          */}
          {(() => {
            const want = data.length > 6 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0, data.length - 1];
            const seen = new Set<number>();
            return want.filter((i) => {
              if (seen.has(i) || !pts[i]) return false;
              seen.add(i);
              return true;
            }).map((i) => {
              const p = pts[i]!;
              // The end labels are pinned inside the plot so neither can
              // be clipped by the panel edge.
              const anchor = i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle';
              return (
                <text
                  key={p.date}
                  x={p.x} y={HEIGHT - 6}
                  textAnchor={anchor}
                  className="fill-muted-foreground text-[10px]"
                >
                  {new Date(`${p.date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </text>
              );
            });
          })()}

          {/* The crosshair and its marker, drawn only for the hovered
              point. A dot on every point is a number on every point: it
              turns the line into noise. */}
          {active && (
            <g>
              <line
                x1={active.x} y1={PAD.top} x2={active.x} y2={PAD.top + plotH}
                stroke="hsl(var(--chart-1))" strokeOpacity={0.35} strokeWidth={1}
              />
              {/* 10px, over the floor of 8, with a surface-coloured ring
                  so it stays legible where it crosses the line. */}
              <circle
                cx={active.x} cy={active.y} r={5}
                fill="hsl(var(--chart-1))"
                stroke="hsl(var(--card))"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      )}

      {/* Tooltip in HTML, not SVG: real text wrapping, real tokens, and it
          cannot be clipped by the plot area. */}
      {active && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border/10 bg-popover px-2.5 py-1.5 shadow-overlay"
          style={{ left: active.x, top: active.y - 10 }}
        >
          <div className="whitespace-nowrap text-[11px] font-medium tabular-nums">
            {active.count} {active.count === 1 ? label.replace(/s$/, '') : label}
          </div>
          <div className="whitespace-nowrap text-[10px] text-muted-foreground">
            {new Date(`${active.date}T12:00:00`).toLocaleDateString('en-IN', {
              weekday: 'short', day: 'numeric', month: 'short',
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
}

/**
 * A ranked list, as bars.
 *
 * Horizontal because the labels are variable-length free text -- a
 * diagnosis, a doctor's name -- and a vertical chart would need them
 * rotated or truncated. The data end is rounded and the baseline end is
 * square, so the bar reads as growing from an axis rather than floating.
 */
export function BarList({ items, series = 1 }: { items: BarItem[]; series?: 1 | 2 }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Nothing recorded yet.</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  const colour = series === 2 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-1))';

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2.5">
          <span className="w-32 shrink-0 truncate text-xs text-muted-foreground" title={item.label}>
            {item.label}
          </span>
          <span className="relative h-4 flex-1 overflow-hidden rounded-sm bg-foreground/[0.04]">
            <span
              className="absolute inset-y-0 left-0 rounded-r-[4px]"
              style={{
                width: `${Math.max(1.5, (item.value / max) * 100)}%`,
                background: colour,
                // Grows from the axis on first paint. One transition, on
                // the property that carries the value.
                transition: `width var(--dur-slow) var(--ease-out)`,
              }}
            />
          </span>
          {/* Direct label on every row is correct HERE and nowhere else:
              a ranked list is read for its values, and there are at most
              a handful of rows. */}
          <span className="w-8 shrink-0 text-right text-xs font-medium tabular-nums">
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
