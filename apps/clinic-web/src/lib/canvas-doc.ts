/**
 * The free-canvas page document, and every operation that changes it.
 *
 * ── Why this file is pure ────────────────────────────────────────────
 *
 * A free canvas is almost entirely arithmetic: where a box lands when you
 * drag it, what its width becomes when you pull the left handle, which of
 * the other boxes it should snap to. Every one of those is easy to get
 * subtly wrong and nearly impossible to eyeball -- a resize that moves `x`
 * but forgets to shrink `w` looks fine until you drag the other way, and an
 * off-by-one in snapping reads as the canvas being sticky rather than as a
 * bug. So the maths lives here, with no React and no DOM, and it is tested
 * directly.
 *
 * ── Coordinates ─────────────────────────────────────────────────────
 *
 * Positions are plain pixels inside a FIXED design width per breakpoint
 * (`CANVAS_WIDTH`), not percentages. The published page centres that
 * coordinate space and scales it down on narrower screens. This is the
 * only way absolute positioning reproduces faithfully: a percentage-based
 * free canvas re-flows at every viewport width, so what the doctor
 * arranged is not what a patient sees.
 *
 * ── Why there are two layouts, not one ──────────────────────────────
 *
 * Absolutely positioned boxes do not adapt. A hero headline placed at
 * x=420 on a 1200px canvas is off-screen on a 390px phone. Wix's classic
 * editor solved this by keeping a separate mobile layout, and that is what
 * `at.desktop` / `at.mobile` are.
 *
 * The doctor is not asked to do that work twice. `deriveMobile` reads the
 * desktop arrangement and stacks it into a single phone column in reading
 * order, which is the correct answer almost every time. A node is only
 * pinned to its own mobile geometry once someone deliberately moves it
 * there (`pinned`), after which the derive step leaves it alone.
 */

export type Breakpoint = 'desktop' | 'mobile';

/** The design widths positions are expressed in. */
export const CANVAS_WIDTH: Record<Breakpoint, number> = { desktop: 1200, mobile: 390 };

/** Nothing may be dragged or resized smaller than this. A 2px-tall text
 *  box is unrecoverable with a pointer -- there is nothing left to grab. */
export const MIN_SIZE = { w: 24, h: 16 };

/** How close an edge has to be, in canvas px, before it snaps. */
export const SNAP_THRESHOLD = 6;

/** Side padding used when stacking a derived phone layout. */
const MOBILE_GUTTER = 16;
/** Vertical rhythm between stacked blocks on the derived phone layout. */
const MOBILE_GAP = 20;

export interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The element kinds the canvas can place.
 *
 * `bound` is the important one: it is a block whose CONTENT comes from the
 * clinic's real records -- its doctors, its services, today's queue -- and
 * is therefore never typed into the page. The doctor positions it and
 * styles it, but cannot author a fake doctor into it, and when a new
 * doctor is added to the clinic the block updates itself.
 */
export type NodeType = 'heading' | 'text' | 'button' | 'image' | 'box' | 'divider' | 'bound';

export interface NodeProps {
  /** heading / text / button. */
  text?: string;
  /** button / image. */
  href?: string;
  /** image. */
  src?: string;
  alt?: string;
  /** Which clinic record block, for type `bound`. */
  bind?: string;
  /** Styling. All optional: absent means the site's own design decides. */
  fontSize?: number;
  fontWeight?: number;
  align?: 'left' | 'center' | 'right';
  color?: string;
  background?: string;
  radius?: number;
  padding?: number;
  /** Line height as a multiplier, so it scales with fontSize. */
  lineHeight?: number;
}

export interface CanvasNode {
  id: string;
  type: NodeType;
  at: Record<Breakpoint, Geometry>;
  /** True once this node's geometry at that breakpoint was set by hand. */
  pinned?: Partial<Record<Breakpoint, boolean>>;
  /** Paint order. Higher is in front. Normalised to 0..n-1 on every write. */
  z: number;
  props: NodeProps;
}

export interface CanvasDoc {
  version: 1;
  nodes: CanvasNode[];
  /** Page height per breakpoint, in that breakpoint's coordinate space. */
  height: Record<Breakpoint, number>;
  background?: string;
}

export const EMPTY_DOC: CanvasDoc = {
  version: 1,
  nodes: [],
  height: { desktop: 900, mobile: 1200 },
};

// ── small helpers ────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Positions are whole pixels. Sub-pixel drift accumulates over a drag and
 *  ends up as text that renders half a pixel off and looks blurry. */
const round = (v: number) => Math.round(v);

let seq = 0;
/** Ids are only ever compared, never ordered, so this is enough and it
 *  keeps the module pure of crypto/Date for the tests. */
export function newId(prefix = 'n'): string {
  seq += 1;
  return `${prefix}${seq.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function findNode(doc: CanvasDoc, id: string): CanvasNode | undefined {
  return doc.nodes.find((n) => n.id === id);
}

/** Paint order: back to front. The renderer and the hit-test must agree on
 *  this or clicking picks a different box than the one you can see. */
export function inPaintOrder(doc: CanvasDoc): CanvasNode[] {
  return [...doc.nodes].sort((a, b) => a.z - b.z);
}

/** Front to back -- the order a click must be tested in. */
export function inHitOrder(doc: CanvasDoc): CanvasNode[] {
  return [...doc.nodes].sort((a, b) => b.z - a.z);
}

/** Re-base z to 0..n-1, preserving relative order. Without this, repeated
 *  bring-to-front walks z upward forever and eventually collides with
 *  whatever the renderer uses for its own chrome. */
function normaliseZ(nodes: CanvasNode[]): CanvasNode[] {
  const ordered = [...nodes].sort((a, b) => a.z - b.z);
  const zById = new Map(ordered.map((n, i) => [n.id, i]));
  return nodes.map((n) => ({ ...n, z: zById.get(n.id)! }));
}

function replaceNode(doc: CanvasDoc, id: string, fn: (n: CanvasNode) => CanvasNode): CanvasDoc {
  let touched = false;
  const nodes = doc.nodes.map((n) => {
    if (n.id !== id) return n;
    touched = true;
    return fn(n);
  });
  return touched ? { ...doc, nodes } : doc;
}

/** Mark a node's geometry at this breakpoint as deliberate, so the derived
 *  phone layout stops overwriting it. */
function pin(node: CanvasNode, bp: Breakpoint): CanvasNode {
  if (bp === 'desktop') return node;
  return { ...node, pinned: { ...node.pinned, mobile: true } };
}

// ── geometry ─────────────────────────────────────────────────────────

export function geometryOf(node: CanvasNode, bp: Breakpoint): Geometry {
  return node.at[bp];
}

/**
 * Move a node by a delta, with snapping, clamped inside the canvas.
 *
 * Returns the new doc and the guides that matched, so the editor can draw
 * exactly the lines the snap used rather than guessing at them again.
 */
export function moveNode(
  doc: CanvasDoc,
  id: string,
  dx: number,
  dy: number,
  bp: Breakpoint,
  opts: { snap?: boolean } = {},
): { doc: CanvasDoc; guides: Guide[] } {
  const node = findNode(doc, id);
  if (!node) return { doc, guides: [] };

  const g = geometryOf(node, bp);
  let next: Geometry = { ...g, x: g.x + dx, y: g.y + dy };

  let guides: Guide[] = [];
  if (opts.snap !== false) {
    const snapped = snapGeometry(next, candidateGuides(doc, id, bp), 'move');
    next = snapped.geometry;
    guides = snapped.guides;
  }

  // Clamp AFTER snapping: a snap that would push a node off the canvas
  // must still leave it reachable.
  next.x = clamp(round(next.x), 0, Math.max(0, CANVAS_WIDTH[bp] - next.w));
  next.y = Math.max(0, round(next.y));

  return {
    doc: replaceNode(doc, id, (n) => pin({ ...n, at: { ...n.at, [bp]: next } }, bp)),
    guides,
  };
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * Resize from one of the eight handles.
 *
 * The part worth stating: dragging a WEST or NORTH handle changes `x`/`y`
 * as well as `w`/`h`, and the two must move together. Changing only the
 * size makes the box grow away from the handle under the pointer, which
 * feels broken; changing only the position makes it slide instead of
 * resize. The min-size clamp has to hold the opposite edge still too, or a
 * box collapsed against its minimum starts creeping across the page.
 */
export function resizeNode(
  doc: CanvasDoc,
  id: string,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  bp: Breakpoint,
  opts: { snap?: boolean } = {},
): { doc: CanvasDoc; guides: Guide[] } {
  const node = findNode(doc, id);
  if (!node) return { doc, guides: [] };

  const g = geometryOf(node, bp);
  const right = g.x + g.w;
  const bottom = g.y + g.h;

  let { x, y, w, h } = g;

  if (handle.includes('w')) {
    // The right edge is the anchor, so x may not pass it (minus the floor).
    x = clamp(g.x + dx, 0, right - MIN_SIZE.w);
    w = right - x;
  }
  if (handle.includes('e')) {
    w = clamp(g.w + dx, MIN_SIZE.w, CANVAS_WIDTH[bp] - g.x);
  }
  if (handle.includes('n')) {
    y = clamp(g.y + dy, 0, bottom - MIN_SIZE.h);
    h = bottom - y;
  }
  if (handle.includes('s')) {
    h = Math.max(MIN_SIZE.h, g.h + dy);
  }

  let next: Geometry = { x, y, w, h };
  let guides: Guide[] = [];
  if (opts.snap !== false) {
    const snapped = snapGeometry(next, candidateGuides(doc, id, bp), handle);
    next = snapped.geometry;
    guides = snapped.guides;
  }

  next = {
    x: clamp(round(next.x), 0, CANVAS_WIDTH[bp] - MIN_SIZE.w),
    y: Math.max(0, round(next.y)),
    w: clamp(round(next.w), MIN_SIZE.w, CANVAS_WIDTH[bp] - round(next.x)),
    h: Math.max(MIN_SIZE.h, round(next.h)),
  };

  return {
    doc: replaceNode(doc, id, (n) => pin({ ...n, at: { ...n.at, [bp]: next } }, bp)),
    guides,
  };
}

/** Set geometry outright, from the inspector's numeric fields. */
export function setGeometry(
  doc: CanvasDoc,
  id: string,
  patch: Partial<Geometry>,
  bp: Breakpoint,
): CanvasDoc {
  const node = findNode(doc, id);
  if (!node) return doc;
  const g = geometryOf(node, bp);
  const merged = { ...g, ...patch };
  // Width first, because the x clamp depends on it -- but assembled in
  // x,y,w,h order, because this object is persisted as JSON and a
  // key order that varies by code path makes stored documents diff
  // against each other for no reason.
  const w = clamp(round(merged.w), MIN_SIZE.w, CANVAS_WIDTH[bp]);
  const next: Geometry = {
    x: clamp(round(merged.x), 0, CANVAS_WIDTH[bp] - w),
    y: Math.max(0, round(merged.y)),
    w,
    h: Math.max(MIN_SIZE.h, round(merged.h)),
  };
  return replaceNode(doc, id, (n) => pin({ ...n, at: { ...n.at, [bp]: next } }, bp));
}

// ── snapping and guides ──────────────────────────────────────────────

export interface Guide {
  axis: 'x' | 'y';
  at: number;
  /** What produced it, so the editor can draw a canvas guide differently
   *  from an alignment with another block. */
  kind: 'edge' | 'center' | 'canvas';
}

/**
 * Every line the moving node could usefully align to: the edges and
 * centres of all the other nodes, plus the canvas's own edges and centre.
 */
export function candidateGuides(doc: CanvasDoc, movingId: string, bp: Breakpoint): Guide[] {
  const guides: Guide[] = [
    { axis: 'x', at: 0, kind: 'canvas' },
    { axis: 'x', at: CANVAS_WIDTH[bp] / 2, kind: 'canvas' },
    { axis: 'x', at: CANVAS_WIDTH[bp], kind: 'canvas' },
    { axis: 'y', at: 0, kind: 'canvas' },
  ];
  for (const n of doc.nodes) {
    if (n.id === movingId) continue;
    const g = geometryOf(n, bp);
    guides.push(
      { axis: 'x', at: g.x, kind: 'edge' },
      { axis: 'x', at: g.x + g.w / 2, kind: 'center' },
      { axis: 'x', at: g.x + g.w, kind: 'edge' },
      { axis: 'y', at: g.y, kind: 'edge' },
      { axis: 'y', at: g.y + g.h / 2, kind: 'center' },
      { axis: 'y', at: g.y + g.h, kind: 'edge' },
    );
  }
  return guides;
}

/**
 * Pull a geometry onto the nearest guide, if one is within the threshold.
 *
 * Which of the box's own lines are eligible depends on what is being
 * dragged: a move can align its left, centre or right, but a resize from
 * the east handle may only align its right edge -- snapping its left would
 * move an edge the pointer is not touching.
 */
export function snapGeometry(
  g: Geometry,
  guides: Guide[],
  mode: 'move' | ResizeHandle,
): { geometry: Geometry; guides: Guide[] } {
  const xTargets: Array<{ own: number; apply: (d: number) => void }> = [];
  const yTargets: Array<{ own: number; apply: (d: number) => void }> = [];
  const next: Geometry = { ...g };

  if (mode === 'move') {
    xTargets.push(
      { own: g.x, apply: (d) => { next.x = g.x + d; } },
      { own: g.x + g.w / 2, apply: (d) => { next.x = g.x + d; } },
      { own: g.x + g.w, apply: (d) => { next.x = g.x + d; } },
    );
    yTargets.push(
      { own: g.y, apply: (d) => { next.y = g.y + d; } },
      { own: g.y + g.h / 2, apply: (d) => { next.y = g.y + d; } },
      { own: g.y + g.h, apply: (d) => { next.y = g.y + d; } },
    );
  } else {
    if (mode.includes('w')) {
      xTargets.push({ own: g.x, apply: (d) => { next.x = g.x + d; next.w = g.w - d; } });
    }
    if (mode.includes('e')) {
      xTargets.push({ own: g.x + g.w, apply: (d) => { next.w = g.w + d; } });
    }
    if (mode.includes('n')) {
      yTargets.push({ own: g.y, apply: (d) => { next.y = g.y + d; next.h = g.h - d; } });
    }
    if (mode.includes('s')) {
      yTargets.push({ own: g.y + g.h, apply: (d) => { next.h = g.h + d; } });
    }
  }

  const matched: Guide[] = [];

  for (const [axis, targets] of [['x', xTargets], ['y', yTargets]] as const) {
    let best: { delta: number; guide: Guide; apply: (d: number) => void } | null = null;
    for (const t of targets) {
      for (const guide of guides) {
        if (guide.axis !== axis) continue;
        const delta = guide.at - t.own;
        if (Math.abs(delta) > SNAP_THRESHOLD) continue;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) {
          best = { delta, guide, apply: t.apply };
        }
      }
    }
    if (best) {
      best.apply(best.delta);
      matched.push(best.guide);
    }
  }

  // A snap must never drive a dimension under the floor.
  if (next.w < MIN_SIZE.w || next.h < MIN_SIZE.h) {
    return { geometry: g, guides: [] };
  }
  return { geometry: next, guides: matched };
}

// ── z-order ──────────────────────────────────────────────────────────

export function bringToFront(doc: CanvasDoc, id: string): CanvasDoc {
  const max = doc.nodes.reduce((m, n) => Math.max(m, n.z), 0);
  return { ...doc, nodes: normaliseZ(doc.nodes.map((n) => (n.id === id ? { ...n, z: max + 1 } : n))) };
}

export function sendToBack(doc: CanvasDoc, id: string): CanvasDoc {
  const min = doc.nodes.reduce((m, n) => Math.min(m, n.z), 0);
  return { ...doc, nodes: normaliseZ(doc.nodes.map((n) => (n.id === id ? { ...n, z: min - 1 } : n))) };
}

/** Swap with the neighbour one step away in paint order, rather than
 *  nudging z by one -- after normalisation, +1 would land on an occupied
 *  slot and change nothing. */
function step(doc: CanvasDoc, id: string, dir: 1 | -1): CanvasDoc {
  const ordered = inPaintOrder(doc);
  const i = ordered.findIndex((n) => n.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ordered.length) return doc;
  const a = ordered[i]!;
  const b = ordered[j]!;
  return {
    ...doc,
    nodes: normaliseZ(
      doc.nodes.map((n) => (n.id === a.id ? { ...n, z: b.z } : n.id === b.id ? { ...n, z: a.z } : n)),
    ),
  };
}

export const bringForward = (doc: CanvasDoc, id: string) => step(doc, id, 1);
export const sendBackward = (doc: CanvasDoc, id: string) => step(doc, id, -1);

// ── add / remove / duplicate ─────────────────────────────────────────

/** Sensible starting size and content per element kind, so a dropped block
 *  is immediately legible instead of an empty 100x100 square. */
export const NODE_DEFAULTS: Record<NodeType, { size: Geometry; props: NodeProps; label: string }> = {
  heading: {
    size: { x: 0, y: 0, w: 520, h: 56 },
    props: { text: 'A heading', fontSize: 40, fontWeight: 700, lineHeight: 1.15 },
    label: 'Heading',
  },
  text: {
    size: { x: 0, y: 0, w: 440, h: 96 },
    props: { text: 'Write something here.', fontSize: 16, lineHeight: 1.6 },
    label: 'Text',
  },
  button: {
    size: { x: 0, y: 0, w: 190, h: 48 },
    props: { text: 'Book an appointment', fontSize: 15, fontWeight: 600, align: 'center', radius: 10 },
    label: 'Button',
  },
  image: {
    size: { x: 0, y: 0, w: 360, h: 240 },
    props: { alt: '', radius: 12 },
    label: 'Image',
  },
  box: {
    size: { x: 0, y: 0, w: 320, h: 200 },
    props: { radius: 16 },
    label: 'Box',
  },
  divider: {
    size: { x: 0, y: 0, w: 480, h: 2 },
    props: {},
    label: 'Divider',
  },
  bound: {
    size: { x: 0, y: 0, w: 1000, h: 420 },
    props: {},
    label: 'Clinic content',
  },
};

export function makeNode(type: NodeType, at: { x: number; y: number }, bp: Breakpoint, bind?: string): CanvasNode {
  const d = NODE_DEFAULTS[type];
  const desktopGeom: Geometry = { ...d.size, x: round(at.x), y: round(at.y) };
  // Added on the phone layout: fit the gutter rather than keep a width
  // meant for 1200px.
  const w = bp === 'mobile' ? Math.min(d.size.w, CANVAS_WIDTH.mobile - MOBILE_GUTTER * 2) : d.size.w;
  const geom: Geometry = { ...desktopGeom, w };
  return {
    id: newId(type[0]),
    type,
    z: 0,
    at: {
      desktop: bp === 'desktop' ? geom : { ...d.size, x: 0, y: round(at.y) },
      mobile: bp === 'mobile' ? { ...geom, x: round(at.x) } : { ...d.size, x: MOBILE_GUTTER, y: round(at.y), w: CANVAS_WIDTH.mobile - MOBILE_GUTTER * 2 },
    },
    pinned: bp === 'mobile' ? { mobile: true } : undefined,
    props: { ...d.props, ...(bind ? { bind } : {}) },
  };
}

export function addNode(doc: CanvasDoc, node: CanvasNode): CanvasDoc {
  const max = doc.nodes.reduce((m, n) => Math.max(m, n.z), -1);
  return { ...doc, nodes: normaliseZ([...doc.nodes, { ...node, z: max + 1 }]) };
}

export function removeNode(doc: CanvasDoc, id: string): CanvasDoc {
  const nodes = doc.nodes.filter((n) => n.id !== id);
  return nodes.length === doc.nodes.length ? doc : { ...doc, nodes: normaliseZ(nodes) };
}

/** Offset so the copy is visibly a copy and not hiding the original. */
const DUPLICATE_OFFSET = 16;

export function duplicateNode(doc: CanvasDoc, id: string): { doc: CanvasDoc; id: string | null } {
  const node = findNode(doc, id);
  if (!node) return { doc, id: null };
  const copy: CanvasNode = {
    ...node,
    id: newId(node.type[0]),
    at: {
      desktop: { ...node.at.desktop, x: node.at.desktop.x + DUPLICATE_OFFSET, y: node.at.desktop.y + DUPLICATE_OFFSET },
      mobile: { ...node.at.mobile, y: node.at.mobile.y + DUPLICATE_OFFSET },
    },
    props: { ...node.props },
  };
  return { doc: addNode(doc, copy), id: copy.id };
}

export function setProps(doc: CanvasDoc, id: string, patch: Partial<NodeProps>): CanvasDoc {
  return replaceNode(doc, id, (n) => ({ ...n, props: { ...n.props, ...patch } }));
}

// ── the phone layout, derived ────────────────────────────────────────

/**
 * Stack the desktop arrangement into one phone column, in reading order.
 *
 * This is the guardrail that makes a free canvas survive contact with a
 * phone. Reading order is top-to-bottom, and left-to-right for things on
 * roughly the same line -- `ROW_TOLERANCE` is what "roughly" means, since
 * two headings a doctor lined up by eye are never at the same y to the
 * pixel.
 *
 * Nodes whose phone geometry was set by hand are left exactly where they
 * were put, and they do not take part in the stacking; overriding somebody
 * who went to the phone layout and moved something is the one thing this
 * must not do.
 */
const ROW_TOLERANCE = 24;

export function deriveMobile(doc: CanvasDoc): CanvasDoc {
  const loose = doc.nodes.filter((n) => !n.pinned?.mobile);
  if (loose.length === 0) return doc;

  const ordered = [...loose].sort((a, b) => {
    const ga = a.at.desktop;
    const gb = b.at.desktop;
    if (Math.abs(ga.y - gb.y) > ROW_TOLERANCE) return ga.y - gb.y;
    return ga.x - gb.x;
  });

  const width = CANVAS_WIDTH.mobile - MOBILE_GUTTER * 2;
  const byId = new Map<string, Geometry>();
  let y = MOBILE_GAP;

  for (const n of ordered) {
    const d = n.at.desktop;
    let h = d.h;
    if (n.type === 'image' && d.w > 0) {
      // Keep the picture's shape. Stretching a photo to a new aspect ratio
      // is the most visible way an automatic layout looks broken.
      h = Math.round((d.h / d.w) * width);
    } else if (n.type === 'divider') {
      h = d.h;
    } else if (d.w > width) {
      // Narrower column means the same text needs more lines. Scaling the
      // height by the width ratio is an estimate, but an estimate that
      // leaves room is far better than a fixed height that clips.
      h = Math.max(d.h, Math.round(d.h * (d.w / width)));
    }
    byId.set(n.id, { x: MOBILE_GUTTER, y, w: width, h });
    y += h + MOBILE_GAP;
  }

  const pinnedBottom = doc.nodes
    .filter((n) => n.pinned?.mobile)
    .reduce((m, n) => Math.max(m, n.at.mobile.y + n.at.mobile.h), 0);

  return {
    ...doc,
    nodes: doc.nodes.map((n) => {
      const geom = byId.get(n.id);
      return geom ? { ...n, at: { ...n.at, mobile: geom } } : n;
    }),
    height: { ...doc.height, mobile: Math.max(y, pinnedBottom + MOBILE_GAP, 400) },
  };
}

/** Hand a node's phone geometry back to the derive step. */
export function unpinMobile(doc: CanvasDoc, id: string): CanvasDoc {
  return deriveMobile(
    replaceNode(doc, id, (n) => {
      const pinned = { ...n.pinned };
      delete pinned.mobile;
      return { ...n, pinned };
    }),
  );
}

/** The page has to be tall enough to contain what is on it, or the bottom
 *  of the last block is simply unreachable on the published site. */
export function fitHeight(doc: CanvasDoc, bp: Breakpoint): CanvasDoc {
  const bottom = doc.nodes.reduce((m, n) => {
    const g = geometryOf(n, bp);
    return Math.max(m, g.y + g.h);
  }, 0);
  const wanted = Math.max(Math.ceil((bottom + 40) / 20) * 20, bp === 'desktop' ? 600 : 400);
  return wanted === doc.height[bp] ? doc : { ...doc, height: { ...doc.height, [bp]: wanted } };
}

// ── hit testing ──────────────────────────────────────────────────────

/** The topmost node under a point, or null. Tested front-to-back so the
 *  box you can see is the box you select. */
export function nodeAt(doc: CanvasDoc, x: number, y: number, bp: Breakpoint): CanvasNode | null {
  for (const n of inHitOrder(doc)) {
    const g = geometryOf(n, bp);
    if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) return n;
  }
  return null;
}

// ── undo / redo ──────────────────────────────────────────────────────

/**
 * A bounded history of whole documents.
 *
 * Whole snapshots rather than inverse operations: a page is a few hundred
 * small objects, so a snapshot costs almost nothing, and the alternative
 * means writing and maintaining an exact inverse for every operation above
 * -- where one wrong inverse corrupts the document silently instead of
 * failing loudly. `LIMIT` exists so a long editing session cannot grow
 * without bound.
 *
 * A drag must call `commit` once when the pointer is released, not on every
 * pointermove, or a single drag across the page fills the whole history and
 * one Undo moves the box by three pixels.
 */
const LIMIT = 60;

export interface History {
  past: CanvasDoc[];
  present: CanvasDoc;
  future: CanvasDoc[];
}

export const initHistory = (doc: CanvasDoc): History => ({ past: [], present: doc, future: [] });

export function commit(h: History, next: CanvasDoc): History {
  if (next === h.present) return h;
  return {
    past: [...h.past, h.present].slice(-LIMIT),
    present: next,
    future: [],
  };
}

/** Change the document WITHOUT a history entry -- for the intermediate
 *  frames of a drag, which must be visible but must not be undoable. */
export const amend = (h: History, next: CanvasDoc): History => ({ ...h, present: next });

export function undo(h: History): History {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future].slice(0, LIMIT) };
}

export function redo(h: History): History {
  const next = h.future[0];
  if (next === undefined) return h;
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: h.future.slice(1) };
}

export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

// ── migration from the section-based site ────────────────────────────

/**
 * Turn the clinic's current section list into a canvas document.
 *
 * This exists so the free canvas is not a blank page. A doctor whose site
 * already works opens the canvas and finds their own site in it, laid out
 * full-width in the order they chose, ready to be pushed around -- rather
 * than an empty rectangle and the job of rebuilding what they had.
 *
 * Every section becomes a `bound` node, so the content still comes from
 * the clinic's records and nothing is copied into the page as frozen text.
 */
export function sectionsToCanvas(
  sections: Array<{ key: string; enabled: boolean; heading?: string }>,
  heights: Record<string, number> = {},
): CanvasDoc {
  const PAD = 24;
  const width = CANVAS_WIDTH.desktop - PAD * 2;
  let y = PAD;
  const nodes: CanvasNode[] = [];

  for (const s of sections) {
    if (!s.enabled) continue;
    const h = heights[s.key] ?? 360;
    nodes.push({
      id: newId('b'),
      type: 'bound',
      z: nodes.length,
      at: {
        desktop: { x: PAD, y, w: width, h },
        mobile: { x: MOBILE_GUTTER, y, w: CANVAS_WIDTH.mobile - MOBILE_GUTTER * 2, h },
      },
      props: { bind: s.key, ...(s.heading ? { text: s.heading } : {}) },
    });
    y += h + PAD;
  }

  return deriveMobile(fitHeight({ ...EMPTY_DOC, nodes }, 'desktop'));
}
