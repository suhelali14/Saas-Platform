/**
 * The route model's geometry, in em, worked out once at module load.
 *
 * A loop of track with six stations spaced evenly along it, a stack of chart
 * sheets in the middle (the one record every station reads), and the lamp
 * that carries one customer round. Everything is measured along the track
 * itself, so the lamp stops exactly at each station's platform however the
 * loop is proportioned -- there is no hand-placed coordinate to drift.
 *
 * Units are em so the whole model scales with one font size, which the
 * section sets from its own width. A CSS path() cannot do that (it is in
 * pixels), so the lamp's run is written out as transform keyframes instead.
 */

/** The plane the model stands on. */
export const PLANE = { w: 47, h: 25.5 };

/** The track: a rounded rectangle. */
const X0 = 5;
const Y0 = 6;
const X1 = 39;
const Y1 = 23;
const R = 3;

const top = X1 - X0 - 2 * R;
const side = Y1 - Y0 - 2 * R;
const arc = (Math.PI * R) / 2;
/** Length of the loop, measured round the track. */
const P = 2 * top + 2 * side + 4 * arc;

/** Where you are after travelling `d` along the track, clockwise from the
 *  top-left corner's end. */
function pointAt(distance: number): { x: number; y: number } {
  let d = ((distance % P) + P) % P;
  const corner = (cx: number, cy: number, from: number, t: number) => {
    const a = from + (t / arc) * (Math.PI / 2);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  };
  if (d < top) return { x: X0 + R + d, y: Y0 };
  d -= top;
  if (d < arc) return corner(X1 - R, Y0 + R, -Math.PI / 2, d);
  d -= arc;
  if (d < side) return { x: X1, y: Y0 + R + d };
  d -= side;
  if (d < arc) return corner(X1 - R, Y1 - R, 0, d);
  d -= arc;
  if (d < top) return { x: X1 - R - d, y: Y1 };
  d -= top;
  if (d < arc) return corner(X0 + R, Y1 - R, Math.PI / 2, d);
  d -= arc;
  if (d < side) return { x: X0, y: Y1 - R - d };
  d -= side;
  return corner(X0 + R, Y0 + R, Math.PI, d);
}

export const STOPS = 6;
const spacing = P / STOPS;
/** Start so the two stations on the far straight sit symmetrically. */
const d0 = (X0 + X1) / 2 - spacing / 2 - (X0 + R);
const stopAt = (i: number) => d0 + i * spacing;

/** One station's shed. `far` is the side of the track away from the
 *  viewer, so a shed never stands between the reader and the lamp. */
export interface Station {
  x: number;
  y: number;
  /** Footprint, em. */
  w: number;
  d: number;
  /** Height, em. The far side stands taller than the near. */
  h: number;
  /** Where on the track the lamp stops for it. */
  stop: { x: number; y: number };
}

const SHED_W = 7;
const SHED_D = 3.6;
const GAP = 0.85;
const HEIGHTS = [4.4, 3.3, 3.9, 2.1, 1.9, 2.4];

export const stations: Station[] = Array.from({ length: STOPS }, (_, i) => {
  const stop = pointAt(stopAt(i));
  let x = stop.x;
  let y = stop.y;
  // Which straight the stop is on decides where the shed goes: outside the
  // loop on the two far sides, inside it on the two near ones.
  if (Math.abs(stop.y - Y0) < 1e-6) y = Y0 - GAP - SHED_D / 2;
  else if (Math.abs(stop.y - Y1) < 1e-6) y = Y1 - GAP - SHED_D / 2;
  else if (Math.abs(stop.x - X1) < 1e-6) x = X1 + GAP + SHED_W / 2;
  else x = X0 + GAP + SHED_W / 2;
  return { x, y, w: SHED_W, d: SHED_D, h: HEIGHTS[i], stop };
});

/** The record: a stack of chart sheets in the middle of the loop. */
export const record = { x: 22, y: 13.4, w: 8.4, d: 5, h: 1.5 };

const round = (n: number) => Math.round(n * 100) / 100;

/** The track as SVG paths in plane units: a rounded rectangle, inset by
 *  `o` (negative to grow it). */
export function trackPath(o = 0): string {
  const x0 = X0 + o;
  const y0 = Y0 + o;
  const x1 = X1 - o;
  const y1 = Y1 - o;
  const r = R - o;
  return [
    `M${round(x0 + r)} ${round(y0)}`,
    `H${round(x1 - r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x1)} ${round(y0 + r)}`,
    `V${round(y1 - r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x1 - r)} ${round(y1)}`,
    `H${round(x0 + r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x0)} ${round(y1 - r)}`,
    `V${round(y0 + r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x0 + r)} ${round(y0)}`,
    'Z',
  ].join('');
}

/* ------------------------------------------------------------- timing --- */

/** Seconds per station: about one to travel and two to read. */
export const SLOT = 3.2;
export const CYCLE = SLOT * STOPS;
const TRAVEL = 1.05;

const pct = (t: number) => `${round((t / CYCLE) * 100)}%`;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The lamp's run, as keyframes. Slot i starts at the previous station and
 * eases along the track to station i, then waits there for the rest of the
 * slot. Sampled finely enough that the corners stay round; linear between
 * samples, with the easing baked into where the samples fall.
 */
export function lampKeyframes(name: string): string {
  const frames: string[] = [];
  const SAMPLES = 14;
  for (let i = 0; i < STOPS; i += 1) {
    const from = stopAt(i - 1);
    let to = stopAt(i);
    if (to < from) to += P;
    for (let k = 0; k <= SAMPLES; k += 1) {
      const f = k / SAMPLES;
      const p = pointAt(from + (to - from) * easeInOut(f));
      frames.push(`${pct(i * SLOT + f * TRAVEL)}{transform:translate(${round(p.x)}em,${round(p.y)}em)}`);
    }
  }
  const last = pointAt(stopAt(STOPS - 1));
  frames.push(`100%{transform:translate(${round(last.x)}em,${round(last.y)}em)}`);
  return `@keyframes ${name}{${frames.join('')}}`;
}

/** Fraction of a slot at which the lamp has arrived and the station lights. */
export const ARRIVE = TRAVEL / SLOT;
