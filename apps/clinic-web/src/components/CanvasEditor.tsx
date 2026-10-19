import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Monitor, Redo2, Smartphone, Undo2, ZoomIn, ZoomOut, Plus, Eye, Globe, Info,
} from 'lucide-react';
import { Button } from './Button';
import { CanvasInspector, type GalleryPhoto } from './CanvasInspector';
import { BASIC_BLOCKS, CONTENT_BLOCKS, SECTION_LABELS, type PaletteItem } from '../lib/canvas-blocks';
import { NODE_DEFAULTS } from '../lib/canvas-doc';
import {
  CANVAS_WIDTH, EMPTY_DOC,
  addNode, amend, bringForward, canRedo, canUndo, commit, deriveMobile, duplicateNode,
  findNode, fitHeight, initHistory, inPaintOrder, makeNode, moveNode, nodeAt, redo,
  removeNode, resizeNode, sendBackward, sectionsToCanvas, setGeometry, setProps, undo,
  unpinMobile,
  type Breakpoint, type CanvasDoc, type Guide, type History, type ResizeHandle,
} from '../lib/canvas-doc';
import { apiFetch, ApiError } from '../lib/api';
import { brandingUrl } from '../pages/Settings';
import { publicSiteUrl } from '../lib/site-mode';
import { useToast } from './Toast';

/**
 * The free-canvas page editor.
 *
 * ── Why there is no canvas element here ─────────────────────────────
 *
 * The owner asked for a Figma-like canvas, so it is worth recording what
 * that does and does not mean. Figma genuinely draws to a <canvas> with a
 * WebGL/WebGPU renderer, because it is a drawing tool for arbitrary
 * vectors and the browser's layout engine is the wrong tool for that. The
 * price it pays is that a canvas holds shapes with no meaning -- nothing
 * in it knows "this is a button" -- which is exactly why Figma-to-code is
 * approximate.
 *
 * Website builders do the opposite. Wix's own documentation describes the
 * published site as ordinary DOM whose order follows the editor's visual
 * arrangement; Webflow, Framer and Builder.io all render real DOM and
 * persist a structured document. There is no convert-to-code step,
 * because there is nothing to convert: the editor and the published page
 * render the same document.
 *
 * So this editor renders real DOM, and the thing it edits is the
 * document. The page you are looking at IS the page that publishes.
 *
 * ── Why the preview is an iframe and the handles are not ────────────
 *
 * The frame renders the real public page, which is the property worth
 * protecting -- a preview drawn by separate code is free to disagree with
 * what gets published. But a pointer that starts inside an iframe keeps
 * sending its events to that frame, so the handles, the guides and the
 * drag all live out here in the parent document.
 *
 * Unlike the section builder, nothing has to be measured. There, the DOM
 * decided where each section landed and the frame had to report its
 * geometry back. Here the document holds the geometry, so the overlay
 * positions itself from the same numbers the frame is rendering from, and
 * the two cannot drift apart.
 */

const ZOOMS = [0.25, 0.4, 0.5, 0.75, 1];
/** Nudge distance for an arrow key, and with Shift held. */
const NUDGE = 1;
const NUDGE_FAST = 10;

type Drag =
  | { kind: 'move'; id: string; startX: number; startY: number; base: CanvasDoc; moved: boolean }
  | { kind: 'resize'; id: string; handle: ResizeHandle; startX: number; startY: number; base: CanvasDoc }
  | { kind: 'new'; item: PaletteItem; clientX: number; clientY: number };

interface Props {
  /** The clinic's current section list, so an empty canvas can be started
   *  from the site they already have rather than from nothing. */
  sections: Array<{ key: string; enabled: boolean; heading?: string }>;
}

export function CanvasEditor({ sections }: Props) {
  const toast = useToast();
  const [history, setHistory] = useState<History>(() => initHistory(EMPTY_DOC));
  const [live, setLive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [bp, setBp] = useState<Breakpoint>('desktop');
  const [zoom, setZoom] = useState(0.5);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);

  const surface = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const frameReady = useRef(false);

  const doc = history.present;
  const node = selected ? findNode(doc, selected) : undefined;

  // ── load ───────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch<{ canvas: CanvasDoc | null; layoutMode: string }>('/site/canvas')
      .then((res) => {
        if (res.canvas) setHistory(initHistory(res.canvas));
        setLive(res.layoutMode === 'canvas');
      })
      .catch(() => {
        // A failed load must not look like an empty page, or the first
        // save would overwrite a real document with nothing.
        toast.error('Could not load your layout. Reload before editing, so nothing is lost.');
      })
      .finally(() => setLoaded(true));
    // toast is stable; re-running this would refetch over local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The picture picker's options. Fetched here rather than in the
  // inspector so it is one request per editing session instead of one per
  // selection, and so the panel stays a pure view of the selected node.
  useEffect(() => {
    apiFetch<{ photos: GalleryPhoto[] }>('/gallery')
      .then((r) => setPhotos(r.photos ?? []))
      .catch(() => {
        // Not fatal. The picker then reads as "no photos yet", which is
        // also what an empty gallery looks like, and the rest of the
        // editor is unaffected.
      });
  }, []);

  // ── push the document into the frame ───────────────────────────────
  const post = useCallback((d: CanvasDoc) => {
    if (!frameReady.current) return;
    frame.current?.contentWindow?.postMessage(
      // Rides the config channel the section builder already uses, which
      // merges a Partial<Clinic> -- so the public page needed no new
      // message type to render a canvas.
      { type: 'clinic-preview', config: { publicLayoutMode: 'canvas', publicCanvas: d } },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type === 'clinic-preview-ready') {
        frameReady.current = true;
        post(doc);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [doc, post]);

  useEffect(() => { post(doc); }, [doc, post]);

  // ── edit helpers ───────────────────────────────────────────────────
  /** A finished edit: one history step. */
  const change = useCallback((next: CanvasDoc) => {
    setHistory((h) => commit(h, fitHeight(next, 'desktop')));
    setDirty(true);
  }, []);

  /** A frame of a drag: visible, but not its own undo step. */
  const sketch = useCallback((next: CanvasDoc) => {
    setHistory((h) => amend(h, next));
    setDirty(true);
  }, []);

  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const box = surface.current?.getBoundingClientRect();
    if (!box) return null;
    return { x: (clientX - box.left) / zoom, y: (clientY - box.top) / zoom };
  }, [zoom]);

  // ── pointer: the whole drag lives on the window ────────────────────
  //
  // On the window rather than the surface, because a drag that leaves the
  // canvas -- over a panel, or off the top -- must still be tracked and
  // must still end. A listener on the surface simply stops firing and
  // leaves the drag stuck on.
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      if (drag.kind === 'new') {
        setDrag({ ...drag, clientX: e.clientX, clientY: e.clientY });
        return;
      }
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      // Applied to the document as it was when the drag STARTED, not
      // cumulatively to the current one: re-applying a delta to an
      // already-moved box compounds rounding every frame and makes a slow
      // drag creep away from the pointer.
      const result = drag.kind === 'move'
        ? moveNode(drag.base, drag.id, dx, dy, bp)
        : resizeNode(drag.base, drag.id, drag.handle, dx, dy, bp);
      setGuides(result.guides);
      sketch(result.doc);
      if (drag.kind === 'move' && !drag.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        setDrag({ ...drag, moved: true });
      }
    };

    const onUp = (e: PointerEvent) => {
      setGuides([]);
      if (drag.kind === 'new') {
        const at = clientToCanvas(e.clientX, e.clientY);
        if (at && at.x >= 0 && at.y >= 0 && at.x <= CANVAS_WIDTH[bp]) {
          const created = makeNode(drag.item.type, at, bp, drag.item.bind);
          change(addNode(doc, created));
          setSelected(created.id);
        }
      } else {
        // One history entry for the whole gesture.
        setHistory((h) => commit({ ...h, present: drag.base }, h.present));
      }
      setDrag(null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Abandon: put the document back as it was before the gesture.
      if (drag.kind !== 'new') setHistory((h) => amend(h, drag.base));
      setGuides([]);
      setDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [drag, zoom, bp, doc, sketch, change, clientToCanvas]);

  // ── keyboard ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never steal a key from a field someone is typing in.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
        setDirty(true);
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setHistory(redo);
        setDirty(true);
        return;
      }
      if (!selected) return;
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const r = duplicateNode(doc, selected);
        change(r.doc);
        if (r.id) setSelected(r.id);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        change(removeNode(doc, selected));
        setSelected(null);
        return;
      }
      if (e.key === 'Escape') { setSelected(null); setEditing(null); return; }

      const step = e.shiftKey ? NUDGE_FAST : NUDGE;
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      const d = nudge[e.key];
      if (d) {
        e.preventDefault();
        // Snapping off for a keyboard nudge: the point of pressing an
        // arrow key is to move by exactly one pixel, and a snap would
        // swallow it.
        change(moveNode(doc, selected, d[0], d[1], bp, { snap: false }).doc);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, doc, bp, change]);

  // ── save ───────────────────────────────────────────────────────────
  const save = async (publish?: boolean) => {
    setSaving(true);
    try {
      // The phone layout is derived at save time, so a clinic that never
      // opens the phone view still publishes something that works on one.
      const payload: { canvas: CanvasDoc; layoutMode?: 'canvas' | 'sections' } = {
        canvas: fitHeight(deriveMobile(fitHeight(doc, 'desktop')), 'mobile'),
      };
      if (publish !== undefined) payload.layoutMode = publish ? 'canvas' : 'sections';
      const res = await apiFetch<{ canvas: CanvasDoc | null; layoutMode: string }>('/site/canvas', {
        method: 'PUT',
        data: payload,
      });
      if (res.canvas) setHistory((h) => ({ ...h, present: res.canvas! }));
      setLive(res.layoutMode === 'canvas');
      setDirty(false);
      toast.success(
        publish === true ? 'Your new layout is live for patients.'
          : publish === false ? 'Patients are back on the stacked page.'
          : 'Layout saved. Patients still see the page that is live.',
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save the layout.');
    } finally {
      setSaving(false);
    }
  };

  const startFromSite = () => {
    change(sectionsToCanvas(sections.filter((s) => s.enabled)));
    toast.success('Your current page is on the canvas. Drag anything to move it.');
  };

  const width = CANVAS_WIDTH[bp];
  const height = doc.height[bp];
  const painted = useMemo(() => inPaintOrder(doc), [doc]);

  if (!loaded) {
    return <div className="p-8 text-sm text-muted-foreground">Loading your layout…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/10 bg-card p-2 shadow-card">
        <div className="flex items-center rounded-lg bg-foreground/5 p-0.5">
          {([['desktop', Monitor, 'Computer'], ['mobile', Smartphone, 'Phone']] as const).map(([k, Icon, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setBp(k); setSelected(null); }}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                bp === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} aria-hidden /> {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          <ToolBtn
            title="Zoom out"
            disabled={zoom <= ZOOMS[0]!}
            onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)] ?? z)}
          >
            <ZoomOut size={14} />
          </ToolBtn>
          <span className="w-12 text-center text-[11px] tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <ToolBtn
            title="Zoom in"
            disabled={zoom >= ZOOMS[ZOOMS.length - 1]!}
            onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)] ?? z)}
          >
            <ZoomIn size={14} />
          </ToolBtn>
        </div>

        <div className="flex items-center gap-0.5">
          <ToolBtn title="Undo (Ctrl+Z)" disabled={!canUndo(history)} onClick={() => { setHistory(undo); setDirty(true); }}>
            <Undo2 size={14} />
          </ToolBtn>
          <ToolBtn title="Redo (Ctrl+Shift+Z)" disabled={!canRedo(history)} onClick={() => { setHistory(redo); setDirty(true); }}>
            <Redo2 size={14} />
          </ToolBtn>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {live ? (
            <span className="tone-success flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium">
              <Globe size={11} aria-hidden /> This layout is live
            </span>
          ) : (
            <span className="tone-neutral flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium">
              <Eye size={11} aria-hidden /> Draft — patients see the stacked page
            </span>
          )}
          <Button variant="ghost" size="sm" busy={saving} onClick={() => save()}>
            Save draft
          </Button>
          {live ? (
            <Button variant="ghost" size="sm" busy={saving} onClick={() => save(false)}>
              Switch patients back
            </Button>
          ) : (
            <Button size="sm" busy={saving} disabled={doc.nodes.length === 0} onClick={() => save(true)}>
              Make this the live page
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        {/* ── Palette ───────────────────────────────────────────────── */}
        <aside className="w-48 shrink-0 space-y-4">
          <PaletteGroup
            title="Add to the page"
            hint="Drag onto the page, or click to drop it in."
            items={BASIC_BLOCKS}
            onPick={(item) => addAt(item)}
            onDragStart={(item, e) => setDrag({ kind: 'new', item, clientX: e.clientX, clientY: e.clientY })}
          />
          <PaletteGroup
            title="Your clinic's content"
            hint="These fill themselves in from your records and stay up to date."
            items={CONTENT_BLOCKS}
            onPick={(item) => addAt(item)}
            onDragStart={(item, e) => setDrag({ kind: 'new', item, clientX: e.clientX, clientY: e.clientY })}
          />
        </aside>

        {/* ── Canvas ────────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {doc.nodes.length === 0 ? (
            <EmptyCanvas onStart={startFromSite} />
          ) : null}

          <div className="overflow-auto rounded-xl border border-border/10 bg-foreground/[0.03] p-6">
            <div
              className="relative mx-auto"
              style={{ width: width * zoom, height: height * zoom }}
            >
              <iframe
                ref={frame}
                src={publicSiteUrl('/')}
                title="Your website"
                className="absolute left-0 top-0 origin-top-left border-0 bg-white"
                style={{ width, height, transform: `scale(${zoom})` }}
              />

              {/* The interaction surface. Same coordinates as the frame,
                  because both are driven by the same document. */}
              <div
                ref={surface}
                className="absolute left-0 top-0"
                style={{ width: width * zoom, height: height * zoom }}
                onPointerDown={(e) => {
                  if (e.target !== surface.current) return;
                  const at = clientToCanvas(e.clientX, e.clientY);
                  const hit = at ? nodeAt(doc, at.x, at.y, bp) : null;
                  if (hit) {
                    setSelected(hit.id);
                    setDrag({ kind: 'move', id: hit.id, startX: e.clientX, startY: e.clientY, base: doc, moved: false });
                  } else {
                    setSelected(null);
                    setEditing(null);
                  }
                }}
                onDoubleClick={(e) => {
                  const at = clientToCanvas(e.clientX, e.clientY);
                  const hit = at ? nodeAt(doc, at.x, at.y, bp) : null;
                  if (hit && (hit.type === 'text' || hit.type === 'heading' || hit.type === 'button')) {
                    setSelected(hit.id);
                    setEditing(hit.id);
                  }
                }}
              >
                {painted.map((n) => {
                  const g = n.at[bp];
                  const isSel = n.id === selected;
                  const label = n.type === 'bound'
                    ? (SECTION_LABELS[n.props.bind ?? ''] ?? 'Clinic content')
                    : NODE_DEFAULTS[n.type].label;
                  return (
                    <div
                      key={n.id}
                      className={`group absolute ${isSel ? 'z-20' : 'z-10'}`}
                      style={{ left: g.x * zoom, top: g.y * zoom, width: g.w * zoom, height: g.h * zoom }}
                    >
                      <div
                        className={`pointer-events-none absolute inset-0 border transition-colors ${
                          isSel ? 'border-primary' : 'border-transparent group-hover:border-primary/40'
                        }`}
                      />

                      {/*
                        An image block with no picture yet.

                        The frame underneath draws nothing for it, because
                        the published page must not show a patient an
                        unfinished placeholder. That left the block
                        genuinely invisible here too -- occupying space,
                        selectable only by guessing where it was. This
                        placeholder exists only in the editor, so the block
                        is findable and says what it needs.
                      */}
                      {n.type === 'image' && !n.props.src && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-sm border-2 border-dashed border-primary/40 bg-primary/5">
                          <span className="px-2 text-center text-[11px] font-medium text-primary">
                            Pick a picture →
                          </span>
                        </div>
                      )}
                      <span
                        className={`pointer-events-none absolute -top-[18px] left-0 whitespace-nowrap rounded-t px-1.5 text-[10px] font-medium transition-opacity ${
                          isSel
                            ? 'bg-primary text-primary-foreground opacity-100'
                            : 'bg-primary/80 text-primary-foreground opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {label}
                      </span>
                      {isSel && <Handles onGrab={(handle, e) => setDrag({
                        kind: 'resize', id: n.id, handle, startX: e.clientX, startY: e.clientY, base: doc,
                      })} />}
                    </div>
                  );
                })}

                {/* Alignment guides, drawn from the same matches the snap
                    used rather than recomputed -- so the line you see is
                    the line it snapped to. */}
                {guides.map((gd, i) => (
                  <div
                    key={`${gd.axis}${gd.at}${i}`}
                    className={`pointer-events-none absolute z-30 ${gd.kind === 'canvas' ? 'bg-ink-violet' : 'bg-ink-pink'}`}
                    style={
                      gd.axis === 'x'
                        ? { left: gd.at * zoom, top: 0, width: 1, height: '100%' }
                        : { top: gd.at * zoom, left: 0, height: 1, width: '100%' }
                    }
                  />
                ))}

                {/* In-place text editing. An overlaid field rather than a
                    contentEditable inside the frame: a caret cannot cross
                    a frame boundary, and this keeps every keystroke in the
                    document the editor owns. */}
                {editing && node && (node.type === 'text' || node.type === 'heading' || node.type === 'button') && (
                  <textarea
                    autoFocus
                    value={node.props.text ?? ''}
                    onChange={(e) => sketch(setProps(doc, node.id, { text: e.target.value }))}
                    onBlur={() => { change(doc); setEditing(null); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { e.currentTarget.blur(); }
                      // Enter commits on a button or a heading, where a
                      // newline is never what was meant.
                      if (e.key === 'Enter' && node.type !== 'text') {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    className="absolute z-40 resize-none rounded-sm border-2 border-primary bg-white p-0 text-slate-900 outline-none"
                    style={{
                      left: node.at[bp].x * zoom,
                      top: node.at[bp].y * zoom,
                      width: node.at[bp].w * zoom,
                      height: node.at[bp].h * zoom,
                      fontSize: (node.props.fontSize ?? 16) * zoom,
                      fontWeight: node.props.fontWeight,
                      textAlign: node.props.align,
                      lineHeight: node.props.lineHeight ?? 1.4,
                    }}
                  />
                )}
              </div>

              {/* The ghost of a block being dragged in from the palette. */}
              {drag?.kind === 'new' && (
                <div
                  className="pointer-events-none fixed z-50 rounded-md border-2 border-dashed border-primary bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"
                  style={{ left: drag.clientX + 8, top: drag.clientY + 8 }}
                >
                  {drag.item.label}
                </div>
              )}
            </div>
          </div>

          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <Info size={12} className="mt-px shrink-0" aria-hidden />
            Drag to move, pull a corner to resize, double-click words to rewrite them.
            Arrow keys nudge by one pixel, Ctrl+Z undoes. Nothing reaches patients until
            you choose to make it live.
          </p>
        </div>

        {/* ── Inspector ─────────────────────────────────────────────── */}
        <aside className="w-60 shrink-0">
          <div className="rounded-xl border border-border/10 bg-card p-3 shadow-card">
            {node ? (
              <CanvasInspector
                node={node}
                bp={bp}
                photos={photos}
                assetUrl={brandingUrl}
                onGeometry={(patch) => change(setGeometry(doc, node.id, patch, bp))}
                onProps={(patch) => change(setProps(doc, node.id, patch))}
                onDelete={() => { change(removeNode(doc, node.id)); setSelected(null); }}
                onDuplicate={() => {
                  const r = duplicateNode(doc, node.id);
                  change(r.doc);
                  if (r.id) setSelected(r.id);
                }}
                onForward={() => change(bringForward(doc, node.id))}
                onBackward={() => change(sendBackward(doc, node.id))}
                onUnpinMobile={() => change(unpinMobile(doc, node.id))}
              />
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Click anything on the page to change it, or drag a block in from the left.
              </p>
            )}
          </div>
          {dirty && (
            <p className="mt-2 text-[11px] leading-relaxed text-ink-warning">
              Unsaved changes.
            </p>
          )}
        </aside>
      </div>
    </div>
  );

  /** Click-to-add, for anyone who does not discover dragging. Dropped
   *  below everything already on the page, so it is never hidden under
   *  another block. */
  function addAt(item: PaletteItem) {
    const bottom = doc.nodes.reduce((m, n) => Math.max(m, n.at[bp].y + n.at[bp].h), 0);
    const created = makeNode(item.type, { x: bp === 'mobile' ? 16 : 40, y: bottom + 24 }, bp, item.bind);
    change(addNode(doc, created));
    setSelected(created.id);
  }
}

// ── pieces ───────────────────────────────────────────────────────────

const HANDLES: Array<{ h: ResizeHandle; cls: string; cursor: string }> = [
  { h: 'nw', cls: '-left-1 -top-1', cursor: 'nwse-resize' },
  { h: 'n', cls: 'left-1/2 -top-1 -translate-x-1/2', cursor: 'ns-resize' },
  { h: 'ne', cls: '-right-1 -top-1', cursor: 'nesw-resize' },
  { h: 'e', cls: '-right-1 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { h: 'se', cls: '-right-1 -bottom-1', cursor: 'nwse-resize' },
  { h: 's', cls: 'left-1/2 -bottom-1 -translate-x-1/2', cursor: 'ns-resize' },
  { h: 'sw', cls: '-left-1 -bottom-1', cursor: 'nesw-resize' },
  { h: 'w', cls: '-left-1 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
];

function Handles({ onGrab }: { onGrab: (h: ResizeHandle, e: React.PointerEvent) => void }) {
  return (
    <>
      {HANDLES.map(({ h, cls, cursor }) => (
        <span
          key={h}
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onGrab(h, e); }}
          style={{ cursor }}
          // 10px, not the 6px the dot looks like: a handle you cannot hit
          // is the single most common reason a resize feels broken.
          className={`absolute z-30 h-2.5 w-2.5 rounded-full border border-white bg-primary shadow-card ${cls}`}
        />
      ))}
    </>
  );
}

function PaletteGroup({
  title, hint, items, onPick, onDragStart,
}: {
  title: string;
  hint: string;
  items: PaletteItem[];
  onPick: (item: PaletteItem) => void;
  onDragStart: (item: PaletteItem, e: React.PointerEvent) => void;
}) {
  return (
    <div className="rounded-xl border border-border/10 bg-card p-3 shadow-card">
      <h3 className="text-xs font-semibold">{title}</h3>
      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{hint}</p>
      <div className="mt-2 flex flex-col gap-1">
        {items.map((item) => (
          <button
            key={item.bind ?? item.type}
            type="button"
            title={item.hint}
            onPointerDown={(e) => onDragStart(item, e)}
            onClick={() => onPick(item)}
            className="flex cursor-grab items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors hover:bg-foreground/[0.06] active:cursor-grabbing"
          >
            <Plus size={11} className="shrink-0 text-muted-foreground/60" aria-hidden />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyCanvas({ onStart }: { onStart: () => void }) {
  return (
    <div className="mb-3 rounded-xl border border-border/10 bg-card p-5 shadow-card">
      <h3 className="text-sm font-semibold">Start from the site you already have</h3>
      <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
        This puts your current page onto the canvas exactly as it is now — your about
        text, your services, your doctors — and then you can drag any of it anywhere.
        Nothing patients see changes until you choose to make the new layout live.
      </p>
      <Button size="sm" className="mt-3" onClick={onStart}>
        Put my current page on the canvas
      </Button>
    </div>
  );
}

function ToolBtn({
  children, title, onClick, disabled,
}: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
